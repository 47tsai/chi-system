import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const examples = read('../components/base/examples.html');
const validator = read('../scripts/validate.mjs');
const spec = read('../SPEC.md');

test('Form labels and descriptive/error relationships resolve to real controls and text', () => {
  const ids = new Set([...examples.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id));
  const controls = new Set([...examples.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map(([, id]) => id));
  const labelTargets = [...examples.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(([, id]) => id);
  assert.ok(labelTargets.length > 0);
  for (const id of labelTargets) assert.ok(controls.has(id), `label target ${id}`);
  for (const [, refs] of examples.matchAll(/\baria-describedby="([^"]+)"/g)) {
    for (const id of refs.split(/\s+/)) assert.ok(ids.has(id), `description target ${id}`);
  }
  assert.match(examples, /aria-invalid="true"/);
  assert.match(examples, /class="chi-field__error" id="example-email-error"/);
});

test('Tabs example follows the tablist, tab, panel, and roving-tabindex contract', () => {
  assert.match(examples, /role="tablist" aria-label="帳戶資訊"/);
  const tabs = [...examples.matchAll(/<button([^>]*role="tab"[^>]*)>/g)];
  assert.equal(tabs.length, 2);
  for (const [, attrs] of tabs) {
    const id = attrs.match(/\bid="([^"]+)"/)[1];
    const panel = attrs.match(/\baria-controls="([^"]+)"/)[1];
    assert.match(attrs, /type="button"/);
    assert.ok(examples.includes(`id="${panel}" role="tabpanel" aria-labelledby="${id}"`));
  }
  assert.match(validator, /Tabs 範例必須且只能有一個 aria-selected=true/);
  assert.match(validator, /tabindex 必須與 aria-selected 同步/);
});

test('Cards, lists, and tables use native document semantics', () => {
  assert.match(examples, /<article class="chi-card" aria-labelledby="example-card-heading">/);
  assert.match(examples, /<h3 class="chi-card__title" id="example-card-heading">/);
  assert.match(examples, /<ul class="chi-list" aria-label="最近活動">[\s\S]*?<li/);
  assert.match(examples, /<table class="chi-table">[\s\S]*?<caption>/);
  assert.match(examples, /<th scope="col">/);
  assert.match(examples, /<th scope="row">/);
  assert.match(validator, /表格必須提供 caption/);
  assert.match(validator, /scope=col 與 scope=row/);
});

test('Semantic examples are documented as the reference contract', () => {
  assert.ok(spec.includes('components/base/examples.html'));
  assert.ok(validator.includes('基礎元件語意範例'));
});
 
test('Form error styling and ARIA state are represented consistently', () => {
  assert.match(examples, /class="chi-field chi-field--error"/);
  assert.match(examples, /aria-invalid="true"/);
  assert.match(examples, /aria-describedby="example-email-hint example-email-error"/);
  assert.match(readFileSync(new URL('../components/base/base.css', import.meta.url), 'utf8'), /\.chi-field--error \.chi-input/);
});

test('Dialog example has a named native dialog and matching open/close controls', () => {
  assert.match(examples, /<dialog class="chi-dialog" id="example-dialog" aria-labelledby="example-dialog-title">/);
  assert.match(examples, /data-chi-dialog-open="example-dialog"/);
  assert.match(examples, /data-chi-dialog-close/);
  assert.match(examples, /id="example-dialog-title"/);
});
