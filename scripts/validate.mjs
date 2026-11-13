// chi-system validate.mjs — 驗真的渲染依據，不是檔案在不在。
// 本地驗證 Token schema／解析、對比計算、禁硬編碼、網站設定、模板渲染、
//   每站建置輸出與斷點一致；axe／Playwright 仍列為 v1.1。
//   axe／Playwright 計算樣式／視覺回歸列為 v1.1（見 SPEC.md §8）。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildTokens } from './build-tokens.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];
const fail = (m) => failures.push(m);

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

// 1. Token schema：每個 Token 都必須明確宣告 $type 與 $value。
//    這一關獨立於 resolveAll，避免「可解析」被誤當成「符合 Token 格式」。
const tokenFiles = [
  'primitives.tokens.json',
  'semantic.tokens.json',
  'semantic-dark.tokens.json',
  'components.tokens.json',
  ...readdirSync(path.join(ROOT, 'tokens', 'brands'))
    .filter((name) => name.endsWith('.tokens.json'))
    .map((name) => 'brands/' + name),
];
const TOKEN_METADATA = new Set(['$description', '$type', '$extensions', '$deprecated', '$experimental']);
function validateTokenNode(node, file, tokenPath = '') {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    fail('Token 結構錯誤：' + file + ' ' + (tokenPath || '(root)') + ' 必須是物件');
    return;
  }
  if (Object.prototype.hasOwnProperty.call(node, '$value')) {
    if (typeof node.$type !== 'string' || !node.$type.trim()) {
      fail('Token 缺少有效 $type：' + file + ' ' + tokenPath);
    }
    if (typeof node.$value === 'string') {
      const value = node.$value;
      const opens = (value.match(/\{/g) || []).length;
      const closes = (value.match(/\}/g) || []).length;
      if (opens !== closes || /\{\s*\}/.test(value)) {
        fail('Token 別名格式錯誤：' + file + ' ' + tokenPath);
      }
    }
    return;
  }
  if (node.$type !== undefined && (typeof node.$type !== 'string' || !node.$type.trim())) {
    fail('Token 群組 $type 無效：' + file + ' ' + (tokenPath || '(root)'));
  }
  const children = Object.entries(node).filter(([key]) => !TOKEN_METADATA.has(key) && !key.startsWith('$'));
  if (tokenPath && children.length === 0) fail('空 Token 群組：' + file + ' ' + tokenPath);
  for (const [key, value] of children) {
    validateTokenNode(value, file, tokenPath ? tokenPath + '.' + key : key);
  }
}
for (const file of tokenFiles) {
  const fullPath = path.join(ROOT, 'tokens', file);
  try {
    validateTokenNode(JSON.parse(readFileSync(fullPath, 'utf8')), 'tokens/' + file);
  } catch (error) {
    if (error instanceof SyntaxError) fail('Token JSON 無法解析：tokens/' + file + '：' + error.message);
    else throw error;
  }
}
console.log('Token schema 檢查完成：' + tokenFiles.length + ' 份來源檔');

// 1. Token 解析（buildTokens 內已做別名解析與循環檢查；未解析會直接拋錯）
const { resolvedLight, resolvedDark, brands } = buildTokens();
console.log(`Token 解析通過：淺色 ${Object.keys(resolvedLight).length} 個，深色 ${Object.keys(resolvedDark).length} 個，品牌 ${Object.keys(brands).length} 個`);

// 2. 對比計算：每品牌×淺深色。一般文字 4.5:1、大字與非文字 UI 3:1（WCAG 2.2 AA）。
const pairs = [
  ['text-primary', 'canvas', 4.5], ['text-secondary', 'canvas', 4.5], ['text-muted', 'canvas', 4.5],
  ['accent', 'canvas', 4.5], ['on-accent', 'accent', 4.5],
  // 元件實際配色：danger 按鈕、secondary／ghost 按鈕與一般表面。
  ['on-accent', 'danger', 4.5], ['text-primary', 'surface', 4.5],
  ['text-primary', 'surface-sunken', 4.5], ['text-secondary', 'surface', 4.5],
  ['accent', 'surface', 4.5],
  ['success', 'canvas', 4.5], ['warning', 'canvas', 4.5], ['danger', 'canvas', 4.5], ['info', 'canvas', 4.5],
  ['success-strong', 'success-bg', 4.5], ['warning-strong', 'warning-bg', 4.5],
  ['danger-strong', 'danger-bg', 4.5], ['info-strong', 'info-bg', 4.5],
];
for (const [theme, vars] of [['light', resolvedLight], ['dark', resolvedDark]]) {
  for (const [fg, bg, min] of pairs) {
    const a = vars[`color.${fg}`];
    const b = vars[`color.${bg}`];
    if (!a || !b) { fail(`對比缺少 Token：${theme} color.${fg} / color.${bg}`); continue; }
    const r = ratio(a, b);
    const line = `對比 ${theme} ${fg} on ${bg}：${r.toFixed(2)}:1（需 ≥${min}:1）`;
    if (r < min) fail(line);
    else notes.push(line);
  }
  // 品牌色只作識別（logo／標記），不作文字：只記錄，不設門檻
  for (const [id, hex] of Object.entries(brands)) {
    notes.push(`品牌 ${id} on canvas（${theme}，僅記錄）：${ratio(hex, vars['color.canvas']).toFixed(2)}:1`);
  }
}

