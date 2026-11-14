# CHI Design System

一個核心，工業化地生出所有 Chi 網站：核心一樣，再調整功能，使網站可以有不同用途。
所有網站打開都是一個樣，不會有不整齊、亂的問題。

## 目的

- header、footer、側邊欄、按鈕、所有元素在所有網站都要統一。
- 範圍不只現有六站，未來所有網站都要套用一樣標準。
- 新站只加一份設定檔（`sites/<站>.json`）＋一份品牌檔（`tokens/brands/<站>.tokens.json`），即可產生共用殼起始頁；各站功能與正式內容仍由站點專案提供。

## 規範

系統原則與公開契約以 [SPEC.md](SPEC.md) 為準。Token 數值唯一來源是
`tokens/*.tokens.json`（DTCG 格式）；元件、模板、建置器與站點設定分別以其來源檔為準。
`dist/*`、`templates/base.html`、`preview/sites.json` 都是生成物，只供執行與驗證，
絕不手改；發現輸出錯誤時，應修正來源檔後重新建置。

## 版面

```
README.md  SPEC.md  CHANGELOG.md  breakpoints.json  package.json
tokens/primitives.tokens.json  tokens/semantic.tokens.json
tokens/semantic-dark.tokens.json  tokens/components.tokens.json
tokens/brands/<站>.tokens.json
sites/<站>.json
components/<header|footer|sidebar|button|tabs|base|theme|dialog>/（base/examples.html 為語意範例；Theme／Sidebar／Tabs／Dialog JS 皆有來源檔）
templates/base.template.html  →  templates/base.html（生成物）
dist/tokens.css  dist/components.css  dist/theme.js  dist/sidebar.js  dist/tabs.js  dist/dialog.js
dist/sites/<站>/index.html（建置產物）  dist/logo/（站點引用 Logo 的部署副本）
scripts/build-tokens.mjs  scripts/build-site.mjs  scripts/validate.mjs
preview/index.html  preview/sites.json（生成物）
logo/
.github/workflows/ci.yml
```

## 元件展示與使用

- [元件展示頁](preview/components.html)：六品牌、淺／深主題、桌機／平板／手機的互動展示。
- [元件使用指南](docs/COMPONENTS.md)：元件總覽、HTML 範例、語意與鍵盤契約。

## 用法

```sh
npm run build     # 產生 Token／元件 CSS、共用模板、預覽清單、dist/logo 與 dist/sites/<站>/index.html
npm run validate  # Token／對比／站設定／模板驗證，以及元件文件 HTML／ARIA 契約檢查
npm run test:integration # 暫時新增兩個測試站，驗證新品牌／站設定可獨立生成 Header／Sidebar 版式
npm run test      # Node.js 行為、Theme／Sidebar／Tabs／Dialog、Header／Footer、Button／表單與 HTML 語意測試
npm run test:browser # Chrome 可用時，六站桌機／手機載入與 Theme／Sidebar／Tabs／Dialog 互動、斷點版式、水平溢位、Focus-visible CSS 合約、真實 Tab／Shift+Tab／方向鍵／Home／End／Space／Escape 鍵盤互動、Dialog backdrop、Sidebar 焦點循環、axe-core WCAG 2.0／2.1／2.2 A／AA 稽核、Accessibility Tree 名稱／ARIA 關聯與實際渲染文字對比，以及預設／減少動態偏好測試；另以元件展示頁六品牌 × 淺深主題 × 三種視窗共 36 組驗收；另以正式預覽殼六品牌 × 淺深主題 × Header／Sidebar 共 24 組驗證 Token 實際套用，並以五種視窗寬度共 120 組驗證共用殼與元件幾何一致性；另以六品牌 × 淺深主題共 12 組實際驗證元件 Hover／Active／Focus／Error／Disabled 視覺狀態與 Token；同樣以 12 組驗證 Checkbox／Radio／Switch Checked／Disabled、Badge 語意色、Spinner／Skeleton、Empty／Error／Success 與 Dialog Backdrop／Focus；另以六品牌 × 桌機／手機 12 組執行真實鍵盤與 Chrome Accessibility Tree 驗收，涵蓋選擇控制角色與具名稱 Radio 群組、Readonly／Disabled／Invalid、Live Region、Dialog 原生 Modal 背景隔離、Tab／Shift+Tab 邊界焦點與返回；另以六站 × 五種視窗寬度 × 淺深主題驗證表單與按鈕互動；另以真實 Tab／方向鍵／Space／Enter 驗證表單鍵盤旅程
npm run check     # build + validate + 新站整合 + unit tests + browser interaction smoke + 生成物 diff
```

新站起步：新增 `tokens/brands/<站>.tokens.json` 與 `sites/<站>.json`，再執行 `npm run build`。站設定可選 `"layout": "header"` 或 `"layout": "sidebar"`，省略時預設 `header`。
建置會產生可獨立部署的 `dist/` 根目錄，包含 `dist/sites/<站>/index.html`、共用 CSS／JS 與 `dist/logo/`；可直接發布整個 `dist/`，不可只抽出 `dist/sites/` 子目錄。站點實際導覽與功能內容仍由該站提供。

## 版本

SemVer，見 [CHANGELOG.md](CHANGELOG.md)。v1.0.0 為第一個正式版。
舊版在 [chi-system-old](https://github.com/47tsai/chi-system-old)（唯讀封存，不再改動）。