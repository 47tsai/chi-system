import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const candidates = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
const browser = candidates.find((candidate) => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
if (!browser) {
  console.log('Browser layout geometry smoke skipped: Chrome/Chromium is not installed.');
  process.exit(0);
}

const tokenCss = readFileSync(path.join(ROOT, 'dist/tokens.css'), 'utf8');
const brands = [...tokenCss.matchAll(/\[data-chi-brand="([^"]+)"\]\s*\{/g)].map(([, id]) => id);
if (brands.length !== 6) throw new Error(`Expected six generated brands, found ${brands.length}`);
const viewports = [
  { name: 'mobile-320', width: 320, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
];
const themes = ['light', 'dark'];
const layouts = ['header', 'sidebar'];
const failures = [];
let passed = 0;

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

async function waitFor(predicate, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await predicate();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for preview shell');
}

try {
  for (const brand of brands) {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'chi-geometry-cdp-'));
    const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, DISPLAY: '' } });
    let socket;
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
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
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
      const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
      await send('Page.enable');
      await send('Runtime.enable');
      for (const theme of themes) for (const layout of layouts) for (const viewport of viewports) {
        await send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 768 });
        const pageUrl = `${origin}/preview/index.html?site=${brand}&theme=${theme}&layout=${layout}`;
        await send('Page.navigate', { url: pageUrl });
        await waitFor(async () => evaluate(`location.href === ${JSON.stringify(pageUrl)} && document.readyState === 'complete' && !!document.querySelector('.chi-footer') && document.documentElement.getAttribute('data-chi-brand') === ${JSON.stringify(brand)}`));
        const result = await evaluate(`(() => {
          const root = document.documentElement;
          const $ = (selector) => document.querySelector(selector);
          const rect = (element) => { const r = element.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom }; };
          const px = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name));
          const style = (element, property) => getComputedStyle(element).getPropertyValue(property);
          const viewportWidth = innerWidth;
          const width = document.documentElement.clientWidth;
          const sidebarMode = ${JSON.stringify(layout)} === 'sidebar';
          const mobile = viewportWidth < 768;
          const tablet = viewportWidth >= 768 && viewportWidth < 1024;
          const shell = $('.chi-shell');
          const content = $('.chi-content');
          const header = $('.chi-header');
          const sidebar = $('.chi-sidebar');
          const mobileHeader = $('.chi-mobile-header');
          const footer = $('.chi-footer');
          const main = $('.chi-main');
          const subnav = $('.chi-subnav');
          const fixture = document.createElement('div');
          fixture.id = 'chi-geometry-controls';
          fixture.innerHTML = '<button class="chi-btn chi-btn--primary" type="button">Primary</button><button class="chi-btn chi-btn--secondary" type="button">Secondary</button><button class="chi-btn chi-btn--ghost" type="button">Ghost</button><button class="chi-btn chi-btn--danger" type="button">Danger</button><input class="chi-input" aria-label="Name"><select class="chi-select" aria-label="Frequency"><option>Daily</option></select><label class="chi-check"><input class="chi-check__input" type="checkbox">Check</label><label class="chi-radio"><input class="chi-radio__input" type="radio" name="geometry-radio">Radio</label><label class="chi-switch"><input class="chi-switch__input" type="checkbox" role="switch">Switch</label>';
          main.appendChild(fixture);
          const buttonRects = [...fixture.querySelectorAll('.chi-btn')].map(rect);
          const controlRects = [...fixture.querySelectorAll('.chi-input, .chi-select')].map(rect);
          const choiceRects = [...fixture.querySelectorAll('.chi-check, .chi-radio, .chi-switch')].map(rect);
          const sr = sidebar ? rect(sidebar) : null;
          const cr = rect(content);
          const fr = rect(footer);
          const mr = rect(main);
          const hr = header ? rect(header) : null;
          const shellRect = rect(shell);
          const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
          const headerHeight = px('--chi-layout-header-height');
          const fullSidebarWidth = px('--chi-layout-sidebar-width');
          const collapsedSidebarWidth = px('--chi-layout-sidebar-collapsed-width');
          const checks = {
            viewportApplied: Math.abs(viewportWidth - ${viewport.width}) < 1,
            noDocumentHorizontalOverflow: docWidth <= width + 1,
            shellFillsViewport: Math.abs(shellRect.width - width) < 1,
            mainContainedInContent: mr.x >= cr.x - 1 && mr.right <= cr.right + 1,
            footerContainedInContent: fr.x >= cr.x - 1 && fr.right <= cr.right + 1,
            footerAfterMain: fr.y >= mr.bottom - 1,
            footerNoHorizontalOverflow: fr.width <= cr.width + 1,
            mainRespectsContentMax: mr.width <= Math.min(cr.width, px('--chi-layout-content-max') + parseFloat(style(main, 'padding-left')) + parseFloat(style(main, 'padding-right'))) + 1,
            mainCenteredInContent: Math.abs((mr.x - cr.x) - (cr.width - mr.width) / 2) < 1,
            buttonVariantsShareHeight: buttonRects.every((item) => Math.abs(item.height - buttonRects[0].height) < 1),
            inputAndSelectShareHeight: Math.abs(controlRects[0].height - controlRects[1].height) < 1,
            choiceLabelsMeetTouchTarget: choiceRects.every((item) => item.height >= px('--chi-size-touch-min') - 1),
          };
          if (!sidebarMode) {
            checks.headerVisible = !!header && style(header, 'display') === 'flex';
            checks.headerFullWidth = !!hr && Math.abs(hr.x) < 1 && Math.abs(hr.width - width) < 1;
            checks.headerTokenHeight = !!hr && Math.abs(hr.height - (headerHeight + parseFloat(style(header, 'border-bottom-width')))) < 1;
            checks.headerThemeControlMeetsTouchTarget = rect($('.chi-header__theme')).height >= px('--chi-size-touch-min') - 1;
            checks.subnavFullWidth = !!subnav && Math.abs(rect(subnav).width - width) < 1;
            checks.sidebarHidden = style(sidebar, 'display') === 'none';
          } else {
            checks.headerHidden = style(header, 'display') === 'none';
            checks.mobileHeaderVisibility = style(mobileHeader, 'display') === (mobile ? 'flex' : 'none');
            checks.sidebarPosition = style(sidebar, 'position') === (mobile ? 'fixed' : 'sticky');
            checks.sidebarWidth = Math.abs(sr.width - (mobile ? fullSidebarWidth : tablet ? collapsedSidebarWidth : fullSidebarWidth) - parseFloat(style(sidebar, 'border-right-width'))) < 1;
            checks.sidebarContentNoOverlap = mobile ? Math.abs(cr.x) < 1 : Math.abs(cr.x - sr.right) < 1;
            checks.sidebarDrawerClosed = mobile ? sr.right <= 1 : Math.abs(sr.x) < 1;
            checks.sidebarLabelsVisibility = tablet ? style($('.chi-sidebar__label'), 'display') === 'none' : style($('.chi-sidebar__label'), 'display') !== 'none';
            checks.sidebarFooterWithinViewport = mobile ? true : fr.right <= width + 1;
            checks.sidebarThemeControlMeetsTouchTarget = rect($('.chi-sidebar__theme')).height >= px('--chi-size-touch-min') - 1;
            checks.sidebarTopMatchesHeaderOnDesktop = mobile || tablet || Math.abs(rect($('.chi-sidebar__top')).height - (headerHeight + parseFloat(style($('.chi-sidebar__top'), 'border-bottom-width')))) < 1;
          }
          return { checks, metrics: { viewportWidth, width, docWidth, shell:shellRect, content:cr, header:hr, sidebar:sr, main:mr, footer:fr, buttonRects, controlRects, choiceRects, headerHeight, fullSidebarWidth, collapsedSidebarWidth } };
        })()`);
        const issues = Object.entries(result.checks).filter(([, ok]) => !ok).map(([name]) => name);
        if (issues.length) failures.push({ brand, theme, layout, viewport: viewport.name, issues, metrics: result.metrics, stderr: stderr.slice(-500) });
        else passed++;
        console.log(`${issues.length ? 'FAIL' : 'PASS'} ${brand} ${theme} ${layout} ${viewport.name}${issues.length ? ` [${issues.join(',')}]` : ''}`);
      }
    } catch (error) {
      failures.push({ brand, error: String(error), stderr: stderr.slice(-1000) });
      console.log(`FAIL ${brand} ${String(error)}`);
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
console.log(`Chrome layout geometry smoke: ${passed}/${brands.length * themes.length * layouts.length * viewports.length} brand/theme/layout/viewport combinations passed.`);
if (failures.length) {
  for (const failure of failures) console.error(JSON.stringify(failure));
  process.exitCode = 1;
}
