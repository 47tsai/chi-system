import { createServer } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const sitesDir = path.join(ROOT, 'sites');
const mimeTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
const browser = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)
  .find((candidate) => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
if (!browser) {
  console.log('Component browser smoke skipped: Chrome/Chromium is not installed.');
  process.exit(0);
}

const fixture = `
<section id="chi-component-smoke" aria-labelledby="chi-component-smoke-title" style="box-sizing:border-box;width:min(100%,640px);padding:16px;">
  <h1 id="chi-component-smoke-title">元件互動驗收</h1>
  <form id="chi-component-form" novalidate>
    <div class="chi-field chi-field--error" id="chi-component-field">
      <label class="chi-field__label" for="chi-component-email">電子郵件</label>
      <input class="chi-input" id="chi-component-email" name="email" type="email" required value="invalid" aria-invalid="true" aria-describedby="chi-component-error">
      <p class="chi-field__error" id="chi-component-error">電子郵件格式不正確。</p>
    </div>
    <div class="chi-field">
      <label class="chi-field__label" for="chi-component-note">備註</label>
      <textarea class="chi-textarea" id="chi-component-note" name="note" placeholder="輸入備註"></textarea>
    </div>
    <div class="chi-field">
      <label class="chi-field__label" for="chi-component-select">通知頻率</label>
      <select class="chi-select" id="chi-component-select" name="frequency"><option value="daily">每日</option><option value="weekly">每週</option></select>
    </div>
    <fieldset><legend>通知方式</legend>
      <label class="chi-check"><input class="chi-check__input" id="chi-component-check" type="checkbox" name="notice" value="email">電子郵件</label>
      <label class="chi-check"><input class="chi-check__input" id="chi-component-check-disabled" type="checkbox" disabled>停用選項</label>
      <label class="chi-radio"><input class="chi-radio__input" id="chi-component-radio-one" type="radio" name="channel" value="email" checked>電子郵件</label>
      <label class="chi-radio"><input class="chi-radio__input" id="chi-component-radio-two" type="radio" name="channel" value="sms">簡訊</label>
    </fieldset>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      <button class="chi-btn chi-btn--primary" id="chi-component-submit" type="submit">送出</button>
      <button class="chi-btn chi-btn--secondary" id="chi-component-disabled" type="button" disabled>暫不可用</button>
    </div>
  </form>
</section>
<script>
(() => {
  document.documentElement.setAttribute('data-chi-theme', new URL(location.href).searchParams.get('theme') === 'dark' ? 'dark' : 'light');
  const results = [];
  const check = (name, ok) => results.push(name + ':' + (ok ? 'PASS' : 'FAIL'));
  try {
    const form = document.getElementById('chi-component-form');
    const email = document.getElementById('chi-component-email');
    const field = document.getElementById('chi-component-field');
    const checkInput = document.getElementById('chi-component-check');
    const disabledCheck = document.getElementById('chi-component-check-disabled');
    const radioOne = document.getElementById('chi-component-radio-one');
    const radioTwo = document.getElementById('chi-component-radio-two');
    const button = document.getElementById('chi-component-disabled');
    check('invalid-email-native-state', !email.validity.valid && email.getAttribute('aria-invalid') === 'true');
    const errorBorderColor = getComputedStyle(email).borderTopColor;
    const normalBorderColor = getComputedStyle(document.getElementById('chi-component-note')).borderTopColor;
    check('error-state-visible', errorBorderColor !== normalBorderColor && !!document.getElementById('chi-component-error') && email.getAttribute('aria-describedby') === 'chi-component-error');
    email.value = 'chi@example.com';
    check('valid-email-native-state', email.validity.valid && form.checkValidity());
    document.getElementById('chi-component-select').value = 'weekly';
    check('select-native-state', document.getElementById('chi-component-select').value === 'weekly');
    document.getElementById('chi-component-note').value = 'CHI';
    check('textarea-native-state', document.getElementById('chi-component-note').value === 'CHI');
    check('theme-fixture-applied', document.documentElement.getAttribute('data-chi-theme') === new URL(location.href).searchParams.get('theme'));
    email.value = 'invalid';
    const note = document.getElementById('chi-component-note');
    note.value = 'CHI browser test';
    const select = document.getElementById('chi-component-select');
    select.value = 'weekly';
    check('textarea-value-update', note.value === 'CHI browser test');
    check('select-value-update', select.value === 'weekly');
    check('disabled-button-native-state', button.disabled && getComputedStyle(button).cursor === 'not-allowed');
    checkInput.click();
    check('checkbox-toggle', checkInput.checked);
    disabledCheck.click();
    check('disabled-checkbox-stable', disabledCheck.disabled && !disabledCheck.checked);
    radioTwo.click();
    check('radio-exclusive-selection', radioTwo.checked && !radioOne.checked);
    const enabledButton = document.getElementById('chi-component-submit');
    check('button-primary-rendered', getComputedStyle(enabledButton).backgroundColor !== 'rgba(0, 0, 0, 0)');
    let submitObserved = false;
    form.addEventListener('submit', (event) => { event.preventDefault(); submitObserved = true; }, { once: true });
    enabledButton.click();
    check('button-submits-form', submitObserved);
    const controls = [...document.querySelectorAll('#chi-component-smoke input, #chi-component-smoke textarea, #chi-component-smoke select, #chi-component-smoke button')];
    const viewportWidth = document.documentElement.clientWidth;
    const overflow = controls.filter((control) => {
      const rect = control.getBoundingClientRect();
      return rect.left < -1 || rect.right > viewportWidth + 1 || rect.width > viewportWidth + 1;
    });
    check('form-controls-fit-viewport', overflow.length === 0);
    const fixtureRect = document.getElementById('chi-component-smoke').getBoundingClientRect();
    check('fixture-fits-viewport', fixtureRect.left >= -1 && fixtureRect.right <= viewportWidth + 1);
    const result = results.join(';');
    document.documentElement.setAttribute('data-chi-components-smoke', result);
  } catch (error) {
    document.documentElement.setAttribute('data-chi-components-smoke', 'harness-error:' + String(error).replace(/[;<>]/g, ' '));
  }
})();
</script>`;

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = path.resolve(DIST, '.' + pathname);
  if (!target.startsWith(DIST + path.sep)) return response.writeHead(403).end();
  try {
    if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
    response.setHeader('content-type', mimeTypes[path.extname(target)] || 'application/octet-stream');
    let body = readFileSync(target);
    if (path.extname(target) === '.html' && target.startsWith(path.join(DIST, 'sites') + path.sep)) {
      body = Buffer.from(body.toString('utf8').replace('</body>', fixture + '</body>'));
    }
    response.end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const sites = readdirSync(sitesDir).filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -5));
