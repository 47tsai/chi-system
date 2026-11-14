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
3. 執行 `npm run check`，確認 Node、Chrome 互動、鍵盤、axe-core WCAG 2.0／2.1／2.2 A／AA 稽核、Playwright Chromium 互動測試、無障礙與生成物一致性全部通過。axe-core 覆蓋六站 × 桌機／手機 × 淺／深主題；Playwright 覆蓋六站 × 桌機／手機。兩者補強自訂 DOM／Accessibility Tree 檢查，但不取代 Firefox／WebKit 驗收或人工螢幕閱讀器測試。
4. 新元件依 `SPEC.md` 的 draft → preview → stable 流程；沒有文件與無障礙驗收，不升 stable。