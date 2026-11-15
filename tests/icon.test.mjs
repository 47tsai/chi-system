import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../components/icon/icon.js', import.meta.url), 'utf8');
const iconCss = readFileSync(new URL('../components/icon/icon.css', import.meta.url), 'utf8');
const buildSite = readFileSync(new URL('../scripts/build-site.mjs', import.meta.url), 'utf8');

// nav 全站 Font Awesome 6.4.0 CDN 用到的圖示必須全數收進此圖示集（U4）。
// 39 個 key：solid 31、regular 2、brands 6；'fa-solid fa-star' 與
// 'fa-regular fa-star' 是不同圖示，不得互相覆蓋。
const EXPECTED = [
  'fa-solid fa-book', 'fa-solid fa-cart-shopping', 'fa-solid fa-code', 'fa-solid fa-gamepad',
  'fa-solid fa-screwdriver-wrench', 'fa-solid fa-star', 'fa-solid fa-tv', 'fa-solid fa-users',
  'fa-solid fa-wand-magic-sparkles', 'fa-solid fa-layer-group', 'fa-solid fa-clock-rotate-left',
  'fa-solid fa-bolt', 'fa-solid fa-house', 'fa-solid fa-magnifying-glass', 'fa-solid fa-globe',
  'fa-solid fa-wifi', 'fa-solid fa-triangle-exclamation', 'fa-solid fa-rotate-right',
  'fa-solid fa-location-arrow', 'fa-solid fa-shield-halved', 'fa-solid fa-sun', 'fa-solid fa-moon',
  'fa-solid fa-circle-half-stroke', 'fa-solid fa-bookmark', 'fa-solid fa-arrow-right',
  'fa-solid fa-compass', 'fa-solid fa-play', 'fa-solid fa-comments', 'fa-solid fa-envelope',
  'fa-solid fa-cloud', 'fa-solid fa-n',
  'fa-regular fa-star', 'fa-regular fa-copy',
  'fa-brands fa-google', 'fa-brands fa-facebook', 'fa-brands fa-youtube', 'fa-brands fa-github',
  'fa-brands fa-instagram', 'fa-brands fa-threads',
];

// 抽查：與來源 SVG 核對過的 viewBox（其餘以格式＋map 一致性檢查覆蓋）。
const SPOT_VIEWBOX = {
  'fa-solid fa-star': '0 0 576 512',
  'fa-solid fa-house': '0 0 576 512',
  'fa-solid fa-bookmark': '0 0 384 512',
  'fa-solid fa-n': '0 0 384 512',
  'fa-solid fa-circle-half-stroke': '0 0 512 512',
  'fa-regular fa-copy': '0 0 512 512',
  'fa-regular fa-star': '0 0 576 512',
  'fa-brands fa-google': '0 0 488 512',
  'fa-brands fa-github': '0 0 496 512',
  'fa-brands fa-threads': '0 0 448 512',
  'fa-brands fa-facebook': '0 0 512 512',
  'fa-brands fa-youtube': '0 0 576 512',
  'fa-brands fa-instagram': '0 0 448 512',
};

function loadIcon() {
  const window = {};
  vm.runInNewContext(source, { window });
  return window.ChiIcon;
}

// 從 icon.js 原始碼抽出 ICONS map，與 chiIcon() 輸出逐一比對，
// 確保輸出用的 viewBox／path 就是 map 裡登記的那一份（不是寫死的另一份）。
function parseMap() {
  const map = new Map();
  const body = source.match(/var ICONS = \{([\s\S]*?)\n  \};/)?.[1] ?? '';
  for (const match of body.matchAll(/'([^']+)': \{ viewBox: '([^']+)', path: '([^']+)' \}/g)) {
    map.set(match[1], { viewBox: match[2], path: match[3] });
  }
  return map;
}

test('icon list covers every nav icon: 39 keys, no duplicates, solid/regular star kept separate', () => {
  const api = loadIcon();
  assert.equal(EXPECTED.length, 39);
  assert.equal(new Set(EXPECTED).size, 39);
  assert.deepEqual([...api.list()].sort(), [...EXPECTED].sort());
  for (const key of EXPECTED) assert.equal(api.has(key), true, `${key} missing`);
  assert.notEqual(
    api.icon('fa-solid fa-star'),
    api.icon('fa-regular fa-star'),
    'solid star and regular star must render different paths',
  );
});

test('every icon renders a legal inline svg with the map viewBox and path', () => {
  const api = loadIcon();
  const map = parseMap();
  assert.equal(map.size, 39, 'ICONS map in source must hold all 39 icons');
  for (const key of EXPECTED) {
    const entry = map.get(key);
    assert.ok(entry, `${key} has no map entry`);
    assert.match(entry.viewBox, /^0 0 \d+ 512$/, `${key} viewBox must keep the Font Awesome original`);
    assert.match(entry.path, /^[Mm][0-9A-Za-z .,\-]+$/, `${key} path must be a single SVG path`);
    const svg = api.icon(key);
    assert.equal(
      svg,
      `<svg class="chi-icon" viewBox="${entry.viewBox}" fill="currentColor" aria-hidden="true"><path d="${entry.path}"/></svg>`,
      `${key} output must use its own map entry`,
    );
    assert.match(svg, /^<svg [^>]*><path d="[^"]+"\/><\/svg>$/);
  }
  for (const [key, viewBox] of Object.entries(SPOT_VIEWBOX)) {
    assert.ok(api.icon(key).includes(`viewBox="${viewBox}"`), `${key} viewBox must be ${viewBox}`);
  }
});

