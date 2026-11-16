# Changelog

## Unreleased

## v1.2.0 — 2026-11-17

- status／h／merch 三站 accent 跟主題色走：tokens/brands/status.tokens.json、h.tokens.json、merch.tokens.json 新增淺／深兩套 accent 覆寫（primitives 新增 lime／fuchsia／violet 三套 accent 家族共 21 個原始值），眉標、側邊欄 active、主要按鈕、焦點環等配件不再 fallback 到藍色。起因是齊 2026-11-17 發現 status 站品牌是綠色、元件 accent 卻全是藍色：tokens.css 裡 `[data-chi-brand="status"]` 只覆寫了品牌色，accent 家族缺失。status 文字 accent 用深綠 #46731C 而非品牌色 #8CDC47，因 #8CDC47 對白僅 1.69:1；#46731C 在白底 5.63:1、canvas 5.30:1、sunken 4.93:1、soft #FFF3E0 5.13:1，白字按鈕 5.63:1，皆過 AA；hover／active #3F6B12、按鈕 active #355A0F（白字 8.01:1）。注意：初選 #4A7A1E 白底雖 5.13:1、但 sunken 只有 4.49:1，過不了 per-brand 檢查，已加深一階為 #46731C。焦點環用 #52921C（對白 3.83:1、對 sunken 3.35:1，過非文字 3:1）。深色 accent #A8E063（對深色 canvas 11.76:1）、hover #BBE785、active 即品牌色 #8CDC47。h 文字 accent 用深品紅 #BD00B2（白底 5.52:1、canvas 5.19:1、sunken 4.83:1、soft 5.03:1），品牌色 #FF61F6 對白僅 2.53:1；hover／active #A9009F、按鈕 active #94008C；焦點環 #E600D8（對白 3.92:1、對 sunken 3.43:1）；深色 accent #FF6EF7（對深色 canvas 7.68:1）、hover #FF97F9、active 即品牌色 #FF61F6。merch 文字 accent 直接用品牌色 #584CCC（白底 6.32:1、canvas 5.95:1、sunken 5.53:1，同 auth 做法，品牌色本身已過 AA）；hover／active #493CC7、按鈕 active #4235BA；焦點環亦用品牌色；深色 accent #A8A2E4（對深色 canvas 7.79:1）、hover #C6C2ED、active #928ADD（品牌色 #584CCC 在深色底只有 2.89:1，不可用作深色 active）。全部數值先以腳本驗算、再由 validate.mjs 與 token-consumption smoke 複驗。語意色與其他站品牌色不動。注意：status 站本身須重釘到新版，線上站才能看到綠色配件；h／merch 尚未遷移，改了不影響任何線上站。
- auth 品牌（2026-11-16 已上 main，本次補記）：tokens/brands/auth.tokens.json 與 Bitwarden 藍 accent 家族（#175DDC），本站配件跟主題色走；v1.1.0 發版後才上 main，當時未記入 CHANGELOG，本版一併收錄。語意色與其他站品牌色不動。
- 本次發版為 v1.2.0（minor）：新增 Token（lime／fuchsia／violet 三套 accent primitive 家族與三站 accent 覆寫），按 docs/RELEASE.md §2 判為 minor。雖是修復缺口，但新增公開 Token 且渲染結果改變（status／h／merch 配件由藍變綠／粉／紫），不符合 patch「渲染結果不變」的定義；判斷有疑義時往高一級打。

## v1.1.0 — 2026-11-16

