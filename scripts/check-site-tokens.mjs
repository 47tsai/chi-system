// chi-system check-site-tokens.mjs — U1 檢查：站點 CSS 不得定義 --chi-*。
// 契約（SPEC.md §3）：--chi-* 變數只由 chi-system 生成物（dist/tokens.css）定義；
// 站點自己的變數一律用 --<站點>-* 前綴（例如 --fg-*、--nav-*）。
// 站點 CSS 出現 --chi- 定義即違反 Token 契約，檢查失敗。
// 引用 var(--chi-*) 不受此限；站內釘版複製的 chi-system/ 與 dist/ 不掃描。
//
// 用法：node scripts/check-site-tokens.mjs <站點目錄> [--json]
//   無違規 exit 0；有違規列出檔案、行號、屬性與值，exit 1；目錄不存在 exit 2。
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

export const EXCLUDED_DIRS = new Set(['chi-system', 'dist', 'node_modules', '.git']);

// 註解先整段拿掉（保留換行數，行號才對得上）；定義一定在註解外才算。
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat(m.split('\n').length - 1));

// 找自訂屬性定義：行首或 ; { 之後的 --chi-xxx: …
// var(--chi-*) 是引用（前面是 (），不會被這條正則命中。
export function findChiTokenDefinitions(cssText) {
  const clean = stripComments(cssText);
  const violations = [];
  const re = /(?:^|[;{])\s*(--chi-[\w-]+)\s*:\s*([^;{}]+)/gm;
  let m;
  while ((m = re.exec(clean))) {
    const line = clean.slice(0, m.index).split('\n').length;
    violations.push({ property: m[1], value: m[2].trim(), line });
  }
  return violations;
}

function collectCssFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collectCssFiles(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.css')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

export function scanSiteCss(siteDir) {
  const files = collectCssFiles(siteDir);
  const violations = [];
  for (const file of files) {
    for (const v of findChiTokenDefinitions(readFileSync(file, 'utf8'))) {
      violations.push({ file, ...v });
    }
  }
  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return { files: files.length, violations };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir || !existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error('用法：node scripts/check-site-tokens.mjs <站點目錄> [--json]');
    process.exit(2);
  }
  const { files, violations } = scanSiteCss(path.resolve(dir));
  if (json) {
    console.log(JSON.stringify({ files, violations }, null, 2));
  } else if (violations.length) {
    console.error(`站點 CSS 不得定義 --chi-*：${violations.length} 處違規（共掃描 ${files} 個 CSS 檔）`);
    for (const v of violations) {
      console.error(`- ${path.relative(process.cwd(), v.file)}:${v.line} ${v.property}: ${v.value}`);
    }
    console.error('站點自己的變數請改用 --<站點>-* 前綴（見 SPEC.md §3）。');
  } else {
    console.log(`站點 Token 覆寫檢查通過：掃描 ${files} 個 CSS 檔，無 --chi- 定義。`);
  }
  process.exit(violations.length ? 1 : 0);
}
