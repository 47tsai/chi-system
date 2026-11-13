import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const buttonHtml = read('../components/button/button.html');
const buttonCss = read('../components/button/button.css');
const headerHtml = read('../components/header/header.html');
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