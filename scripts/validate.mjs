// chi-system validate.mjs — 驗真的渲染依據，不是檔案在不在。
// 本地驗證 Token schema／解析、對比計算、禁硬編碼、網站設定、模板渲染、
//   每站建置輸出與斷點一致；axe／Playwright 仍列為 v1.1。
//   axe／Playwright 計算樣式／視覺回歸列為 v1.1（見 SPEC.md §8）。
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildTokens, flatten } from './build-tokens.mjs';

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
const SUPPORTED_TOKEN_TYPES = new Set(['color', 'dimension', 'duration', 'fontFamily', 'fontWeight', 'number', 'shadow']);
function validateTokenNode(node, file, tokenPath = '') {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    fail('Token 結構錯誤：' + file + ' ' + (tokenPath || '(root)') + ' 必須是物件');
    return;
  }
  if (Object.prototype.hasOwnProperty.call(node, '$value')) {
    if (typeof node.$type !== 'string' || !SUPPORTED_TOKEN_TYPES.has(node.$type)) {
      fail('Token $type 不受目前生成器支援：' + file + ' ' + tokenPath + ' (' + String(node.$type) + ')');
    }
    // 目前生成器只處理字串型 Token；複合物件值需先擴充序列化器，不能靜默輸出 [object Object]。
    if (typeof node.$value !== 'string' || !node.$value.trim()) {
      fail('Token $value 必須是非空字串（目前生成器支援範圍）：' + file + ' ' + tokenPath);
    } else {
      const value = node.$value;
      const opens = (value.match(/\{/g) || []).length;
      const closes = (value.match(/\}/g) || []).length;
      if (opens !== closes || /\{\s*\}/.test(value)) {
        fail('Token 別名格式錯誤：' + file + ' ' + tokenPath);
      }
      if (node.$type === 'color' && !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) && !/^\{[^{}]+\}$/.test(value)) {
        fail('Color Token 必須是 hex 或單一 Token 別名：' + file + ' ' + tokenPath);
      }
      if (node.$type === 'number' && !/^\{[^{}]+\}$/.test(value) && !Number.isFinite(Number(value))) {
        fail('Number Token 必須是有限數值：' + file + ' ' + tokenPath);
      }
      if (node.$type === 'duration' && !/^\d+(?:\.\d+)?(?:ms|s)$/.test(value) && !/^\{[^{}]+\}$/.test(value)) {
        fail('Duration Token 必須使用 ms 或 s：' + file + ' ' + tokenPath);
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

// 別名型別必須一致：避免 color 指向 dimension 等可解析但語意錯誤的 Token。
const tokenSource = (file) => flatten(JSON.parse(readFileSync(path.join(ROOT, 'tokens', file), 'utf8')), '', {});
const primitiveDefinitions = tokenSource('primitives.tokens.json');
const lightDefinitions = {
  ...tokenSource('semantic.tokens.json'),
  ...tokenSource('components.tokens.json'),
};
const darkDefinitions = tokenSource('semantic-dark.tokens.json');
const layeredDefinitions = { ...primitiveDefinitions, ...lightDefinitions, ...darkDefinitions };
function validateAliases(definitions, scope) {
  for (const [name, token] of Object.entries(definitions)) {
    if (typeof token.$value !== 'string') continue;
    for (const match of token.$value.matchAll(/\{([^{}]+)\}/g)) {
      const targetName = match[1].trim();
      const target = definitions[targetName] ?? layeredDefinitions[targetName];
      if (!target) {
        fail(`Token 別名不存在：${scope} ${name} → ${targetName}`);
      } else if (target.$type !== token.$type) {
        fail(`Token 別名型別不一致：${scope} ${name} (${token.$type}) → ${targetName} (${target.$type})`);
      }
    }
  }
}
validateAliases(layeredDefinitions, 'shared');
const brandDirectory = path.join(ROOT, 'tokens', 'brands');
for (const file of readdirSync(brandDirectory).filter((name) => name.endsWith('.tokens.json'))) {
  const brandDefinitions = flatten(JSON.parse(readFileSync(path.join(brandDirectory, file), 'utf8')), '', {});
  validateAliases(brandDefinitions, file);
}

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
    const rawTiming = src.match(/(?:animation|transition):[^;{}]*\b\d+(?:\.\d+)?(?:ms|s)\b/g);
    if (rawTiming) fail(`硬編碼動效時間：${dir}/${f} 出現 ${[...new Set(rawTiming)].join('、')}，請改用 Duration Token`);
    const rawOpacity = src.match(/opacity:\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\b/g);
    if (rawOpacity) fail(`硬編碼透明度：${dir}/${f} 出現 ${[...new Set(rawOpacity)].join('、')}，請改用 Number Token`);
    const rawWeight = src.match(/font-weight:\s*(?:[1-9]00|normal|bold)\b/g);
    if (rawWeight) fail(`硬編碼字重：${dir}/${f} 出現 ${[...new Set(rawWeight)].join('、')}，請改用 FontWeight Token`);
    const rawColorFunction = src.match(/(?:background(?:-color)?|color):\s*rgba?\(/g);
    if (rawColorFunction) fail(`硬編碼顏色函式：${dir}/${f} 出現 ${[...new Set(rawColorFunction)].join('、')}，請改用 Color Token`);
  }
}

// CSS 自訂屬性引用完整性：元件與生成 CSS 的 var(--chi-*) 必須有定義，或明確提供 fallback。
const cssFiles = [
  ...readdirSync(path.join(ROOT, 'components'), { recursive: true })
    .filter((file) => file.endsWith('.css'))
    .map((file) => path.join(ROOT, 'components', file)),
path.join(ROOT, 'dist', 'tokens.css'),
  path.join(ROOT, 'dist', 'components.css'),
];
const cssSources = cssFiles.map((file) => [file, stripComments(readFileSync(file, 'utf8'))]);
const componentCss = readdirSync(path.join(ROOT, 'components'), { recursive: true })
  .filter((file) => file.endsWith('.css'))
  .map((file) => stripComments(readFileSync(path.join(ROOT, 'components', file), 'utf8'))).join('\n');
for (const name of Object.keys(tokenSource('components.tokens.json'))) {
  const variable = `var(--chi-${name.replaceAll('.', '-')})`;
  if (!componentCss.includes(variable)) fail(`元件 Token 未被任何元件 CSS 使用：${name}`);
}
const semanticDefinitions = tokenSource('semantic.tokens.json');
const componentDefinitions = tokenSource('components.tokens.json');
const componentAliasReferences = new Set(Object.values(componentDefinitions).flatMap((token) =>
  typeof token.$value === 'string'
    ? [...token.$value.matchAll(/\{([^{}]+)\}/g)].map(([, name]) => name.trim())
    : [],
));
for (const name of Object.keys(semanticDefinitions)) {
  const variable = `var(--chi-${name.replaceAll('.', '-')})`;
  if (!componentCss.includes(variable) && !componentAliasReferences.has(name)) fail(`Semantic Token 未被元件 CSS 或元件 Token 使用：${name}`);
}
const definedProperties = new Set();
for (const [, source] of cssSources) {
  for (const match of source.matchAll(/(^|[;{\s])(--[\w-]+)\s*:/gm)) definedProperties.add(match[2]);
}
const unresolvedProperties = new Map();
for (const [file, source] of cssSources) {
  for (const match of source.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) {
    const name = match[1];
    if (!definedProperties.has(name) && !match[2]) {
      if (!unresolvedProperties.has(name)) unresolvedProperties.set(name, new Set());
      unresolvedProperties.get(name).add(path.relative(ROOT, file));
    }
  }
}
for (const [name, files] of unresolvedProperties) {
  fail(`CSS Token 未定義：${name}，引用位置：${[...files].join('、')}`);
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
const siteIds = new Set();
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
  if (siteIds.has(site.id)) fail('網站設定 id 重複：' + site.id);
  siteIds.add(site.id);
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
  if (site.brand !== site.id) fail('目前站點契約要求 brand 與 site id 一致：' + f);
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
  for (const asset of ['../../tokens.css', '../../components.css', '../../theme.js', '../../sidebar.js', '../../tabs.js', '../../dialog.js']) {
    if (!output.includes(asset)) fail('網站建置輸出缺少共用資產路徑：' + site.id + ' ' + asset);
    const resolved = path.resolve(ROOT, 'dist', 'sites', site.id, asset);
    if (!resolved.startsWith(path.join(ROOT, 'dist') + path.sep) || !existsSync(resolved)) fail('網站建置輸出引用不存在或越界的共用資產：' + site.id + ' ' + asset);
  }
  for (const logo of [site.logoLight, site.logoDark]) {
    const logoPath = '../../' + logo;
    if (!output.includes(logoPath)) fail('網站建置輸出缺少品牌 Logo 路徑：' + site.id + ' ' + logoPath);
    const resolvedLogo = path.resolve(ROOT, 'dist', 'sites', site.id, logoPath);
    if (!existsSync(path.join(ROOT, logo)) || !resolvedLogo.startsWith(path.join(ROOT, 'dist') + path.sep) || !existsSync(resolvedLogo)) fail('網站建置輸出引用不存在的品牌 Logo：' + site.id + ' ' + logoPath);
  }
}
// dist 是純生成目錄：除了建置器明確產生的資產，不得殘留舊檔或手動檔案。
function collectDistFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix + entry.name;
    return entry.isDirectory()
      ? collectDistFiles(path.join(directory, entry.name), relative + '/')
      : [relative];
  });
}
const expectedDistFiles = new Set([
  'components.css', 'dialog.js', 'sidebar.js', 'tabs.js', 'theme.js', 'tokens.css',
  ...siteRecords.map((site) => 'sites/' + site.id + '/index.html'),
  ...siteRecords.flatMap((site) => [site.logoLight, site.logoDark]),
]);
const actualDistFiles = collectDistFiles(path.join(ROOT, 'dist'));
for (const file of expectedDistFiles) if (!actualDistFiles.includes(file)) fail('dist 產物清單缺少預期檔案：' + file);
for (const file of actualDistFiles) if (!expectedDistFiles.has(file)) fail('dist 出現未預期的檔案：' + file);
console.log('網站建置輸出檢查通過：' + siteRecords.length + ' 站');

