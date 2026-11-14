import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright-core';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const sites = ['chi', 'fg', 'h', 'merch', 'nav', 'status'];
const viewports = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const engines = [
  { name: 'Chromium', browserType: chromium },
  { name: 'Firefox', browserType: firefox },
  { name: 'WebKit', browserType: webkit },
];

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = path.resolve(DIST, '.' + pathname);
  if (!target.startsWith(DIST + path.sep)) return response.writeHead(403).end();
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

        const brand = await page.locator('html').getAttribute('data-chi-brand');
        if (brand !== site) throw new Error(`brand mismatch: expected ${site}, received ${brand}`);

        if (await page.getByRole('main').count() !== 1) throw new Error('expected exactly one main landmark');
        if (await page.getByRole('heading', { level: 1, name: '標題' }).count() !== 1) throw new Error('expected one named level-one heading');

        const themeToggle = page.locator('[data-chi-theme-toggle]:visible').first();
        if (await page.locator('[data-chi-theme-toggle]:visible').count() !== 1) throw new Error('expected one visible theme toggle');
        const beforeMode = await page.locator('html').getAttribute('data-chi-theme-mode');
        await themeToggle.click();
        await page.waitForFunction((previous) => document.documentElement.dataset.chiThemeMode !== previous, beforeMode);
        await themeToggle.click();
        await page.waitForFunction(() => document.documentElement.dataset.chiThemeMode === 'dark' && document.documentElement.dataset.chiTheme === 'dark');
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
        console.log(`PASS ${engine.name} ${site} ${viewport.name} ${geometry.viewport}px mode=${beforeMode}→dark`);
      } catch (error) {
        failures.push({ engine: engine.name, site, viewport: viewport.name, error: String(error), pageErrors });
        console.log(`FAIL ${engine.name} ${site} ${viewport.name} ${String(error)}`);
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

console.log(`Playwright cross-browser smoke: ${passed}/${engines.length * sites.length * viewports.length} engine/site/viewport journeys passed.`);
if (failures.length) {
  for (const failure of failures) console.error(JSON.stringify(failure));
  process.exitCode = 1;
}
