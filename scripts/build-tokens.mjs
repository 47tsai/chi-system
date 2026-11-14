// chi-system build-tokens.mjs — Token 唯一來源的生成器。
// 參考架構：DTCG 2025.10 JSON 為原始來源、Style Dictionary「來源 → 生成物」管線
//   （見研究報告 §2：tokens/*.tokens.json 在 Git 為準，生成的 CSS 絕不手改）。
//   本腳本是無依賴的最小實作：DTCG 格式不變，日後可換 Style Dictionary 而不改 JSON。
// 輸入：tokens/primitives.tokens.json、semantic.tokens.json、semantic-dark.tokens.json、
//   components.tokens.json、tokens/brands/*.tokens.json
// 輸出：dist/tokens.css（生成物，DO NOT EDIT）
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = path.join(ROOT, 'tokens');

function load(rel) {
  return JSON.parse(readFileSync(path.join(TOKENS, rel), 'utf8'));
}

// 扁平化：{ color: { text: { primary: { $value } } } } → { 'color.text.primary': { $value, $type } }
export function flatten(obj, prefix, out) {
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const p = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && '$value' in val) out[p] = val;
    else if (val && typeof val === 'object') flatten(val, p, out);
  }
  return out;
}

export function resolveAll(flat) {
  const resolved = {};
  const resolving = new Set();
  function resolve(name) {
    if (name in resolved) return resolved[name];
    if (resolving.has(name)) throw new Error(`Token 別名循環：${[...resolving, name].join(' → ')}`);
    const tok = flat[name];
    if (!tok) throw new Error(`Token 別名未解析：${name}`);
    resolving.add(name);
    let v = tok.$value;
    if (typeof v === 'string') {
      v = v.replace(/\{([^}]+)\}/g, (_, ref) => resolve(ref.trim()));
    }
    resolving.delete(name);
    resolved[name] = v;
    return v;
  }
  for (const name of Object.keys(flat)) resolve(name);
  return resolved;
}

const toVar = (name) => `--chi-${name.replaceAll('.', '-')}`;

function cssBlock(selector, vars) {
  const lines = Object.keys(vars).sort().map((n) => `  ${toVar(n)}: ${vars[n]};`);
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}

