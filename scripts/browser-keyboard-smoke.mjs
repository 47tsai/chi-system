import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const sitesDir = path.join(ROOT, 'sites');
const browserCandidates = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
const browser = browserCandidates.find((candidate) => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
if (!browser) {
  console.log('Browser keyboard smoke skipped: Chrome/Chromium is not installed.');
  process.exit(0);
}

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = path.resolve(DIST, '.' + pathname);
  if (!target.startsWith(DIST + path.sep)) return response.writeHead(403).end();
  try {
    if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
    response.setHeader('content-type', path.extname(target) === '.html' ? 'text/html' : path.extname(target) === '.css' ? 'text/css' : 'text/javascript');
    response.end(readFileSync(target));
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const sites = readdirSync(sitesDir).filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -5));
const viewports = [{ name: 'desktop', width: 1365, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const failures = [];
let passed = 0;

async function waitFor(predicate, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for Chrome DevTools');
}

try {
  for (const siteId of sites) {
    for (const viewport of viewports) {
      const profile = await mkdtemp(path.join(os.tmpdir(), 'chi-cdp-'));
      const child = spawn(browser, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
        `--user-data-dir=${profile}`, 'about:blank',
      ], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, DISPLAY: '' } });
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      let socket;
      try {
        const activePortFile = path.join(profile, 'DevToolsActivePort');
        const port = await waitFor(async () => {
          try { return Number((await readFile(activePortFile, 'utf8')).split('\n')[0]); } catch { return null; }
        });
        const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${origin}/sites/${siteId}/index.html`)}`, { method: 'PUT' })).json();
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
          const id = ++nextId;
          pending.set(id, { resolve, reject });
          socket.send(JSON.stringify({ id, method, params }));
        });
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.name === 'mobile' });
        const pageUrl = `${origin}/sites/${siteId}/index.html`;
        await send('Page.navigate', { url: pageUrl });
        await waitFor(async () => {
          const result = await send('Runtime.evaluate', { expression: `location.href === ${JSON.stringify(pageUrl)} && document.readyState === 'complete'`, returnByValue: true });
          return result.result.value === true;
        });
        const setup = await send('Runtime.evaluate', { expression: `(() => {
          const button = document.createElement('button');
          button.id = 'chi-cdp-keyboard-target';
          button.type = 'button';
          button.className = 'chi-btn';
          button.textContent = 'Keyboard focus test';
          button.style.position = 'fixed';
          button.style.left = '8px';
          button.style.top = '8px';
          document.body.prepend(button);
          for (const item of document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')) {
            if (item !== button) item.setAttribute('tabindex', '-1');
          }
          document.activeElement?.blur?.();
          return true;
        })()`, returnByValue: true });
        if (!setup.result.value) throw new Error('Could not install keyboard fixture');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
        const check = await send('Runtime.evaluate', { expression: `(() => {
          const target = document.getElementById('chi-cdp-keyboard-target');
          const style = getComputedStyle(target);
          return {
            focused: document.activeElement === target,
            focusVisible: target.matches(':focus-visible'),
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            outlineColor: style.outlineColor,
            activeId: document.activeElement?.id,
            activeTag: document.activeElement?.tagName,
            href: location.href
          };
        })()`, returnByValue: true });
        const result = check.result.value;
        const ok = result.focused && result.focusVisible && result.outlineStyle !== 'none' && result.outlineWidth !== '0px';
        if (ok) passed++;
        else failures.push({ site: siteId, viewport: viewport.name, result, stderr: stderr.slice(-1500) });
        console.log(`${ok ? 'PASS' : 'FAIL'} ${siteId} ${viewport.name} real Tab → :focus-visible ${JSON.stringify(result)}`);
      } catch (error) {
        failures.push({ site: siteId, viewport: viewport.name, error: String(error), stderr: stderr.slice(-1500) });
        console.log(`FAIL ${siteId} ${viewport.name} ${String(error)}`);
      } finally {
        try { socket?.close(); } catch {}
        child.kill('SIGKILL');
        await new Promise((resolve) => child.once('close', resolve));
        await rm(profile, { recursive: true, force: true });
      }
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
console.log(`Chrome real-keyboard focus smoke: ${passed}/${sites.length * viewports.length} site/viewport combinations passed.`);
if (failures.length) {
  for (const failure of failures) console.error(JSON.stringify(failure));
  process.exitCode = 1;
}
