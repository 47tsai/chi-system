import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const runtime = read('../components/dialog.js');
const template = read('../templates/base.template.html');
const spec = read('../SPEC.md');
const builder = read('../scripts/build-site.mjs');

test('Dialog runtime uses native modal semantics and exposes a small stable API', () => {
  for (const contract of [
    'dialog.chi-dialog', 'showModal()', 'dialog.close(returnValue || \'\')',
    'dialog.addEventListener(\'close\'', 'returnFocus.set(dialog, opener || document.activeElement)',
    'target.focus()', 'opener.focus()', 'window.ChiDialog = { init, initAll, open, close }',
  ]) assert.ok(runtime.includes(contract), contract);
  assert.ok(!runtime.includes('onDocumentPointer'));
});

test('Dialog open and close controls are delegated and scoped to their dialog', () => {
  assert.ok(runtime.includes('[data-chi-dialog-open]'));
  assert.ok(runtime.includes('[data-chi-dialog-close]'));
  assert.ok(runtime.includes('getDialog(opener.getAttribute(\'data-chi-dialog-open\'))'));
  assert.ok(runtime.includes('closest(closer, DIALOG_SELECTOR)'));
});

test('Dialog leaves focus trapping and Escape handling to the native modal element', () => {
  assert.ok(runtime.includes('dialog.showModal()'));
  assert.ok(!runtime.includes("addEventListener('keydown'"));
  assert.ok(spec.includes('焦點限制、Escape 與背景 inert 由原生 modal dialog 提供'));
});

test('Canonical shell loads the generated Dialog runtime and every site rewrites its path', () => {
  assert.ok(template.includes('<script src="../dist/dialog.js" defer></script>'));
  assert.ok(builder.includes("'dist', 'dialog.js'"));
  assert.ok(builder.includes(".replaceAll('../dist/dialog.js', '../../dialog.js')"));
});

test('Dialog contract documents accessible title association and focus options', () => {
  for (const contract of ['aria-labelledby', 'data-chi-dialog-open', 'data-chi-dialog-close', 'data-chi-dialog-initial-focus', 'data-chi-dialog-backdrop-close']) {
    assert.ok(spec.includes(contract), contract);
  }
});
function createDialogHarness() {
  const dialogListeners = {};
  const document = {
    activeElement: null,
    addEventListener() {},
    querySelectorAll() { return [dialog]; },
    getElementById(id) { return id === 'test-dialog' ? dialog : null; },
  };
  const opener = { isConnected: true, focusCount: 0, focus() { this.focusCount++; document.activeElement = this; } };
  const target = { focusCount: 0, focus() { this.focusCount++; document.activeElement = this; } };
  const dialog = {
    open: false, attributes: {}, listeners: dialogListeners,
    matches(selector) { return selector === 'dialog.chi-dialog'; },
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector(selector) { return selector.includes('autofocus') || selector.includes('data-chi-dialog-initial-focus') ? target : null; },
    addEventListener(type, callback) { (dialogListeners[type] ||= []).push(callback); },
    showModal() { this.open = true; },
    close(value) { this.open = false; this.returnValue = value; for (const callback of dialogListeners.close || []) callback(); },
  };
  const window = {};
  vm.runInNewContext(runtime, { document, window, WeakMap, WeakSet });
  return { api: window.ChiDialog, document, dialog, opener, target };
}

test('Dialog runtime moves focus in, closes, and restores focus to the opener', () => {
  const h = createDialogHarness();
  h.document.activeElement = h.opener;
  assert.equal(h.api.open(h.dialog, h.opener), true);
  assert.equal(h.dialog.open, true);
  assert.equal(h.document.activeElement, h.target);
  assert.equal(h.target.focusCount, 1);
  assert.equal(h.api.close(h.dialog, 'confirmed'), true);
  assert.equal(h.dialog.open, false);
  assert.equal(h.dialog.returnValue, 'confirmed');
  assert.equal(h.document.activeElement, h.opener);
  assert.equal(h.opener.focusCount, 1);
});

test('Dialog init is idempotent and safely handles missing or already-open dialogs', () => {
  const h = createDialogHarness();
  h.api.init(h.dialog);
  h.api.init(h.dialog);
  assert.equal(h.dialog.listeners.close.length, 1);
  assert.equal(h.api.open(null), false);
  h.dialog.open = true;
  assert.equal(h.api.open(h.dialog, h.opener), false);
  assert.equal(h.api.close(h.dialog), true);
});

test('Dialog backdrop close is opt-in and close restores focus', () => {
  const h = createDialogHarness();
  h.dialog.attributes['data-chi-dialog-backdrop-close'] = '';
  h.api.open(h.dialog, h.opener);
  h.dialog.listeners.click[0]({ target: h.dialog });
  assert.equal(h.dialog.open, false);
  assert.equal(h.dialog.returnValue, 'backdrop');
  assert.equal(h.document.activeElement, h.opener);
});
