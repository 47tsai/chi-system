# CHI 產品識別色庫（Product Color Registry）

- **版本：** v1.2
- **狀態：** 已生效（齊 2026-11-16 確認移入 chi-system 新 repo）
- **基準日：** 2026-11-08
- **移入：** 2026-11-16 自 chi-system-old 移入 chi-system 新 repo；舊 repo 的原檔保留不動。
- **來源：** Adobe Spectrum 品牌頁（https://spectrum.adobe.com/foundations/brand#color ，2026-11-08 核對）為主；其餘來源見各筆 Source 欄。

## 1. 用途與規則

1. 本文件是**候選色庫**，只負責收集與展示顏色，**不預設用途**。候選色庫與網站配色分離：分配結果以 `sites/*.json` 為準，本文件只同步記錄各色的 Status 與 Assigned to，不另存一份分配表。
2. 現有網站要選識別色時，從 Status 為 `Available` 的顏色挑；未來新增網站直接挑尚未使用的顏色，不需要每次重新研究配色。
3. 顏色被某站選用後，該筆 Status 改為 `Assigned`，Assigned to 填站點 ID；不得刪除已分配的紀錄，改狀態即可。
4. `Reserved` 為生態系保留色（例如品牌主色），不開放各站挑選。
5. 每一筆必須有固定 ID、名稱、HEX、來源。HEX 一律大寫。新增顏色時先查是否已有相同 HEX，有則合併、不另立一筆。
6. 本文件收錄的是 **Adobe 產品品牌色**，不是 Spectrum UI 色階。Spectrum 2 的 UI 色階（每色相 16 階）是介面用的 token，與此處的品牌識別色不同，不得混用（見第 5 節核對紀錄）。
7. 非 Adobe 產品品牌色亦可收錄（首筆為 Bitwarden，2026-11-16 齊確認），來源見各筆 Source 欄。

## 2. 候選色一覽

### A. Creative Cloud 品牌色（亮色）

| ID | Name | HEX | Source | Status | Assigned to | Notes |
|---|---|---|---|---|---|---|
| color-orange | Orange（Illustrator） | `#FF9A00` | Adobe Spectrum 品牌頁 | Assigned | fg | Spectrum 2 對應值 `#FD9A00`，見備註 1 |
| color-celery | Celery（Dimension） | `#99E83F` | Adobe Spectrum 品牌頁 | Available | — | |
| color-cyan | Cyan（Photoshop / Lightroom） | `#31A8FF` | Adobe Spectrum 品牌頁 | Available | — | |
| color-indigo | Indigo（After Effects） | `#9999FF` | Adobe Spectrum 品牌頁 | Available | — | |
| color-fuchsia | Fuchsia（XD） | `#FF61F6` | Adobe Spectrum 品牌頁 | Assigned | h | |
| color-magenta | Magenta（InDesign） | `#FF3366` | Adobe Spectrum 品牌頁 | Available | — | Spectrum 2 對應值 `#FC487B`，見備註 1 |

### B. Creative Cloud 品牌色（深色變體）

| ID | Name | HEX | Source | Status | Assigned to | Notes |
|---|---|---|---|---|---|---|
| color-orange-dark | Orange Dark | `#330000` | Adobe Spectrum 品牌頁 | Available | — | Illustrator 深色底 |
| color-celery-dark | Celery Dark | `#1E3101` | Adobe Spectrum 品牌頁 | Available | — | Dimension 深色底 |
| color-cyan-dark | Cyan Dark | `#001E36` | Adobe Spectrum 品牌頁 | Available | — | Photoshop / Lightroom 深色底 |
| color-indigo-dark | Indigo Dark | `#00005B` | Adobe Spectrum 品牌頁 | Available | — | After Effects / Premiere Pro 深色底 |
| color-fuchsia-dark | Fuchsia Dark | `#470137` | Adobe Spectrum 品牌頁 | Available | — | XD 深色底 |
| color-magenta-dark | Magenta Dark | `#6E132E` | Adobe Spectrum 品牌頁 | Available | — | InDesign 深色底 |

### C. Document Cloud