// 4d. 共用殼的語意契約：品牌文字已提供可讀名稱，Logo 圖片只作視覺識別；
// 側欄本身是 complementary landmark，內層 nav 才是具名導覽 landmark。
const headerHtml = readFileSync(path.join(ROOT, 'components', 'header', 'header.html'), 'utf8');
const sidebarHtml = readFileSync(path.join(ROOT, 'components', 'sidebar', 'sidebar.html'), 'utf8');
const footerHtml = readFileSync(path.join(ROOT, 'components', 'footer', 'footer.html'), 'utf8');
for (const [name, source, logoClass] of [
  ['header', headerHtml, 'chi-header__logo'],
  ['sidebar', sidebarHtml, 'chi-sidebar__logo'],
]) {
  for (const theme of ['light', 'dark']) {
    const match = source.match(new RegExp('<img[^>]*class="[^"]*' + logoClass + '[^"]*' + theme + '[^"]*"[^>]*>'));
    if (!match) fail(`${name} 缺少 ${theme} Logo`);
    else if (!match[0].includes('alt=""')) fail(`${name} ${theme} Logo 應為裝飾圖片，避免與品牌文字重複朗讀`);
  }
}
if (!sidebarHtml.includes('<aside id="chi-sidebar" class="chi-sidebar" aria-label="側邊欄">')) fail('sidebar aside 必須使用描述其 landmark 的名稱「側邊欄」');
if (!sidebarHtml.includes('<nav class="chi-sidebar__nav" aria-label="本站導覽">')) fail('sidebar 導覽 nav 必須有明確的「本站導覽」名稱');
if (!headerHtml.includes('<nav class="chi-subnav" aria-label="本站導覽">')) fail('header 副導覽 nav 必須有明確名稱');
if (!headerHtml.includes('<span class="chi-header__name">{{site.name}}</span>')) fail('Header 品牌連結必須以可見站名提供可存取名稱');
if (!footerHtml.includes('<footer class="chi-footer">') || !footerHtml.includes('<span class="chi-footer__name">{{site.name}}</span>') || !footerHtml.includes('data-chi-version')) fail('Footer 必須使用原生 footer landmark 並提供站名與版本識別');
if (/<a\b/.test(footerHtml)) fail('Footer 不得加入跨站連結');

