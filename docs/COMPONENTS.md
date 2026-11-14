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

以上路徑以獨立部署的 `dist/` 為根目錄。實際部署版本請釘選 Git Tag，不要引用浮動分支。

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

## Button

```html
<button class="chi-btn chi-btn--primary" type="button">儲存</button>
<button class="chi-btn chi-btn--secondary" type="button">取消</button>
<button class="chi-btn chi-btn--ghost" type="button">更多</button>
<button class="chi-btn chi-btn--danger" type="button">刪除</button>
<button class="chi-btn chi-btn--primary" type="button" disabled>處理中</button>
```

使用原生 `disabled`，不要只用 `aria-disabled` 模擬停用。按鈕若不是送出表單，明確指定 `type="button"`。

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
<label class="chi-radio"><input class="chi-radio__input" type="radio" name="frequency" value="weekly"> 每週</label>
<label class="chi-switch"><input class="chi-switch__input" type="checkbox" role="switch"> 啟用通知</label>
```

錯誤欄位必須同時有 `aria-invalid="true"`、`aria-describedby` 指向錯誤訊息，以及 `chi-field--error`。Checkbox／Radio／Switch 的文字放在 label 內，讓點擊範圍包含文字。

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

每個 tab 與 panel 的 ID 必須唯一且互相關聯。Runtime 會同步 `aria-selected`、`tabindex` 與 panel `hidden`；disabled tab 會略過。

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

由 `dialog.js` 管理 `showModal()`、初始焦點與關閉後焦點返回。可用 `data-chi-dialog-initial-focus` 指定初始焦點，或在 dialog 上加 `data-chi-dialog-backdrop-close` 啟用背景點擊關閉。

## 驗收與變更

1. 先在元件展示頁檢查六品牌、淺／深主題與桌機／手機版面。
2. 修改只落在 `components/`、`tokens/` 或模板來源；不要手改 `dist/`、`templates/base.html`。
3. 執行 `npm run check`，確認 Node、Chrome 互動、鍵盤、無障礙與生成物一致性全部通過。
4. 新元件依 `SPEC.md` 的 draft → preview → stable 流程；沒有文件與無障礙驗收，不升 stable。
