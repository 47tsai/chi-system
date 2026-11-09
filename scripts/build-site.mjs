// chi-system build-site.mjs — 組裝生成物。
// 參考架構：GOV.UK「一個頁面殼＋具名區塊」（研究報告 §3、§6）。
// 輸入：templates/base.template.html（來源檔）＋ components/*/*.html 片段、components/*/*.css
// 輸出：templates/base.html、dist/components.css（皆為生成物，DO NOT EDIT）
// CSS 串接順序固定為 header、footer、sidebar、button、base：base 在最後，
//   其中的版式開關（data-chi-layout）才能覆寫前面的版式規則。
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const FRAGMENTS = { header: 'header/header.html', footer: 'footer/footer.html', sidebar: 'sidebar/sidebar.html', button: 'button/button.html' };

export function buildSite() {
  let base = readFileSync(path.join(ROOT, 'templates', 'base.template.html'), 'utf8');
  for (const [name, rel] of Object.entries(FRAGMENTS)) {
    const frag = readFileSync(path.join(ROOT, 'components', rel), 'utf8');
    if (!base.includes(`<!-- chi-component:${name} -->`)) throw new Error(`base.template.html 缺少 <!-- chi-component:${name} -->`);
    base = base.replace(`<!-- chi-component:${name} -->`, frag.trim());
  }
  if (/<!-- chi-component:/.test(base)) throw new Error('base.template.html 有未組裝的元件標記');
  const out = `<!-- chi-system base.html — 生成物，DO NOT EDIT。由 scripts/build-site.mjs 從 templates/base.template.html ＋ components/*/*.html 組裝。版本 v${VERSION}。 -->\n${base}`;
  writeFileSync(path.join(ROOT, 'templates', 'base.html'), out);

  const order = ['header', 'footer', 'sidebar', 'button', 'base'];
  let css = `/* chi-system components.css — 生成物，DO NOT EDIT。由 scripts/build-site.mjs 串接 components/*/*.css 產生。順序：${order.join('、')}。 */\n`;
  for (const name of order) {
    const files = readdirSync(path.join(ROOT, 'components', name)).filter((f) => f.endsWith('.css'));
    for (const f of files) css += `\n/* --- ${name}/${f} --- */\n${readFileSync(path.join(ROOT, 'components', name, f), 'utf8')}`;
  }
  mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  writeFileSync(path.join(ROOT, 'dist', 'components.css'), css);
  // 預覽頁的網站清單也是生成物：由 sites/*.json 產生，預覽頁不得寫死站清單。
  const sites = readdirSync(path.join(ROOT, 'sites'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => { const s = JSON.parse(readFileSync(path.join(ROOT, 'sites', f), 'utf8')); return { id: s.id, name: s.name }; })
    .sort((a, b) => a.id.localeCompare(b.id));
  mkdirSync(path.join(ROOT, 'preview'), { recursive: true });
  writeFileSync(path.join(ROOT, 'preview', 'sites.json'), JSON.stringify(sites, null, 2) + '\n');
  return { version: VERSION, sites: sites.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = buildSite();
  console.log(`base.html、components.css、preview/sites.json 已生成（版本 v${r.version}，${r.sites} 站）`);
}