// Tabs script is a generated runtime asset and must be loaded by the canonical shell.
const templateSource = readFileSync(path.join(ROOT, 'templates', 'base.template.html'), 'utf8');

const runtimeScripts = [...templateSource.matchAll(/<script\b([^>]*)><\/script>/gi)].map((match) => ({
  attrs: match[1],
  src: (match[1].match(/\bsrc=["']([^"']+)["']/i) || [])[1] || '',
  index: match.index,
}));
const runtime = (name) => runtimeScripts.find((script) => script.src.endsWith('/' + name + '.js'));
const themeScript = runtime('theme');
const sidebarScript = runtime('sidebar');
const tabsScript = runtime('tabs');
const dialogScript = runtime('dialog');
const firstStylesheet = templateSource.indexOf('<link rel="stylesheet"');
if (!themeScript || !sidebarScript || !tabsScript || !dialogScript) {
  fail('模板必須載入 Theme／Sidebar／Tabs／Dialog 四個 Runtime');
} else {
  for (const [name, script] of [['Theme', themeScript], ['Sidebar', sidebarScript]]) {
    if (/\b(?:defer|async)\b/i.test(script.attrs)) fail(name + ' Runtime 必須同步載入，避免首次繪製閃爍');
    if (script.index > firstStylesheet) fail(name + ' Runtime 必須在樣式表之前載入');
  }
  if (themeScript.index > sidebarScript.index) fail('Theme Runtime 必須先於 Sidebar Runtime');
  for (const [name, script] of [['Tabs', tabsScript], ['Dialog', dialogScript]]) {
    if (!/\bdefer\b/i.test(script.attrs) || /\basync\b/i.test(script.attrs)) {
      fail(name + ' Runtime 必須使用 defer 且不可 async');
}
  }
}
const tabsSource = readFileSync(path.join(ROOT, 'components', 'tabs', 'tabs.js'), 'utf8');
if (!templateSource.includes('<script src="../dist/tabs.js" defer></script>')) fail('base template 必須載入 Tabs runtime');
for (const contract of ["[data-chi-tabs]", "[role=\"tab\"]", "ArrowRight", "ArrowLeft", "Home", "End", "aria-selected", "aria-controls", "tabindex"]) {
  if (!tabsSource.includes(contract)) fail(`Tabs runtime 缺少必要互動契約：${contract}`);
}

