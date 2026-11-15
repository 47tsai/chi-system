# 發版與釘版流程

chi-system 是六站共用的核心：上游發版、打 tag，各站釘住確切版本（或 Git Tag），
回滾就是切回上一個 Tag 重建（SPEC.md §10）。本文件規定「什麼時候打 tag」、
「tag 怎麼打」與「各站怎麼重釘」，檢查工具見 `scripts/check-pinned.mjs`。

## 1. 版本規則（SemVer）

公開 API＝Token、元件 props／slots、站設定 schema、模板區塊；未列入的皆為內部。
tag 命名一律 `vX.Y.Z`。

| 層級 | 算什麼 | 例子 |
| --- | --- | --- |
| patch（`v1.0.Z`） | 修正、文件、測試、CI、建置腳本；公開 API 與渲染結果不變 | 修對比、修驗證器誤判、補測試 |
| minor（`v1.Y.0`） | 新增功能、新增 Token／元件、新增站設定選填欄位；**廢棄（deprecation）放 minor，不移除** | 新增元件、新增斷點、標記某 Token 廢棄 |
| major（`vX.0.0`） | 破壞性變更：移除公開 API、改 Token 名稱／語意、站設定 schema 不相容變更、改斷點值 | 移除已廢棄的 Token、改站設定必填欄位 |

判斷有疑義時往高一級打（寧可 minor 不要 patch、寧可 major 不要 minor）。
廢棄與移除分開走：先在一個 minor 版標記廢棄，移除只放在下一個 major 版。

## 2. 發版節奏：Unreleased 累積到一段落就打 tag

`CHANGELOG.md` 常備 `Unreleased` 區，開發中的變更先記在那裡；累積到一段落就發版。
「一段落」的判斷標準：

- **patch**：Unreleased 只有修正／文件／測試／CI，且任一站回報問題已修好、或累積的修
  正值得各站同步一次。沒有新增功能時不硬湊 minor。
- **minor**：Unreleased 有任何新增功能、新增 Token／元件、或任何一條廢棄標記。
- **major**：Unreleased 有任何一條 breaking 條目（CHANGELOG 寫明「破壞」／
  「breaking」／「移除」）。只要有一條 breaking，整版就是 major，不論其他內容多寡。

打 tag 由 chi-system 主維護者決定並執行（目前分工：澪主責；2026-11-16 齊指定
上游全部由澪負責，分工有變時以齊的最新指定為準）。決定前先跑 `scripts/check-pinned.mjs` 看各站
落後狀況；發版後通知各站重釘（見 §5）。

### 打 tag 前的檢查清單（缺一項不打 tag）

1. `npm run check` 全綠（含 build、validate、整合測試、Node 測試、瀏覽器測試，
   且生成物 `dist`／`templates/base.html`／`preview/sites.json` 無未提交的 diff）。
2. `CHANGELOG.md` 的 `Unreleased` 區整段搬到版本區，標題寫版本與日期，
   格式 `## vX.Y.Z — YYYY-MM-DD`，下方留一個新的空 `Unreleased` 區。
3. `package.json` 的 `version` 同步改為 `X.Y.Z`（不帶 `v`）。
4. 條目寫清楚影響範圍：有 breaking 的條目開頭標明破壞性與遷移方式，
   讓各站不用讀 diff 也能判斷要不要跟。

### 打 tag 的步驟

```bash
git tag vX.Y.Z
git push origin vX.Y.Z   # 只推 tag；main 的推送流程不變
```

tag 一旦推出就不再改寫；發錯了就再發一個修正版，不要刪 tag 重打。

## 3. 回滾

回滾就是切回上一個 Tag 重建，不在舊版上直接改：

```bash
git checkout vX.Y.(Z-1)   # 上一個 Tag
npm run build              # 依該 Tag 重建 dist
```

各站回滾同理：把 `release.json` 的 `chiSystemVersion`／`chiSystemCommit`
改回上一個 Tag 對應的值，重新建置部署（見 §5）。回滾後同樣要跑 §5 的驗收，
確認線上 `version.json` 是回滾後的版本。

## 4. 釘版紀錄格式：`release.json`

每站的 repo 根目錄放一份機器可讀的 `release.json`，欄位固定四個：

```json
{
  "chiSystemVersion": "1.0.0",
  "chiSystemCommit": "c71c30c44b6934049ed817964a392feb7c9345b3",
  "site": "fg",
  "version": "1.0.0"
}
```

| 欄位 | 規則 |
| --- | --- |
| `chiSystemVersion` | 釘住的 chi-system 版本（SemVer，不帶 `v`），與 tag 對應 |
| `chiSystemCommit` | 該版本的完整 commit，40 位 hex；不可只寫短 hash |
| `site` | 站 id，與 chi-system `sites/*.json` 的 id 一致 |
| `version` | 本站自己的版本 |

只在 HTML 註解留來源 commit（例如 nav 的 `index.html` 註解）**不合規**：
註解機器讀不到、格式不固定，檢查腳本與 CI 無法對照，應補一份 `release.json`。

## 5. 各站重釘流程

### 何時重釘

- 上游發了新 tag（patch／minor／major 皆通知各站，由各站決定跟進時機）；
- `scripts/check-pinned.mjs` 回報落後超過門檻（預設 10 個 commit，見 §6）；
- 期間有 breaking 條目：先評估影響再決定跟不跟，不跟也要在本站留下「已知落後」
  的紀錄，不要無聲放著。

