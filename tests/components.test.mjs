import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const buttonHtml = read('../components/button/button.html');
const buttonCss = read('../components/button/button.css');
const headerHtml = read('../components/header/header.html');
const footerHtml = read('../components/footer/footer.html');
const footerCss = read('../components/footer/footer.css');
const sidebarHtml = read('../components/sidebar/sidebar.html');
const headerCss = read('../components/header/header.css');
const sidebarCss = read('../components/sidebar/sidebar.css');
const baseTemplate = read('../templates/base.html');
const baseCss = read('../components/base/base.css');

test('Button exposes exactly the four documented closed-enum variants', () => {
  const variants = ['primary', 'secondary', 'ghost', 'danger'];
  const buttons = [...buttonHtml.matchAll(/<button([^>]*)>/g)];
  assert.equal(buttons.length, 4);
  for (const variant of variants) {
    const matches = buttons.filter(([, attrs]) => attrs.includes(`chi-btn chi-btn--${variant}`));
    assert.equal(matches.length, 1, `${variant} should appear exactly once`);
    assert.ok(matches[0][1].includes('type="button"'));
  }
});

test('Button disabled state remains visually stable across hover and active', () => {
  for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
    for (const state of [':disabled', ':disabled:hover', ':disabled:active']) {
      assert.ok(buttonCss.includes(`.chi-btn--${variant}${state}`), `${variant} ${state}`);
    }
  }
  assert.ok(buttonCss.includes('.chi-btn:focus-visible'));
});

test('Header and Sidebar controls use native button semantics and named navigation', () => {
  for (const [name, source, nav] of [
    ['Header', headerHtml, '<nav class="chi-subnav" aria-label="本站導覽">'],
    ['Sidebar', sidebarHtml, '<nav class="chi-sidebar__nav" aria-label="本站導覽">'],
  ]) {
    assert.ok(source.includes(nav), `${name} navigation should be named`);
    const controls = [...source.matchAll(/<button([^>]*)>/g)];
    assert.ok(controls.length > 0, `${name} should expose controls`);
    for (const [, attrs] of controls) assert.ok(attrs.includes('type="button"'));
  }
});

test('Header and Sidebar navigation links have token-based visible keyboard focus', () => {
  assert.ok(headerCss.includes('.chi-header__brand:focus-visible'));
  assert.ok(headerCss.includes('.chi-subnav a:focus-visible'));
  assert.ok(sidebarCss.includes('.chi-sidebar__nav a:focus-visible'));
  for (const css of [headerCss, sidebarCss]) {
    assert.ok(css.includes('var(--chi-focus-width)'));
    assert.ok(css.includes('var(--chi-color-focus-ring)'));
    assert.ok(css.includes('var(--chi-focus-offset)'));
  }
});

test('Complete base template gives every button an explicit non-submit type', () => {
  const buttons = [...baseTemplate.matchAll(/<button([^>]*)>/g)];
  assert.ok(buttons.length >= 6);
  for (const [, attrs] of buttons) assert.ok(attrs.includes('type="button"'));
});

test('Form controls retain visible keyboard focus outlines', () => {
  const focusRule = baseCss.match(/:where\([^}]+\):focus-visible\s*\{([^}]+)\}/s);
  assert.ok(focusRule, 'shared focus-visible rule exists');
  assert.match(focusRule[1], /outline:\s*var\(--chi-focus-width\)/);
  const inputFocusRule = baseCss.match(/\.chi-input:focus,[\s\S]*?\.chi-textarea:focus\s*\{([^}]+)\}/);
  assert.ok(inputFocusRule);
  assert.doesNotMatch(inputFocusRule[1], /outline:\s*none/);
});

test('Disabled form controls keep stable feedback and disabled labels', () => {
  for (const selector of [
    '.chi-input:disabled:hover', '.chi-select:disabled:hover', '.chi-textarea:disabled:hover',
    '.chi-select:disabled', '.chi-check:has(.chi-check__input:disabled)',
    '.chi-radio:has(.chi-radio__input:disabled)', '.chi-switch:has(.chi-switch__input:disabled)',
  ]) assert.ok(baseCss.includes(selector), `${selector} is defined`);
  assert.match(baseCss, /\.chi-switch__input:disabled\s*\{[^}]*cursor:\s*not-allowed/s);
});

test('Tabs disabled state and reduced-motion cover all choice controls', () => {
  assert.ok(baseCss.includes('.chi-tab:hover:not(:disabled)'));
  assert.ok(baseCss.includes('.chi-tab:disabled'));
  const reducedMotion = baseCss.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(reducedMotion);
  for (const selector of ['.chi-check__input', '.chi-radio__input', '.chi-switch__input']) {
    assert.ok(reducedMotion[1].includes(selector), `${selector} transition is disabled`);
  }
});

test('Sidebar consumes its component-level surface and active-text tokens', () => {
  assert.match(sidebarCss, /\.chi-sidebar\s*\{[^}]*background:\s*var\(--chi-sidebar-background\)/s);
  assert.match(sidebarCss, /\.chi-sidebar__nav a\[aria-current="page"\]\s*\{[^}]*color:\s*var\(--chi-sidebar-text-active\)/s);
});


