// site-tokens.test.mjs — U1 檢查的回歸測試：站點 CSS 不得定義 --chi-*。
// 反例取自 nav/css/nav.css 真實 :root 區塊；正例取自 fg/site/fg.css 真實寫法
//（fg 全站只引用 var(--chi-*)，不定義）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { findChiTokenDefinitions } from '../scripts/check-site-tokens.mjs';

// nav/css/nav.css:2-7 原文節錄（minified 單行，僅保留關鍵定義）
const NAV_CSS = `:root{
  color-scheme:light;
  --chi-color-page:#f6f8fc;--chi-color-page-soft:#f1f5fb;--chi-color-surface:#fff;
  --chi-color-text:#33343a;--chi-color-text-strong:#202127;
  --chi-color-border:#e8ebf2;--chi-color-border-strong:#d4dae6;--chi-color-accent:#008cad;--chi-color-accent-hover:#006e87;--chi-color-accent-soft:#e6f4f7;--chi-color-accent-border:#8ed0de;--chi-color-focus:#008cad;
  --chi-color-success:#237a50;--chi-color-success-soft:#ecfdf3;--chi-color-warning:#8a5b13;--chi-color-danger:#b93843;
  --chi-font-sans:"Noto Sans TC",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --chi-radius-sm:6px;--chi-radius-md:10px;--chi-radius-lg:16px;--chi-radius-xl:22px;
}
.nav-divider{height:1px;background:var(--chi-color-border);}
.search-icon{color:var(--chi-color-accent);}`;

// fg/site/fg.css:8-16 原文節錄（只引用，不定義）
const FG_CSS = `.fg-skip-link {
  position: absolute;
  left: var(--chi-space-3);
  top: -60px;
  z-index: 50;
  padding: var(--chi-space-2) var(--chi-space-3);
  border: 1px solid var(--chi-color-border-strong);
  border-radius: var(--chi-radius-md);
  background: var(--chi-color-surface);
  color: var(--chi-color-text-primary);
  text-decoration: none;
}`;

test('nav.css 的 --chi- 定義全數被抓到，含 accent 與語意色', () => {
  const found = findChiTokenDefinitions(NAV_CSS);
  const props = found.map((v) => v.property);
  assert.ok(props.includes('--chi-color-accent'), '應抓到 --chi-color-accent');
  assert.equal(found.find((v) => v.property === '--chi-color-accent').value, '#008cad');
  for (const p of ['--chi-color-success', '--chi-color-warning', '--chi-color-danger', '--chi-font-sans', '--chi-radius-md']) {
    assert.ok(props.includes(p), '應抓到 ' + p);
  }
  assert.equal(found.find((v) => v.property === '--chi-color-success').value, '#237a50');
  // var(--chi-*) 引用不算定義：全文只有 --chi-color-accent 一次定義，引用不重複計數
  assert.equal(props.filter((p) => p === '--chi-color-accent').length, 1);
  assert.ok(found.every((v) => Number.isInteger(v.line) && v.line >= 1));
});

test('fg.css 只引用 var(--chi-*)，零違規', () => {
  assert.deepEqual(findChiTokenDefinitions(FG_CSS), []);
});

test('站點自己的 --<站點>-* 變數不受限，註解內的定義不算', () => {
  const css = `/* --chi-color-accent: #ff0000; 註解不算 */
:root { --fg-accent: #FF9A00; --nav-foo: 1px; color: var(--chi-color-text-primary); }`;
  assert.deepEqual(findChiTokenDefinitions(css), []);
});

test('無分號收尾的定義（} 前）也抓得到', () => {
  const found = findChiTokenDefinitions(':root{--chi-color-accent:#008cad}');
  assert.equal(found.length, 1);
  assert.equal(found[0].property, '--chi-color-accent');
});
