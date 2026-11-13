import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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