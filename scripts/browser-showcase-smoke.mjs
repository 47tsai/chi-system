import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const browser = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)
  .find((candidate) => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
if (!browser) {
  console.log('Component showcase smoke skipped: Chrome/Chromium is not installed.');
  process.exit(0);
}

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const target = path.resolve(ROOT, '.' + pathname);
  if (!target.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
  try {
    if (statSync(target).isDirectory()) return response.writeHead(404).end();
    response.setHeader('content-type', MIME[path.extname(target)] || 'application/octet-stream');
    response.end(readFileSync(target));
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const brands = ['chi', 'fg', 'h', 'merch', 'nav', 'status'];
const themes = ['light', 'dark'];
const viewports = [{ name: 'mobile', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 900 }, { name: 'desktop', width: 1365, height: 900 }];
const failures = [];
let passed = 0;

async function waitFor(predicate, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for Chrome DevTools');
}

try {
  for (const brand of brands) {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'chi-showcase-cdp-'));
    const child = spawn(browser, ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], { stdio: ['ignore','ignore','pipe'], env: { ...process.env, DISPLAY: '' } });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    let socket;
    try {
      const portFile = path.join(profile, 'DevToolsActivePort');
      const port = await waitFor(async () => { try { return Number((await readFile(portFile, 'utf8')).split('\n')[0]); } catch { return null; } });
      const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${origin}/preview/components.html?brand=${brand}`)}`, { method: 'PUT' })).json();
      socket = new WebSocket(target.webSocketDebuggerUrl);
      await waitFor(() => socket.readyState === WebSocket.OPEN);
      let nextId = 0;
      const pending = new Map();
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
          const { resolve, reject } = pending.get(message.id);
          pending.delete(message.id);
          if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
        }
      });
      const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
      });
      const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
      await send('Page.enable'); await send('Runtime.enable');
      await send('Page.navigate', { url: `${origin}/preview/components.html?brand=${brand}` });
      await waitFor(async () => await evaluate(`document.readyState === 'complete' && !!window.ChiTheme && !!window.ChiTabs && !!window.ChiDialog`));
      await evaluate(`window.ChiTabs.initAll(); window.ChiDialog.initAll(); document.getElementById('brand-select').value = ${JSON.stringify(brand)}; true`);
      for (const theme of themes) for (const viewport of viewports) {
        await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.name === 'mobile' });
        const result = await evaluate(`(() => {
          window.ChiTheme.setPreviewMode(${JSON.stringify(theme)});
          const checks = {
            brand: document.documentElement.getAttribute('data-chi-brand') === ${JSON.stringify(brand)},
            theme: document.documentElement.getAttribute('data-chi-theme') === ${JSON.stringify(theme)},
            sections: ['buttons-title','badges-title','form-title','tabs-title','card-title','list-title','table-title','state-title','dialog-title'].every((id) => !!document.getElementById(id)),
            buttonStyle: getComputedStyle(document.querySelector('.chi-btn--primary')).backgroundColor !== 'rgba(0, 0, 0, 0)',
            fieldStyle: getComputedStyle(document.querySelector('.chi-input')).borderTopLeftRadius !== '0px',
            tabsRuntime: document.querySelector('[data-chi-tabs]').getAttribute('data-chi-tabs-initialized') === 'true',
            dialogNative: typeof document.getElementById('showcase-dialog').showModal === 'function',
            noOverflow: document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth,
          };
          const select = document.getElementById('showcase-select'); select.selectedIndex = 1;
          checks.selectInteractive = select.selectedIndex === 1;
          document.getElementById('showcase-form').requestSubmit();
          checks.formFeedback = document.getElementById('showcase-form-status').textContent === '表單互動正常。';
          return checks;
        })()`);
        const issues = Object.entries(result || {}).filter(([, ok]) => !ok).map(([name]) => name);
        if (issues.length) failures.push({ brand, theme, viewport: viewport.name, issues, stderr: stderr.slice(-500) }); else passed++;
        console.log(`${issues.length ? 'FAIL' : 'PASS'} ${brand} ${theme} ${viewport.name}${issues.length ? ` [${issues.join(',')}]` : ''}`);
      }
    } catch (error) {
      failures.push({ brand, error: String(error), stderr: stderr.slice(-1000) });
      console.log(`FAIL ${brand} ${String(error)}`);
    } finally {
      try { socket?.close(); } catch {}
      child.kill('SIGKILL');
      await new Promise((resolve) => child.once('close', resolve));
      await rm(profile, { recursive: true, force: true });
    }
  }
} finally { await new Promise((resolve) => server.close(resolve)); }
console.log(`Chrome component showcase smoke: ${passed}/${brands.length * themes.length * viewports.length} brand/theme/viewport combinations passed.`);
if (failures.length) { for (const failure of failures) console.error(JSON.stringify(failure)); process.exitCode = 1; }
