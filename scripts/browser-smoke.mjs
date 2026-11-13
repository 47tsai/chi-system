import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const sitesDir = path.join(ROOT, 'sites');
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
};

function findBrowser() {
  const candidates = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) return candidate;
  }
  return null;
}

const browser = findBrowser();
if (!browser) {
  console.log('Browser smoke skipped: Chrome/Chromium is not installed.');
  process.exit(0);
}

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = path.resolve(DIST, '.' + pathname);
  if (!target.startsWith(DIST + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
    response.setHeader('content-type', mimeTypes[path.extname(target)] || 'application/octet-stream');
    response.end(readFileSync(target));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const origin = `http://127.0.0.1:${server.address().port}`;
const sites = readdirSync(sitesDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.slice(0, -5));
const viewports = [
  { name: 'desktop', size: '1365,900' },
  { name: 'mobile', size: '390,844' },
];
const failures = [];
let passed = 0;

try {
  for (const siteId of sites) {
    const site = JSON.parse(readFileSync(path.join(sitesDir, siteId + '.json'), 'utf8'));
    const expectedLayout = site.layout || 'header';
    for (const viewport of viewports) {
      const url = `${origin}/sites/${siteId}/index.html`;
      const child = spawn(browser, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--no-first-run', '--no-default-browser-check', '--enable-logging=stderr',
        '--log-level=0', '--virtual-time-budget=1800', `--window-size=${viewport.size}`,
        '--dump-dom', url,
      ], { env: { ...process.env, DISPLAY: '' } });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      const exitCode = await new Promise((resolve) => {
        const timeout = setTimeout(() => child.kill('SIGKILL'), 30000);
        child.once('close', (code) => {
          clearTimeout(timeout);
          resolve(code);
        });
      });

      const layout = stdout.match(/<html\b[^>]*data-chi-layout="([^"]+)"/)?.[1];
      const browserErrors = stderr.split('\n').filter((line) => /ERROR:CONSOLE|Failed to load resource|net::ERR_/i.test(line));
      const issues = [];
      if (exitCode !== 0) issues.push(`Chrome exited with ${exitCode}`);
      if (!stdout.includes('</html>')) issues.push('DOM did not finish loading');
      if (layout !== expectedLayout) issues.push(`expected layout ${expectedLayout}, received ${layout || 'missing'}`);
      if (browserErrors.length) issues.push(...browserErrors);
      if (issues.length) failures.push({ site: siteId, viewport: viewport.name, issues });
      else passed++;
      console.log(`${issues.length ? 'FAIL' : 'PASS'} ${siteId} ${viewport.name}`);
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(`Chrome smoke: ${passed}/${sites.length * viewports.length} site/viewport combinations passed.`);
if (failures.length) {
  for (const failure of failures) console.error(JSON.stringify(failure));
  process.exitCode = 1;
}