| ID | Name | HEX | Source | Status | Assigned to | Notes |
|---|---|---|---|---|---|---|
| color-acrobat-red | Acrobat Red | `#B30B00` | Adobe Spectrum 品牌頁 | Available | — | |
| color-dc-purple | Purple | `#584CCC` | Adobe Spectrum 品牌頁 | Assigned | merch | |
| color-dc-teal | Teal | `#008CAD` | Adobe Spectrum 品牌頁 | Assigned | nav | |
| color-dc-coral | Coral | `#F75C46` | Adobe Spectrum 品牌頁 | Available | — | |
| color-dc-magenta | Magenta | `#AD0955` | Adobe Spectrum 品牌頁 | Available | — | 與 A 節 Magenta 不同色 |
| color-dc-blue | Blue | `#0054B6` | Adobe Spectrum 品牌頁 | Available | — | |
| color-dc-pink | Pink | `#FFDBD9` | Adobe Spectrum 品牌頁 | Available | — | 見備註 2 |
| color-dc-lavender | Lavender | `#CCA4FD` | Adobe Spectrum 品牌頁 | Available | — | |
| color-dc-light-blue | Light Blue | `#78BBFA` | Adobe Spectrum 品牌頁 | Available | — | |

備註：官方頁未標示哪一格屬於主要／次要／Adobe red，以上按頁面 3×3 圖片順序收錄。

### D. Experience Cloud

| ID | Name | HEX | Source | Status | Assigned to | Notes |
|---|---|---|---|---|---|---|
| color-ec-insights | Insights | `#9755E6` | Adobe Spectrum 品牌頁 | Available | — | Foundational（冷色） |
| color-ec-content | Content Management | `#8CDC47` | Adobe Spectrum 品牌頁 | Assigned | status | Foundational（冷色） |
| color-ec-data | Data Management | `#16878C` | Adobe Spectrum 品牌頁 | Available | — | Foundational（冷色） |
| color-ec-configuration | Setup and Configuration | `#DEDEF9` | Adobe Spectrum 品牌頁 | Available | — | Foundational（冷色）；與 Express Light 同一 HEX，已合併，見備註 3 |
| color-ec-marketing | Marketing | `#D83791` | Adobe Spectrum 品牌頁 | Available | — | Functional（暖色） |
| color-ec-advertising | Advertising | `#B130BD` | Adobe Spectrum 品牌頁 | Available | — | Functional（暖色） |
| color-ec-commerce | Commerce | `#DA7B11` | Adobe Spectrum 品牌頁 | Available | — | Functional（暖色） |

### E. Adobe Express 與品牌基礎色

| ID | Name | HEX | Source | Status | Assigned to | Notes |
|---|---|---|---|---|---|---|
| color-express-indigo | Express Indigo | `#5C5CE0` | Adobe Spectrum 品牌頁 | Available | — | |
| color-express-light | Express Light | `#DEDEF9` | Adobe Spectrum 品牌頁 | Available | — | 與 D 節 Configuration 同一 HEX，已合併，見備註 3 |
| color-adobe-red | Adobe Red | `#FA0F00` | Adobe 品牌紅（2020 改版後） | Available | — | 見備註 4 |
| color-dark-gray | Dark Gray | `#242424` | Adobe Spectrum 品牌頁 | Available | — | |
| color-black | Black | `#000000` | 通用 | Available | — | |
| color-white | White | `#FFFFFF` | 通用 | Available | — | |

### F. 其他 Adobe 產品品牌色（補充）

| ID | Name | HEX | Source | Status | Assigned to | Notes |
|---|---|---|---|---|---|---|
| color-premiere-purple | Premiere Purple（Premiere Pro） | `#EA77FF` | Adobe 產品品牌色 | Available | — | 本次官方品牌頁六色之外，待官方頁再確認 |

### G. CHI 原生色

| ID | Name | HEX | Source | Status | Assigned to | Notes |
|---|---|---|---|---|---|---|
| color-chi-blue | Chi 品牌藍 | `#4A88FC` | 舊 chi-design-system `site-colors/sites.yml` brand_default | Reserved | chi（生態系品牌主色） | 不開放各站挑選 |

### H. 其他產品品牌色

| ID | Name | HEX | Source | Status | Assigned to | Notes |
|---|---|---|---|---|---|---|
| color-bitwarden-blue | Bitwarden Blue | `#175DDC` | Bitwarden 品牌色（https://github.com/bitwarden/brand/blob/main/brand-colors/palette.scss ，2026-11-16 核對） | Assigned | auth | Bitwarden 主品牌色 |

## 3. 統計

- 候選色共 **37 筆**，去重後 **36 個不同 HEX**（`#DEDEF9` 出現兩次，已合併為一筆）。
- Status：Available 30 筆、Assigned 6 筆（fg、merch、nav、h、status、auth）、Reserved 1 筆（chi 品牌藍）。
- 分配結果以 `sites/*.json` 為準：chi `#4A88FC`、fg `#FF9A00`、merch `#584CCC`、nav `#008CAD`、h `#FF61F6`、status `#8CDC47`、auth `#175DDC`（六站為齊 2026-11-08 確認，採 Muse 推薦值；auth 為齊 2026-11-16 確認，取 Bitwarden 主品牌色）。
- 來源分類：Creative Cloud 12 筆、Document Cloud 9 筆、Experience Cloud 7 筆、Express 與品牌基礎色 6 筆、其他 Adobe 產品 1 筆、CHI 原生 1 筆、其他產品品牌色 1 筆。

