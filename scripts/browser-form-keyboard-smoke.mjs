import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const sitesDir = path.join(ROOT, 'sites');
const browser = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)
  .find((candidate) => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
if (!browser) {
  console.log('Form keyboard smoke skipped: Chrome/Chromium is not installed.');
  process.exit(0);
}

const fixture = `
<section id="chi-form-keyboard-fixture">
  <form id="chi-form-keyboard-form" novalidate>
    <label for="chi-form-keyboard-email">Email</label>
    <input class="chi-input" id="chi-form-keyboard-email" type="email" required>
    <label for="chi-form-keyboard-select">Frequency</label>
    <select class="chi-select" id="chi-form-keyboard-select"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
    <label class="chi-check"><input class="chi-check__input" id="chi-form-keyboard-check" type="checkbox">Email notices</label>
    <fieldset><legend>Channel</legend>
      <label class="chi-radio"><input class="chi-radio__input" id="chi-form-keyboard-radio-email" type="radio" name="channel" value="email" checked>Email</label>
      <label class="chi-radio"><input class="chi-radio__input" id="chi-form-keyboard-radio-sms" type="radio" name="channel" value="sms">SMS</label>
    </fieldset>
    <button class="chi-btn chi-btn--primary" id="chi-form-keyboard-submit" type="submit">Submit</button>
  </form>
</section>`;

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = path.resolve(DIST, '.' + pathname);
  if (!target.startsWith(DIST + path.sep)) return response.writeHead(403).end();
  try {
    if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
    response.setHeader('content-type', path.extname(target) === '.html' ? 'text/html' : path.extname(target) === '.css' ? 'text/css' : 'text/javascript');
    let body = readFileSync(target);
    if (path.extname(target) === '.html' && target.startsWith(path.join(DIST, 'sites') + path.sep)) {
      body = Buffer.from(body.toString('utf8').replace('</body>', fixture + '</body>'));
    }
    response.end(body);
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
  for (const site of sites) for (const viewport of viewports) {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'chi-form-cdp-'));
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
      const pageUrl = `${origin}/sites/${site}/index.html`;
      const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(pageUrl)}`, { method: 'PUT' })).json();
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
      await send('Page.navigate', { url: pageUrl });
      await waitFor(async () => {
        const result = await send('Runtime.evaluate', { expression: `location.href === ${JSON.stringify(pageUrl)} && document.readyState === 'complete'`, returnByValue: true });
        return result.result.value === true;
      });
      const setup = await send('Runtime.evaluate', { expression: `(() => {
        const form = document.getElementById('chi-form-keyboard-form');
        window.__chiFormSubmitCount = 0;
        form.addEventListener('submit', (event) => { event.preventDefault(); window.__chiFormSubmitCount++; });
        document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]').forEach((node) => node.setAttribute('tabindex', '-1'));
        for (const id of ['chi-form-keyboard-email','chi-form-keyboard-select','chi-form-keyboard-check','chi-form-keyboard-radio-email','chi-form-keyboard-radio-sms','chi-form-keyboard-submit']) {
          document.getElementById(id).removeAttribute('tabindex');
        }
        document.activeElement?.blur?.();
        return true;
      })()`, returnByValue: true });
      if (!setup.result.value) throw new Error('Could not install form keyboard fixture');
      const key = async (name, code, keyCode) => {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
      };
      const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
      await key('Tab', 'Tab', 9);
      const emailFocused = await evaluate(`document.activeElement.id === 'chi-form-keyboard-email' && document.activeElement.matches(':focus-visible')`);
      await send('Input.insertText', { text: 'chi@example.com' });
      await key('Tab', 'Tab', 9);
      const selectFocused = await evaluate(`document.activeElement.id === 'chi-form-keyboard-select'`);
      await key('ArrowDown', 'ArrowDown', 40);
      const selectChanged = await evaluate(`document.getElementById('chi-form-keyboard-select').value === 'weekly'`);
      await key('Tab', 'Tab', 9);
      const checkboxFocused = await evaluate(`document.activeElement.id === 'chi-form-keyboard-check'`);
      await key(' ', 'Space', 32);
      const checkboxChecked = await evaluate(`document.getElementById('chi-form-keyboard-check').checked`);
      await key('Tab', 'Tab', 9);
      const radioFocused = await evaluate(`document.activeElement.id === 'chi-form-keyboard-radio-email'`);
      await key('ArrowRight', 'ArrowRight', 39);
      const radioChanged = await evaluate(`document.getElementById('chi-form-keyboard-radio-sms').checked && document.activeElement.id === 'chi-form-keyboard-radio-sms'`);
      await key('Tab', 'Tab', 9);
      const submitFocused = await evaluate(`document.activeElement.id === 'chi-form-keyboard-submit'`);
      await key('Enter', 'Enter', 13);
      const submitState = await evaluate(`({ count: window.__chiFormSubmitCount, active: document.activeElement.id, valid: document.getElementById('chi-form-keyboard-form').checkValidity(), type: document.getElementById('chi-form-keyboard-submit').type })`);
      const submitted = submitState.count === 1;
      const result = { emailFocused, selectFocused, selectChanged, checkboxFocused, checkboxChecked, radioFocused, radioChanged, submitFocused, submitted, submitState };
      const ok = Object.values(result).every(Boolean);
      if (ok) passed++;
      else failures.push({ site, viewport: viewport.name, result, stderr: stderr.slice(-1200) });
      console.log(`${ok ? 'PASS' : 'FAIL'} ${site} ${viewport.name} form keyboard journey ${JSON.stringify(result)}`);
    } catch (error) {
      failures.push({ site, viewport: viewport.name, error: String(error), stderr: stderr.slice(-1200) });
      console.log(`FAIL ${site} ${viewport.name} ${String(error)}`);
    } finally {
      try { socket?.close(); } catch {}
      child.kill('SIGKILL');
      await new Promise((resolve) => child.once('close', resolve));
      await rm(profile, { recursive: true, force: true });
    }
  }
} finally { await new Promise((resolve) => server.close(resolve)); }
console.log(`Chrome real form-keyboard smoke: ${passed}/${sites.length * viewports.length} site/viewport combinations passed.`);
if (failures.length) { for (const failure of failures) console.error(JSON.stringify(failure)); process.exitCode = 1; }