// 基礎元件語意範例：驗證實際 HTML 關聯，而不只檢查 CSS class 是否存在。
const examplesHtml = readFileSync(path.join(ROOT, 'components', 'base', 'examples.html'), 'utf8');

const exampleClasses = new Set([...examplesHtml.matchAll(/\bclass="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)));
for (const className of exampleClasses) {
  if (className.startsWith('chi-') && !componentCss.includes('.' + className)) fail('語意範例使用未定義的元件 class：' + className);
}
const exampleIds = [...examplesHtml.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id);
const exampleIdSet = new Set(exampleIds);
if (exampleIds.length !== exampleIdSet.size) fail('基礎元件範例含重複 id');
const hasElementId = (tag, id) => new RegExp(`<${tag}\\b[^>]*\\bid="${id.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}"`).test(examplesHtml);
for (const [, target] of examplesHtml.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)) {
  if (!['input', 'select', 'textarea'].some((tag) => hasElementId(tag, target))) fail(`表單 label for 找不到對應控制項：${target}`);
}
for (const [, references] of examplesHtml.matchAll(/\baria-describedby="([^"]+)"/g)) {
  for (const id of references.trim().split(/\s+/)) if (!exampleIdSet.has(id)) fail(`aria-describedby 找不到目標：${id}`);
}
for (const [, references] of examplesHtml.matchAll(/\baria-labelledby="([^"]+)"/g)) {
  for (const id of references.trim().split(/\s+/)) if (!exampleIdSet.has(id)) fail(`aria-labelledby 找不到目標：${id}`);
}
const tablists = [...examplesHtml.matchAll(/<([a-z][\w-]*)\b([^>]*\brole="tablist"[^>]*)>([\s\S]*?)<\/\1>/g)];
if (tablists.length !== 1) fail('Tabs 範例必須且只能有一個 tablist');
for (const [, , attrs, contents] of tablists) {
  if (!/\baria-label="[^" ]/.test(attrs) && !/\baria-labelledby="[^" ]/.test(attrs)) fail('tablist 必須有可存取名稱');
  const tabs = [...contents.matchAll(/<button\b([^>]*\brole="tab"[^>]*)>/g)];
  if (tabs.length < 2) fail('Tabs 範例至少需要兩個原生 button tab');
  let selectedCount = 0;
  for (const [, tabAttrs] of tabs) {
    const id = tabAttrs.match(/\bid="([^"]+)"/)?.[1];
    const panelId = tabAttrs.match(/\baria-controls="([^"]+)"/)?.[1];
    const selected = tabAttrs.match(/\baria-selected="(true|false)"/)?.[1];
    const tabindex = tabAttrs.match(/\btabindex="(-?\d+)"/)?.[1];
    if (!id || !panelId || !selected || tabindex === undefined) fail('每個 tab 都必須有 id、aria-controls、aria-selected 與 tabindex');
    if (!/\btype="button"/.test(tabAttrs)) fail('Tab 必須明確使用 type="button"');
    if (selected === 'true') selectedCount++;
    if (tabindex !== (selected === 'true' ? '0' : '-1')) fail(`Tab ${id || '(unknown)'} tabindex 必須與 aria-selected 同步`);
    const panel = [...examplesHtml.matchAll(new RegExp(`<([a-z][\\w-]*)\\b([^>]*\\bid="${panelId || '__missing__'}"[^>]*)>`, 'g'))][0];
    if (!panel || !/\brole="tabpanel"/.test(panel[2]) || !new RegExp(`\\baria-labelledby="${id || '__missing__'}"`).test(panel[2])) {
      fail(`Tab ${id || '(unknown)'} 的 panel 必須有 role=tabpanel 並以 aria-labelledby 回指`);
    } else {
      const selectedPanel = selected === 'true';
      if (selectedPanel === /\bhidden(?:\s|>|$)/.test(panel[2])) fail(`Tab ${id} 與 panel hidden 狀態不一致`);
    }
  }
  if (selectedCount !== 1) fail('Tabs 範例必須且只能有一個 aria-selected=true');
}
const card = examplesHtml.match(/<article\b([^>]*\bclass="[^"]*chi-card[^"]*"[^>]*)>([\s\S]*?)<\/article>/);
if (!card || !/\baria-labelledby="([^"]+)"/.test(card[1])) fail('Card 範例必須使用 article 並以 aria-labelledby 關聯標題');
else {
  const headingId = card[1].match(/\baria-labelledby="([^"]+)"/)[1];
  if (!new RegExp(`<h[1-6]\\b[^>]*\\bid="${headingId}"`).test(card[2])) fail('Card aria-labelledby 必須指向卡片內的標題');
}
if (!/<ul\b[^>]*class="[^"]*chi-list[^"]*"[^>]*>[\s\S]*?<li\b/.test(examplesHtml)) fail('清單範例必須使用原生 ul／li 語意');
const dialogExample = examplesHtml.match(/<dialog\b([^>]*)>([\s\S]*?)<\/dialog>/);
if (!dialogExample) fail('Dialog 語意範例必須使用原生 dialog');
else {
  const dialogId = dialogExample[1].match(/\bid="([^"]+)"/)?.[1];
  const labelledBy = dialogExample[1].match(/\baria-labelledby="([^"]+)"/)?.[1];
  if (!dialogId || !labelledBy || !exampleIdSet.has(labelledBy)) fail('Dialog 必須有 id 並以 aria-labelledby 關聯可見標題');
  if (!new RegExp(`<h[1-6]\\b[^>]*\\bid="${labelledBy || '__missing__'}"`).test(dialogExample[2])) fail('Dialog aria-labelledby 必須指向對話框內的標題');
  if (!new RegExp(`data-chi-dialog-open="${dialogId || '__missing__'}"`).test(examplesHtml)) fail('Dialog 必須有對應的開啟控制項');
  if (!/data-chi-dialog-close/.test(dialogExample[2])) fail('Dialog 必須有關閉控制項');
}
const badgeExamples = [...examplesHtml.matchAll(/<span class="chi-badge chi-badge--(success|warning|danger|info)"><span class="chi-badge__dot" aria-hidden="true"><\/span>([^<]+)<\/span>/g)];
if (badgeExamples.length !== 4 || new Set(badgeExamples.map(([, variant]) => variant)).size !== 4 || badgeExamples.some(([, , label]) => !label.trim())) fail('徽章範例必須涵蓋四種語意狀態，並提供裝飾性 dot 與可見文字');
const stateExamples = [...examplesHtml.matchAll(/<section class="chi-state"([^>]*)>([\s\S]*?)<\/section>/g)];
if (stateExamples.length !== 4) fail('資料狀態範例必須涵蓋 loading、empty、error、success');
const stateByName = new Map(stateExamples.map(([, attrs, contents]) => {
  const name = contents.match(/id="example-state-(loading|empty|error|success)-title"/)?.[1];
  return [name, { attrs, contents }];
}));
for (const name of ['loading', 'empty', 'error', 'success']) {
  const state = stateByName.get(name);
  const role = name === 'error' ? 'alert' : 'status';
  if (!state || !state.attrs.includes(`role="${role}"`) || !state.attrs.includes(`aria-labelledby="example-state-${name}-title"`)) fail(`資料狀態 ${name} 必須有正確的 role 與可存取標題`);
  if (state && (!state.contents.includes('class="chi-state__title"') || !state.contents.includes('class="chi-state__desc"'))) fail(`資料狀態 ${name} 必須提供標題與描述`);
  if (name === 'loading' && (!state?.attrs.includes('aria-busy="true"') || !state.contents.includes('class="chi-spinner"') || !state.contents.includes('class="chi-skeleton"'))) fail('Loading 狀態必須標示 aria-busy 並提供 spinner／skeleton');
  if (name !== 'loading' && !state?.contents.includes('class="chi-state__icon"')) fail(`資料狀態 ${name} 必須提供裝飾圖示`);
  if (name === 'error' && !state?.contents.includes('class="chi-state__action"')) fail('Error 狀態必須提供可採取的恢復操作');
}
const invalidFields = [...examplesHtml.matchAll(/<div\b([^>]*class="[^"]*chi-field[^"]*"[^>]*)>([\s\S]*?)<\/div>/g)];
for (const [, attrs, contents] of invalidFields) {
  if (/aria-invalid="true"/.test(contents) && !/chi-field--error/.test(attrs)) fail('aria-invalid=true 的欄位必須套用 chi-field--error');
  if (/chi-field--error/.test(attrs) && (!/aria-invalid="true"/.test(contents) || !/chi-field__error/.test(contents))) fail('錯誤欄位必須同時提供 aria-invalid 與可見錯誤文字');
}

