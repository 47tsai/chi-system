import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/tabs.js', import.meta.url), 'utf8');

class Element {
  constructor(role = '') {
    this.attrs = new Map();
    this.listeners = new Map();
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.focused = false;
    if (role) this.setAttribute('role', role);
  }
  setAttribute(key, value) { this.attrs.set(key, String(value)); }
  getAttribute(key) { return this.attrs.get(key) ?? null; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  contains(node) { return this === node || this.children.includes(node); }
  querySelectorAll(selector) { return selector === '[role="tab"]' ? this.children : []; }
  closest(selector) { return selector === '[role="tab"]' && this.getAttribute('role') === 'tab' ? this : null; }
  focus() { this.focused = true; }
  dispatch(type, event) { this.listeners.get(type)?.(event); }
}

function setup() {
  const root = new Element();
  const tabs = [new Element('tab'), new Element('tab'), new Element('tab'), new Element('tab')];
  const panels = tabs.map(() => new Element('tabpanel'));
  const byId = new Map();
  tabs.forEach((tab, index) => {
    tab.setAttribute('id', `tab-${index + 1}`);
    tab.setAttribute('aria-controls', `panel-${index + 1}`);
    tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    panels[index].setAttribute('id', `panel-${index + 1}`);
    panels[index].setAttribute('aria-labelledby', `tab-${index + 1}`);
    byId.set(`panel-${index + 1}`, panels[index]);
  });
  tabs[2].disabled = true;
  root.children = tabs;
  const document = {
    readyState: 'complete',
    getElementById: id => byId.get(id) ?? null,
    querySelectorAll: selector => selector === '[data-chi-tabs]' ? [root] : [],
    addEventListener() {},
  };
  const window = {};
  vm.runInNewContext(source, { document, window });
  return { root, tabs, panels, byId, document, api: window.ChiTabs };
}

test('Tabs initialize selected tab, roving tabindex, and associated panels', () => {
  const { tabs, panels } = setup();
  assert.equal(tabs[0].getAttribute('tabindex'), '0');
  assert.equal(tabs[1].getAttribute('tabindex'), '-1');
  assert.equal(panels[0].hidden, false);
  assert.equal(panels[1].hidden, true);
  assert.equal(panels[2].hidden, true);
});

test('Arrow keys wrap and skip disabled tabs while synchronizing panels', () => {
  const { root, tabs, panels } = setup();
  let prevented = false;
  root.dispatch('keydown', { target: tabs[1], key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(tabs[3].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[3].focused, true);
  assert.equal(panels[3].hidden, false);
  assert.equal(panels[1].hidden, true);
  root.dispatch('keydown', { target: tabs[3], key: 'ArrowRight', preventDefault() {} });
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
});

test('Home and End move to first and last enabled tabs', () => {
  const { root, tabs } = setup();
  root.dispatch('keydown', { target: tabs[0], key: 'End', preventDefault() {} });
  assert.equal(tabs[3].getAttribute('aria-selected'), 'true');
  root.dispatch('keydown', { target: tabs[3], key: 'Home', preventDefault() {} });
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
});

test('Click selects a tab without stealing focus and disabled tabs cannot activate', () => {
  const { root, tabs, panels } = setup();
  root.dispatch('click', { target: tabs[1] });
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[1].focused, false);
  root.dispatch('click', { target: tabs[2] });
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(panels[1].hidden, false);
});

test('Tabs init is idempotent and can initialize a newly inserted tablist', () => {
  const { root, api, tabs, byId } = setup();
  const prior = root.listeners.get('keydown');
  api.init(root);
  assert.equal(root.listeners.get('keydown'), prior);
  const another = new Element();
  const tab = new Element('tab');
  tab.setAttribute('aria-controls', 'panel-1');
  const panel = new Element('tabpanel');
  byId.set('panel-dynamic', panel);
  tab.setAttribute('aria-controls', 'panel-dynamic');
  another.children = [tab];
  api.init(another);
  assert.equal(tab.getAttribute('tabindex'), '0');
  assert.equal(panel.hidden, false);
});


test('Tabs initialize after DOMContentLoaded when script loads before the document is ready', () => {
  const root = new Element();
  const tab = new Element('tab');
  const panel = new Element('tabpanel');
  tab.setAttribute('aria-controls', 'late-panel');
  const listeners = new Map();
  const document = {
    readyState: 'loading',
    querySelectorAll: () => [root],
    getElementById: id => id === 'late-panel' ? panel : null,
    addEventListener: (type, fn) => listeners.set(type, fn),
  };
  root.children = [tab];
  vm.runInNewContext(source, { document, window: {} });
  assert.equal(root.getAttribute('data-chi-tabs-initialized'), null);
  listeners.get('DOMContentLoaded')();
  assert.equal(root.getAttribute('data-chi-tabs-initialized'), 'true');
  assert.equal(tab.getAttribute('tabindex'), '0');
});