- fg 站 accent 跟主題色走：tokens/brands/fg.tokens.json 新增淺／深兩套 accent 覆寫（齊 2026-11-16 定案），眉標、側邊欄 active、主要按鈕、焦點環等配件不再是藍色。文字 accent 用深橘 #8F5600 而非品牌色 #FF9A00，因 #FF9A00 對白僅 2.13:1；#8F5600 在白底 6.00:1、canvas 5.65:1、sunken 5.25:1、soft #FFF3E0 5.47:1，白字按鈕 6.00:1，皆過 AA；hover／active #7A4900、按鈕 active #663D00（白字 9.41:1）。焦點環用 #B86E00（對白 3.99:1、對 sunken 3.49:1，過非文字 3:1），因 #FF9A00 對白 2.13:1 不可用作焦點環。深色 accent #FFB84D（對深色 canvas 10.63:1）、hover #FFCC80、active #FF9900。另新增 per-brand accent 對比檢查：有覆寫的品牌在 canvas／surface／sunken／soft 四種底上皆須 ≥4.5:1，由 validate.mjs 與 token-consumption smoke 檢查（nav 一併納入檢查，soft 除外：nav 的 soft #E6F4F7 未進 Token，2026-11-14 人工驗算 #006E87 為 5.21:1）。語意色與其他站品牌色不動。注意：fg 站本身尚未重釘，線上站要看到橘色配件須等 fg 重釘到新版。
- U1 站點 CSS 不得定義 --chi-*：SPEC §3 補契約（站點自己的變數一律用 --<站點>-* 前綴），新增 scripts/check-site-tokens.mjs（掃描站點 CSS，出現 --chi- 定義即失敗，排除站內釘版複製的 chi-system/ 與 dist/；拿 nav 的 css/nav.css 當反例共抓到 49 處、fg 的 fg.css 當正例通過），validate.mjs 加本系統自查，tests/site-tokens.test.mjs 4 項回歸測試。nav.css 的舊覆寫本身不在本次範圍（外觀分叉收斂與否尚未定案，不動）。
- U3 釘版流程：新增 docs/RELEASE.md（發版節奏：Unreleased 累積到一段落打 patch／minor tag 的判斷標準、打 tag 前檢查清單、回滾方式、各站重釘流程、釘版紀錄格式以 fg 的 release.json 為範本），新增 scripts/check-pinned.mjs（讀站方 pin commit，對照 chi-system main 列出期間 commit 與 CHANGELOG 條目，落後超過 --max-lag（預設 10）或有重大不相容變更時警告 exit 1；實測 fg 釘 c71c30c 落後 6 個 commit、無此類變更）。本次發版為 v1.1.0（minor，齊 2026-11-16 拍板）：Unreleased 有新增功能與新增 Token，按 docs/RELEASE.md §2 判為 minor。
- U4 新增 chi-icon 內嵌 SVG 圖示集：新增 components/icon/icon.js（圖示 map＋chiIcon() helper，接受 'fa-solid fa-star' 寫法、回傳完整 inline `<svg viewBox="…" fill="currentColor" aria-hidden="true"><path d="…"/></svg>` 字串，不依賴外部檔案、不依賴 sprite 路徑；未知名稱回傳 fallback fa-solid fa-triangle-exclamation，不拋錯）與 icon.css（.chi-icon 尺寸 1em、currentColor、垂直對齊；.chi-sidebar__icon 內的 svg 撐滿）；建置器 CSS 順序加入 icon（base 之前）並輸出 dist/icon.js，SPEC §6／§8 與 docs/COMPONENTS.md 補圖示契約與用法，tests/icon.test.mjs 7 項回歸測試。共 39 個圖示（solid 31、regular 2、brands 6），涵蓋 nav 全站 Font Awesome 6.4.0 CDN 用到的全部圖示，nav 換掉 CDN 的前提已具備（nav 本身本次不動）。圖示來源 Font Awesome Free 6.4.0，Icons: CC BY 4.0；例外：fa-brands fa-threads 在 6.4.0 尚不存在，取自 6.4.2（同授權，來源版本已註明於 icon.js 檔頭與文件）。注意：base.css 既有的 .chi-icon（Token 固定 20px）仍保留給 select 等舊用法，icon.css 以 svg.chi-icon 提高特異度避免被蓋回固定尺寸。
- nav 站 accent 跟主題色走：tokens/brands/nav.tokens.json 新增淺／深兩套 accent 覆寫（淺色 #008CAD／文字與按鈕 #006E87、深色 #35BDD8），眉標、側邊欄 active、主要按鈕、焦點環等配件不再是藍色；文字 accent 用 #006E87 而非 #007A96，因 #007A96 在 sunken／soft 底上只有 4.35／4.41:1、過不了 axe AA，#006E87 在 sunken 5.13:1、soft 5.21:1；生成器改為輸出品牌 accent 覆寫區塊，幾何 smoke 的品牌計數改為去重；token-consumption smoke 的 accent 檢查改為按品牌／主題比對生成 CSS 宣告的預期值，不再要求六站 accent 相同。語意色與其他站品牌色不動。
- M40 擴充跨瀏覽器元件展示驗收：三引擎 × 六品牌 × 桌機／手機共 36 組，真實操作 Tabs 方向鍵／Home／End、Radio／Switch、表單送出與原生 Dialog 開啟／Escape／焦點返回；另執行 108 組 showcase axe-core 淺／深主題與 Dialog 開啟狀態稽核。修正展示頁 Theme icon-only 按鈕與 Card link 的可見文字／可存取名稱不一致，跨瀏覽器展示頁共 180 組 axe-core 稽核零違規。
- M39 將 axe-core WCAG 2.0／2.1／2.2 A／AA 稽核整合至 Playwright 三引擎流程，在 Chromium／Firefox／WebKit × 六站 × 桌機／手機 × 淺／深主題共 72 組執行；全部零違規，跨引擎無障礙結果成為 CI 阻擋條件。
- M38 擴充 Playwright 至 Chromium／Firefox／WebKit 三引擎，六站 × 桌機／手機共 36 組；並在三引擎 × 六站 × 桌機／手機 × 淺／深主題共 72 組執行 axe-core WCAG 2.0／2.1／2.2 A／AA 稽核，全部零違規。CI 安裝三種瀏覽器及必要系統依賴，跨引擎互動與無障礙旅程成為正式阻擋門檻。
- M37 修正 Node 測試探索範圍：`npm test` 只執行 `tests/*.test.mjs`，避免把會暫時改寫 Token／站設定與 dist 的整合腳本再次當成單元測試並行執行，消除生成物讀寫競態。
- M36 新增 Playwright 瀏覽器旅程：六站 × 桌機／手機共 12 組，透過可存取角色與名稱定位主要介面，驗證主 Landmark、H1、品牌識別、主題切換、文件語言與水平溢出；納入 `npm run test:browser`，並提供獨立 `npm run test:playwright`。
- M35 將 axe-core 納入既有 Chrome 無障礙驗收：依 WCAG 2.0／2.1／2.2 A／AA 規則掃描六站 × 桌機／手機 × 淺／深主題共 24 組，違規直接使測試失敗；CI 新增 `npm ci`，鎖定依賴並確保乾淨環境可重現。人工螢幕閱讀器驗收仍列後續工作。
- M34 補齊 Theme／Sidebar／Tabs／Dialog 的公開 JavaScript API、參數、事件與使用時機文件；文件驗證器同步比對 Runtime 實際匯出的方法，避免 API 文件與程式碼分岔。
- M33 新增全新站點整合驗收：測試執行期間暫時加入兩份品牌 Token 與兩份站設定，分別驗證預設 Header 與指定 Sidebar 版式可生成完整站點、品牌 Token、Logo 與共用資產路徑，並通過完整站點驗證；測試結束自動清除 fixture 並重建正式輸出。
- M32 強化元件公開契約文件：補齊 Header／Sidebar Runtime 載入範例、Radio fieldset／legend、Readonly／Disabled／Invalid 差異、圖示按鈕可存取名稱、Tabs 自動啟用與 Dialog 原生 Modal 行為；新增文件範例驗證器，檢查 HTML ID／ARIA 關聯、表單標籤、Button closed enum、Tabs／Dialog／Table 語意，並納入 `npm run validate`。
- Theme／Sidebar runtime 來源收回 `components/`，由建置器產生 `dist/`；CI 驗證 Theme／Sidebar／Tabs／Dialog 四份 runtime 來源與輸出一致。
- Dialog 使用原生 modal dialog，管理初始焦點與關閉後焦點返回；補足 Tabs 鍵盤行為與表單／元件語意回歸測試。
- 補齊 Badge 四種狀態與 Loading／Empty／Error／Success 語意範例及驗證。
- 元件 Token 必須被 CSS 使用；透明度、動效時間、字重與遮罩色改由 Token 管理，禁止硬編碼檢查同步擴充。
- 驗證器鎖定 `dist/` 允許的生成檔清單，並檢查每站輸出引用的所有共用 runtime 資產。
- 每站所需 Logo 複製至 `dist/logo/`，相對路徑不再逃出部署根目錄；新增靜態資產解析測試。
- 加入 Node 原生 HTTP 部署 smoke test，逐一請求六站入口與所有本機 CSS／JS／Logo，驗證 200 與 MIME。
- 補足 Header 品牌可存取名稱與 Footer landmark／站名／版本的語意合約。
- 新增無依賴 headless Chrome smoke test，於可用環境驗證六站桌機／手機載入與 console。
- Semantic Token 必須實際被元件 CSS 或元件 Token 別名使用，避免語意層出現無消費者的孤兒 Token。
- 修正共用殼 Runtime 載入順序：Theme／Sidebar 移至樣式表前同步載入，Tabs／Dialog 保持 `defer`；新增驗證防止回歸。
- 擴充 headless Chrome 測試為真實互動驗收：驗證主題循環、側欄桌機收合／手機抽屜、Tabs 鍵盤切換，以及 Dialog 焦點進入與返回。
- Chrome 驗收增加桌機／手機斷點版式、側欄定位與頁面水平溢位檢查。
- Chrome 驗收擴充為預設與減少動態兩種偏好模式，檢查動態偏好媒體查詢、元件轉場／Spinner 動畫停用，以及 Focus-visible 樣式規則仍存在於生成 CSS。
- 新增獨立 Chrome DevTools Protocol 鍵盤驗收：六站桌機／手機共 12 組情境實際送出 Tab、ArrowRight、Escape，確認焦點落點、`:focus-visible`、Tabs 選取／面板同步，以及 Dialog 關閉與焦點返回。
- Dialog 的瀏覽器 close-control smoke 改為檢查同步關閉結果；原生 Escape、close event 與焦點返回由獨立 CDP 鍵盤測試驗證。
- 新增 Sidebar 手機抽屜真實鍵盤驗收：六站逐一以 Tab／Shift+Tab 測試焦點循環、抽屜外焦點回收與 Escape 關閉／焦點返回。
- M23 擴充真實鍵盤旅程：Tabs 以方向鍵略過 disabled tab，並實測 Home／End；Theme 以 Space 鍵操作並確認模式與可存取標籤同步；Dialog 實際點擊 backdrop 驗證 opt-in 關閉與焦點返回。六站桌機／手機共 12 組。
- M24 新增表單／按鈕瀏覽器回歸測試：驗證 Email 錯誤／有效狀態、Select／Textarea、Checkbox／Radio、disabled 狀態、按鈕送出表單與控制項水平溢出；六站 × 五種視窗寬度 × 淺深主題共 60 組。
- M25 新增真實表單鍵盤旅程：以 Chrome DevTools Protocol 實際按 Tab、方向鍵、Space、Enter，驗證 Email 輸入、Select／Radio 選擇、Checkbox 勾選及表單送出；六站桌機／手機共 12 組。
- M26 新增可互動元件展示頁與開發者使用指南，覆蓋 Button、Form、Tabs、Card、List、Table、Badge、Dialog、Data states，並以六品牌 × 淺深主題 × 手機／平板／桌機共 36 組 Chrome 驗收。
- M27 新增六品牌 × 淺深主題 × Header／Sidebar 共 24 組 Token 實際消費測試，明確區分品牌識別色與共用操作 Accent；修正生成 CSS 檔頭註解中的 `*/` 意外結束註解，避免瀏覽器丟棄第一條 Header CSS 規則。
- M28 新增共用殼幾何回歸測試，六品牌 × 淺深主題 × Header／Sidebar × 五種視窗寬度共 120 組，檢查斷點、側欄寬度、主內容置中、Footer 位置、水平溢出、按鈕／表單控制尺寸一致性與觸控目標。
- M29 新增瀏覽器互動狀態視覺回歸，六品牌 × 淺深主題共 12 組，實際驗證 Button Hover／Active／Disabled、表單 Hover／Focus／Error／Disabled、Tabs、Card、List、Table 狀態是否使用正確語意 Token；展示頁補齊停用欄位與可互動 Card／List 範例。

