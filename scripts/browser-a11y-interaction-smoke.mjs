import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const browser = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)
  .find((candidate) => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
if (!browser) {
  console.log('Browser accessibility interaction smoke skipped: Chrome/Chromium is not installed.');
  process.exit(0);
}
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  let target = path.resolve(ROOT, '.' + pathname);
  if (!target.startsWith(ROOT + path.sep)) return response.writeHead(403).end();
  try {
    if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
    const ext = path.extname(target);
    response.setHeader('content-type', ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : 'text/javascript');
    response.end(readFileSync(target));
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const brands = ['chi', 'fg', 'h', 'merch', 'nav', 'status'];
const viewports = [{name:'desktop',width:1365,height:900},{name:'mobile',width:390,height:844}];
const failures = [];
let passed = 0;

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
  for (const brand of brands) for (const viewport of viewports) {
    const profile = await mkdtemp(path.join(os.tmpdir(), 'chi-a11y-interaction-'));
    const child = spawn(browser, ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], {stdio:['ignore','ignore','pipe'],env:{...process.env,DISPLAY:''}});
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    let socket;
    try {
      const port = await waitFor(async () => { try { return Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]); } catch { return null; } });
      const pageUrl = `${origin}/preview/components.html?brand=${brand}&theme=light`;
      const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,{method:'PUT'})).json();
      socket = new WebSocket(target.webSocketDebuggerUrl);
      await waitFor(() => socket.readyState === WebSocket.OPEN);
      let nextId = 0;
      const pending = new Map();
      socket.addEventListener('message', event => { const msg=JSON.parse(event.data); if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);} });
      const send = (method,params={}) => new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
      const evaluate = async expression => (await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
      const key = async (name,code,keyCode,modifiers=0) => { await send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code,modifiers,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode,...(name==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})}); await send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code,modifiers,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode}); };
      await send('Page.enable'); await send('Runtime.enable'); await send('Accessibility.enable');
      await send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:viewport.name==='mobile'});
      await send('Page.navigate',{url:pageUrl});
      await waitFor(async()=>evaluate(`location.href===${JSON.stringify(pageUrl)}&&document.readyState==='complete'&&!!window.ChiDialog`));
      await evaluate(`window.ChiTheme?.setPreviewMode('light'); window.ChiTabs?.initAll(); window.ChiDialog?.initAll(); true`);

      const axTree = await send('Accessibility.getFullAXTree');
      const axRoles = Object.fromEntries(['接收電子郵件通知','個人','啟用通知','電子郵件','唯讀欄位','停用欄位'].map(name => { const node=axTree.nodes.find(item => item.name?.value===name); return [name,node ? {role:node.role?.value,properties:node.properties?.map(prop=>({name:prop.name,value:prop.value?.value}))||[]} : null]; }));
      const disabledFocus = await evaluate(`(() => { const el=document.querySelector('#showcase-disabled-input'); el.focus(); return document.activeElement===el; })()`);
      const readonlyFocus = await evaluate(`(() => { const el=document.querySelector('#showcase-readonly-input'); el.focus(); return document.activeElement===el && el.readOnly && !el.disabled; })()`);
      await send('Input.insertText',{text:'不可覆寫'});
      const readonlyValueStable = await evaluate(`document.querySelector('#showcase-readonly-input').value==='可聚焦，不可修改'`);
      const invalidSemantics = await evaluate(`(() => { const el=document.querySelector('#showcase-email'); return el.getAttribute('aria-invalid')==='true' && el.getAttribute('aria-describedby')==='showcase-email-error' && !!document.getElementById('showcase-email-error'); })()`);
      const liveSemantics = await evaluate(`(() => { const status=document.querySelector('#showcase-form-status'); const alert=document.querySelector('[role=alert]'); const busy=document.querySelector('[aria-busy=true]'); return status.getAttribute('aria-live')==='polite' && alert && busy && busy.getAttribute('role')==='status'; })()`);
      const radioGroupSemantics = await evaluate(`(() => { const radios=[...document.querySelectorAll('input.chi-radio__input')].filter(el=>el.name==='showcase-radio'); return radios.length===3 && radios.every(el=>el.type==='radio') && radios.filter(el=>el.checked).length===1 && radios[0].closest('fieldset')?.querySelector('legend')?.textContent.trim()==='通知對象'; })()`);

      await evaluate(`document.querySelector('#showcase-name').focus()`);
      await key('Tab','Tab',9);
      const disabledSkipped = await evaluate(`document.activeElement.id==='showcase-readonly-input'`);
      await key('Tab','Tab',9);
      const emailAfterReadonly = await evaluate(`document.activeElement.id==='showcase-email'`);
      await key('Tab','Tab',9);
      const selectAfterEmail = await evaluate(`document.activeElement.id==='showcase-select'`);
      await key('Tab','Tab',9);
      const textareaAfterSelect = await evaluate(`document.activeElement.id==='showcase-message'`);
      await key('Tab','Tab',9);
      const checkboxStart = await evaluate(`document.activeElement.matches('.chi-check__input:not(:disabled)')`);
      await key(' ','Space',32);
      const checkboxToggled = await evaluate(`document.activeElement.checked===false`);
      await key('Tab','Tab',9);
      const radioStart = await evaluate(`document.activeElement.matches('.chi-radio__input:not(:disabled)')`);
      await key('ArrowRight','ArrowRight',39);
      const radioMoved = await evaluate(`document.activeElement.id==='showcase-radio-team' && document.activeElement.checked`);
      await key('Tab','Tab',9);
      const switchFocused = await evaluate(`document.activeElement.matches('.chi-switch__input:not(:disabled)')`);
      const switchBefore = await evaluate(`document.activeElement.checked`);
      await key(' ','Space',32);
      const switchToggled = await evaluate(`document.activeElement.checked!==${JSON.stringify(switchBefore)}`);

      await evaluate(`document.querySelector('[data-chi-dialog-open="showcase-dialog"]').focus(); document.querySelector('[data-chi-dialog-open="showcase-dialog"]').click()`);
      await new Promise(resolve=>setTimeout(resolve,80));
      const dialogInitialFocus = await evaluate(`document.querySelector('#showcase-dialog').open && document.activeElement===document.querySelector('#showcase-dialog [data-chi-dialog-close]:first-child')`);
      await key('Tab','Tab',9);
      const dialogTabMovesToNextControl = await evaluate(`document.activeElement===document.querySelector('#showcase-dialog [data-chi-dialog-close]:last-child')`);
      await key('Tab','Tab',9);
      const dialogTabDoesNotFocusBackground = await evaluate(`(() => { const dialog=document.querySelector('#showcase-dialog'); const opener=document.querySelector('[data-chi-dialog-open="showcase-dialog"]'); return dialog.open && dialog.matches(':modal') && document.activeElement!==opener; })()`);
      await key('Tab','Tab',9,8);
      const dialogShiftTabReturnsToLastControl = await evaluate(`document.activeElement===document.querySelector('#showcase-dialog [data-chi-dialog-close]:last-child')`);
      const backgroundInert = await evaluate(`(() => { const opener=document.querySelector('[data-chi-dialog-open="showcase-dialog"]'); const dialog=document.querySelector('#showcase-dialog'); opener.focus(); return dialog.open && dialog.matches(':modal') && document.activeElement!==opener; })()`);
      await key('Escape','Escape',27);
      await waitFor(async()=>evaluate(`!document.querySelector('#showcase-dialog').open`));
      const dialogReturnFocus = await evaluate(`document.activeElement===document.querySelector('[data-chi-dialog-open="showcase-dialog"]')`);

      const axProperty = (name, property) => axRoles[name]?.properties?.find(item => item.name === property)?.value;
      const checks = {axCheckboxRole:axRoles['接收電子郵件通知']?.role==='checkbox',axRadioRole:axRoles['個人']?.role==='radio',axSwitchRole:axRoles['啟用通知']?.role==='switch',axInvalidFieldRole:axRoles['電子郵件']?.role==='textbox',axReadonlyRole:axRoles['唯讀欄位']?.role==='textbox',axDisabledRole:axRoles['停用欄位']?.role==='textbox',axInvalidAnnounced:axProperty('電子郵件','invalid')==='true',axReadonlyAnnounced:axProperty('唯讀欄位','readonly')===true,axDisabledAnnounced:axProperty('停用欄位','disabled')===true,axStatusRole:axTree.nodes.some(node=>node.role?.value==='status'),axAlertRole:axTree.nodes.some(node=>node.role?.value==='alert'),disabledCannotFocus:!disabledFocus,readonlyCanFocus:readonlyFocus,readonlyValueStable,invalidHasDescription:invalidSemantics,liveRegionsPresent:liveSemantics,radioGroupSemantics,disabledSkippedInTabOrder:disabledSkipped,tabOrderEmail:emailAfterReadonly,tabOrderSelect:selectAfterEmail,tabOrderTextarea:textareaAfterSelect,checkboxReached:checkboxStart,checkboxSpaceToggles:checkboxToggled,radioReached:radioStart,radioArrowChangesSelection:radioMoved,switchReached:switchFocused,switchSpaceToggles:switchToggled,dialogInitialFocus,dialogTabMovesToNextControl,dialogTabDoesNotFocusBackground,dialogShiftTabReturnsToLastControl,backgroundModalIsolation:backgroundInert,dialogEscapeReturnsFocus:dialogReturnFocus};
      const issues = Object.entries(checks).filter(([,value])=>!value).map(([name])=>name);
      if (issues.length) failures.push({brand,viewport:viewport.name,issues,checks,axRoles,stderr:stderr.slice(-1000)}); else passed++;
      console.log(`${issues.length?'FAIL':'PASS'} ${brand} ${viewport.name}${issues.length?` [${issues.join(', ')}]`:''}`);
    } catch(error) {
      failures.push({brand,viewport:viewport.name,error:String(error),stderr:stderr.slice(-1200)});
      console.log(`FAIL ${brand} ${viewport.name} ${String(error)}`);
    } finally {
      try{socket?.close();}catch{}
      const closed=new Promise(resolve=>child.once('close',resolve)); child.kill('SIGKILL'); await Promise.race([closed,new Promise(resolve=>setTimeout(resolve,2000))]);
      await rm(profile,{recursive:true,force:true});
    }
  }
} finally { await new Promise(resolve=>server.close(resolve)); }
console.log(`Chrome accessibility interaction smoke: ${passed}/${brands.length*viewports.length} brand/viewport combinations passed.`);
if(failures.length){for(const failure of failures)console.error(JSON.stringify(failure));process.exitCode=1;}
