import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright-core';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const AXE_SOURCE = readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const sites = (process.env.CHI_TEST_SITES || 'chi,fg,h,merch,nav,status').split(',').filter(Boolean);
const viewports = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
].filter(({ name }) => !process.env.CHI_TEST_VIEWPORTS || process.env.CHI_TEST_VIEWPORTS.split(',').includes(name));
const engines = [
  { name: 'Chromium', browserType: chromium },
  { name: 'Firefox', browserType: firefox },
  { name: 'WebKit', browserType: webkit },
].filter(({ name }) => !process.env.CHI_TEST_ENGINES || process.env.CHI_TEST_ENGINES.split(',').includes(name));

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const root = pathname.startsWith('/preview/') || pathname.startsWith('/dist/') ? ROOT : DIST;
  const target = path.resolve(root, pathname.slice(1));
  if (!target.startsWith(root + path.sep)) return response.writeHead(403).end();
  try {
    if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
    const extension = path.extname(target);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    response.setHeader('content-type', types[extension] || 'application/octet-stream');
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
const failures = [];
let passed = 0;
let axeAuditsPassed = 0;
let showcaseJourneysPassed = 0;
let showcaseAxeAuditsPassed = 0;
const browsers = [];

try {
  for (const engine of engines) {
    const browser = await engine.browserType.launch({
      headless: true,
      ...(engine.name === 'Chromium' ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}),
    });
    browsers.push(browser);

    for (const site of sites) {
      for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: 'light',
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      try {
        const response = await page.goto(`${origin}/sites/${site}/index.html`, { waitUntil: 'load' });
        if (!response?.ok()) throw new Error(`site response was ${response?.status() ?? 'missing'}`);

        await page.addScriptTag({ content: AXE_SOURCE });

        const brand = await page.locator('html').getAttribute('data-chi-brand');
        if (brand !== site) throw new Error(`brand mismatch: expected ${site}, received ${brand}`);

        if (await page.getByRole('main').count() !== 1) throw new Error('expected exactly one main landmark');
        if (await page.getByRole('heading', { level: 1, name: '標題' }).count() !== 1) throw new Error('expected one named level-one heading');

        // 手機版 sidebar 版式站（如 nav）：主題切換在側邊欄抽屜裡，抽屜未開時
        // sidebar.inert = true，按鈕雖可被 :visible 定位到卻點不下去。先照真實
        // 使用者流程開抽屜，等它不再 inert 再繼續。header 版式站不受影響。
        if (viewport.name === 'mobile' && (await page.locator('html').getAttribute('data-chi-layout')) === 'sidebar') {
          await page.locator('.chi-mobile-header [data-chi-sidebar-toggle]').click();
          await page.waitForFunction(() => {
            const sidebar = document.querySelector('.chi-sidebar');
            return sidebar?.classList.contains('mobile-open') && !sidebar.inert;
          });
        }

        const themeToggle = page.locator('[data-chi-theme-toggle]:visible').first();
        if (await page.locator('[data-chi-theme-toggle]:visible').count() !== 1) throw new Error('expected one visible theme toggle');
        const beforeMode = await page.locator('html').getAttribute('data-chi-theme-mode');
        await themeToggle.click();
        await page.waitForFunction((previous) => document.documentElement.dataset.chiThemeMode !== previous, beforeMode);
        await page.waitForFunction(() => document.documentElement.dataset.chiThemeMode === 'light' && document.documentElement.dataset.chiTheme === 'light');
        const lightAudit = await page.evaluate(async () => {
          const { violations, passes } = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
          return { passCount: passes.length, violations: violations.map(({ id, impact, help, nodes }) => ({ id, impact, help, targets: nodes.slice(0, 5).map((node) => node.target) })) };
        });
        if (lightAudit.violations.length) throw new Error(`axe light violations: ${JSON.stringify(lightAudit.violations)}`);
        axeAuditsPassed++;
        await themeToggle.click();
        await page.waitForFunction(() => document.documentElement.dataset.chiThemeMode === 'dark' && document.documentElement.dataset.chiTheme === 'dark');
        const darkAudit = await page.evaluate(async () => {
          const { violations, passes } = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
          return { passCount: passes.length, violations: violations.map(({ id, impact, help, nodes }) => ({ id, impact, help, targets: nodes.slice(0, 5).map((node) => node.target) })) };
        });
        if (darkAudit.violations.length) throw new Error(`axe dark violations: ${JSON.stringify(darkAudit.violations)}`);
        axeAuditsPassed++;
        const after = await page.locator('html').getAttribute('data-chi-theme');
        if (after !== 'dark') throw new Error(`theme toggle expected dark, received ${after}`);

        const geometry = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          title: document.title,
          language: document.documentElement.lang,
        }));
        if (geometry.document > geometry.viewport) throw new Error(`horizontal overflow: ${geometry.document}px > ${geometry.viewport}px`);
        if (geometry.language !== 'zh-Hant') throw new Error(`unexpected document language: ${geometry.language}`);
        if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join('; ')}`);

        passed++;
        console.log(`PASS ${engine.name} ${site} ${viewport.name} ${geometry.viewport}px mode=${beforeMode}→dark axe=${lightAudit.passCount + darkAudit.passCount} passes / 0 violations`);
      } catch (error) {
        failures.push({ engine: engine.name, site, viewport: viewport.name, error: String(error), pageErrors });
        console.log(`FAIL ${engine.name} ${site} ${viewport.name} ${String(error)}`);
      } finally {
        await context.close();
      }
      }
    }

    for (const site of sites) {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: 'light',
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        try {
          const response = await page.goto(`${origin}/preview/components.html?brand=${site}&theme=light`, { waitUntil: 'load' });
          if (!response?.ok()) throw new Error(`showcase response was ${response?.status() ?? 'missing'}`);
          await page.addScriptTag({ content: AXE_SOURCE });
          if (await page.locator('html').getAttribute('data-chi-brand') !== site) throw new Error(`showcase brand mismatch: expected ${site}`);

          const audit = async (theme) => {
            const result = await page.evaluate(async () => {
              const { violations, passes } = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
              return { passCount: passes.length, violations: violations.map(({ id, impact, help, nodes }) => ({ id, impact, help, targets: nodes.slice(0, 5).map((node) => node.target) })) };
            });
            if (result.violations.length) throw new Error(`showcase axe ${theme} violations: ${JSON.stringify(result.violations)}`);
            showcaseAxeAuditsPassed++;
            return result.passCount;
          };

          const tabOne = page.getByRole('tab', { name: '標籤一' });
          const tabTwo = page.getByRole('tab', { name: '標籤二' });
          await tabOne.focus();
          await tabOne.press('ArrowRight');
          if (await tabTwo.getAttribute('aria-selected') !== 'true' || !(await page.locator('#showcase-panel-two').isVisible())) throw new Error('ArrowRight did not activate the next tab and panel');
          await tabTwo.press('ArrowRight');
          if (await tabOne.getAttribute('aria-selected') !== 'true') throw new Error('ArrowRight did not skip the disabled tab and wrap');
          await tabOne.press('End');
          if (await tabTwo.getAttribute('aria-selected') !== 'true') throw new Error('End did not select the last enabled tab');
          await tabTwo.press('Home');
          if (await tabOne.getAttribute('aria-selected') !== 'true') throw new Error('Home did not select the first enabled tab');

          const teamRadio = page.getByRole('radio', { name: '團隊' });
          await teamRadio.check();
          if (!(await teamRadio.isChecked())) throw new Error('radio selection did not persist');
          const notifySwitch = page.getByRole('switch', { name: '啟用通知' });
          await notifySwitch.uncheck();
          if (await notifySwitch.isChecked()) throw new Error('switch did not toggle off');
          await page.getByRole('button', { name: '測試送出' }).click();
          if (await page.locator('#showcase-form-status').textContent() !== '表單互動正常。') throw new Error('form submission status was not announced');

          const opener = page.getByRole('button', { name: '開啟對話框' });
          await opener.click();
          const dialog = page.getByRole('dialog', { name: '對話框標題' });
          if (!(await dialog.isVisible())) throw new Error('dialog did not open');
          const modalState = await dialog.evaluate((element) => ({ modal: element.matches(':modal'), focusInside: element.contains(document.activeElement), focusedControl: document.activeElement?.textContent?.trim() }));
          if (!modalState.modal || !modalState.focusInside || modalState.focusedControl !== '取消') throw new Error(`dialog modal/initial-focus contract failed: ${JSON.stringify(modalState)}`);
          const openDialogAudit = await audit('light-dialog-open');
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          if (!(await opener.evaluate((element) => element === document.activeElement))) throw new Error('dialog did not restore focus to its opener');

          const themeToggle = page.locator('[data-chi-theme-toggle]:visible');
          const lightPasses = await audit('light');
          await themeToggle.click();
          await page.waitForFunction(() => document.documentElement.dataset.chiThemeMode === 'dark' && document.documentElement.dataset.chiTheme === 'dark');
          const darkPasses = await audit('dark');

          const geometry = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
          if (geometry.document > geometry.viewport) throw new Error(`showcase horizontal overflow: ${geometry.document}px > ${geometry.viewport}px`);
          if (pageErrors.length) throw new Error(`showcase page errors: ${pageErrors.join('; ')}`);

          showcaseJourneysPassed++;
          console.log(`PASS ${engine.name} showcase/${site} ${viewport.name} tabs/dialog/forms axe=${openDialogAudit + lightPasses + darkPasses} passes / 0 violations`);
        } catch (error) {
          failures.push({ engine: engine.name, site, viewport: viewport.name, suite: 'showcase', error: String(error), pageErrors });
          console.log(`FAIL ${engine.name} showcase/${site} ${viewport.name} ${String(error)}`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await Promise.all(browsers.map((browser) => browser.close()));
  await new Promise((resolve) => server.close(resolve));
}

console.log(`Playwright cross-browser smoke: site shell ${passed}/${engines.length * sites.length * viewports.length}, component showcase ${showcaseJourneysPassed}/${engines.length * sites.length * viewports.length} journeys passed; axe-core site ${axeAuditsPassed}/${engines.length * sites.length * viewports.length * 2}, showcase ${showcaseAxeAuditsPassed}/${engines.length * sites.length * viewports.length * 3} audits passed.`);
if (failures.length) {
  for (const failure of failures) console.error(JSON.stringify(failure));
  process.exitCode = 1;
}