const viewports = [
  { name: 'compact-320', size: '320,800' },
  { name: 'mobile-390', size: '390,844' },
  { name: 'tablet-768', size: '768,900' },
  { name: 'desktop-1024', size: '1024,900' },
  { name: 'wide-1365', size: '1365,900' },
];
const themes = ['light', 'dark'];
let passed = 0;
const failures = [];
try {
  for (const site of sites) for (const viewport of viewports) for (const theme of themes) {
    const url = `${origin}/sites/${site}/index.html?theme=${theme}`;
    const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--enable-logging=stderr', '--log-level=0', '--virtual-time-budget=15000', `--window-size=${viewport.size}`, '--dump-dom', url], { env: { ...process.env, DISPLAY: '' } });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const exitCode = await new Promise((resolve) => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 25000);
      child.once('close', (code) => { clearTimeout(timeout); resolve(code); });
    });
    const result = stdout.match(/data-chi-components-smoke="([^"]*)"/)?.[1];
    const issues = [];
    if (exitCode !== 0) issues.push(`Chrome exited ${exitCode}`);
    if (!result) issues.push('component harness did not finish');
    else issues.push(...result.split(';').filter((item) => !item.endsWith(':PASS')).map((item) => `interaction ${item}`));
    const browserErrors = stderr.split('\n').filter((line) => /ERROR:CONSOLE|Failed to load resource|net::ERR_/i.test(line));
    if (browserErrors.length) issues.push(...browserErrors);
    if (issues.length) failures.push({ site, viewport: viewport.name, theme, issues }); else passed++;
    console.log(`${issues.length ? 'FAIL' : 'PASS'} ${site} ${viewport.name} ${theme}${result ? ` [${result}]` : ''}`);
  }
} finally { await new Promise((resolve) => server.close(resolve)); }
console.log(`Chrome component/form smoke: ${passed}/${sites.length * viewports.length * themes.length} site/viewport/theme combinations passed.`);
if (failures.length) { for (const failure of failures) console.error(JSON.stringify(failure)); process.exitCode = 1; }
