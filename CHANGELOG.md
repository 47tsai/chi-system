# Changelog

## Unreleased

（無）

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
- 已知缺口（v1.1）：對話框焦點管理程式、axe／Playwright 計算樣式／視覺回歸、
  日期選擇等未列入基礎示例表的元件。
