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
  console.log('Browser sidebar keyboard smoke skipped: Chrome/Chromium is not installed.');
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
    const profile = await mkdtemp(path.join(os.tmpdir(), 'chi-sidebar-cdp-'));
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
      const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
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
      const key = async (name, code, keyCode, modifiers = 0) => {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
      };
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
      const pageUrl = `${origin}/sites/${siteId}/index.html`;
      await send('Page.navigate', { url: pageUrl });
      await waitFor(async () => {
        const result = await send('Runtime.evaluate', { expression: `location.href === ${JSON.stringify(pageUrl)} && document.readyState === 'complete'`, returnByValue: true });
        return result.result.value === true;
      });

      const opened = await send('Runtime.evaluate', { expression: `(() => {
        document.documentElement.setAttribute('data-chi-layout', 'sidebar');
        const trigger = document.querySelector('.chi-mobile-header [data-chi-sidebar-toggle]');
        const sidebar = document.querySelector('.chi-sidebar');
        trigger.focus();
        trigger.click();
        const items = Array.from(sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        return {
          opened: sidebar.classList.contains('mobile-open'),
          firstIsBrand: items[0] === sidebar.querySelector('.chi-sidebar__brand'),
          lastIsTheme: items.at(-1) === sidebar.querySelector('.chi-sidebar__theme'),
          focusMovedToNav: document.activeElement === sidebar.querySelector('.chi-sidebar__nav a'),
          ariaVisible: sidebar.getAttribute('aria-hidden') === 'false',
          expanded: trigger.getAttribute('aria-expanded') === 'true',
          count: items.length
        };
      })()`, returnByValue: true });
      const openedState = opened.result.value;

      await send('Runtime.evaluate', { expression: `document.querySelector('.chi-sidebar__theme').focus()` });
      await key('Tab', 'Tab', 9);
      const tabWrap = await send('Runtime.evaluate', { expression: `document.activeElement === document.querySelector('.chi-sidebar__brand')`, returnByValue: true });

      await send('Runtime.evaluate', { expression: `document.querySelector('.chi-sidebar__brand').focus()` });
      await key('Tab', 'Tab', 9, 8);
      const shiftWrap = await send('Runtime.evaluate', { expression: `document.activeElement === document.querySelector('.chi-sidebar__theme')`, returnByValue: true });

      await send('Runtime.evaluate', { expression: `document.querySelector('.chi-mobile-header [data-chi-sidebar-toggle]').focus()` });
      await key('Tab', 'Tab', 9);
      const outsideEntry = await send('Runtime.evaluate', { expression: `document.activeElement === document.querySelector('.chi-sidebar__brand')`, returnByValue: true });

      await key('Escape', 'Escape', 27);
      const closed = await send('Runtime.evaluate', { expression: `(() => {
        const sidebar = document.querySelector('.chi-sidebar');
        const trigger = document.querySelector('.chi-mobile-header [data-chi-sidebar-toggle]');
        return {
          closed: !sidebar.classList.contains('mobile-open'),
          inert: sidebar.inert,
          hidden: sidebar.getAttribute('aria-hidden') === 'true',
          notExpanded: trigger.getAttribute('aria-expanded') === 'false',
          focusRestored: document.activeElement === trigger,
          scrimHidden: !document.querySelector('[data-chi-sidebar-scrim]').classList.contains('visible'),
          scrollUnlocked: !document.documentElement.classList.contains('chi-sidebar-open')
        };
      })()`, returnByValue: true });
      const closeState = closed.result.value;
      const result = {
        ...openedState,
        tabWrap: tabWrap.result.value,
        shiftWrap: shiftWrap.result.value,
        outsideEntry: outsideEntry.result.value,
        ...closeState,
      };
      const ok = result.opened && result.firstIsBrand && result.lastIsTheme && result.focusMovedToNav && result.ariaVisible && result.expanded && result.count >= 3 && result.tabWrap && result.shiftWrap && result.outsideEntry && result.closed && result.inert && result.hidden && result.notExpanded && result.focusRestored && result.scrimHidden && result.scrollUnlocked;
      if (ok) passed++;
      else failures.push({ site: siteId, result, stderr: stderr.slice(-1500) });
      console.log(`${ok ? 'PASS' : 'FAIL'} ${siteId} mobile Sidebar real Tab / Shift+Tab / Escape ${JSON.stringify(result)}`);
    } catch (error) {
      failures.push({ site: siteId, error: String(error), stderr: stderr.slice(-1500) });
      console.log(`FAIL ${siteId} mobile Sidebar ${String(error)}`);
    } finally {
      try { socket?.close(); } catch {}
      const closed = new Promise((resolve) => child.once('close', resolve));
      child.kill('SIGKILL');
      await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 2000))]);
      await rm(profile, { recursive: true, force: true });
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
console.log(`Chrome real-keyboard Sidebar smoke: ${passed}/${sites.length} mobile site combinations passed.`);
if (failures.length) {
  for (const failure of failures) console.error(JSON.stringify(failure));
  process.exitCode = 1;
}