const table = examplesHtml.match(/<table\b[^>]*class="[^"]*chi-table[^"]*"[^>]*>([\s\S]*?)<\/table>/);
if (!table || !/<caption\b/.test(table[1])) fail('表格必須提供 caption');
if (!/<th\b[^>]*\bscope="col"/.test(table?.[1] || '') || !/<th\b[^>]*\bscope="row"/.test(table?.[1] || '')) fail('表格範例必須示範 scope=col 與 scope=row');

// Button closed enum 與原生按鈕語意：四種變體各一個示例，全部明確指定 type。
const buttonHtml = readFileSync(path.join(ROOT, 'components', 'button', 'button.html'), 'utf8');
const buttonCss = stripComments(readFileSync(path.join(ROOT, 'components', 'button', 'button.css'), 'utf8'));
const buttonTags = [...buttonHtml.matchAll(/<button[^>]*>/g)].map(([tag]) => tag);
for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
  const matches = buttonTags.filter((tag) => tag.includes('class="chi-btn chi-btn--' + variant + '"'));
  if (matches.length !== 1) fail(`Button ${variant} 變體示例必須且只能有一個，實際：${matches.length}`);
  else if (!matches[0].includes('type="button"')) fail(`Button ${variant} 必須明確指定 type="button"`);
  for (const state of [':disabled', ':disabled:hover', ':disabled:active']) {
    if (!buttonCss.includes('.chi-btn--' + variant + state)) fail(`Button ${variant} 缺少 disabled ${state} 穩定狀態`);
  }
}
if (buttonTags.length !== 4) fail('Button 範例不得引入 closed enum 以外的按鈕或變體');
if (!buttonCss.includes('.chi-btn:focus-visible')) fail('Button 必須提供鍵盤 focus-visible 樣式');
if (!buttonCss.includes('.chi-btn:disabled')) fail('Button 必須提供 disabled 樣式');
for (const [name, source] of [['header', headerHtml], ['sidebar', sidebarHtml]]) {
  for (const [tag] of source.matchAll(/<button[^>]*>/g)) {
    if (!tag.includes('type="button"')) fail(`${name} 所有操作控制都必須明確指定 type="button"`);
  }
}