// 3. 禁硬編碼：元件原始 CSS 與模板來源不得出現 hex（註解除外）；生成的 tokens.css 除外（它就是解析後的數值）。
for (const dir of ['components']) {
  for (const f of readdirSync(path.join(ROOT, dir), { recursive: true }).filter((x) => x.endsWith('.css'))) {
    const src = stripComments(readFileSync(path.join(ROOT, dir, f), 'utf8'));
    const hits = src.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hits) fail(`硬編碼色值：${dir}/${f} 出現 ${[...new Set(hits)].join('、')}`);
    const dimensionSource = src.replace(/min-width:\s*\d+px/g, '');
    const dimensionHits = dimensionSource.match(/(?<![\w-])-?\d+(?:\.\d+)?px\b/g);
    if (dimensionHits) fail(`硬編碼尺寸：${dir}/${f} 出現 ${[...new Set(dimensionHits)].join('、')}，請改用 Token`);
  }
}
const template = stripComments(readFileSync(path.join(ROOT, 'templates', 'base.template.html'), 'utf8'));
if (/#[0-9a-fA-F]{3,8}\b/.test(template)) fail('硬編碼色值：templates/base.template.html 出現 hex');
const layoutAttributeCount = (template.match(/\bdata-chi-layout=/g) || []).length;
if (layoutAttributeCount !== 1) fail('模板來源必須且只能有一個 data-chi-layout，實際：' + layoutAttributeCount);
if (/<div\b[^>]*\bdata-chi-layout=/.test(template)) fail('data-chi-layout 必須由根 html 元素統一管理，不可在內層重複設定');

// 預覽必須操作與正式模板相同的根層版式契約，不能再修改內層 shell。
const previewSource = readFileSync(path.join(ROOT, 'preview', 'index.html'), 'utf8');
if (!previewSource.includes("root.setAttribute('data-chi-layout', layout)")) {
  fail('preview/index.html 必須將版式設定到 document.documentElement');
}
if (previewSource.includes("body.replace('data-chi-layout=\\\"header\\\"'")) {
  fail('preview/index.html 不可再修改內層 body shell 的 data-chi-layout');
}

// 4. 網站設定 schema：欄位、型別、品牌檔存在、logo 檔案存在；不寫死站數。
const REQUIRED = ['id', 'name', 'url', 'brand', 'logoLight', 'logoDark', 'description', 'icon'];
const ALLOWED_SITE_KEYS = new Set([...REQUIRED, 'layout']);
const sites = readdirSync(path.join(ROOT, 'sites')).filter((f) => f.endsWith('.json'));
const siteRecords = [];
if (sites.length === 0) fail('sites/ 沒有任何網站設定');
for (const f of sites) {
  let site;
  try {
    site = JSON.parse(readFileSync(path.join(ROOT, 'sites', f), 'utf8'));
  } catch (error) {
    fail('網站設定 JSON 無法解析：' + f + '：' + error.message);
    continue;
  }
  if (!site || typeof site !== 'object' || Array.isArray(site)) {
    fail('網站設定必須是 JSON object：' + f);
    continue;
  }
  siteRecords.push(site);
  for (const k of REQUIRED) {
    if (!(k in site)) fail('網站設定缺欄位：' + f + ' 缺 ' + k);
  }
  for (const k of Object.keys(site)) {
    if (!ALLOWED_SITE_KEYS.has(k)) fail('網站設定含未知欄位：' + f + ' ' + k);
  }
  if (site.id !== f.replace('.json', '')) fail('網站設定 id 與檔名不符：' + f);
  if (typeof site.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(site.id)) {
    fail('網站設定 id 格式不合法：' + f);
  }
  for (const key of ['name', 'brand', 'description', 'icon']) {
    if (typeof site[key] !== 'string' || !site[key].trim()) {
      fail('網站設定欄位必須是非空字串：' + f + ' ' + key);
    }
  }
  if (site.layout !== undefined && !['header', 'sidebar'].includes(site.layout)) {
    fail('網站設定 layout 只能是 header 或 sidebar：' + f);
  }
  if (!brands[site.brand]) fail('網站設定品牌不存在：' + f + ' brand=' + site.brand);
  if (typeof site.url !== 'string') {
    fail('網站設定 url 必須是字串：' + f);
  } else {
    try {
      if (new URL(site.url).protocol !== 'https:') fail('網站設定 url 必須使用 HTTPS：' + f);
    } catch {
      fail('網站設定 url 格式不合法：' + f);
    }
  }
  for (const key of ['logoLight', 'logoDark']) {
    const logo = site[key];
    if (typeof logo !== 'string' || !logo.trim()) {
      fail('網站設定 logo 必須是非空路徑：' + f + ' ' + key);
      continue;
    }
    const resolved = path.resolve(ROOT, logo);
    if (!resolved.startsWith(ROOT + path.sep)) {
      fail('網站設定 logo 不可離開 repo 根目錄：' + f + ' ' + key);
    } else if (!existsSync(resolved)) {
      fail('網站設定 logo 不存在：' + f + ' ' + logo);
    }
  }
}
console.log('網站設定 schema 通過：' + siteRecords.length + ' 站');

// 4b. 預覽清單、模板 placeholder 與每站模板填值必須一致。
const previewSites = JSON.parse(readFileSync(path.join(ROOT, 'preview', 'sites.json'), 'utf8'));
const previewById = new Map(previewSites.map((site) => [site.id, site]));
if (previewSites.length !== siteRecords.length) fail('preview/sites.json 與 sites/*.json 站數不一致');
for (const site of siteRecords) {
  const preview = previewById.get(site.id);
  if (!preview || preview.name !== site.name) fail('preview/sites.json 缺少或名稱不一致：' + site.id);
}
const generatedTemplate = stripComments(readFileSync(path.join(ROOT, 'templates', 'base.html'), 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
const allowedPlaceholders = new Set([
  '{{site.brand}}', '{{site.id}}', '{{site.url}}', '{{site.name}}',
  '{{site.logoLight}}', '{{site.logoDark}}', '{{site.layout}}', '{{version}}',
  '{{slots.actions}}', '{{slots.subnav}}', '{{slots.nav}}',
]);
const foundPlaceholders = generatedTemplate.match(/\{\{[^}]+\}\}/g) || [];
for (const placeholder of foundPlaceholders) {
  if (!allowedPlaceholders.has(placeholder)) fail('模板含未定義 placeholder：' + placeholder);
}
const packageVersion = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const sampleSlots = {
  '{{slots.actions}}': '<button type="button">操作</button>',
  '{{slots.subnav}}': '<a href="#">連結一</a>',
  '{{slots.nav}}': '<a href="#"><span class="chi-sidebar__icon">1</span><span class="chi-sidebar__label">連結一</span></a>',
};
for (const site of siteRecords) {
  const values = {
    '{{site.brand}}': site.brand,
    '{{site.id}}': site.id,
    '{{site.url}}': site.url,
    '{{site.name}}': site.name,
    '{{site.logoLight}}': '../' + site.logoLight,
    '{{site.logoDark}}': '../' + site.logoDark,
    '{{site.layout}}': site.layout === 'sidebar' ? 'sidebar' : 'header',
    '{{version}}': 'v' + packageVersion,
    ...sampleSlots,
  };
  let rendered = generatedTemplate;
  for (const [placeholder, value] of Object.entries(values)) rendered = rendered.split(placeholder).join(value);
  if (/\{\{[^}]+\}\}/.test(rendered)) fail('網站模板仍有未填 placeholder：' + site.id);
  if (!rendered.includes('data-chi-brand="' + site.brand + '"')) fail('網站模板未套用品牌：' + site.id);
  if (!rendered.includes('data-chi-layout="' + (site.layout === 'sidebar' ? 'sidebar' : 'header') + '"')) {
    fail('網站模板未套用指定版式：' + site.id);
  }
  for (const logo of [site.logoLight, site.logoDark]) {
    if (!rendered.includes('../' + logo)) fail('網站模板未輸出 logo：' + site.id + ' ' + logo);
  }
  for (const selector of ['class="chi-header"', 'class="chi-sidebar"', 'class="chi-footer"']) {
    if (!rendered.includes(selector)) fail('網站模板缺少共用殼元件：' + site.id + ' ' + selector);
  }
}
console.log('模板靜態煙霧測試通過：' + siteRecords.length + ' 站，placeholder 全數可填');
// 4c. 實際站點產物：每份 sites/*.json 都必須有完整、無未填變數的可部署 index.html。
for (const site of siteRecords) {
  const outputPath = path.join(ROOT, 'dist', 'sites', site.id, 'index.html');
  if (!existsSync(outputPath)) {
    fail('缺少網站建置輸出：dist/sites/' + site.id + '/index.html');
    continue;
  }
  const output = readFileSync(outputPath, 'utf8');
  const outputWithoutComments = output.replace(/<!--[\s\S]*?-->/g, '');
  if (/\{\{[^}]+\}\}/.test(outputWithoutComments)) {
    fail('網站建置輸出仍有未填 placeholder：' + site.id);
  }
  if (!output.includes('data-chi-brand="' + site.brand + '"')) {
    fail('網站建置輸出未套用品牌：' + site.id);
  }
  const expectedLayout = site.layout === 'sidebar' ? 'sidebar' : 'header';
  if (!output.includes('data-chi-layout="' + expectedLayout + '"')) {
    fail('網站建置輸出未套用版式：' + site.id + ' expected=' + expectedLayout);
  }
  for (const asset of ['../../tokens.css', '../../components.css', '../../theme.js', '../../sidebar.js']) {
    if (!output.includes(asset)) fail('網站建置輸出缺少共用資產路徑：' + site.id + ' ' + asset);
  }
  for (const logo of [site.logoLight, site.logoDark]) {
    const logoPath = '../../../' + logo;
    if (!output.includes(logoPath)) fail('網站建置輸出缺少品牌 Logo 路徑：' + site.id + ' ' + logoPath);
    if (!existsSync(path.join(ROOT, logo))) fail('網站建置輸出引用不存在的品牌 Logo：' + site.id + ' ' + logo);
  }
}
console.log('網站建置輸出檢查通過：' + siteRecords.length + ' 站');

