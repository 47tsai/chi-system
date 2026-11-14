import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const browser = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)
  .find((candidate) => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
if (!browser) {
  console.log('Visual state regression smoke skipped: Chrome/Chromium is not installed.');
  process.exit(0);
}

const brands = ['chi', 'fg', 'h', 'merch', 'nav', 'status'];
const themes = ['light', 'dark'];
const failures = [];
let passed = 0;
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = path.resolve(ROOT, '.' + pathname);
  if (!target.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
  try {
    if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
    const ext = path.extname(target);
    response.setHeader('content-type', ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'text/javascript' : 'application/octet-stream');
    response.end(readFileSync(target));
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;

async function waitFor(predicate, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for Chrome DevTools or showcase');
}

try {
  for (const brand of brands) {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'chi-visual-state-'));
    const child = spawn(browser, ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, DISPLAY: '' } });
    let socket;
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    try {
      const port = await waitFor(async () => { try { return Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch { return null; } });
      const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about%3Ablank`, { method: 'PUT' })).json();
      socket = new WebSocket(target.webSocketDebuggerUrl);
      await waitFor(() => socket.readyState === WebSocket.OPEN);
      let nextId = 0;
      const pending = new Map();
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
          const { resolve, reject } = pending.get(message.id);
          pending.delete(message.id);
          if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
        }
      });
      const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
      const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
      const hover = async (selector) => { const box = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`); await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:box.x,y:box.y}); };
      const press = async (selector) => { const box = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`); await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:box.x,y:box.y}); await send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x,y:box.y,button:'left',clickCount:1}); };
      const release = async (selector) => { const box = await evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`); await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x,y:box.y,button:'left',clickCount:1}); };
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Emulation.setDeviceMetricsOverride', {width:1440,height:2200,deviceScaleFactor:1,mobile:false});
      const url = `${origin}/preview/components.html?brand=${brand}`;
      await send('Page.navigate', { url });
      await waitFor(async () => evaluate(`document.readyState === 'complete' && !!document.querySelector('.chi-btn--primary') && !!window.ChiTheme`));
      await evaluate('window.ChiTabs?.initAll(); window.ChiDialog?.initAll(); true');

      for (const theme of themes) {
        await evaluate(`window.scrollTo(0, 0); window.ChiTheme.setPreviewMode(${JSON.stringify(theme)})`);
        await new Promise((resolve) => setTimeout(resolve, 220));
        const baseline = await evaluate(`(() => {
          const root = getComputedStyle(document.documentElement);
          const style = (selector, property) => getComputedStyle(document.querySelector(selector)).getPropertyValue(property).trim();
          const token = (name) => { const probe = document.createElement('span'); probe.style.color = root.getPropertyValue(name).trim(); document.body.appendChild(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; };
          return {
            button: { background:style('.chi-btn--primary','background-color'), token:token('--chi-button-primary-background'), hover:token('--chi-button-primary-background-hover'), active:token('--chi-button-primary-background-active') },
            field: { border:style('.chi-input','border-top-color'), hover:token('--chi-color-text-muted'), focus:token('--chi-color-accent'), danger:token('--chi-color-danger'), disabled:token('--chi-color-surface-sunken') },
            tabs: { selected:token('--chi-color-accent'), text:token('--chi-color-text-primary'), disabled:token('--chi-color-text-disabled') },
            surfaces: { sunken:token('--chi-color-surface-sunken'), border:token('--chi-color-border-strong'), raised:token('--chi-color-surface-raised'), backdrop:token('--chi-color-backdrop') },
            status: { accent:token('--chi-color-accent'), success:token('--chi-color-success'), warning:token('--chi-color-warning'), danger:token('--chi-color-danger'), info:token('--chi-color-info'), muted:token('--chi-color-text-muted'), primary:token('--chi-color-text-primary'), disabledText:token('--chi-color-text-disabled') },
          };
        })()`);
        const checks = {};
        checks.buttonBaseUsesToken = baseline.button.background === baseline.button.token;
        await hover('.chi-btn--primary');
        await new Promise((resolve) => setTimeout(resolve, 220));
        const buttonHover = await evaluate("getComputedStyle(document.querySelector('.chi-btn--primary')).backgroundColor");
        checks.buttonHoverUsesToken = buttonHover === baseline.button.hover;
        await press('.chi-btn--primary');
        await new Promise((resolve) => setTimeout(resolve, 220));
        const buttonActive = await evaluate("getComputedStyle(document.querySelector('.chi-btn--primary')).backgroundColor");
        checks.buttonActiveUsesToken = buttonActive === baseline.button.active;
        await release('.chi-btn--primary');
        await hover('.chi-btn--primary[disabled]');
        await new Promise((resolve) => setTimeout(resolve, 220));
        const disabledBase = await evaluate("getComputedStyle(document.querySelector('.chi-btn--primary[disabled]')).backgroundColor");
        await press('.chi-btn--primary[disabled]');
        await new Promise((resolve) => setTimeout(resolve, 220));
        const disabledActive = await evaluate("getComputedStyle(document.querySelector('.chi-btn--primary[disabled]')).backgroundColor");
        checks.disabledButtonStable = disabledBase === disabledActive;
        await release('.chi-btn--primary[disabled]');

        await hover('#showcase-name');
        await new Promise((resolve) => setTimeout(resolve, 220));
        const fieldHover = await evaluate("getComputedStyle(document.querySelector('#showcase-name')).borderTopColor");
        checks.fieldHoverUsesToken = fieldHover === baseline.field.hover;
        await evaluate('document.body.focus()');
        await evaluate("document.querySelector('#showcase-name').focus()");
        await new Promise((resolve) => setTimeout(resolve, 220));
        const fieldFocus = await evaluate("getComputedStyle(document.querySelector('#showcase-name')).borderTopColor");
        checks.fieldFocusUsesToken = fieldFocus === baseline.field.focus;
        const fieldError = await evaluate("getComputedStyle(document.querySelector('#showcase-email')).borderTopColor");
        checks.fieldErrorUsesToken = fieldError === baseline.field.danger;
        const disabledField = await evaluate("getComputedStyle(document.querySelector('#showcase-disabled-input')).backgroundColor");
        checks.disabledFieldUsesToken = disabledField === baseline.field.disabled;

        await hover('.chi-tab:not([disabled])');
        await new Promise((resolve) => setTimeout(resolve, 220));
        const tabHover = await evaluate("getComputedStyle(document.querySelector('.chi-tab:not([disabled])')).color");
        checks.tabHoverUsesPrimaryText = tabHover === baseline.tabs.text;
        const selectedTabBorder = await evaluate("getComputedStyle(document.querySelector('.chi-tab[aria-selected=true]')).borderBottomColor");
        checks.selectedTabUsesAccent = selectedTabBorder === baseline.tabs.selected;
        const disabledTabColor = await evaluate("getComputedStyle(document.querySelector('.chi-tab[disabled]')).color");
        checks.disabledTabUsesToken = disabledTabColor === baseline.tabs.disabled;
        await evaluate('document.body.focus()');

        await hover('.chi-card--clickable');
        await new Promise((resolve) => setTimeout(resolve, 220));
        const cardHover = await evaluate("getComputedStyle(document.querySelector('.chi-card--clickable')).borderTopColor");
        checks.cardHoverUsesStrongBorder = cardHover === baseline.surfaces.border;
        await hover('.chi-list__item--clickable');
        await new Promise((resolve) => setTimeout(resolve, 220));
        const listHover = await evaluate("getComputedStyle(document.querySelector('.chi-list__item--clickable')).backgroundColor");
        checks.listHoverUsesSunkenSurface = listHover === baseline.surfaces.sunken;
        await hover('.chi-table tbody tr');
        await new Promise((resolve) => setTimeout(resolve, 220));
        const tableHover = await evaluate("getComputedStyle(document.querySelector('.chi-table tbody tr')).backgroundColor");
        checks.tableHoverUsesSunkenSurface = tableHover === baseline.surfaces.sunken;

        const choice = await evaluate(`(() => {
          const check = document.querySelector('.chi-check__input');
          const radio = document.querySelector('.chi-radio__input');
          const toggle = document.querySelector('.chi-switch__input');
          const disabledCheck = document.querySelector('.chi-check__input:disabled');
          const disabledRadio = document.querySelector('.chi-radio__input:disabled');
          const disabledSwitch = document.querySelector('.chi-switch__input:disabled');
          const color = (element, property) => getComputedStyle(element).getPropertyValue(property).trim();
          const label = (element) => color(element.closest('label'), 'color');
          const opacity = (element) => color(element, 'opacity');
          return {checkBefore:color(check,'background-color'),checkChecked:color(check,'background-color'),checkBorder:color(check,'border-top-color'),radioBorder:color(radio,'border-top-color'),switchBefore:color(toggle,'background-color'),disabledCheckOpacity:opacity(disabledCheck),disabledRadioOpacity:opacity(disabledRadio),disabledSwitchOpacity:opacity(disabledSwitch),disabledLabel:label(disabledSwitch),disabledLabelColor:color(document.querySelector('.chi-switch__input:disabled').closest('label'),'color')};
        })()`);
        checks.checkboxCheckedUsesAccent = choice.checkChecked === baseline.status.accent;
        checks.radioCheckedUsesAccent = choice.radioBorder === baseline.status.accent;
        checks.switchCheckedUsesAccent = choice.switchBefore === baseline.status.accent;
        checks.disabledChoiceOpacityConsistent = choice.disabledCheckOpacity === choice.disabledRadioOpacity && choice.disabledRadioOpacity === choice.disabledSwitchOpacity && Number(choice.disabledCheckOpacity) < 1;
        checks.disabledChoiceLabelUsesDisabledText = choice.disabledLabel === baseline.status.disabledText;
        const disabledControlFocus = await evaluate(`(() => { const el=document.querySelector('.chi-check__input:disabled'); el.focus(); return document.activeElement === el; })()`);
        checks.disabledChoiceCannotReceiveFocus = disabledControlFocus === false;

        const badgeChecks = await evaluate(`(() => {
          const map = [['success','--chi-color-success-strong'],['warning','--chi-color-warning-strong'],['danger','--chi-color-danger-strong'],['info','--chi-color-info-strong']];
          return map.map(([name,token]) => { const badge=document.querySelector('.chi-badge--'+name); const probe=document.createElement('span'); probe.style.color=getComputedStyle(document.documentElement).getPropertyValue(token).trim(); document.body.appendChild(probe); const expected=getComputedStyle(probe).color; probe.remove(); return getComputedStyle(badge).color === expected; });
        })()`);
        checks.badgeSemanticColors = badgeChecks.every(Boolean);
        checks.spinnerUsesAccent = await evaluate(`getComputedStyle(document.querySelector('.chi-spinner')).borderTopColor`) === baseline.status.accent;
        checks.skeletonUsesSunkenSurface = await evaluate(`getComputedStyle(document.querySelector('.chi-skeleton')).backgroundColor`) === baseline.surfaces.sunken;
        checks.emptyErrorSuccessStatesPresent = await evaluate(`document.querySelectorAll('.chi-state').length >= 4 && !!document.querySelector('.chi-state[role=alert]') && [...document.querySelectorAll('.chi-state')].some(el => el.textContent.includes('儲存成功'))`);

        const opener = '.chi-dialog + *';
        await evaluate(`document.querySelector('[data-chi-dialog-open="showcase-dialog"]').click()`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        const dialog = await evaluate(`(() => { const el=document.querySelector('#showcase-dialog'); const backdrop=getComputedStyle(el,'::backdrop').backgroundColor; return {open:el.open,background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,backdrop,activeInside:el.contains(document.activeElement)}; })()`);
        checks.dialogOpensAndReceivesFocus = dialog.open && dialog.activeInside;
        checks.dialogUsesRaisedSurface = dialog.background === baseline.surfaces.raised;
        checks.dialogTextUsesPrimary = dialog.color === baseline.status.primary;
        checks.dialogBackdropUsesToken = dialog.backdrop === baseline.surfaces.backdrop;
        await evaluate(`document.querySelector('#showcase-dialog [data-chi-dialog-close]').click()`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        checks.dialogClosesAndReturnsFocus = await evaluate(`!document.querySelector('#showcase-dialog').open && document.activeElement === document.querySelector('[data-chi-dialog-open="showcase-dialog"]')`);
        await evaluate(`document.querySelector('[data-chi-dialog-open="showcase-dialog"]').click()`);
        await new Promise((resolve) => setTimeout(resolve, 80));
        await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:12,y:12});
        await send('Input.dispatchMouseEvent', {type:'mousePressed',x:12,y:12,button:'left',clickCount:1});
        await send('Input.dispatchMouseEvent', {type:'mouseReleased',x:12,y:12,button:'left',clickCount:1});
        await new Promise((resolve) => setTimeout(resolve, 100));
        checks.dialogBackdropClosesAndReturnsFocus = await evaluate(`!document.querySelector('#showcase-dialog').open && document.activeElement === document.querySelector('[data-chi-dialog-open="showcase-dialog"]')`);
        checks.brandAndThemeApplied = await evaluate(`document.documentElement.getAttribute('data-chi-brand') === ${JSON.stringify(brand)} && document.documentElement.getAttribute('data-chi-theme') === ${JSON.stringify(theme)}`);
        const issues = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
        if (issues.length) failures.push({ brand, theme, issues, baseline, stderr: stderr.slice(-600) });
        else passed++;
        console.log(`${issues.length ? 'FAIL' : 'PASS'} ${brand} ${theme}${issues.length ? ` [${issues.join(',')}]` : ''}`);
      }
    } catch (error) {
      failures.push({ brand, error: String(error), stderr: stderr.slice(-1000) });
      console.log(`FAIL ${brand} ${String(error)}`);
    } finally {
      try { socket?.close(); } catch {}
      child.kill('SIGKILL');
      await new Promise((resolve) => child.once('close', resolve));
      await rm(profile, { recursive: true, force: true });
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
console.log(`Chrome visual state regression smoke: ${passed}/${brands.length * themes.length} brand/theme combinations passed.`);
if (failures.length) {
  for (const failure of failures) console.error(JSON.stringify(failure));
  process.exitCode = 1;
}