### 重釘步驟

1. 更新本站 `release.json`：`chiSystemVersion` 改為新 tag 的版本，
   `chiSystemCommit` 改為該 tag 的完整 commit（`git rev-list -n 1 vX.Y.Z` 可查）。
2. 依新版 chi-system 重新建置本站。
3. 跑本站 validate（例如 fg 的 `validate-site`）與本站 CI，全綠才算通過。
4. 部署後線上回讀本站 `version.json`，核對 `chiSystemVersion`／
   `chiSystemCommit` 與 `release.json` 一致。
5. 若新版有 breaking 條目：先按 CHANGELOG 的遷移說明改本站程式碼，再跑上面
   3–4 步；改不動就暫不重釘，維持舊 pin，等下一版再評估。

## 6. 釘版檢查：`scripts/check-pinned.mjs`

共用腳本，Node 無依賴，放在上游 repo，各站直接拿去用（或複製一份到本站）。
對照 pin commit 與 main HEAD，列出期間 commit 清單與 CHANGELOG 區間條目，
判斷落後幾個 commit、期間有無 breaking 條目。

```bash
# 在本站 repo 根目錄跑，預設讀 ./release.json
node /path/to/chi-system/scripts/check-pinned.mjs

# 或直接指定 pin 與站
node /path/to/chi-system/scripts/check-pinned.mjs --pin c71c30c --site fg

# 或指定 release.json 位置
node /path/to/chi-system/scripts/check-pinned.mjs --release ./release.json

# chi-system 本地 clone 位置：--repo 參數優先，否則環境變數 CHI_SYSTEM_REPO，
# 否則 ./../chi-system，再否則腳本所在的 repo
CHI_SYSTEM_REPO=/path/to/chi-system node scripts/check-pinned.mjs --pin c71c30c --site fg

# 落後門檻預設 10 個 commit，可用 --max-lag 調整
node scripts/check-pinned.mjs --pin c71c30c --site fg --max-lag 5
```

Exit code：`0`＝落後在門檻內且無 breaking；`1`＝落後超過門檻或期間有
breaking 條目（需評估重釘）；`2`＝用法／輸入／repo 錯誤（例如 pin 不存在、
找不到 clone、release.json 格式錯），訊息印在 stderr，不印 stack trace。

判斷細節：

- 落後數＝`git log <pin>..main` 的 commit 數；pin 等於 main HEAD 時為 0。
- breaking 條目＝CHANGELOG `Unreleased` 區，以及新於釘住版本的版本區中，
  含「破壞」／「breaking」／「移除」字樣的條目。條目以 `- ` 開頭解析，
  續行併入同一條目。
- 廢棄（deprecation）條目只作提示列出，不影響 exit code。
- pin 不是 main 的祖先時會另外警告（例如 pin 來自別的分支），落後數僅供參考。

建議各站把這支腳本放進本站 CI（例如每週跑一次，或發版後跑一次），
落後超標或出現 breaking 時提早發現，不要等到要重釘才發現差了一大截。

接法：各站在本站 CI 加一個 job，固定讀本站 `release.json`（不需帶
`--pin`，腳本預設讀 `./release.json`），每週排程跑一次，或本站每次
發版後跑一次；exit 1 時 CI 失敗並通知維護者評估重釘。門檻維持預設
`--max-lag 10`，除非本站另有約定。範例（本站 CI 的 job）：

```yaml
jobs:
  check-pinned:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          repository: 47tsai/chi-system
          path: chi-system
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - name: Check pinned chi-system version
        run: node chi-system/scripts/check-pinned.mjs --repo chi-system
```

腳本需要一個 chi-system 本地 clone 來對照（`--repo` 參數或
`CHI_SYSTEM_REPO` 環境變數）；上面範例是 checkout 一份上游再跑檢查，
本站也可以把腳本複製到本站 repo 後以 `--repo` 指向該 clone。

chi-system 自己的 CI（`.github/workflows/ci.yml`）跑一則自測：以
`--pin $(git rev-parse HEAD)` 對照當前 main HEAD，落後為 0、無 breaking，exit 0，
確保腳本本身在每次提交都能正常執行；真正的各站落後檢查由各站 CI
按上面接法跑，不由上游 CI 代跑。

## 現況（2026-11-16）

- `package.json` 已是 `1.1.0`，`v1.1.0` tag 已打（第一次發版，按 §2 判為
  minor：Unreleased 有新增功能與新增 Token；齊 2026-11-16 拍板，澪主責執行）。
  `v1.0.0` tag 仍存在；2026-11-14 之後的變更（M35–M40、nav accent、fg accent、
  U1、U3）皆已收進 `CHANGELOG.md` 的 `## v1.1.0 — 2026-11-16` 區。
- fg 釘在 `c71c30c`（M39），`release.json` 格式符合 §4；發版前 main 為 `01ed668`，
  期間 6 個 commit、只有 nav accent 變更，對 fg 無影響。發版提交本身使 fg
  落後數＋1，仍在門檻（10）內、無 breaking；fg 重釘到 v1.1.0 後，線上才能
  看到橘色配件（見 CHANGELOG v1.1.0 fg 條目）。
- nav 沒有機器可讀的釘版檔，只有 `index.html` 的 HTML 註解寫來源 commit
  `4f776ae`（M40），同樣落後 main，應按 §4 補 `release.json`。