- 新增 DTCG Token schema 驗證，明確檢查 `$type`、`$value`、別名括號格式。
- 統一本地與 CI 驗收入口為 `npm run check`。
- 新增每站共用殼起始頁生成：`dist/sites/<站>/index.html`，並驗證 placeholder、品牌、Logo 與共用資產路徑。
- Header／Sidebar 支援依主題切換淺色與深色 Logo。
- 預覽主題切換不污染正式網站的 localStorage；元件展示區納入共用殼內容區。
- Header／Sidebar 增加品牌識別線，預覽測試文案同步更新。
- 修正手機版側邊欄關閉時仍可鍵盤聚焦的問題；加入 inert／aria-hidden、Tab 焦點循環與控制關係。
- 對比驗證新增實際元件配色組合，涵蓋 danger 按鈕文字、一般表面與次要表面。
- 站點設定新增可選 `layout`（header／sidebar），建置器與互動預覽共用同一設定規則，省略時預設 header。
- Header／Sidebar／Base／Button／Footer 的像素尺寸與邊框寬度改由 component tokens 管理；CI 新增 px 硬編碼檢查。

## v1.0.0 — 2026-11-09

第一個正式版。公開 API 宣告與 SemVer 承諾自此開始。

- 全新架構：Foundations／Tokens／Components／Patterns／Products＋Tooling & Governance。
  舊 repo（chi-system-old，HEAD 436f028）唯讀封存，不再改動。
