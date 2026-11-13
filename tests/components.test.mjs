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