## 4. 備註

1. **Ai 與 Id 有兩個官方值。**官方品牌頁開頭列的「產品外品牌色」為 Ai `#FF9A00`、Id `#FF3366`；同一頁 Creative Cloud 段落的 Spectrum 2 對應值為 Ai `#FD9A00`、Id `#FC487B`。頁面註明產品外使用的品牌色可能與 Spectrum 2 色彩略有差異。本文件以產品外品牌色為正式收錄值，Spectrum 2 對應值記於 Notes。
2. **Document Cloud Pink 有一位數出入。**官方品牌頁圖片讀值為 `#FFDBD9`，ChatGPT 提供的初稿為 `#FFD8D9`，兩者差一位數。本文件採用官方頁圖片讀值，待再次確認。
3. **`#DEDEF9` 去重。**Experience Cloud Setup and Configuration 與 Adobe Express Light 為同一 HEX，依第 1 節第 5 條合併，不另立一筆；兩筆 ID 皆保留，指向同一顏色。
4. **Adobe Red 色碼待再確認。**`#FA0F00` 為 2020 改版後品牌紅，`#EB1000` 為改版前舊值。本次官方品牌頁未以文字列出 Adobe red 色碼，`#FA0F00` 採通用公開品牌色值，待官方頁再確認。

## 5. 核對紀錄（2026-11-08）

- 官方品牌頁現址為 https://spectrum.adobe.com/foundations/brand#color ，舊網址 https://spectrum.adobe.com/page/brand/ 已回 404。頁面色碼本身未以文字列出，由圖片放大讀值。
- ChatGPT 初稿稱「37 色、15 個色相家族、每家族 16 個明度階層」皆有誤：初稿實際只列 34 筆；Adobe 官方 `@adobe/spectrum-tokens` v15.6.0 的色階為 17 個彩色色相家族（另有 gray / silver 等中性）× 16 階；且初稿 37 個色值無一出現在 Spectrum tokens 內——因為那是**產品品牌色**，不是 Spectrum UI 色階，兩者是不同系統。
- ChatGPT 初稿另有兩處與官方頁不符，已按官方頁修正：After Effects Indigo 初稿 `#9999FF` 與官方一致（Muse 初核誤指為 `#9991FF`，該值為舊版品牌色，特此更正）；InDesign Magenta Dark 初稿 `#6E132E` 與官方一致（Muse 初核誤指為 `#49021F`，該值為舊版深色，特此更正）。
- Premiere Pro `#EA77FF` 為初稿遺漏，已補入 F 節。

## 6. 待確認事項

- [ ] C 節 Pink `#FFDBD9` 與初稿 `#FFD8D9` 差一位數，待再確認。
- [ ] E 節 Adobe Red `#FA0F00` 待官方頁再確認色碼。
- [ ] F 節 Premiere Pro `#EA77FF` 待官方頁再確認。
- [ ] 是否納入 Google、Microsoft 等其他設計系統的色彩作為下一批種子，待齊決定。（2026-11-16 已先納入首筆非 Adobe 色：Bitwarden 藍 `#175DDC`，見 H 節。）
- 已結案：舊提案三色（nav `#0D9488`、status `#16A34A`、merch `#6541B8`）不納入候選庫（齊 2026-11-08 確認舊提案是錯誤的，不採用）；六站識別色分配已定案（見第 3 節，齊 2026-11-08 確認）。

## 7. 修訂紀錄

| 版本 | 日期 | 內容 |
|---|---|---|
| v1.0 | 2026-11-08 | 初稿：以 Adobe Spectrum 品牌頁為來源建立候選色庫，36 筆、去重後 35 色，皆未分配。 |
| v1.1 | 2026-11-08 | 六站識別色分配定案（齊確認，採 Muse 推薦值）：五色改 Assigned（fg、merch、nav、h、status），分配結果以 `sites.json` 為準；舊提案三色確認不納入，結案。 |
| v1.2 | 2026-11-16 | 移入 chi-system 新 repo（舊 repo 原檔保留不動），狀態改為生效；`sites.json` 引用改為 `sites/*.json`；新增 H 節，收錄首筆非 Adobe 產品品牌色 Bitwarden 藍 `#175DDC`，分配給 auth（齊確認）。 |
