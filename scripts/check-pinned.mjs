// chi-system check-pinned.mjs — 各站共用的釘版檢查腳本。
// 對照某站釘住的 chi-system commit 與 main HEAD，列出期間 commit 與
// CHANGELOG 條目，判斷落後幾個 commit、期間有無 breaking 條目。
// Node 無依賴，直接用 node 跑；用法見 docs/RELEASE.md。
//   node scripts/check-pinned.mjs --pin <commit> --site <站 id>
//   node scripts/check-pinned.mjs --release <release.json 路徑>
//   node scripts/check-pinned.mjs            （預設讀 ./release.json）
// 額外參數：--repo <chi-system 本地路徑>、--max-lag <N，預設 10>。
// Exit code：0＝落後在門檻內且無 breaking；1＝落後超標或有 breaking；
// 2＝用法／輸入／repo 錯誤（訊息印在 stderr，不印 stack trace）。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const BREAKING_RE = /破壞|breaking|移除/i;
const DEPRECATED_RE = /廢棄|deprecat/i;
const HEX_RE = /^[0-9a-f]{4,40}$/i;
const FULL_HEX_RE = /^[0-9a-f]{40}$/i;
const DEFAULT_MAX_LAG = 10;

const usage = () => [
  '用法：',
  '  node scripts/check-pinned.mjs --pin <commit> [--site <站 id>] [--repo <路徑>] [--max-lag <N>]',
  '  node scripts/check-pinned.mjs --release <release.json 路徑> [--repo <路徑>] [--max-lag <N>]',
  '  node scripts/check-pinned.mjs [--site <站 id>] [--repo <路徑>] [--max-lag <N>]  （預設讀 ./release.json）',
  '  --repo 預設：環境變數 CHI_SYSTEM_REPO，否則 ./../chi-system，再否則本腳本所在的 repo。',
  '  --max-lag 預設 10。exit 0＝通過；1＝落後超標或有 breaking；2＝用法／輸入／repo 錯誤。',
].join('\n');

function failUsage(message) {
  console.error('錯誤：' + message);
  console.error(usage());
  process.exit(2);
}

function parseArgs(argv) {
  const args = { pin: null, site: null, release: null, repo: null, maxLag: DEFAULT_MAX_LAG };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const takeValue = (name) => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) failUsage(name + ' 需要一個值');
      i++;
      return value;
    };
    if (arg === '--pin') args.pin = takeValue('--pin');
    else if (arg === '--site') args.site = takeValue('--site');
    else if (arg === '--release') args.release = takeValue('--release');
    else if (arg === '--repo') args.repo = takeValue('--repo');
    else if (arg === '--max-lag') {
      const value = Number(takeValue('--max-lag'));
      if (!Number.isInteger(value) || value < 0) failUsage('--max-lag 必須是非負整數');
      args.maxLag = value;
    } else if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else {
      failUsage('未知參數：' + arg);
    }
  }
  return args;
}

function runGit(repo, gitArgs) {
  try {
    return execFileSync('git', ['-C', repo, ...gitArgs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function resolveRepo(explicitRepo) {
  const candidates = [];
  if (explicitRepo) candidates.push(path.resolve(explicitRepo));
  if (process.env.CHI_SYSTEM_REPO) candidates.push(path.resolve(process.env.CHI_SYSTEM_REPO));
  candidates.push(path.resolve(process.cwd(), '..', 'chi-system'));
  candidates.push(REPO_ROOT);
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, '.git'))) return candidate;
  }
  console.error('錯誤：找不到 chi-system 本地 clone（需含 .git）。試過：' + [...new Set(candidates)].join('、'));
  console.error('請用 --repo <路徑> 或環境變數 CHI_SYSTEM_REPO 指定。');
  process.exit(2);
}

