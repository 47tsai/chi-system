# CHI Design System — SPEC v1.0.0

> 唯一規範。本文件是 chi-system 的準則；數值只在 tokens/*.tokens.json，
> 設計理由只在 Token 的 `$description` 與本文件原則節，不另開文件。
> 舊版（47tsai/chi-system-old，HEAD 436f028）唯讀參考，不再改動。

## 0. 權威來源與優先級

本系統採「來源檔為權威、生成物為輸出」原則。生成物可用來驗證實際輸出，
但不得反向覆蓋來源檔；發現差異時，應修正來源並重新生成。

1. 本文件（系統原則、架構與公開契約）
2. `tokens/*.tokens.json`（Token 數值唯一來源）
3. `components/`、`templates/*.template.html`、`scripts/`（元件、模板與建置行為的唯一實作來源）
4. `sites/*.json`、`breakpoints.json`（站點與斷點設定來源）
5. 生成物（`dist/*`、`templates/base.html`、`preview/sites.json`），只供執行與驗證，不得手改
6. 文件中的示例、截圖與預覽畫面，只供說明，不覆蓋上述來源

不同領域的來源各自負責其範圍；若跨領域規則衝突，以本文件定義的契約為準，
並同步修正受影響的來源檔。新增元件仍遵循 draft → preview → stable；
`draft`／`preview` 永遠不覆蓋 `stable`。

## 1. 目的

建立一個範本，可以工業化地製作其他網站：核心是一樣的，再調整功能，
使網站可以有不同用途；所有網站打開都是一個樣，不會有不整齊、亂的問題。
header、footer、側邊欄、按鈕、所有元素在所有網站都要統一。
範圍不只現有六站，未來所有網站都要套用一樣標準。

判準：新站能不能只加一份設定檔就上線？不能，架構就是錯的。

## 2. 分層

Foundations（原則）→ Tokens（數值）→ Components（元件）→ Patterns／Templates（頁面殼）
→ Products／Sites（各站設定），橫跨全部的是 Tooling & Governance（生成、驗證、CI、版本）。
參考：GitHub Primer 的分層、GOV.UK 的元件規範（見 §11 參考來源）。

## 3. Token

- 三層：primitive → semantic → component。元件只讀 semantic／component，
  絕不讀 primitive、絕不寫 hex。參考：DTCG 2025.10、Material 3、Atlassian。
  `tokens/components.tokens.json` 的每個元件 Token 都必須被元件 CSS 實際使用；`tokens/semantic.tokens.json` 的每個 Semantic Token 都必須被元件 CSS 或元件 Token 別名使用；未使用的 Token 不得保留。
- 支援型別：color、dimension、duration、fontFamily、fontWeight、number、shadow；number 必須是有限數值，duration 使用 ms 或 s。
- 原始來源：tokens/*.tokens.json（DTCG 格式，`$value`／`$type` 必填，別名 `{…}`）。
  DTCG 是 Community Group Report，不是 W3C 正式標準，文件裡不稱它為「W3C 標準」。
  生成：scripts/build-tokens.mjs → dist/tokens.css（生成物，禁手改）。
- 品牌：每站識別色是 semantic `color.brand`，由 tokens/brands/<站>.tokens.json
  把 semantic 指到 primitive（只寫別名，不寫原始值）。六站定案值：
  chi #4A88FC、fg #FF9A00、merch #584CCC、nav #008CAD、h #FF61F6、status #8CDC47。品牌色只用於站點識別（Header／Sidebar 品牌標記），不取代共用語意 `color.accent`；連結、主要按鈕、焦點環與互動狀態使用依淺深主題調整的 Accent。品牌識別與操作色分離是刻意的 Token 契約。
- 語意色共用一組（Adobe Spectrum 900 階）：成功 #05834E／#099D59、
  異常 #9E6600／#BA7C00、錯誤 #D73220／#FC432E，淺深兩套，皆過 AA，
  永遠配文字或圖示，不只靠顏色。
- 斷點：768px（md，平板及以上）、1024px（lg，桌面及以上），只在
  breakpoints.json 定一次；CSS 與 JS 只用 min-width，不得用 max-width 反向寫法。
- 主題：key `chi-theme-mode`，三態 system／light／dark，預設跟隨系統；
  生效寫在 `data-chi-theme`。淺深兩套，乾淨實用。

## 4. 檔案職責

| 檔案 | 職責 | 禁止 |
|---|---|---|
| SPEC.md | 唯一規範 | 寫數值副本、寫修訂歷史 |
| tokens/*.tokens.json | 數值唯一來源 | 放元件名、站名、散文理由 |
| dist/*、templates/base.html、preview/sites.json | 生成物 | 手改 |
| components/<Name>/ | 元件唯一實作（.html／.css／.js，依元件需要） | 站名、原始色值、複製到站裡改 |
| sites/*.json | 站設定：id、名稱、網址、品牌、logo、描述、圖示；版式 `layout` 可選 `header`／`sidebar`，預設 `header` | 設計數值、未知欄位 |
| preview/index.html | 一個參數化預覽（?site=&theme=&layout=） | 每站一頁、示範區放真實內文 |

## 5. 範本規則（齊定案）

- 範本與示範頁不放任何真實內容：標題打「標題」、內文打「內文」、
  品牌寫「站名」／「副標」、導覽寫「連結一／連結二／連結三」。
- 頁尾跨站清單拿掉；fg 是獨立站，不需其他站連結。
- 模板只有一份：templates/base.html（由 base.template.html＋components 組裝）。
  版式由 `data-chi-layout` 一個屬性決定：header（預設）或 sidebar，不另開第二份。
- 新站起步：複製 base.html，填 `{{site.*}}`，填 `{{slots.*}}`，改 `data-chi-layout`，完成。

## 6. 元件合約

- Runtime 載入：Theme 與 Sidebar 必須在 `<head>` 中同步載入，且位於樣式表之前，確保首次繪製前套用主題與側欄收合狀態；Theme 先於 Sidebar。Tabs 與 Dialog 使用 `defer`，不可使用 `async`。
- Header：logo（本身就是首頁連結，不另設首頁按鍵）＋站名＋主題切換＋本站操作；
  導覽不進 header，放 header 下方獨立一列；沒有導覽的站省略整段。
  主題切換在 header 版式放 header，側邊欄版式放側邊欄底部。
- Footer：使用原生 footer landmark，提供站名＋版本識別；不放跨站連結。
- Sidebar：站設定 `layout: "sidebar"` 才使用側邊欄版式；適用門檻——本站導覽 ≥5 個頂層區段，或為動態分類；
  否則用 header＋副導覽列。收合開關在側邊欄頂列右側；收合 key 只有一個存放位置
  （引入 sidebar.js 的 `<script data-chi-sidebar-key>`），值
  `chi-<站點>-sidebar-collapsed`；手機版為抽屜，開關只在 <768px 顯示；抽屜關閉時須退出 Tab 順序並對輔助科技隱藏，開啟時限制 Tab 焦點於抽屜內，關閉後焦點返回觸發按鈕；公開 `bind()` 可重複呼叫，重複綁定不得增加事件監聽器。
  導覽連結寫法：`<a><span class="chi-sidebar__icon">…</span><span class="chi-sidebar__label">…</span></a>`。
- Button：primary／secondary／ghost／danger 四級 closed enum；
  一個操作情境至多一個 primary；不得自由傳 class。
- Tabs：容器使用 `data-chi-tabs` 與 `role="tablist"`；每個 tab 使用原生 button、`role="tab"`、唯一 id、`aria-controls`、`aria-selected`、`tabindex`；panel 使用 `role="tabpanel"`、唯一 id、`aria-labelledby`。方向鍵循環切換、Home／End 移至首／末個可用 tab，選取時同步更新 panel hidden；disabled tab 略過。
- 其他元件（表單、Tabs、卡片、清單／表格、徽章、對話框、資料狀態）：
  樣式在 components/base/base.css，沿用舊版已核對的段落（見 §10 來源）。 HTML 語意範例集中於 `components/base/examples.html`，作為欄位關聯、Tabs、Card、List、Table、Badge、Dialog 與四種資料狀態的可驗證參考。
  錯誤欄位必須同時設定 `aria-invalid="true"`、`aria-describedby` 指向錯誤文字，並套用 `chi-field--error`。
  Dialog 使用原生 `<dialog class="chi-dialog">` 與 `showModal()`；必須以 `aria-labelledby` 關聯可見標題。
  開啟按鈕使用 `data-chi-dialog-open="dialog-id"`，關閉按鈕使用 `data-chi-dialog-close`；
  可選 `data-chi-dialog-initial-focus`、`autofocus` 與 `data-chi-dialog-backdrop-close`。
  Runtime 來源為 `components/dialog/dialog.js`，建置後輸出 `dist/dialog.js`；設定初始焦點並於 close 後返回觸發處；焦點限制、Escape 與背景 inert 由原生 modal dialog 提供。
  日期選擇、檔案上傳、滑桿等未列入基礎示例表的元件，使用前須另行定義。

## 7. 元件展示與使用文件

- `preview/components.html` 是可互動元件展示頁，必須覆蓋所有穩定元件與主要狀態，並可切換六品牌與淺／深主題。
- `docs/COMPONENTS.md` 是開發者使用指南，提供語意 HTML、Runtime 載入方式、鍵盤／ARIA 契約與驗收流程；`scripts/validate-component-contracts.mjs` 會檢查文件範例與 canonical HTML 的 ID／ARIA 關聯、表單標籤、Radio 群組、Tabs、Dialog、Table、Button closed enum，以及 Theme／Sidebar／Tabs／Dialog 公開 Runtime API 文件與實作一致；與本規範衝突時以本文件為準。
- 展示頁需在手機、平板、桌機驗證無非預期水平溢出；元件樣式必須來自正式 Token 與元件 CSS，不另建一套展示專用元件樣式。

## 8. 新增流程

狀態 draft → preview → stable，只有核心維護者能升 stable。

- 新元件：提案（問題、誰遇到、現有元件為何解不了、至少 2 站需要或 1 站＋可信第二用途）
  → 設計（只用 Token、列出全部狀態、響應式、鍵盤＋ARIA）→ preview（一站試用）
  → stable（程式＋文件＋驗收全部完成）。無文件＝未完成，無無障礙驗收＝不 stable。
  參考：GOV.UK 貢獻標準、Carbon 產品開發生命週期（皆縮小為一人維護版）。
- 新網站：加一份品牌檔（只寫別名）＋一份 sites/*.json，執行同一個建置目標；元件庫不動。
  建置器產生 dist/sites/<站>/index.html 共用殼起始頁，正式導覽、操作與內容由站點專案提供。
  CI：全部 semantic Token 可解析、對比檢查
[... 259 bytes omitted ...]
代品與移除版本，移除只在下一個 major。

## 9. 驗收

CI 驗真的渲染依據，不是檔案在不在（舊系統三支腳本全綠仍是亂的）：

1. Token schema＋別名解析（每品牌全部 semantic 可解析）
2. Runtime 生成物與 components/ 來源逐位元一致（Theme／Sidebar／Tabs／Dialog）
3. 生成物一致（重跑生成，diff 必須為空；dist 只允許明確列出的生成資產）
4. 禁硬編碼（元件原始 CSS／模板來源出現未經 Token 管理的色值、尺寸、動效時間、透明度或字重即失敗；斷點由 breakpoints.json 管理；註解除外）
5. 網站設定 schema（欄位、型別、logo 檔案存在；預覽清單與 sites 一致）
6. 對比計算（每品牌×淺深色：一般文字 4.5:1、大字與非文字 UI 3:1）
7. 斷點一致（768／1024 在 JSON、CSS、JS 三處一致）
8. 站點輸出煙霧測試（每份站設定都產生完整 index.html；placeholder 全數填入、品牌與 Logo 路徑正確且都位於 dist 根目錄內、共用 CSS／JS 路徑存在）。另以臨時新增的兩個品牌／站設定執行新站整合測試，驗證只新增品牌 Token 與站設定即可產生預設 Header、指定 Sidebar 版式，且完整站點驗證通過；所有本機 CSS／JS／Logo 路徑須通過靜態 HTTP 200 與 MIME smoke test；Chrome 可用時另以 headless 桌機／手機載入六站並檢查 console；Chrome 可用時，另驗證元件展示頁六品牌 × 淺深主題 × 手機／平板／桌機共 36 組，檢查元件樣式、Runtime、表單互動與水平溢出；並以正式預覽殼驗證六品牌 × 淺深主題 × Header／Sidebar 版式共 24 組 Token 實際消費，檢查品牌識別線、共用操作 Accent、Footer 語意文字、主題色切換與 CSSOM 樣式規則；另以六品牌 × 淺深主題 × Header／Sidebar × 320／390／768／1024／1440px 五種視窗共 120 組幾何回歸，檢查殼層寬度、斷點、側欄寬度／定位、主內容置中、Footer 順序、水平溢出、按鈕與表單控制尺寸一致性及觸控目標；另以六品牌 × 淺深主題共 12 組實際驗證 Button、表單、Tabs、Card、List、Table 的 Hover／Active／Focus／Error／Disabled 狀態與語意 Token；並驗證 Checkbox／Radio／Switch 的 Checked／Disabled、Badge 語意色、Spinner／Skeleton、Empty／Error／Success 資料狀態，以及 Dialog Backdrop、焦點進入、關閉與焦點返回；並以真實鍵盤與 Chrome Accessibility Tree 驗證選擇控制角色／具名稱 Radio 群組、Readonly／Disabled／Invalid 公告、Live Region、Tab 順序與原生 Dialog Modal 背景隔離、Tab／Shift+Tab 邊界焦點；並驗證預設／減少動態偏好、Focus-visible CSS 合約與元件互動；另以 Chrome DevTools Protocol 注入真實 Tab、方向鍵、Home／End、Space、Escape 與滑鼠 backdrop 點擊，於六站桌機／手機共 12 組情境確認焦點落點、`:focus-visible`、Tabs disabled 略過／首末項移動與面板同步、Theme 鍵盤操作及標籤同步，以及 Dialog Escape／backdrop 關閉和焦點返回；另於六站手機版實際驗證 Sidebar 抽屜的 Tab／Shift+Tab 焦點循環、外部焦點回收與 Escape 關閉。 Chrome Accessibility Tree 與 DOM 稽核則覆蓋六站桌機／手機、淺色／深色共 24 組，檢查文件語言／標題、主要 Landmark、互動可存取名稱、表單標籤、圖片 alt、ARIA IDREF、重複 ID、aria-hidden 焦點安全，以及可見文字的實際前景／背景對比。另以元件表單瀏覽器測試覆蓋六站、五種視窗寬度（320／390／768／1024／1365px）及淺深主題共 60 組，實際檢查 Email 有效／錯誤狀態、欄位錯誤樣式、Select／Textarea 值、Checkbox／Radio 操作、按鈕送出表單、停用控制穩定性與表單控制項水平溢出；另以 Chrome DevTools Protocol 於六站桌機／手機共 12 組實際驗證 Tab 焦點順序、Select 方向鍵、Checkbox Space、Radio 方向鍵及 Enter 送出表單。此自動檢查是專案回歸門檻，不宣稱取代完整人工 WCAG／輔助科技測試。
9. 無障礙與視覺回歸分階段導入：v1.1 已加入 axe-core WCAG 2.0／2.1／2.2 A／AA 自動稽核，涵蓋六站 × 桌機／手機 × 淺／深主題共 24 組，並與既有 Chrome Accessibility Tree、DOM、鍵盤及實際文字對比檢查共同作為 CI 門檻；Playwright 跨瀏覽器測試、人工螢幕閱讀器驗收與逐像素截圖差異比對仍待後續評估，不以易受字型／作業系統影響的截圖雜訊作為阻擋條件。

## 10. 版本

SemVer。v1.0.0 是公開 API 宣告與 SemVer 承諾開始之時：
公開 API＝Token、元件 props／slots、站設定 schema、模板區塊；未列入的皆為內部。
廢棄放 minor、移除放下一個 major；破壞性變更只在 major。
站釘版用確切版本（或 Git Tag），回滾就是切回上一個 Tag 重建。
CHANGELOG.md 常備 Unreleased 區。參考：GOV.UK Frontend 版本政策。

## 11. 來源（搬用與參考，皆註明）

舊版搬用（chi-system-old，HEAD 436f028；皆為全量盤點核對過沒問題的部分）：
- Token 全部數值（六站識別色、語意色、字級、間距、圓角、陰影、版面尺寸）
  → tokens/*.tokens.json。為什麼沒問題：數值本身皆過 AA、與舊盤點實算一致。
- logo/ 全部 16 檔 → logo/。為什麼沒問題：站點 ID 命名已定案、檔案完整。
- theme.js → components/theme/theme.js → dist/theme.js。三態邏輯已驗證；dist 由建置器生成。
- sidebar.js → components/sidebar/sidebar.js → dist/sidebar.js。收合／抽屜／焦點邏輯已驗證；
  key 只剩 `<script>` 一個來源（舊報告 A06）、拿掉底部列 variant（舊報告 U01）。
- components.css 第 1–56、161–719 行 → components/base/base.css。
  為什麼沒問題：全部只引 Token；後續 Token 化與無障礙修正以目前來源檔為準。
  按鈕段未搬：v2 button.css 已按 component token 重寫。
- breakpoints.json、sites.json 的站資料 → breakpoints.json、sites/*.json。
  為什麼沒問題：斷點與站資料皆已定案；改動：sites 從一個寫死六站的陣列改為每站一檔。

別人做法參考（只抄架構，不抄數值；詳見研究報告）：
- GitHub Primer：分層架構、元件分層。
- USWDS：Token 管理。GOV.UK：元件規範、貢獻標準、SemVer 版本政策。
- SGDS：Token 命名與多主題。DTCG 2025.10：Token 格式（三層）。
- DWP：變更與貢獻流程。Carbon：draft→preview→stable 生命週期。
- 研究報告：~/workspace/research_notes/chi-system-design-systems-research-20261109-1329/report.md

## 12. 執行順序

1. 本文件齊審閱通過（v1.0.0 已按此版實作，見 CHANGELOG.md）
2. 最小核心實作，本地驗證全過
3. 推 main、Tag v1.0.0、遠端回讀核對
4. 試點遷移一站，成功後逐站推；不一次六站全上__FILE__docs/COMPONENTS.md
# CHI 元件使用指南

這份文件是 `components/` 元件的開發者入口與使用範例；規範衝突時以 [`SPEC.md`](../SPEC.md) 為準，視覺數值只讀 `tokens/*.tokens.json`。可互動展示請開啟 [`元件展示頁`](../preview/components.html)，可切換六個品牌與淺／深主題。

## 快速開始

在頁面 `<head>` 依序同步載入 Theme、Token 與元件樣式；Tabs／Dialog Runtime 使用 `defer`。Sidebar Runtime 只有 `layout="sidebar"` 的站點需要。

```html
<script src="/theme.js"></script>
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/components.css">
<script src="/tabs.js" defer></script>
<script src="/dialog.js" defer></script>
```

以上是 Header 版式。Sidebar 版式需在 `<head>` 中、樣式表之前同步載入 Sidebar Runtime，並以 script attribute 指定唯一的站點收合 key：

```html
<script src="/theme.js"></script>
<script src="/sidebar.js" data-chi-sidebar-key="chi-example-sidebar-collapsed"></script>
<link rel="stylesheet" href="/tokens.css">
<link rel="stylesheet" href="/components.css">
<script src="/tabs.js" defer></script>
<script src="/dialog.js" defer></script>
```

Theme 必須先於 Sidebar；兩者皆同步載入且早於樣式表，避免首次繪製閃爍。Sidebar key 格式為 `chi-<site-id>-sidebar-collapsed`，只放在 script attribute，不要另存於 HTML 或 JavaScript。以上路徑以獨立部署的 `dist/` 為根目錄。實際部署版本請釘選 Git Tag，不要引用浮動分支。

## 品牌識別色與操作色

品牌 Token `color.brand` 只負責站點識別，例如 Header／Sidebar 頂部的品牌識別線；它不會覆寫全站操作色。連結、Primary Button、焦點環與互動狀態使用共用語意 Token `color.accent`，並依淺色／深色主題切換。這是刻意的分層，不是品牌色漏套。

新增元件時，先判斷它是在表達「這是哪個站」還是在表達「這個操作可以做什麼」：前者使用 `color.brand`，後者使用對應的 semantic／component Token。不要直接把 `color.brand` 套到所有主要按鈕。

## 元件總覽

| 元件 | CSS／Runtime 來源 | 主要用途 | 關鍵契約 |
|---|---|---|---|
| Header／Footer | `components/header/`、`components/footer/` | 共用站點識別與頁尾 | Header 品牌 Logo 是首頁連結；Footer 使用原生 footer landmark |
| Sidebar | `components/sidebar/`、`components/sidebar/sidebar.js` | 導覽區段較多的站點 | 僅 `layout: sidebar` 使用；手機抽屜需焦點循環與返回焦點 |
| Button | `components/button/` | 操作按鈕 | 僅 `primary`、`secondary`、`ghost`、`danger` 四種；一個情境最多一個 primary |
| Form fields | `components/base/base.css` | Input、Select、Textarea、Checkbox、Radio、Switch | 原生表單元素；每個欄位要有可見 label |
| Tabs | `components/base/base.css`、`components/tabs/tabs.js` | 同一區域的平行內容 | 原生 button + tablist/tab/tabpanel；方向鍵、Home、End 支援 |
| Card | `components/base/base.css` | 相關內容分組 | 使用 article 與標題關聯；可點擊卡片須提供明確連結 |
| List／Table | `components/base/base.css` | 清單與表格資料 | 優先使用原生 ul／ol／table 語意；表格欄列標題要有 scope |
| Badge | `components/base/base.css` | 短狀態標記 | 狀態文字不可只靠顏色表達 |
| Dialog | `components/base/base.css`、`components/dialog/dialog.js` | 需要暫時聚焦的任務 | 原生 dialog、aria-labelledby、開啟／關閉與焦點返回契約 |
| Data states | `components/base/base.css` | Loading、Empty、Error、Success | 使用 status／alert 語意；狀態標題與說明清楚可讀 |

## Runtime JavaScript API

Runtime 會在共用殼載入時自動初始化。以下公開方法供動態插入元件、框架整合或除錯使用；一般靜態頁面只需依照前面的 HTML attribute 契約，不必手動呼叫。

| Runtime | 公開 API | 行為 |
|---|---|---|
| Theme | `ChiTheme.getMode()`、`ChiTheme.getEffective()` | 取得使用者模式（`system`／`light`／`dark`）與實際生效主題（`light`／`dark`） |
| Theme | `ChiTheme.setMode(mode)`、`ChiTheme.cycle()` | 設定並儲存模式，或依序切換；`setMode` 接受三種合法模式 |
| Theme | `ChiTheme.setPreviewMode(mode)` | 只切換當前頁面，不寫入使用者偏好，供預覽器使用 |
| Theme | `ChiTheme.bindToggles()`、`ChiTheme.KEY`、`ChiTheme.MODES` | 綁定主題按鈕；公開儲存 key 與合法模式清單 |
| Sidebar | `ChiSidebar.bind()`、`ChiSidebar.isCollapsed()` | 重綁新增的 Sidebar DOM（不重複註冊既有事件）與讀取桌面收合狀態 |
| Sidebar | `ChiSidebar.setCollapsed(value)`、`ChiSidebar.toggleCollapsed()` | 設定或切換桌面收合狀態 |
| Sidebar | `ChiSidebar.openMobile()`、`ChiSidebar.closeMobile(restoreFocus)` | 開啟手機抽屜；關閉時預設返回觸發按鈕，只有跨斷點等情況才傳 `false` 略過焦點返回 |
| Tabs | `ChiTabs.init(root)`、`ChiTabs.initAll()` | 初始化指定的 `[data-chi-tabs]` 根節點，或掃描整份文件；適用動態插入的 Tabs |
| Dialog | `ChiDialog.init(dialog)`、`ChiDialog.initAll()` | 初始化指定 Dialog，或掃描整份文件 |
| Dialog | `ChiDialog.open(dialog, opener)`、`ChiDialog.close(dialog, returnValue)` | 以原生 modal 開啟／關閉；`open` 成功回傳 `true`，無法開啟回傳 `false` |

事件：`window` 會派發 `chi-theme-change`（`detail: { mode, effective }`）與 `chi-sidebar-change`（`detail: { collapsed }`）。監聽器應依事件 detail 更新自己的介面，不要直接修改 CHI 內部的 DOM 狀態。`setPreviewMode()` 不儲存偏好；正式使用者操作請用 `setMode()`。

```js
// 動態插入元件後，初始化新增的區塊
window.ChiTabs?.init(document.querySelector('[data-chi-tabs]'));
window.ChiDialog?.init(document.querySelector('#confirm-dialog'));

// 監聽共用狀態
window.addEventListener('chi-theme-change', (event) => {
  console.log(event.detail.mode, event.detail.effective);
});
```

Runtime 物件是版本化公開 API；未列出的內部函式、DOM class 與私有屬性不保證跨版本相容。呼叫 Dialog API 時傳入實際 DOM Element，不是 ID 字串。

## Button

```html
<button class="chi-btn chi-btn--primary" type="button">儲存</button>
<button class="chi-btn chi-btn--secondary" type="button">取消</button>
<button class="chi-btn chi-btn--ghost" type="button">更多</button>
<button class="chi-btn chi-btn--danger" type="button">刪除</button>
<button class="chi-btn chi-btn--primary" type="button" disabled>處理中</button>
```

使用原生 `disabled`，不要只用 `aria-disabled` 模擬停用。按鈕若不是送出表單，明確指定 `type="button"`。純圖示按鈕必須提供可存取名稱（例如 `aria-label`）；不可只依賴 tooltip 或圖示外觀。一個操作情境最多一個 Primary。

## Form fields

```html
<div class="chi-field">
  <label class="chi-field__label" for="display-name">顯示名稱</label>
  <input class="chi-input" id="display-name" name="displayName" autocomplete="name">
  <p class="chi-field__hint" id="display-name-hint">其他人會看到這個名稱。</p>
</div>

<div class="chi-field chi-field--error">
  <label class="chi-field__label" for="email">電子郵件</label>
  <input class="chi-input" id="email" name="email" type="email" aria-invalid="true" aria-describedby="email-error">
  <p class="chi-field__error" id="email-error">請輸入有效的電子郵件地址。</p>
</div>

<label class="chi-check"><input class="chi-check__input" type="checkbox" name="updates"> 接收更新通知</label>
<fieldset>
  <legend>通知頻率</legend>
  <label class="chi-radio"><input class="chi-radio__input" type="radio" name="frequency" value="weekly"> 每週</label>
  <label class="chi-radio"><input class="chi-radio__input" type="radio" name="frequency" value="monthly"> 每月</label>
</fieldset>
<label class="chi-switch"><input class="chi-switch__input" type="checkbox" role="switch"> 啟用通知</label>
```

錯誤欄位必須同時有 `aria-invalid="true"`、`aria-describedby` 指向錯誤訊息，以及 `chi-field--error`。Checkbox／Radio／Switch 的文字放在 label 內，讓點擊範圍包含文字；Radio 選項必須放在有可見 `legend` 的 `fieldset` 中。

`disabled` 與 `readonly` 不可混用：`disabled` 不可聚焦且不會隨表單送出；`readonly` 僅適用於支援它的 Input／Textarea，仍可聚焦且會隨表單送出。Select、Checkbox、Radio 不支援 `readonly`，不可用 `aria-readonly` 假裝原生行為。欄位錯誤使用 `aria-invalid`，不要把錯誤狀態當成停用或唯讀。

Select 使用原生 `<select class="chi-select">`；需要包裝圖示時使用 `.chi-select-wrap`。Textarea 使用 `.chi-textarea`。不要自行重做原生選擇器的鍵盤行為。

## Tabs

```html
<div data-chi-tabs>
  <div class="chi-tabs" role="tablist" aria-label="設定分類">
    <button class="chi-tab" id="tab-general" type="button" role="tab" aria-controls="panel-general" aria-selected="true" tabindex="0">一般</button>
    <button class="chi-tab" id="tab-security" type="button" role="tab" aria-controls="panel-security" aria-selected="false" tabindex="-1">安全性</button>
  </div>
  <section id="panel-general" role="tabpanel" aria-labelledby="tab-general" tabindex="0">一般設定內容</section>
  <section id="panel-security" role="tabpanel" aria-labelledby="tab-security" tabindex="0" hidden>安全性設定內容</section>
</div>
```

每個 tab 與 panel 的 ID 必須唯一且互相關聯。Runtime 會同步 `aria-selected`、`tabindex` 與 panel `hidden`；disabled tab 會略過。這是自動啟用模式：方向鍵移動焦點時，同步切換選取與面板；Home／End 移至第一／最後一個可用 tab。Tab 鍵離開整組 tablist，panel 依範例以 `tabindex="0"` 接受焦點。

## Card、List、Table

```html
<article class="chi-card" aria-labelledby="summary-title">
  <h2 class="chi-card__title" id="summary-title">帳戶摘要</h2>
  <div class="chi-card__body"><p>摘要內容。</p></div>
  <div class="chi-card__actions"><a href="/account">查看帳戶</a></div>
</article>

<ul class="chi-list" aria-label="最近活動">
  <li class="chi-list__item">已更新資料</li>
  <li class="chi-list__item">已啟用驗證</li>
</ul>

<div class="chi-table-wrap">
  <table class="chi-table">
    <caption>登入紀錄</caption>
    <thead><tr><th scope="col">日期</th><th scope="col">裝置</th></tr></thead>
    <tbody><tr><th scope="row">2026-11-14</th><td>桌面裝置</td></tr></tbody>
  </table>
</div>
```

表格外層 `.chi-table-wrap` 提供窄螢幕水平捲動容器；不要為了視覺對齊移除 caption 或欄列標題。

## Badge 與資料狀態

Badge 修飾短狀態，使用 `chi-badge--success|warning|danger|info`。資料狀態使用 `.chi-state`、`.chi-state__title`、`.chi-state__desc`，依情境選擇 `role="status"` 或 `role="alert"`；載入狀態可加 `aria-busy="true"` 與 `.chi-spinner`／`.chi-skeleton`。成功、錯誤、警告不能只靠顏色辨識。

## Dialog

```html
<button class="chi-btn chi-btn--secondary" type="button" data-chi-dialog-open="confirm-dialog">開啟確認</button>
<dialog class="chi-dialog" id="confirm-dialog" aria-labelledby="confirm-title">
  <h2 class="chi-dialog__title" id="confirm-title" tabindex="-1">確認操作</h2>
  <p class="chi-dialog__body">確定要繼續嗎？</p>
  <div class="chi-dialog__actions">
    <button class="chi-btn chi-btn--secondary" type="button" data-chi-dialog-close>取消</button>
    <button class="chi-btn chi-btn--primary" type="button" data-chi-dialog-close>確認</button>
  </div>
</dialog>
```

由 `dialog.js` 管理 `showModal()`、初始焦點與關閉後焦點返回。可用 `data-chi-dialog-initial-focus` 指定初始焦點，或在 dialog 上加 `data-chi-dialog-backdrop-close` 啟用背景點擊關閉。焦點限制、Escape 關閉與背景 inert 由原生 modal `<dialog>` 提供，不要自行再加一套焦點陷阱。每個 Dialog 都必須有唯一 ID，並以 `aria-labelledby` 指向對話框內可見標題。

## 驗收與變更

1. 先在元件展示頁檢查六品牌、淺／深主題與桌機／手機版面。
2. 修改只落在 `components/`、`tokens/` 或模板來源；不要手改 `dist/`、`templates/base.html`。
3. 執行 `npm run check`，確認 Node、Chrome 互動、鍵盤、axe-core WCAG 2.0／2.1／2.2 A／AA 稽核、無障礙與生成物一致性全部通過。axe-core 自動稽核覆蓋六站 × 桌機／手機 × 淺／深主題；它補強自訂 DOM／Accessibility Tree 檢查，但不取代人工螢幕閱讀器驗收。
4. 新元件依 `SPEC.md` 的 draft → preview → stable 流程；沒有文件與無障礙驗收，不升 stable。