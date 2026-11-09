# CHI Design System

一個核心，工業化地生出所有 Chi 網站：核心一樣，再調整功能，使網站可以有不同用途。
所有網站打開都是一個樣，不會有不整齊、亂的問題。

## 目的

- header、footer、側邊欄、按鈕、所有元素在所有網站都要統一。
- 範圍不只現有六站，未來所有網站都要套用一樣標準。
- 新站只加一份設定檔（`sites/<站>.json`）＋一份品牌檔（`tokens/brands/<站>.tokens.json`）就上線。

## 規範

唯一規範是 [SPEC.md](SPEC.md)。數值唯一來源是 `tokens/*.tokens.json`（DTCG 格式），
生成的 `dist/tokens.css` 絕不手改。優先級：生成物 ＞ 元件原始碼 ＞ 元件文件 ＞ SPEC.md ＞ 截圖。

## 版面

```
README.md  SPEC.md  CHANGELOG.md  breakpoints.json  package.json
tokens/primitives.tokens.json  tokens/semantic.tokens.json
tokens/semantic-dark.tokens.json  tokens/components.tokens.json
tokens/brands/<站>.tokens.json
sites/<站>.json
components/<header|footer|sidebar|button|base>/
templates/base.template.html  →  templates/base.html（生成物）
dist/tokens.css  dist/components.css  dist/theme.js  dist/sidebar.js\ndist/sites/<站>/index.html（建置產物）
scripts/build-tokens.mjs  scripts/build-site.mjs  scripts/validate.mjs
preview/index.html  preview/sites.json（生成物）
logo/
.github/workflows/ci.yml
```

## 用法

```sh
npm run build     # 產生 Token／元件 CSS、共用模板、預覽清單與 dist/sites/<站>/index.html
npm run validate  # Token schema／解析、對比、硬編碼、站設定、模板與站點輸出、斷點
npm run check     # build + validate + 生成物 diff 必須為空
```

新站起步：複製 `templates/base.html`，填 `{{site.*}}`，填 `{{slots.*}}`，
`data-chi-layout` 選 `header` 或 `sidebar`。

## 版本

SemVer，見 [CHANGELOG.md](CHANGELOG.md)。v1.0.0 為第一個正式版。
舊版在 [chi-system-old](https://github.com/47tsai/chi-system-old)（唯讀封存，不再改動）。
