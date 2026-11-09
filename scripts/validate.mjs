// chi-system validate.mjs — 驗真的渲染依據，不是檔案在不在。
// 參考：研究報告 §5 的九道關卡，本版實作其中可本地驗證的 6 道
//   （Token 解析、對比計算、禁硬編碼、網站設定 schema、斷點一致、生成物由 CI 另驗）。
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
    .map((name) => \`brands/\${name}\`),
];
const TOKEN_METADATA = new Set(['$description', '$type', '$extensions', '$deprecated', '$experimental']);
function validateTokenNode(node, file, tokenPath = '') {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    fail(\`Token 結構錯誤：\${file} \${tokenPath || '(root)'} 必須是物件\`);
    return;
  }
  if (Object.prototype.hasOwnProperty.call(node, '$value')) {
    if (typeof node.$type !== 'string' || !node.$type.trim()) {
      fail(\`Token 缺少有效 $type：\${file} \${tokenPath}\`);
    }
    if (typeof node.$value === 'string') {
      const value = node.$value;
      const opens = (value.match(/\{/g) || []).length;
      const closes = (value.match(/\}/g) || []).length;
      if (opens !== closes || /\{\s*\}/.test(value)) {
        fail(\`Token 別名格式錯誤：\${file} \${tokenPath}\`);
      }
    }
    return;
  }
  if (node.$type !== undefined && (typeof node.$type !== 'string' || !node.$type.trim())) {
    fail(\`Token 群組 $type 無效：\${file} \${tokenPath || '(root)'}\`);
  }
  const children = Object.entries(node).filter(([key]) => !TOKEN_METADATA.has(key) && !key.startsWith('$'));
  if (tokenPath && children.length === 0) fail(\`空 Token 群組：\${file} \${tokenPath}\`);
  for (const [key, value] of children) {
    validateTokenNode(value, file, tokenPath ? \`\${tokenPath}.\${key}\` : key);
  }
}
for (const file of tokenFiles) {
  const fullPath = path.join(ROOT, 'tokens', file);
  try {
    validateTokenNode(JSON.parse(readFileSync(fullPath, 'utf8')), \`tokens/\${file}\`);
  } catch (error) {
    if (error instanceof SyntaxError) fail(\`Token JSON 無法解析：tokens/\${file}：\${error.message}\`);
    else throw error;
  }
}
console.log(\`Token schema 檢查完成：\${tokenFiles.length} 份來源檔\`);

// 1. Token 解析（buildTokens 內已做別名解析與循環檢查；未解析會直接拋錯）
const { resolvedLight, resolvedDark, brands } = buildTokens();
console.log(`Token 解析通過：淺色 ${Object.keys(resolvedLight).length} 個，深色 ${Object.keys(resolvedDark).length} 個，品牌 ${Object.keys(brands).length} 個`);

// 2. 對比計算：每品牌×淺深色。一般文字 4.5:1、大字與非文字 UI 3:1（WCAG 2.2 AA）。
const pairs = [
  ['text-primary', 'canvas', 4.5], ['text-secondary', 'canvas', 4.5], ['text-muted', 'canvas', 4.5],
  ['accent', 'canvas', 4.5], ['on-accent', 'accent', 4.5],
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
  }
}
const template = stripComments(readFileSync(path.join(ROOT, 'templates', 'base.template.html'), 'utf8'));
if (/#[0-9a-fA-F]{3,8}\b/.test(template)) fail('硬編碼色值：templates/base.template.html 出現 hex');

// 4. 網站設定 schema：欄位、型別、品牌檔存在、logo 檔案存在；不寫死站數。
const REQUIRED = ['id', 'name', 'url', 'brand', 'logoLight', 'logoDark'];
const sites = readdirSync(path.join(ROOT, 'sites')).filter((f) => f.endsWith('.json'));
if (sites.length === 0) fail('sites/ 沒有任何網站設定');
for (const f of sites) {
  const site = JSON.parse(readFileSync(path.join(ROOT, 'sites', f), 'utf8'));
  for (const k of REQUIRED) if (!(k in site)) fail(`網站設定缺欄位：${f} 缺 ${k}`);
  if (site.id !== f.replace('.json', '')) fail(`網站設定 id 與檔名不符：${f}`);
  if (!brands[site.brand]) fail(`網站設定品牌不存在：${f} brand=${site.brand}`);
  for (const logo of [site.logoLight, site.logoDark]) {
    if (logo && !existsSync(path.join(ROOT, logo))) fail(`網站設定 logo 不存在：${f} ${logo}`);
  }
  if (typeof site.url !== 'string' || !site.url.startsWith('https://')) fail(`網站設定 url 不合法：${f}`);
}
console.log(`網站設定通過：${sites.length} 站（不寫死站數，新增一站只加一個檔案）`);

// 4b. 預覽網站清單必須與 sites/*.json 一致（生成物，由 build-site.mjs 產生）
const previewSites = JSON.parse(readFileSync(path.join(ROOT, 'preview', 'sites.json'), 'utf8'));
const siteIds = sites.map((f) => f.replace('.json', '')).sort();
if (JSON.stringify(previewSites.map((s) => s.id).sort()) !== JSON.stringify(siteIds)) {
  fail('preview/sites.json 與 sites/*.json 不一致（請重跑 npm run build）');
}

// 5. 斷點一致：768／1024 在 JSON、CSS、JS 三處一致；不得用 max-width 反向寫法。
const bp = JSON.parse(readFileSync(path.join(ROOT, 'breakpoints.json'), 'utf8'));
const widths = bp.breakpoints.map((b) => b.minWidth);
if (JSON.stringify(widths) !== '[768,1024]') fail(`斷點不是 768／1024：${JSON.stringify(widths)}`);
const sidebarCss = readFileSync(path.join(ROOT, 'components', 'sidebar', 'sidebar.css'), 'utf8');
for (const w of widths) if (!sidebarCss.includes(`min-width: ${w}px`)) fail(`sidebar.css 缺 min-width: ${w}px`);
if (/max-width:\s*768px/.test(sidebarCss)) fail('sidebar.css 出現 max-width: 768px 反向寫法（舊報告 A16）');
const sidebarJs = readFileSync(path.join(ROOT, 'dist', 'sidebar.js'), 'utf8');
if (!sidebarJs.includes('768')) fail('sidebar.js 缺 768 斷點值');

console.log(notes.filter((n) => n.startsWith('對比')).join('\n'));
if (failures.length) {
  console.error(`\n驗證失敗 ${failures.length} 項：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\n驗證全部通過。');