// 5. 斷點一致：768／1024 在 JSON、CSS、JS 三處一致；不得用 max-width 反向寫法。
const bp = JSON.parse(readFileSync(path.join(ROOT, 'breakpoints.json'), 'utf8'));
const widths = bp.breakpoints.map((b) => b.minWidth);
if (JSON.stringify(widths) !== '[768,1024]') fail(`斷點不是 768／1024：${JSON.stringify(widths)}`);
const sidebarCss = readFileSync(path.join(ROOT, 'components', 'sidebar', 'sidebar.css'), 'utf8');
for (const w of widths) if (!sidebarCss.includes(`min-width: ${w}px`)) fail(`sidebar.css 缺 min-width: ${w}px`);
if (/max-width:\s*768px/.test(sidebarCss)) fail('sidebar.css 出現 max-width: 768px 反向寫法（舊報告 A16）');
const sidebarJs = readFileSync(path.join(ROOT, 'dist', 'sidebar.js'), 'utf8');
if (!sidebarJs.includes('768')) fail('sidebar.js 缺 768 斷點值');
if (!sidebarJs.includes('sidebar.inert = hidden')) fail('sidebar.js 未將關閉的手機側欄移出 Tab 順序');
if (!sidebarJs.includes("setAttribute('aria-hidden', hidden ? 'true' : 'false')")) fail('sidebar.js 未同步側欄 aria-hidden');
if (!sidebarJs.includes("event.key !== 'Tab'")) fail('sidebar.js 缺少手機抽屜 Tab 焦點管理');
const sidebarMarkup = readFileSync(path.join(ROOT, 'components', 'sidebar', 'sidebar.html'), 'utf8');
const baseMarkup = readFileSync(path.join(ROOT, 'templates', 'base.template.html'), 'utf8');
if (!sidebarMarkup.includes('id="chi-sidebar"')) fail('sidebar.html 缺少穩定 id');
if (!sidebarMarkup.includes('aria-controls="chi-sidebar"') || !baseMarkup.includes('aria-controls="chi-sidebar"')) {
  fail('側欄觸發按鈕缺少 aria-controls 關聯');
}

console.log(notes.filter((n) => n.startsWith('對比')).join('\n'));
if (failures.length) {
  console.error(`\n驗證失敗 ${failures.length} 項：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\n驗證全部通過。');