function parseReleaseFile(releasePath) {
  let data;
  try {
    data = JSON.parse(readFileSync(releasePath, 'utf8'));
  } catch (error) {
    console.error('錯誤：release.json 無法解析：' + releasePath + '：' + error.message);
    process.exit(2);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.error('錯誤：release.json 必須是 JSON object：' + releasePath);
    process.exit(2);
  }
  for (const field of ['chiSystemVersion', 'chiSystemCommit', 'site', 'version']) {
    if (typeof data[field] !== 'string' || !data[field].trim()) {
      console.error(`錯誤：release.json 缺少或空白欄位 ${field}：` + releasePath);
      process.exit(2);
    }
  }
  if (!FULL_HEX_RE.test(data.chiSystemCommit)) {
    console.error('錯誤：release.json 的 chiSystemCommit 必須是 40 位 hex：' + data.chiSystemCommit);
    process.exit(2);
  }
  return data;
}

// CHANGELOG 解析：以 "## " 標題切區；Unreleased 區與各版本區的條目皆以 "- " 開頭，
// 續行（縮排或接續文字）併入同一條目。回傳 [{ heading, version, entries: [String] }]。
function parseChangelog(text) {
  const sections = [];
  let current = null;
  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const versionMatch = heading[1].match(/^v?(\d+)\.(\d+)\.(\d+)\b/);
      current = {
        heading: heading[1],
        version: versionMatch ? versionMatch.slice(1).map(Number) : null,
        entries: [],
      };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith('- ')) {
      current.entries.push(line.slice(2).trim());
    } else if (current.entries.length > 0 && line.trim() && !line.startsWith('#')) {
      current.entries[current.entries.length - 1] += ' ' + line.trim();
    }
  }
  return sections;
}

