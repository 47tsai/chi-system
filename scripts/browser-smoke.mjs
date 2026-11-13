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

const browserFixture = `
<div id="chi-browser-smoke-fixture" style="position:fixed;left:0;top:0;opacity:0.01;z-index:2147483647">
  <div data-chi-tabs id="smoke-tabs">
    <div role="tablist" aria-label="Smoke tabs">
      <button id="smoke-tab-one" type="button" role="tab" aria-controls="smoke-panel-one" aria-selected="true" tabindex="0">One</button>
      <button id="smoke-tab-two" type="button" role="tab" aria-controls="smoke-panel-two" aria-selected="false" tabindex="-1">Two</button>
    </div>
    <section id="smoke-panel-one" role="tabpanel" aria-labelledby="smoke-tab-one">One panel</section>
    <section id="smoke-panel-two" role="tabpanel" aria-labelledby="smoke-tab-two" hidden>Two panel</section>
  </div>
  <button id="smoke-motion-button" class="chi-btn" type="button">Motion button</button>
  <input id="smoke-motion-input" class="chi-input" aria-label="Motion input">
  <span id="smoke-motion-spinner" class="chi-spinner" aria-hidden="true"></span>
  <button id="smoke-dialog-opener" type="button" data-chi-dialog-open="smoke-dialog">Open dialog</button>
  <dialog id="smoke-dialog" class="chi-dialog" aria-labelledby="smoke-dialog-title">
    <h2 id="smoke-dialog-title" class="chi-dialog__title" tabindex="-1" data-chi-dialog-initial-focus>Smoke dialog</h2>
    <button id="smoke-dialog-close" type="button" data-chi-dialog-close>Close dialog</button>
  </dialog>
</div>
<script>
(() => {
  const results = [];
  const check = (name, ok) => results.push(name + ':' + (ok ? 'PASS' : 'FAIL'));
  const run = async () => {
    try {
      const themeButton = document.querySelector('[data-chi-theme-toggle]');
      const oldMode = window.ChiTheme && window.ChiTheme.getMode();
      if (themeButton && window.ChiTheme) {
        themeButton.click();
        const nextMode = window.ChiTheme.getMode();
        check('theme-cycle', nextMode !== oldMode && themeButton.getAttribute('aria-label').includes('目前色彩模式'));
      } else check('theme-cycle', false);

      const reducedMotionExpected = new URL(location.href).searchParams.get('motion') === 'reduce';
      const reducedMotionActive = matchMedia('(prefers-reduced-motion: reduce)').matches;
      check('reduced-motion-preference', reducedMotionActive === reducedMotionExpected);
      const motionButton = document.getElementById('smoke-motion-button');
      const spinner = document.getElementById('smoke-motion-spinner');
      const buttonTransition = getComputedStyle(motionButton).transitionDuration.split(',').map((value) => parseFloat(value) || 0);
      const spinnerAnimation = getComputedStyle(spinner).animationName;
      check('reduced-motion-effects', !reducedMotionExpected || (buttonTransition.every((duration) => duration === 0) && spinnerAnimation === 'none'));

      const focusRules = [];
      const collectFocusRules = (rules) => {
        for (const rule of rules) {
          if (rule.cssRules) collectFocusRules(rule.cssRules);
          if (rule.selectorText && rule.selectorText.includes(':focus-visible') && rule.style && rule.style.getPropertyValue('outline')) {
            focusRules.push(rule.selectorText);
          }
        }
      };
      for (const sheet of document.styleSheets) {
        try { collectFocusRules(sheet.cssRules); } catch {}
      }
      check('focus-visible-css-contract', focusRules.some((selector) => selector.includes('.chi-btn')) && focusRules.some((selector) => selector.includes('.chi-header__theme')) && focusRules.some((selector) => selector.includes('.chi-sidebar__trigger')));

      const root = document.documentElement;
      const originalLayout = root.getAttribute('data-chi-layout');
      root.setAttribute('data-chi-layout', 'sidebar');
      const sidebar = document.querySelector('.chi-sidebar');
      const mobile = window.innerWidth < 768;
      const trigger = mobile
        ? document.querySelector('.chi-mobile-header [data-chi-sidebar-toggle]')
        : document.querySelector('.chi-sidebar__top [data-chi-sidebar-toggle]');
      if (sidebar && trigger && window.ChiSidebar) {
        trigger.focus();
        if (mobile) {
          trigger.click();
          const opened = sidebar.classList.contains('mobile-open') && trigger.getAttribute('aria-expanded') === 'true' && sidebar.getAttribute('aria-hidden') === 'false';
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          check('sidebar-drawer', opened && !sidebar.classList.contains('mobile-open') && document.activeElement === trigger);
        } else {
          const before = window.ChiSidebar.isCollapsed();
          trigger.click();
          const after = window.ChiSidebar.isCollapsed();
          const toggled = after !== before && trigger.getAttribute('aria-expanded') === String(!after);
          trigger.click();
          check('sidebar-collapse', toggled && window.ChiSidebar.isCollapsed() === before);
        }
        const sidebarVisible = getComputedStyle(sidebar).display !== 'none';
        const mobileHeaderVisible = getComputedStyle(document.querySelector('.chi-mobile-header')).display !== 'none';
        const expectedPosition = mobile ? 'fixed' : 'sticky';
        check('sidebar-breakpoint', sidebarVisible && mobileHeaderVisible === mobile && getComputedStyle(sidebar).position === expectedPosition);
      } else {
        check(mobile ? 'sidebar-drawer' : 'sidebar-collapse', false);
        check('sidebar-breakpoint', false);
      }
      root.setAttribute('data-chi-layout', originalLayout || 'header');
      const header = document.querySelector('.chi-header');
      const layoutMatches = originalLayout === 'sidebar'
        ? getComputedStyle(sidebar).display !== 'none' && getComputedStyle(header).display === 'none'
        : getComputedStyle(header).display !== 'none' && getComputedStyle(sidebar).display === 'none';
      check('site-layout', layoutMatches);
      check('no-horizontal-overflow', document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);

      const firstTab = document.getElementById('smoke-tab-one');
      const secondTab = document.getElementById('smoke-tab-two');
      firstTab.focus();
      firstTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      check('tabs-keyboard', secondTab.getAttribute('aria-selected') === 'true' && !document.getElementById('smoke-panel-two').hidden && document.activeElement === secondTab);

      const opener = document.getElementById('smoke-dialog-opener');
      const dialog = document.getElementById('smoke-dialog');
      const initialFocus = document.getElementById('smoke-dialog-title');
      opener.click();
      const opened = dialog.open && document.activeElement === initialFocus;
      let closeEventObserved = false;
      const closedEvent = new Promise((resolve) => dialog.addEventListener('close', () => {
        closeEventObserved = true;
        resolve();
      }, { once: true }));
      document.getElementById('smoke-dialog-close').click();
      await Promise.race([closedEvent, new Promise((resolve) => {
        const deadline = performance.now() + 2500;
        const poll = () => {
          if (closeEventObserved || performance.now() >= deadline) resolve();
          else requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      })]);
      check('dialog-close-event', closeEventObserved);
      check('dialog-focus-return', opened && !dialog.open && document.activeElement === opener);
    } catch (error) {
      results.push('exception:' + String(error && error.message || error));
    }
    document.documentElement.setAttribute('data-chi-browser-smoke', results.join(';'));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 0), { once: true });
  else setTimeout(run, 0);
})();
</script>`;

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
    let body = readFileSync(target);
    if (path.extname(target) === '.html' && target.startsWith(path.join(DIST, 'sites') + path.sep)) {
      body = Buffer.from(body.toString('utf8').replace('</body>', browserFixture + '</body>'));
    }
    response.end(body);
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
const motionModes = [
  { name: 'default', query: '', flags: [] },
  { name: 'reduced-motion', query: '?motion=reduce', flags: ['--force-prefers-reduced-motion=reduce'] },
];
const failures = [];
let passed = 0;

