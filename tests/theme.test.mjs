import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/theme.js', import.meta.url), 'utf8');

function createTheme({ stored = null, dark = false, storageThrows = false, loading = false } = {}) {
  const attrs = new Map();
  const listeners = new Map();
  const mediaListeners = new Set();
  const buttons = [];
  const events = [];
  const store = new Map(stored === null ? [] : [['chi-theme-mode', stored]]);
  const localStorage = {
    getItem(key) { if (storageThrows) throw new Error('blocked'); return store.get(key) ?? null; },
    setItem(key, value) { if (storageThrows) throw new Error('blocked'); store.set(key, value); },
  };
  const media = {
    matches: dark,
    addEventListener(type, fn) { if (type === 'change') mediaListeners.add(fn); },
    addListener(fn) { mediaListeners.add(fn); },
  };
  const document = {
    readyState: loading ? 'loading' : 'complete',
    documentElement: { style: {}, setAttribute(k, v) { attrs.set(k, v); }, getAttribute(k) { return attrs.get(k) ?? null; } },
    querySelectorAll() { return buttons; },
    addEventListener(type, fn) { listeners.set(type, fn); },
  };
  const window = {
    localStorage,
    matchMedia() { return media; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    dispatchEvent(event) { events.push(event); },
  };
  vm.runInNewContext(source, { window, document });
  return { api: window.ChiTheme, attrs, store, events, media, mediaListeners, buttons, listeners };
}

test('invalid stored mode falls back to system and follows system preference', () => {
  const ctx = createTheme({ stored: 'sepia', dark: true });
  assert.equal(ctx.api.getMode(), 'system');
  assert.equal(ctx.api.getEffective(), 'dark');
  assert.equal(ctx.attrs.get('data-chi-theme-mode'), 'system');
  assert.equal(ctx.attrs.get('data-chi-theme'), 'dark');
});

test('cycle follows system → light → dark → system and persists user choice', () => {
  const ctx = createTheme();
  assert.equal(ctx.api.cycle(), 'light');
  assert.equal(ctx.store.get('chi-theme-mode'), 'light');
  assert.equal(ctx.api.cycle(), 'dark');
  assert.equal(ctx.api.cycle(), 'system');
  assert.equal(ctx.events.length, 4); // initial apply plus three transitions
});

test('system preference changes update effective theme only in system mode', () => {
  const ctx = createTheme({ dark: false });
  ctx.media.matches = true;
  for (const fn of ctx.mediaListeners) fn();
  assert.equal(ctx.attrs.get('data-chi-theme'), 'dark');
  ctx.api.setMode('light');
  ctx.media.matches = false;
  for (const fn of ctx.mediaListeners) fn();
  assert.equal(ctx.attrs.get('data-chi-theme'), 'light');
  assert.equal(ctx.api.getMode(), 'light');
});

test('preview mode does not persist, invalid modes are ignored', () => {
  const ctx = createTheme({ stored: 'dark' });
  ctx.api.setPreviewMode('light');
  assert.equal(ctx.api.getMode(), 'light');
  assert.equal(ctx.store.get('chi-theme-mode'), 'dark');
  ctx.api.setMode('invalid');
  assert.equal(ctx.api.getMode(), 'light');
});

test('storage failures do not prevent selecting a theme', () => {
  const ctx = createTheme({ storageThrows: true });
  assert.doesNotThrow(() => ctx.api.setMode('dark'));
  assert.equal(ctx.api.getEffective(), 'dark');
});

test('theme toggle icon, accessible label, title, and click cycle stay synchronized', () => {
  const ctx = createTheme();
  const attrs = new Map([['href', '/icons.svg#initial']]);
  const use = {
    getAttribute(key) { return attrs.get(key) ?? null; },
    hasAttribute(key) { return attrs.has(key); },
    setAttribute(key, value) { attrs.set(key, value); },
  };
  const icon = { textContent: '' };
  const button = {
    attrs: new Map(),
    listeners: new Map(),
    querySelector(selector) { return selector === 'use' ? use : selector === '[data-chi-theme-icon]' ? icon : null; },
    setAttribute(key, value) { this.attrs.set(key, value); },
    addEventListener(type, fn) { this.listeners.set(type, fn); },
  };
  ctx.buttons.push(button);
  ctx.api.bindToggles();
  assert.equal(attrs.get('href'), '/icons.svg#sun-moon');
  assert.equal(icon.textContent, '◐');
  assert.equal(button.attrs.get('aria-label'), '目前色彩模式：跟隨系統，點擊切換');
  assert.equal(button.attrs.get('title'), button.attrs.get('aria-label'));
  button.listeners.get('click')();
  assert.equal(attrs.get('href'), '/icons.svg#sun');
  assert.equal(icon.textContent, '☀︎');
  assert.equal(button.attrs.get('aria-label'), '目前色彩模式：淺色，點擊切換');
  assert.equal(button.attrs.get('title'), button.attrs.get('aria-label'));
  assert.equal(button.__chiThemeBound, true);
});