function compareVersion(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

const args = parseArgs(process.argv.slice(2));

let pin = args.pin;
let site = args.site;
let pinnedVersion = null;
if (args.release) {
  const release = parseReleaseFile(path.resolve(args.release));
  pin = release.chiSystemCommit;
  pinnedVersion = release.chiSystemVersion.replace(/^v/, '');
  if (site && site !== release.site) {
    console.error(`警告：--site ${site} 與 release.json 的 site ${release.site} 不一致，採用 release.json 的 ${release.site}。`);
  }
  site = release.site;
} else if (!pin) {
  const defaultRelease = path.resolve(process.cwd(), 'release.json');
  if (existsSync(defaultRelease)) {
    const release = parseReleaseFile(defaultRelease);
    pin = release.chiSystemCommit;
    pinnedVersion = release.chiSystemVersion.replace(/^v/, '');
    if (site && site !== release.site) {
      console.error(`警告：--site ${site} 與 release.json 的 site ${release.site} 不一致，採用 release.json 的 ${release.site}。`);
    }
    site = release.site;
  } else {
    failUsage('未指定 --pin，也找不到 ./release.json；請給 --pin <commit> 或 --release <路徑>');
  }
}
if (!HEX_RE.test(pin)) {
  console.error('錯誤：pin 必須是 4–40 位 hex commit（短 hash 或完整 hash）：' + pin);
  process.exit(2);
}

const repo = resolveRepo(args.repo);
const changelogPath = path.join(repo, 'CHANGELOG.md');
if (!existsSync(changelogPath)) {
  console.error('錯誤：repo 內找不到 CHANGELOG.md：' + changelogPath);
  process.exit(2);
}

const pinFull = runGit(repo, ['rev-parse', '--verify', pin + '^{commit}']);
if (!pinFull) {
  console.error(`錯誤：在 ${repo} 找不到 commit ${pin}（請確認 hash 正確、本地 clone 已 fetch 最新 main）。`);
  process.exit(2);
}
const mainFull = runGit(repo, ['rev-parse', '--verify', 'main']) || runGit(repo, ['rev-parse', '--verify', 'HEAD']);
if (!mainFull) {
  console.error('錯誤：無法取得 main HEAD（repo 沒有 main 分支也沒有 HEAD）。');
  process.exit(2);
}
const pinShort = runGit(repo, ['rev-parse', '--short', pinFull]);
const mainShort = runGit(repo, ['rev-parse', '--short', mainFull]);

let isAncestor = false;
try {
  execFileSync('git', ['-C', repo, 'merge-base', '--is-ancestor', pinFull, mainFull], { encoding: 'utf8' });
  isAncestor = true;
} catch {
  isAncestor = false;
}

const logOutput = runGit(repo, ['log', '--format=%h %s', pinFull + '..' + mainFull]);
if (logOutput === null) {
  console.error('錯誤：git log 失敗（pin 與 main 無法比較）。');
  process.exit(2);
}
const commits = logOutput ? logOutput.split('\n').filter(Boolean) : [];
const lag = commits.length;

const sections = parseChangelog(readFileSync(changelogPath, 'utf8'));
const unreleased = sections.find((s) => /^unreleased$/i.test(s.heading));
const pinnedSemver = pinnedVersion ? pinnedVersion.split('.').map(Number) : null;
const newerVersionSections = sections.filter((s) =>
  s.version && pinnedSemver && compareVersion(s.version, pinnedSemver) > 0,
);
const inRangeEntries = [
  ...(unreleased ? unreleased.entries.map((e) => ({ section: 'Unreleased', entry: e })) : []),
  ...newerVersionSections.flatMap((s) => s.entries.map((e) => ({ section: s.heading, entry: e }))),
];
const breakingEntries = inRangeEntries.filter(({ entry }) => BREAKING_RE.test(entry));
const deprecatedEntries = inRangeEntries.filter(({ entry }) => DEPRECATED_RE.test(entry) && !BREAKING_RE.test(entry));

console.log(`站點：${site || '(未指定)'}`);
console.log(`釘住：${pinShort}（${pinFull}）`);
console.log(`main：${mainShort}（${mainFull}）`);
console.log(`落後：${lag} 個 commit（門檻 ${args.maxLag}）`);
if (!isAncestor) {
  console.log('警告：pin 不是 main 的祖先，落後數僅為 main 有、pin 沒有的 commit 數，請人工確認分支關係。');
}
console.log('');
console.log('期間 commit（由新到舊）：');
if (commits.length === 0) console.log('  （無）');
else for (const commit of commits) console.log('  - ' + commit);
console.log('');
console.log('CHANGELOG 區間條目（Unreleased' + (newerVersionSections.length ? '＋新於釘住版本的版本區' : '') + '，共 ' + inRangeEntries.length + ' 條）：');
if (inRangeEntries.length === 0) console.log('  （無）');
else {
  for (const { section, entry } of inRangeEntries) {
    const short = entry.length > 120 ? entry.slice(0, 120) + '…' : entry;
    console.log(`  - [${section}] ${short}`);
  }
}
if (breakingEntries.length > 0) {
  console.log('');
  console.log(`breaking 條目（${breakingEntries.length} 條，含「破壞」／「breaking」／「移除」）：`);
  for (const { section, entry } of breakingEntries) {
    console.log(`  - [${section}] ${entry.length > 160 ? entry.slice(0, 160) + '…' : entry}`);
  }
}
if (deprecatedEntries.length > 0) {
  console.log(`註：另有 ${deprecatedEntries.length} 條廢棄（deprecation）條目，屬 minor 層級、不影響 exit code。`);
}

const overLag = lag > args.maxLag;
console.log('');
if (overLag || breakingEntries.length > 0) {
  const reasons = [];
  if (overLag) reasons.push(`落後 ${lag} 個 commit，超過門檻 ${args.maxLag}`);
  if (breakingEntries.length > 0) reasons.push(`有 ${breakingEntries.length} 條 breaking 條目`);
  console.log('結果：需要處理——' + reasons.join('；') + '。請評估重釘（見 docs/RELEASE.md）。');
  process.exit(1);
}
console.log(`結果：落後 ${lag} 個 commit，無 breaking。`);