test('chiIcon accepts FA class spellings, sizes, titles, and sanitizes extra classes', () => {
  const api = loadIcon();
  const star = api.icon('fa-solid fa-star');
  assert.equal(api.icon('fa-star'), star, "'fa-star' defaults to solid");
  assert.equal(api.icon('star'), star, "bare 'star' defaults to solid");
  assert.equal(api.icon('  FA-SOLID   fa-star  '), star, 'whitespace and case are tolerated');
  assert.equal(api.icon('fas fa-star'), star, "'fas' alias resolves to solid");
  assert.equal(api.icon('far fa-star'), api.icon('fa-regular fa-star'), "'far' alias resolves to regular");
  assert.equal(api.icon('fab fa-github'), api.icon('fa-brands fa-github'), "'fab' alias resolves to brands");
  assert.match(api.icon('fa-solid fa-star', { size: 'sm' }), /class="chi-icon chi-icon--sm"/);
  assert.match(api.icon('fa-solid fa-star', { size: 'lg' }), /class="chi-icon chi-icon--lg"/);
  assert.match(api.icon('fa-solid fa-star', { size: 'huge' }), /class="chi-icon"/, 'unknown size is ignored, not rendered');
  const titled = api.icon('fa-solid fa-house', { title: '首頁' });
  assert.match(titled, /role="img"><title>首頁<\/title>/);
  assert.doesNotMatch(titled, /aria-hidden/);
  assert.match(api.icon('fa-solid fa-star', { title: '<b>&"' }), /<title>&lt;b&gt;&amp;&quot;<\/title>/, 'title is HTML-escaped');
  assert.doesNotMatch(api.icon('fa-solid fa-star', { className: '"><script>alert(1)</script>' }), /<script>/, 'className injection is stripped');
  assert.match(api.icon('fa-solid fa-star', { className: 'my-icon' }), /class="chi-icon my-icon"/);
});

test('unknown icon names return the fallback instead of throwing', () => {
  const api = loadIcon();
  const fallback = api.icon('fa-solid fa-triangle-exclamation');
  assert.equal(api.FALLBACK, 'fa-solid fa-triangle-exclamation');
  for (const bad of ['fa-solid fa-nope', 'fa-brands fa-nope', 'bogus', '', '   ', null, undefined, 42, 'fa-solid']) {
    assert.doesNotThrow(() => api.icon(bad), `chiIcon(${JSON.stringify(bad)}) must not throw`);
    assert.equal(api.icon(bad), fallback, `chiIcon(${JSON.stringify(bad)}) must return the fallback`);
    assert.equal(api.has(bad), false, `has(${JSON.stringify(bad)}) must be false`);
  }
  assert.equal(api.has('fa-solid fa-triangle-exclamation'), true, 'the fallback icon itself is a real icon');
});

test('icon.js states the Font Awesome Free license and the threads 6.4.2 exception', () => {
  assert.match(source, /Font Awesome Free 6\.4\.0/);
  assert.match(source, /Icons: CC BY 4\.0/);
  assert.match(source, /fa-brands fa-threads.*6\.4\.2/s, 'threads must document that it came from 6.4.2, not 6.4.0');
  assert.match(source, /not depend on (an )?external|不依賴外部檔案/, 'icon.js must state it needs no external file or sprite');
});

test('icon.css sizes inline svg in em, keeps currentColor, and fills the sidebar icon slot', () => {
  assert.match(iconCss, /svg\.chi-icon\s*\{[^}]*width:\s*1em;[^}]*height:\s*1em;[^}]*fill:\s*currentColor;[^}]*vertical-align:/s);
  assert.match(iconCss, /svg\.chi-icon--sm\s*\{[^}]*width:\s*var\(--chi-base-icon-sm\)/s);
  assert.match(iconCss, /svg\.chi-icon--lg\s*\{[^}]*width:\s*var\(--chi-base-icon-lg\)/s);
  assert.match(iconCss, /\.chi-sidebar__icon\s*\{[^}]*width:\s*var\(--chi-base-icon-md\);[^}]*height:\s*var\(--chi-base-icon-md\)/s);
  assert.match(iconCss, /\.chi-sidebar__icon svg\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%/s);
  assert.doesNotMatch(iconCss.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|\d+px\b/, 'icon.css must not hard-code colors or pixel sizes');
});

test('build wires icon into the CSS order before base and copies icon.js to dist', () => {
  assert.match(buildSite, /const order = \['header', 'footer', 'sidebar', 'button', 'icon', 'base'\]/);
  assert.match(buildSite, /writeFileSync\(path\.join\(ROOT, 'dist', 'icon\.js'\), readFileSync\(path\.join\(ROOT, 'components', 'icon', 'icon\.js'\), 'utf8'\)\)/);
});
