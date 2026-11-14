import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const browserCandidates = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
const browser = browserCandidates.find((candidate) => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
if (!browser) {
  console.log('Browser token consumption smoke skipped: Chrome/Chromium is not installed.');
  process.exit(0);
}

const tokenCss = readFileSync(path.join(DIST, 'tokens.css'), 'utf8');
const brands = [...tokenCss.matchAll(/\[data-chi-brand="([^"]+)"\]\s*\{\s*--chi-color-brand:\s*(#[0-9a-fA-F]{6})\s*;/g)]
  .map(([, id, color]) => ({ id, color: color.toLowerCase() }));
if (brands.length !== 6) throw new Error(`Expected six generated brand tokens, found ${brands.length}`);
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = path.resolve(ROOT, '.' + pathname);
  if (!target.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
  try {
    if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
    const ext = path.extname(target);
    response.setHeader('content-type', ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : ext === '.json' ? 'application/json' : 'application/octet-stream');
    response.end(readFileSync(target));
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const themes = ['light', 'dark'];
const layouts = ['header', 'sidebar'];
const failures = [];
let passed = 0;
// Expected accent per brand/theme, parsed from the generated CSS: the :root /
// [data-chi-theme="dark"] defaults, overridden per brand by the
// [data-chi-brand="…"] (and dark variant) blocks. A brand may declare its
// own accent — nav follows its theme color (#008CAD) instead of the shared
// default — so the accent is asserted per brand, not identical across brands.
const expectedAccent = new Map();
const defaultAccent = {};
for (const [, selector, body] of tokenCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const accent = /--chi-color-accent:\s*(#[0-9a-fA-F]{6})\s*;/.exec(body)?.[1]?.toLowerCase();
  if (!accent) continue;
  const brandMatch = /\[data-chi-brand="([^"]+)"\]/.exec(selector);
  const dark = selector.includes('[data-chi-theme="dark"]');
  if (!brandMatch) defaultAccent[dark ? 'dark' : 'light'] = accent;
  else expectedAccent.set(`${brandMatch[1]}:${dark ? 'dark' : 'light'}`, accent);
}
for (const { id } of brands) for (const theme of themes) {
  if (!expectedAccent.has(`${id}:${theme}`)) expectedAccent.set(`${id}:${theme}`, defaultAccent[theme]);
}
const semanticValues = new Map();

async function waitFor(predicate, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for preview shell or Chrome DevTools');
}

try {
  for (const { id: brand, color: expectedBrand } of brands) {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'chi-token-cdp-'));
    const child = spawn(browser, ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], { stdio: ['ignore','ignore','pipe'], env: { ...process.env, DISPLAY: '' } });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    let socket;
    try {
      const port = await waitFor(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return null; } });
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
        const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
      });
      const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
      await send('Page.enable'); await send('Runtime.enable');
      for (const theme of themes) for (const layout of layouts) {
        const pageUrl = `${origin}/preview/index.html?site=${brand}&theme=${theme}&layout=${layout}`;
        await send('Page.navigate', { url: pageUrl });
        await waitFor(async () => await evaluate(`location.href === ${JSON.stringify(pageUrl)} && document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(layout === 'header' ? '.chi-header' : '.chi-sidebar')}) && document.documentElement.getAttribute('data-chi-brand') === ${JSON.stringify(brand)}`));
        const result = await evaluate(`(() => {
          const root = document.documentElement;
          const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();
          const color = (el, prop) => getComputedStyle(el).getPropertyValue(prop).trim();
          const hexRgb = (hex) => { const n = hex.slice(1); return [0,2,4].map((i) => parseInt(n.slice(i,i+2),16)); };
          const containsRgb = (value, rgb) => value.includes('rgb(' + rgb.join(', ') + ')');
          const expectedRgb = hexRgb(${JSON.stringify(expectedBrand)});
          const header = document.querySelector('.chi-header');
          const sidebar = document.querySelector('.chi-sidebar');
          const footer = document.querySelector('.chi-footer');
          const button = document.querySelector('.chi-btn--primary');
          const activeLink = document.querySelector('.chi-sidebar__nav a[aria-current="page"]');
          const brandLine = ${JSON.stringify(layout)} === 'header' ? getComputedStyle(header).boxShadow : getComputedStyle(document.querySelector('.chi-sidebar__top')).boxShadow;
          const actualAccent = css('--chi-color-accent');
          const values = { canvas: css('--chi-color-canvas'), surface: css('--chi-color-surface'), text: css('--chi-color-text-primary'), accent: actualAccent };
          return {
            brandAttribute: root.getAttribute('data-chi-brand') === ${JSON.stringify(brand)},
            themeAttribute: root.getAttribute('data-chi-theme') === ${JSON.stringify(theme)},
            layoutAttribute: root.getAttribute('data-chi-layout') === ${JSON.stringify(layout)},
            brandToken: css('--chi-color-brand').toLowerCase() === ${JSON.stringify(expectedBrand)},
            brandIdentityRendered: containsRgb(brandLine, expectedRgb),
            primaryUsesAccent: color(button, 'background-color') === (function(){const h=actualAccent.match(/^#([0-9a-f]{6})$/i);return h?'rgb('+hexRgb('#'+h[1]).join(', ')+')':actualAccent;})(),
            footerUsesMutedText: color(footer, 'color') === (function(){const h=css('--chi-color-text-muted').match(/^#([0-9a-f]{6})$/i);return h?'rgb('+hexRgb('#'+h[1]).join(', ')+')':css('--chi-color-text-muted');})(),
            shellMode: ${JSON.stringify(layout)} === 'header' ? !!header && getComputedStyle(header).display === 'flex' && getComputedStyle(sidebar).display === 'none' : !!sidebar && getComputedStyle(header).display === 'none',
            headerBackground: ${JSON.stringify(layout)} === 'header' ? color(header, 'background-color') === (function(){const h=css('--chi-color-surface').match(/^#([0-9a-f]{6})$/i);return h?'rgb('+hexRgb('#'+h[1]).join(', ')+')':css('--chi-color-surface');})() : true,
            sidebarBackground: ${JSON.stringify(layout)} === 'sidebar' ? color(sidebar, 'background-color') === (function(){const h=css('--chi-sidebar-background').match(/^#([0-9a-f]{6})$/i);return h?'rgb('+hexRgb('#'+h[1]).join(', ')+')':css('--chi-sidebar-background');})() : true,
            sidebarActiveAccent: ${JSON.stringify(layout)} === 'sidebar' ? color(activeLink, 'color') === (function(){const h=css('--chi-sidebar-text-active').match(/^#([0-9a-f]{6})$/i);return h?'rgb('+hexRgb('#'+h[1]).join(', ')+')':css('--chi-sidebar-text-active');})() : true,
            logoTheme: ${JSON.stringify(theme)} === 'dark' ? getComputedStyle(document.querySelector('.chi-header__logo--dark')).display !== 'none' && getComputedStyle(document.querySelector('.chi-header__logo--light')).display === 'none' : getComputedStyle(document.querySelector('.chi-header__logo--light')).display !== 'none' && getComputedStyle(document.querySelector('.chi-header__logo--dark')).display === 'none',
            tokenValuesPresent: Object.values(values).every(Boolean),
            values
          };
        })()`);
        const checks = { ...result };
        delete checks.values;
        const issues = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        const expected = expectedAccent.get(`${brand}:${theme}`);
        if (expected && result.values.accent.toLowerCase() !== expected) issues.push('accent-does-not-match-brand-tokens');
        const semanticKey = `${brand}:${theme}`;
        semanticValues.set(semanticKey, result.values);
        if (issues.length) failures.push({ brand, theme, layout, issues, values: result.values, stderr: stderr.slice(-500) }); else passed++;
        console.log(`${issues.length ? 'FAIL' : 'PASS'} ${brand} ${theme} ${layout}${issues.length ? ` [${issues.join(',')}]` : ''}`);
      }
    } catch (error) {
      failures.push({ brand, error: String(error), stderr: stderr.slice(-1000) });
      console.log(`FAIL ${brand} ${String(error)}`);
    } finally {
      try { socket?.close(); } catch {}
      const closed = new Promise((resolve) => child.once('close', resolve)); child.kill('SIGKILL');
      await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 2000))]);
      await rm(profile, { recursive: true, force: true });
    }
  }
} finally { await new Promise((resolve) => server.close(resolve)); }
for (const brand of brands.map((item) => item.id)) {
  const light = semanticValues.get(`${brand}:light`);
  const dark = semanticValues.get(`${brand}:dark`);
  if (light && dark) {
    if (light.canvas === dark.canvas) failures.push({ brand, issue: 'canvas-does-not-change-with-theme' });
    if (light.surface === dark.surface) failures.push({ brand, issue: 'surface-does-not-change-with-theme' });
    if (light.text === dark.text) failures.push({ brand, issue: 'text-does-not-change-with-theme' });
    if (light.accent === dark.accent) failures.push({ brand, issue: 'accent-does-not-change-with-theme' });
  }
}
console.log(`Chrome token consumption smoke: ${passed}/${brands.length * themes.length * layouts.length} brand/theme/layout combinations passed.`);
if (failures.length) { for (const failure of failures) console.error(JSON.stringify(failure)); process.exitCode = 1; }
