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
  console.log('Browser accessibility smoke skipped: Chrome/Chromium is not installed.');
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
      const profile = await mkdtemp(path.join(os.tmpdir(), 'chi-a11y-cdp-'));
      const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, DISPLAY: '' } });
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
        await send('Page.enable'); await send('Runtime.enable'); await send('Accessibility.enable');
        await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.name === 'mobile' });
        const pageUrl = `${origin}/sites/${siteId}/index.html`;
        await send('Page.navigate', { url: pageUrl });
        await waitFor(async () => (await send('Runtime.evaluate', { expression: `location.href === ${JSON.stringify(pageUrl)} && document.readyState === 'complete'`, returnByValue: true })).result.value === true);
        for (const theme of ['light', 'dark']) {
        await send('Runtime.evaluate', { expression: `document.documentElement.setAttribute('data-chi-theme', '${'${theme}'}')` });
        const audit = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
          const issues = [];
          const text = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim();
          const hasName = (el) => {
            const labelledBy = el.getAttribute('aria-labelledby');
            if (labelledBy && labelledBy.split(/\\s+/).every((id) => document.getElementById(id))) return labelledBy.split(/\\s+/).some((id) => text(document.getElementById(id)));
            return Boolean(el.getAttribute('aria-label')?.trim() || el.getAttribute('title')?.trim() || text(el) || el.labels?.length);
          };
          const ids = new Map();
          document.querySelectorAll('[id]').forEach((el) => ids.set(el.id, (ids.get(el.id) || 0) + 1));
          for (const [id, count] of ids) if (count > 1) issues.push({ code: 'duplicate-id', id, count });
          for (const el of document.querySelectorAll('img')) if (!el.hasAttribute('alt')) issues.push({ code: 'image-alt-missing', src: el.getAttribute('src') });
          for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=link]')) {
            if (!hasName(el)) issues.push({ code: 'control-name-missing', tag: el.tagName, role: el.getAttribute('role'), className: String(el.className).slice(0, 90) });
          }
          for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
            if (!el.labels?.length && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) issues.push({ code: 'form-control-unlabelled', id: el.id, name: el.name });
          }
          for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant']) {
            for (const el of document.querySelectorAll('[' + attr + ']')) {
              for (const id of el.getAttribute(attr).trim().split(/\\s+/).filter(Boolean)) if (!document.getElementById(id)) issues.push({ code: 'broken-' + attr, id, tag: el.tagName });
            }
          }
          for (const el of document.querySelectorAll('[aria-hidden=true]')) {
            const focusable = el.matches('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])') || el.querySelector('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
            if (focusable && !el.inert) issues.push({ code: 'focusable-in-aria-hidden', tag: el.tagName, id: el.id, className: String(el.className).slice(0, 90) });
          }
          const main = document.querySelectorAll('main');
          if (main.length !== 1) issues.push({ code: 'main-landmark-count', count: main.length });
          if (!document.documentElement.lang) issues.push({ code: 'document-language-missing' });
          if (!document.title.trim()) issues.push({ code: 'document-title-missing' });
          const h1 = document.querySelectorAll('h1');
          if (h1.length !== 1) issues.push({ code: 'h1-count', count: h1.length });
          const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((el) => el.getClientRects().length);
          let prior = 0;
          for (const h of headings) {
            const level = Number(h.tagName.slice(1));
            if (prior && level > prior + 1) issues.push({ code: 'heading-level-skip', from: prior, to: level, text: text(h).slice(0, 60) });
            prior = level;
          }
          const landmarks = [...document.querySelectorAll('header,nav,main,aside,footer,[role=banner],[role=navigation],[role=main],[role=complementary],[role=contentinfo]')];
          for (const el of landmarks) {
            const role = el.getAttribute('role') || ({ HEADER: 'banner', NAV: 'navigation', MAIN: 'main', ASIDE: 'complementary', FOOTER: 'contentinfo' }[el.tagName] || '');
            if (['navigation','complementary'].includes(role) && !hasName(el)) issues.push({ code: 'landmark-name-missing', role, className: String(el.className).slice(0, 80) });
          }
          const parseColor = (value) => {
            const match = value.match(/rgba?\(([^)]+)\)/);
            if (!match) return null;
            const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
            return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
          };
          const composite = (front, back) => {
            const a = front.a + back.a * (1 - front.a);
            if (!a) return { r: 0, g: 0, b: 0, a: 0 };
            return { r: (front.r * front.a + back.r * back.a * (1 - front.a)) / a, g: (front.g * front.a + back.g * back.a * (1 - front.a)) / a, b: (front.b * front.a + back.b * back.a * (1 - front.a)) / a, a };
          };
          const luminance = (color) => {
            const channel = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
            return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
          };
          const backgroundFor = (el) => {
            let bg = { r: 255, g: 255, b: 255, a: 1 };
            const chain = [];
            for (let node = el; node; node = node.parentElement) chain.push(node);
            for (const node of chain.reverse()) {
              const color = parseColor(getComputedStyle(node).backgroundColor);
              if (color && color.a > 0) bg = composite(color, bg);
            }
            return bg;
          };
          const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          let checkedTextRuns = 0;
          while ((node = textNodes.nextNode())) {
            if (!node.nodeValue.trim()) continue;
            const el = node.parentElement;
            if (!el || el.closest('[aria-hidden=true],script,style,noscript,svg')) continue;
            const range = document.createRange(); range.selectNodeContents(node);
            if (!range.getClientRects().length) continue;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
            const fg = parseColor(style.color);
            if (!fg || fg.a < 1) continue;
            const bg = backgroundFor(el);
            if (bg.a < 1) continue;
            const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
            const contrast = (a + 0.05) / (b + 0.05);
            const fontSize = Number.parseFloat(style.fontSize);
            const isLarge = fontSize >= 24 || (fontSize >= 18.66 && Number(style.fontWeight) >= 700);
            const minimum = isLarge ? 3 : 4.5;
            checkedTextRuns++;
            if (contrast + 0.01 < minimum) issues.push({ code: 'text-contrast', text: node.nodeValue.trim().slice(0, 60), ratio: Number(contrast.toFixed(2)), minimum, color: style.color, background: 'rgb(' + Math.round(bg.r) + ', ' + Math.round(bg.g) + ', ' + Math.round(bg.b) + ')'  });
          }
          return { title: document.title, lang: document.documentElement.lang, checkedTextRuns, issues };
        })()` });
        const result = audit.result.value;
        const ax = await send('Accessibility.getFullAXTree');
        const axNodes = ax.nodes || [];
        const unnamedInteractive = axNodes.filter((node) => !node.ignored && ['button','link','textbox','combobox','checkbox','radio','tab'].includes(node.role?.value) && !node.name?.value?.trim()).map((node) => ({ role: node.role?.value, backendNodeId: node.backendDOMNodeId }));
        if (unnamedInteractive.length) result.issues.push(...unnamedInteractive.map((item) => ({ code: 'ax-unnamed-' + item.role, backendNodeId: item.backendNodeId })));
        const ok = result.issues.length === 0;
        if (ok) passed++;
        else failures.push({ site: siteId, viewport: viewport.name, theme, result, stderr: stderr.slice(-1000) });
        console.log(`${ok ? 'PASS' : 'FAIL'} ${siteId} ${viewport.name} ${theme} ${result.checkedTextRuns} text runs ${result.issues.length} issue(s) ${JSON.stringify(result.issues)}`);
        }
      } catch (error) {
        failures.push({ site: siteId, viewport: viewport.name, error: String(error), stderr: stderr.slice(-1500) });
        console.log(`FAIL ${siteId} ${viewport.name} ${String(error)}`);
      } finally {
        try { socket?.close(); } catch {}
        const closed = new Promise((resolve) => child.once('close', resolve)); child.kill('SIGKILL');
        await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 2000))]);
        await rm(profile, { recursive: true, force: true });
      }
    }
  }
} finally { await new Promise((resolve) => server.close(resolve)); }
console.log(`Chrome accessibility audit: ${passed}/${sites.length * viewports.length * 2} site/viewport/theme combinations passed.`);
if (failures.length) { for (const failure of failures) console.error(JSON.stringify(failure)); process.exitCode = 1; }