export function buildTokens() {
  const prim = flatten(load('primitives.tokens.json'), '', {});
  const light = { ...flatten(load('semantic.tokens.json'), '', {}), ...flatten(load('components.tokens.json'), '', {}) };
  const dark = flatten(load('semantic-dark.tokens.json'), '', {});
  const all = { ...prim, ...light, ...dark };
  const resolvedLight = resolveAll({ ...prim, ...light });
  const resolvedDark = resolveAll({ ...prim, ...light, ...dark });
  // :root 只輸出 semantic／component 層的顏色＋非顏色的單值 Token：
  // 顏色 primitive（色階、淺深變體）只供解析，元件絕對不讀它。
  const lightVars = {};
  for (const [k, v] of Object.entries(resolvedLight)) {
    if (k.startsWith('color.') && !(k in light)) continue;
    lightVars[k] = v;
  }
  const darkVars = {};
  for (const k of Object.keys(light)) darkVars[k] = resolvedDark[k];
  // 深色只輸出與淺色不同的值
  const darkOverrides = {};
  for (const [k, v] of Object.entries(darkVars)) {
    if (lightVars[k] !== v) darkOverrides[k] = v;
  }
  // 品牌：每品牌一份只寫別名的檔案 → [data-chi-brand] 覆寫 --chi-color-brand。
  // 品牌檔還可帶 accent 覆寫（淺色用 color.*／button.*／sidebar.*，深色用 dark.* 同名鍵）：
  // 淺色覆寫併進原本的品牌區塊（--chi-color-brand 必須維持第一行，供 smoke 測試的
  // 正則比對），深色覆寫另出 [data-chi-theme="dark"][data-chi-brand] 區塊（特異度高於
  // 單屬性選擇器，深色才生效）。目前只有 nav 有 accent 覆寫（齊 2026-11-14 定案：
  // nav 配件跟主題色走），其餘站只出品牌色。
  const OVERRIDE_KEYS = [
    'color.accent', 'color.accent-hover', 'color.accent-active', 'color.focus-ring',
    'button.primary.background', 'button.primary.background-hover', 'button.primary.background-active',
    'sidebar.text-active',
  ];
  const brandFiles = readdirSync(path.join(TOKENS, 'brands')).filter((f) => f.endsWith('.tokens.json'));
  const brands = {};
  const brandOverrides = {};
  for (const f of brandFiles) {
    const id = f.replace('.tokens.json', '');
    const flat = flatten(load(`brands/${f}`), '', {});
    const lightResolved = resolveAll({ ...prim, ...light, ...flat });
    brands[id] = lightResolved['color.brand'];
    const lightAccent = {};
    for (const key of OVERRIDE_KEYS) {
      if (key in flat) lightAccent[key] = lightResolved[key];
    }
    const darkFlat = Object.fromEntries(
      Object.entries(flat).filter(([k]) => k.startsWith('dark.')).map(([k, v]) => [k.slice(5), v]),
    );
    const darkResolved = resolveAll({ ...prim, ...light, ...dark, ...darkFlat });
    const darkAccent = {};
    for (const key of OVERRIDE_KEYS) {
      if (key in darkFlat) darkAccent[key] = darkResolved[key];
    }
    brandOverrides[id] = { light: lightAccent, dark: darkAccent };
  }

  let css = `/* chi-system tokens.css — 生成物，DO NOT EDIT。\n * 由 scripts/build-tokens.mjs 從 tokens/*.tokens.json 產生；手改會被 CI 擋下。\n * DTCG 2025.10（Community Group Report，不是 W3C 正式標準）。\n */\n`;
  css += cssBlock(':root', lightVars);
  css += `\n${cssBlock('[data-chi-theme="dark"]', darkOverrides)}`;
  for (const [id, hex] of Object.entries(brands).sort()) {
    css += `\n[data-chi-brand="${id}"] {\n  --chi-color-brand: ${hex};\n}\n`;
  }
  for (const [id, { light, dark }] of Object.entries(brandOverrides).sort()) {
    if (Object.keys(light).length) {
      css += `\n${cssBlock(`[data-chi-brand="${id}"]`, light)}`;
    }
    if (Object.keys(dark).length) {
      css += `\n${cssBlock(`[data-chi-theme="dark"][data-chi-brand="${id}"]`, dark)}`;
    }
  }
  // 相容別名：舊 components.css（v2 base.css 沿用）用的 --chi-line-height-* 與 --chi-duration。
  css += `\n/* 相容別名（舊寫法沿用，見 components/base/base.css 檔頭） */\n:root {\n`;
  for (const n of ['body', 'body-small', 'caption', 'card-title', 'label', 'page-title', 'section-title']) {
    css += `  --chi-line-height-${n}: var(--chi-font-line-height-${n});\n`;
  }
  css += `  --chi-duration: var(--chi-duration-base);\n}\n`;
  // 緊湊密度：舊 tokens.css 已驗證的值（來源：chi-system-old tokens.css）
  css += `\n[data-chi-density="compact"] {\n  --chi-space-section: 32px;\n  --chi-space-group: 16px;\n  --chi-space-item: 12px;\n  --chi-size-control: var(--chi-size-control-compact);\n  --chi-size-list-row: var(--chi-size-list-row-compact);\n}\n`;
  mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  writeFileSync(path.join(ROOT, 'dist', 'tokens.css'), css);
  return { lightCount: Object.keys(lightVars).length, darkOverrides: Object.keys(darkOverrides).length, brands, brandOverrides, resolvedLight, resolvedDark };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = buildTokens();
  console.log(`tokens.css：淺色 ${r.lightCount} 個變數，深色覆寫 ${r.darkOverrides} 個，品牌 ${Object.keys(r.brands).length} 個`);
}