test('CSS design-state values are tokenized instead of hard-coded', () => {
  assert.match(baseCss, /opacity:\s*var\(--chi-base-state-disabled-opacity\)/);
  assert.match(baseCss, /animation:\s*chi-spin var\(--chi-base-spinner-duration\)/);
  assert.match(baseCss, /background-color:\s*var\(--chi-color-backdrop\)/);
  assert.match(baseCss, /font-weight:\s*var\(--chi-font-weight-label\)/);
  assert.match(sidebarCss, /opacity:\s*var\(--chi-sidebar-scrim-opacity\)/);
  assert.doesNotMatch(baseCss + sidebarCss, /opacity:\s*0\.[0-9]+|(?:animation|transition):[^;]*\b[0-9]+(?:\.[0-9]+)?(?:ms|s)\b|font-weight:\s*[0-9]+|(?:background-color|background|color):\s*rgb\(/);
  assert.match(read('../scripts/validate.mjs'), /Number Token 必須是有限數值/);
  assert.match(read('../scripts/validate.mjs'), /Duration Token 必須使用 ms 或 s/);
});


test('Theme, Sidebar, Tabs, and Dialog runtime outputs are generated from component sources', () => {
  for (const [source, output] of [
    ['../components/theme/theme.js', '../dist/theme.js'],
    ['../components/sidebar/sidebar.js', '../dist/sidebar.js'],
    ['../components/tabs/tabs.js', '../dist/tabs.js'],
    ['../components/dialog/dialog.js', '../dist/dialog.js'],
  ]) assert.equal(read(source), read(output), `${output} must be generated from ${source}`);
});


test('Generated dist inventory is explicit and excludes undeclared files', () => {
  const validator = read('../scripts/validate.mjs');
  assert.match(validator, /dist 是純生成目錄/);
  assert.match(validator, /dist 產物清單缺少預期檔案/);
  assert.match(validator, /dist 出現未預期的檔案/);
});


test('Every generated site asset resolves inside the standalone dist root', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const distRoot = path.join(root, 'dist');
  for (const site of ['chi', 'fg', 'h', 'merch', 'nav', 'status']) {
    const siteRoot = path.join(distRoot, 'sites', site);
    const html = readFileSync(path.join(siteRoot, 'index.html'), 'utf8');
    for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (/^(?:https?:|#|data:|mailto:|tel:)/i.test(asset)) continue;
      const resolved = path.resolve(siteRoot, asset);
      assert.ok(resolved.startsWith(distRoot + path.sep), `${site} asset escapes dist: ${asset}`);
      assert.ok(existsSync(resolved), `${site} asset does not exist in dist: ${asset}`);
    }
  }
});


test('Header brand and Footer expose the documented shell semantics', () => {
  assert.match(headerHtml, /<span class="chi-header__name">{{site.name}}<\/span>/);
  assert.match(headerHtml, /class="chi-header__logo chi-header__logo--light"[^>]*alt=""/);
  assert.match(headerHtml, /class="chi-header__logo chi-header__logo--dark"[^>]*alt=""/);
  assert.match(footerHtml, /<footer class="chi-footer">/);
  assert.match(footerHtml, /<span class="chi-footer__name">{{site.name}}<\/span>/);
  assert.match(footerHtml, /data-chi-version/);
  assert.doesNotMatch(footerHtml, /<a\b/);
  assert.match(footerCss, /border-top:\s*var\(--chi-base-border-default-width\)/);
  assert.match(read('../scripts/validate.mjs'), /Footer 不得加入跨站連結/);
});


test('Every semantic token is consumed by component CSS or a component-token alias', () => {
  assert.match(read('../scripts/validate.mjs'), /Semantic Token 未被元件 CSS 或元件 Token 使用/);
  assert.match(read('../scripts/validate.mjs'), /componentAliasReferences/);
});


test('Runtime loading order prevents theme and sidebar flash before first paint', () => {
  const template = read('../templates/base.template.html');
  const validator = read('../scripts/validate.mjs');
  const theme = template.indexOf('theme.js');
  const sidebar = template.indexOf('sidebar.js');
  const stylesheet = template.indexOf('<link rel="stylesheet"');
  const tabs = template.match(/<script src="[^"']*tabs\.js"([^>]*)>/);
  const dialog = template.match(/<script src="[^"']*dialog\.js"([^>]*)>/);
  assert.ok(theme >= 0 && theme < sidebar && sidebar < stylesheet);
  assert.match(tabs?.[1] || '', /\bdefer\b/);
  assert.match(dialog?.[1] || '', /\bdefer\b/);
  assert.match(validator, /Runtime 必須在樣式表之前載入/);
  assert.match(validator, /Theme Runtime 必須先於 Sidebar Runtime/);
  assert.match(validator, /必須使用 defer 且不可 async/);
});

test('Component showcase and developer guide cover the stable component catalog', () => {
  const showcase = read('../preview/components.html');
  const guide = read('../docs/COMPONENTS.md');
  const preview = read('../preview/index.html');
  for (const id of ['buttons-title','badges-title','form-title','tabs-title','card-title','list-title','table-title','state-title','dialog-title']) {
    assert.ok(showcase.includes(`id="${id}"`), `showcase section ${id}`);
  }
  for (const brand of ['chi','fg','h','merch','nav','status']) assert.ok(showcase.includes(`value="${brand}"`), `showcase brand ${brand}`);
  for (const contract of ['aria-invalid', 'aria-describedby', 'data-chi-tabs', 'data-chi-dialog-open', 'chi-switch__input']) {
    assert.ok(guide.includes(contract), `developer guide contract ${contract}`);
  }
  assert.match(preview, /href="components\.html"/);
  assert.match(read('../package.json'), /browser-showcase-smoke\.mjs/);
});