- Token 三層（primitive→semantic→component），DTCG 2025.10 JSON 為原始來源，
  Style Dictionary 概念的無依賴生成腳本產出 dist/tokens.css。
- 一個品牌＝一份只寫別名的檔案＋一份網站設定檔；網站設定資料驅動，不寫死六站。
- 共用元件各一份真實作：Header、Footer、Sidebar、Button，另有文件基礎（表單、Tabs、
  卡片、清單／表格、徽章、對話框、資料狀態，沿用舊版已核對段落）。
- 模板只有一份（templates/base.html，生成物），版式由 data-chi-layout 決定。
- 預覽只有一個參數化預覽（?site=&theme=&layout=），另有假俗艷品牌測試。
- CI：Token 解析、對比計算（每品牌×淺深色）、禁硬編碼、網站設定 schema、斷點一致、生成物 diff。
- 定案值沿用舊版：六站識別色、語意色（Adobe Spectrum 900 階）、斷點 768／1024、
  主題 key chi-theme-mode、logo 站點 ID 命名、範本佔位規則。
- 已知缺口（v1.1）：逐像素視覺回歸、人工螢幕閱讀器驗收，以及日期選擇等未列入基礎示例表的元件。
- 新增 Chrome Accessibility／DOM 稽核：六站桌機／手機、淺色／深色共 24 組，檢查文件語言與標題、主要 Landmark、互動名稱、表單標籤、圖片 alt、ARIA IDREF、重複 ID、隱藏區焦點與實際渲染文字對比。
- M30 擴充元件狀態驗收：六品牌 × 淺深主題共 12 組，實際檢查 Checkbox／Radio／Switch 的 Checked／Disabled、Badge 四種語意色、Spinner／Skeleton、Empty／Error／Success 資料狀態，以及 Dialog 表面／Backdrop／開關與焦點返回；展示頁補齊停用選擇控制與成功狀態。
- M31 新增真實鍵盤與 Chrome Accessibility Tree 驗收，六品牌 × 桌機／手機共 12 組，驗證 Checkbox／Radio／Switch 語意角色、Checked 狀態、Disabled／Readonly／Invalid 公告、Tab 順序、Space／方向鍵操作、Live Region，以及 Dialog 初始焦點、原生 Modal 背景隔離、Tab／Shift+Tab 邊界焦點與 Escape 焦點返回；補上具名稱的原生 Radio fieldset／legend 群組，並保留原生 `<dialog>` 的焦點管理，不另造一套焦點陷阱。