// Dialog 使用原生 modal，並驗證 runtime 與文件公開契約一致。
const dialogSource = readFileSync(path.join(ROOT, 'components', 'dialog', 'dialog.js'), 'utf8');
if (!templateSource.includes('<script src="../dist/dialog.js" defer></script>')) fail('base template 必須載入 Dialog runtime');
for (const contract of ['dialog.chi-dialog', 'showModal()', 'data-chi-dialog-open', 'data-chi-dialog-close', 'returnFocus.set(dialog, opener || document.activeElement)', 'opener.focus()']) {
  if (!dialogSource.includes(contract)) fail(`Dialog runtime 缺少必要焦點／互動契約：${contract}`);
}
if (dialogSource.includes("addEventListener('keydown'")) fail('Dialog 不應重造原生 modal 的 Escape／焦點限制行為');
if (!dialogSource.includes("event.target === dialog && dialog.hasAttribute('data-chi-dialog-backdrop-close')")) fail('Dialog backdrop close 必須明確 opt-in');

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
if (!sidebarJs.includes('function closeMobile(restoreFocus)')) fail('sidebar.js closeMobile 必須支援斷點切換時略過焦點回復');
if (!sidebarJs.includes('if (!isMobile()) closeMobile(false)')) fail('sidebar.js 跨到平板／桌面斷點時不可聚焦已隱藏的手機開關');
if (!sidebarCss.includes('@media (prefers-reduced-motion: reduce)') || !sidebarCss.includes('.chi-sidebar {\n    transition: none;')) fail('sidebar.css 必須尊重 prefers-reduced-motion');
const themeJs = readFileSync(path.join(ROOT, 'dist', 'theme.js'), 'utf8');
if (!themeJs.includes("button.setAttribute('aria-label', label)")) fail('theme.js 必須同步主題切換按鈕的 aria-label');
if (!themeJs.includes("button.setAttribute('title', label)")) fail('theme.js 必須同步主題切換按鈕的 title');
if (!themeJs.includes("'目前色彩模式：' + LABELS[mode] + '，點擊切換'")) fail('theme.js 主題切換標籤必須包含目前模式');
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
