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
  `tokens/components.tokens.json` 的每個元件 Token 都必須被元件 CSS 實際使用；未使用的元件 Token 不得保留。
- 支援型別：color、dimension、duration、fontFamily、fontWeight、number、shadow；number 必須是有限數值，duration 使用 ms 或 s。
- 原始來源：tokens/*.tokens.json（DTCG 格式，`$value`／`$type` 必填，別名 `{…}`）。
  DTCG 是 Community Group Report，不是 W3C 正式標準，文件裡不稱它為「W3C 標準」。
  生成：scripts/build-tokens.mjs → dist/tokens.css（生成物，禁手改）。
- 品牌：每站識別色是 semantic `color.brand`，由 tokens/brands/<站>.tokens.json
  把 semantic 指到 primitive（只寫別名，不寫原始值）。六站定案值：
  chi #4A88FC、fg #FF9A00、merch #584CCC、nav #008CAD、h #FF61F6、status #8CDC47。
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

- Header：logo（本身就是首頁連結，不另設首頁按鍵）＋站名＋主題切換＋本站操作；
  導覽不進 header，放 header 下方獨立一列；沒有導覽的站省略整段。
  主題切換在 header 版式放 header，側邊欄版式放側邊欄底部。
- Footer：站名＋版本識別；不放跨站連結。
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

## 7. 新增流程

狀態 draft → preview → stable，只有核心維護者能升 stable。

- 新元件：提案（問題、誰遇到、現有元件為何解不了、至少 2 站需要或 1 站＋可信第二用途）
  → 設計（只用 Token、列出全部狀態、響應式、鍵盤＋ARIA）→ preview（一站試用）
  → stable（程式＋文件＋驗收全部完成）。無文件＝未完成，無無障礙驗收＝不 stable。
  參考：GOV.UK 貢獻標準、Carbon 產品開發生命週期（皆縮小為一人維護版）。
- 新網站：加一份品牌檔（只寫別名）＋一份 sites/*.json，執行同一個建置目標；元件庫不動。
  建置器產生 dist/sites/<站>/index.html 共用殼起始頁，正式導覽、操作與內容由站點專案提供。
  CI：全部 semantic Token 可解析、對比檢查通過、假俗艷品牌測試通過。
  系統擁有 primitive＋semantic 合約；各站擁有自己的品牌檔與設定檔。
- 新 Token：只提角色、不提數值；角色至少在 2 站或 2 元件出現才加。
  廢棄用 `$deprecated` 標註替代品與移除版本，移除只在下一個 major。

## 8. 驗收

CI 驗真的渲染依據，不是檔案在不在（舊系統三支腳本全綠仍是亂的）：

1. Token schema＋別名解析（每品牌全部 semantic 可解析）
2. Runtime 生成物與 components/ 來源逐位元一致（Theme／Sidebar／Tabs／Dialog）
3. 生成物一致（重跑生成，diff 必須為空；dist 只允許明確列出的生成資產）
4. 禁硬編碼（元件原始 CSS／模板來源出現未經 Token 管理的色值、尺寸、動效時間、透明度或字重即失敗；斷點由 breakpoints.json 管理；註解除外）
5. 網站設定 schema（欄位、型別、logo 檔案存在；預覽清單與 sites 一致）
6. 對比計算（每品牌×淺深色：一般文字 4.5:1、大字與非文字 UI 3:1）
7. 斷點一致（768／1024 在 JSON、CSS、JS 三處一致）
8. 站點輸出煙霧測試（每份站設定都產生完整 index.html；placeholder 全數填入、品牌與 Logo 路徑正確、共用 CSS／JS 路徑存在）。瀏覽器 console 與實際 404 驗收列為 v1.1 Playwright 工作。
9. axe／Playwright 計算樣式／視覺回歸：列為 v1.1（Storybook 未引入前，以上 8 道為 v1.0 門檻）

## 9. 版本

SemVer。v1.0.0 是公開 API 宣告與 SemVer 承諾開始之時：
公開 API＝Token、元件 props／slots、站設定 schema、模板區塊；未列入的皆為內部。
廢棄放 minor、移除放下一個 major；破壞性變更只在 major。
站釘版用確切版本（或 Git Tag），回滾就是切回上一個 Tag 重建。
CHANGELOG.md 常備 Unreleased 區。參考：GOV.UK Frontend 版本政策。

## 10. 來源（搬用與參考，皆註明）

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

## 11. 執行順序

1. 本文件齊審閱通過（v1.0.0 已按此版實作，見 CHANGELOG.md）
2. 最小核心實作，本地驗證全過
3. 推 main、Tag v1.0.0、遠端回讀核對
4. 試點遷移一站，成功後逐站推；不一次六站全上