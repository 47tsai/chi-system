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
- 原始來源：tokens/*.tokens.json（DTCG �]��V��(�+my�文字、主題色切換與 CSSOM 樣式規則；另以六品牌 × 淺深主題 × Header／Sidebar × 320／390／768／1024／1440px 五種視窗共 120 組幾何回歸，檢查殼層寬度、斷點、側欄寬度／定位、主內容置中、Footer 順序、水平溢出、按鈕與表單控制尺寸一致性及觸控目標；另以六品牌 × 淺深主題共 12 組實際驗證 Button、表單、Tabs、Card、List、Table 的 Hover／Active／Focus／Error／Disabled 狀態與語意 Token；並驗證 Checkbox／Radio／Switch 的 Checked／Disabled、Badge 語意色、Spinner／Skeleton、Empty／Error／Success 資料狀態，以及 Dialog Backdrop、焦點進入、關閉與焦點返回；並以真實鍵盤與 Chrome Accessibility Tree 驗證選擇控制角色／具名稱 Radio 群組、Readonly／Disabled／Invalid 公告、Live Region、Tab 順序與原生 Dialog Modal 背景隔離、Tab／Shift+Tab 邊界焦點；並驗證預設／減少動態偏好、Focus-visible CSS 合約與元件互動；另以 Chrome DevTools Protocol 注入真實 Tab、方向鍵、Home／End、Space、Escape 與滑鼠 backdrop 點擊，於六站桌機／手機共 12 組情境確認焦點落點、`:focus-visible`、Tabs disabled 略過／首末項移動與面板同步、Theme 鍵盤操作及標籤同步，以及 Dialog Escape／backdrop 關閉和焦點返回；另於六站手機版實際驗證 Sidebar 抽屜的 Tab／Shift+Tab 焦點循環、外部焦點回收與 Escape 關閉。 Chrome Accessibility Tree 與 DOM 稽核則覆蓋六站桌機／手機、淺色／深色共 24 組，檢查文件語言／標題、主要 Landmark、互動可存取名稱、表單標籤、圖片 alt、ARIA IDREF、重複 ID、aria-hidden 焦點安全，以及可見文字的實際前景／背景對比。另以元件表單瀏覽器測試覆蓋六站、五種視窗寬度（320／390／768／1024／1365px）及淺深主題共 60 組，實際檢查 Email 有效／錯誤狀態、欄位錯誤樣式、Select／Textarea 值、Checkbox／Radio 操作、按鈕送出表單、停用控制穩定性與表單控制項水平溢出；另以 Chrome DevTools Protocol 於六站桌機／手機共 12 組實際驗證 Tab 焦點順序、Select 方向鍵、Checkbox Space、Radio 方向鍵及 Enter 送出表單。此自動檢查是專案回歸門檻，不宣稱取代完整人工 WCAG／輔助科技測試。
9. 無障礙與視覺回歸分階段導入：v1.1 已加入 axe-core WCAG 2.0／2.1／2.2 A／AA 自動稽核，涵蓋六站 × 桌機／手機 × 淺／深主題共 24 組；並加入 Playwright Chromium 真實頁面互動測試，涵蓋六站 × 桌機／手機共 12 組，檢查主要 Landmark、標題、品牌識別、主題切換、文件語言與水平溢出；兩者與既有 Chrome Accessibility Tree、DOM、鍵盤及實際文字對比檢查共同作為 CI 門檻。Firefox／WebKit 跨瀏覽器測試、人工螢幕閱讀器驗收與逐像素截圖差異比對仍待後續評估，不以易受字型／作業系統影響的截圖雜訊作為阻擋條件。

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
4. 試點遷移一站，成功後逐站推；不一次六站全上