try {
  for (const siteId of sites) {
    const site = JSON.parse(readFileSync(path.join(sitesDir, siteId + '.json'), 'utf8'));
    const expectedLayout = site.layout || 'header';
    for (const viewport of viewports) {
      for (const motionMode of motionModes) {
      const url = `${origin}/sites/${siteId}/index.html${motionMode.query}`;
      const child = spawn(browser, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--no-first-run', '--no-default-browser-check', '--enable-logging=stderr',
        '--log-level=0', '--virtual-time-budget=20000', `--window-size=${viewport.size}`,
        ...motionMode.flags,
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
      const interaction = stdout.match(/data-chi-browser-smoke="([^"]*)"/)?.[1];
      const browserErrors = stderr.split('\n').filter((line) => /ERROR:CONSOLE|Failed to load resource|net::ERR_/i.test(line));
      const issues = [];
      if (exitCode !== 0) issues.push(`Chrome exited with ${exitCode}`);
      if (!stdout.includes('</html>')) issues.push('DOM did not finish loading');
      if (layout !== expectedLayout) issues.push(`expected layout ${expectedLayout}, received ${layout || 'missing'}`);
      if (!interaction) issues.push('browser interaction harness did not finish');
      else issues.push(...interaction.split(';').filter((result) => !result.endsWith(':PASS')).map((result) => `interaction ${result}`));
      if (browserErrors.length) issues.push(...browserErrors);
      if (issues.length) failures.push({ site: siteId, viewport: viewport.name, motion: motionMode.name, issues });
      else passed++;
      console.log(`${issues.length ? 'FAIL' : 'PASS'} ${siteId} ${viewport.name} ${motionMode.name}${interaction ? ` [${interaction}]` : ''}`);
      }
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(`Chrome interaction smoke: ${passed}/${sites.length * viewports.length * motionModes.length} site/viewport/motion combinations passed (theme, sidebar, responsive layout, overflow, focus-visible CSS contract, reduced motion, tabs, dialog).`);
if (failures.length) {
  for (const failure of failures) console.error(JSON.stringify(failure));
  process.exitCode = 1;
}