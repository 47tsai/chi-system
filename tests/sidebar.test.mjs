import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/sidebar.js', import.meta.url), 'utf8');

class Element {
  constructor(tag = 'DIV') {
    this.tagName = tag;
    this.attrs = new Map();
    this.listeners = new Map();
    this.classes = new Set();
    this.children = [];
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name),
    };
    this.style = {};
    this.inert = false;
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.get(k) ?? null; }
  removeAttribute(k) { this.attrs.delete(k); }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  dispatch(type, event = {}) { this.listeners.get(type)?.(event); }
  querySelector() { return this.children[0] ?? null; }
  querySelectorAll() { return this.children; }
  focus() { this.focused = true; this.onFocus?.(this); }
  contains(node) { return this === node || this.children.some(child => child === node || child.contains?.(node)); }
}

function createSidebar(width = 500) {
  const sidebar = new Element('ASIDE');
  const nav = new Element('NAV');
  const link = new Element('A');
  nav.children = [link];
  sidebar.children = [nav];
  sidebar.querySelector = selector => selector === '.chi-sidebar__nav a' ? link : null;
  sidebar.querySelectorAll = selector => selector.startsWith('a[') ? [link] : [];
  const trigger = new Element('BUTTON');
  const scrim = new Element();
  const html = new Element('HTML');
  const docListeners = new Map();
  const winListeners = new Map();
  const document = {
    documentElement: html,
    readyState: 'complete', activeElement: trigger,
    querySelector: selector => selector === '.chi-sidebar' ? sidebar : selector === '[data-chi-sidebar-scrim]' ? scrim : null,
    querySelectorAll: selector => selector === '[data-chi-sidebar-toggle]' ? [trigger] : [],
    addEventListener: (type, fn) => { const prior = docListeners.get(type); docListeners.set(type, prior ? event => { prior(event); fn(event); } : fn); },
  };
  trigger.onFocus = element => { document.activeElement = element; };
  link.onFocus = element => { document.activeElement = element; };
  const window = {
    innerWidth: width,
    addEventListener: (type, fn) => winListeners.set(type, fn),
    dispatchEvent() {},
  };
  const context = { document, window, localStorage: { getItem: () => null, setItem() {} }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } };
  vm.runInNewContext(source, context);
  return { api: window.ChiSidebar, sidebar, trigger, scrim, html, link, document, window, docListeners, winListeners };
}

test('mobile drawer opens, updates ARIA, and moves focus to first link', () => {
  const ctx = createSidebar();
  ctx.api.openMobile();
  assert.equal(ctx.sidebar.classList.contains('mobile-open'), true);
  assert.equal(ctx.sidebar.inert, false);
  assert.equal(ctx.sidebar.getAttribute('aria-hidden'), 'false');
  assert.equal(ctx.trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(ctx.link.focused, true);
  assert.equal(ctx.scrim.classList.contains('visible'), true);
});

test('Escape closes mobile drawer and restores focus to opener', () => {
  const ctx = createSidebar();
  ctx.api.openMobile();
  ctx.docListeners.get('keydown')({ key: 'Escape' });
  assert.equal(ctx.sidebar.classList.contains('mobile-open'), false);
  assert.equal(ctx.sidebar.inert, true);
  assert.equal(ctx.sidebar.getAttribute('aria-hidden'), 'true');
  assert.equal(ctx.trigger.focused, true);
  assert.equal(ctx.trigger.getAttribute('aria-expanded'), 'false');
});

test('resize to tablet closes drawer without focusing the now-hidden mobile trigger', () => {
  const ctx = createSidebar();
  ctx.api.openMobile();
  ctx.window.innerWidth = 800;
  ctx.winListeners.get('resize')();
  assert.equal(ctx.sidebar.classList.contains('mobile-open'), false);
  assert.notEqual(ctx.document.activeElement, ctx.trigger);
  assert.equal(ctx.sidebar.getAttribute('aria-hidden'), 'false');
  assert.equal(ctx.trigger.getAttribute('aria-expanded'), 'true');
});

test('desktop collapsed state updates root attribute and trigger ARIA', () => {
  const ctx = createSidebar(1200);
  ctx.api.setCollapsed(true);
  assert.equal(ctx.api.isCollapsed(), true);
  assert.equal(ctx.trigger.getAttribute('aria-expanded'), 'false');
  ctx.api.toggleCollapsed();
  assert.equal(ctx.api.isCollapsed(), false);
  assert.equal(ctx.trigger.getAttribute('aria-expanded'), 'true');
});
test('scrim click closes the drawer and restores focus', () => {
  const ctx = createSidebar();
  ctx.api.openMobile();
  ctx.scrim.dispatch('click');
  assert.equal(ctx.sidebar.classList.contains('mobile-open'), false);
  assert.equal(ctx.scrim.classList.contains('visible'), false);
  assert.equal(ctx.trigger.focused, true);
});

test('Tab and Shift+Tab stay inside the open mobile drawer', () => {
  const ctx = createSidebar();
  const last = new Element('BUTTON');
  ctx.sidebar.children.push(last);
  ctx.sidebar.querySelectorAll = selector => selector.startsWith('a[') ? [ctx.link, last] : [];
  ctx.api.openMobile();
  ctx.document.activeElement = last;
  let prevented = false;
  ctx.docListeners.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(ctx.link.focused, true);
  prevented = false;
  ctx.document.activeElement = ctx.link;
  ctx.docListeners.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(last.focused, true);
});

test('Command/Ctrl+B toggles sidebar but does not intercept text inputs', () => {
  const ctx = createSidebar(1200);
  let prevented = false;
  ctx.docListeners.get('keydown')({ key: 'b', ctrlKey: true, target: { tagName: 'INPUT' }, preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
  ctx.docListeners.get('keydown')({ key: 'b', metaKey: true, target: { tagName: 'BODY' }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(ctx.api.isCollapsed(), true);
});