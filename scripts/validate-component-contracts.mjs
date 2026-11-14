/* Validate public component examples and documented HTML contracts. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (message) => failures.push(message);
const read = (relative) => readFileSync(path.join(ROOT, relative), 'utf8');

function parseAttributes(source) {
  const attrs = {};
  for (const match of source.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function inspectMarkup(markup, label) {
  const ids = new Set();
  const elements = [];
  const stack = [];
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (const token of markup.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-zA-Z][^>]*>/g)) {
    const raw = token[0];
    if (raw.startsWith('<!--') || raw.startsWith('<!')) continue;
    const closing = /^<\//.test(raw);
    const name = raw.match(/^<\/?\s*([\w-]+)/)?.[1]?.toLowerCase();
    if (!name) continue;
    if (closing) {
      const index = stack.lastIndexOf(name);
      if (index >= 0) stack.splice(index);
      continue;
    }
    const attrs = parseAttributes(raw.slice(name.length + 1, -1));
    const element = { name, attrs, ancestors: [...stack] };
    elements.push(element);
    if (attrs.id) {
      if (ids.has(attrs.id)) fail(`${label}: duplicate id="${attrs.id}"`);
      ids.add(attrs.id);
    }
    if (name === 'button' && !['button','submit','reset'].includes(attrs.type)) fail(`${label}: button must declare a valid type`);
    if (name === 'button' && attrs.class?.split(/\s+/).some((c) => c.startsWith('chi-btn--'))) {
      const variants = attrs.class.split(/\s+/).filter((c) => c.startsWith('chi-btn--'));
      if (variants.length !== 1 || !['chi-btn--primary','chi-btn--secondary','chi-btn--ghost','chi-btn--danger'].includes(variants[0])) fail(`${label}: Button variant must use the four-value closed enum`);
    }
    if (!voidTags.has(name) && !/\/\s*>$/.test(raw)) stack.push(name);
  }

  const byId = new Map(elements.filter((el) => el.attrs.id).map((el) => [el.attrs.id, el]));
  for (const el of elements) {
    for (const relation of ['aria-labelledby','aria-describedby','aria-controls','aria-owns','aria-activedescendant']) {
      for (const id of (el.attrs[relation] || '').split(/\s+/).filter(Boolean)) if (!byId.has(id)) fail(`${label}: ${relation} points to missing #${id}`);
    }
    if (el.attrs['aria-invalid'] === 'true' && !el.attrs['aria-describedby']) fail(`${label}: invalid control needs aria-describedby`);
    if (el.attrs.role === 'tab') {
      if (el.name !== 'button' || !el.attrs.id || !el.attrs['aria-controls'] || !['true','false'].includes(el.attrs['aria-selected']) || !['0','-1'].includes(el.attrs.tabindex)) fail(`${label}: tab must be a named button with controls, selected and tabindex`);
      const panel = byId.get(el.attrs['aria-controls']);
      if (!panel || panel.attrs.role !== 'tabpanel' || panel.attrs['aria-labelledby'] !== el.attrs.id) fail(`${label}: tab and tabpanel relationship is incomplete`);
    }
    if (el.attrs.role === 'tablist' && !el.attrs['aria-label'] && !el.attrs['aria-labelledby']) fail(`${label}: tablist needs an accessible name`);
    if (el.name === 'input' && !['hidden','submit','button','reset','image'].includes(el.attrs.type) || ['select','textarea'].includes(el.name)) {
      const wrappedByLabel = el.ancestors.includes('label');
      const explicitLabel = el.attrs.id && elements.some((candidate) => candidate.name === 'label' && candidate.attrs.for === el.attrs.id);
      if (!wrappedByLabel && !explicitLabel) fail(`${label}: ${el.name} control needs a programmatic label`);
    }
    if (el.name === 'input' && ['checkbox','radio'].includes(el.attrs.type)) {
      const wrappedByLabel = el.ancestors.includes('label');
      const explicitLabel = el.attrs.id && elements.some((candidate) => candidate.name === 'label' && candidate.attrs.for === el.attrs.id);
      if (!wrappedByLabel && !explicitLabel) fail(`${label}: ${el.attrs.type} needs a programmatic label`);
      if (el.attrs.type === 'radio') {
        const fieldsetIndex = el.ancestors.lastIndexOf('fieldset');
        const hasLegend = fieldsetIndex >= 0 && elements.some((candidate) => candidate.name === 'legend' && candidate.ancestors.includes('fieldset'));
        if (!hasLegend) fail(`${label}: radio choices must belong to a fieldset with legend`);
      }
    }
    if (el.name === 'dialog' && el.attrs.class?.split(/\s+/).includes('chi-dialog')) {
      if (!el.attrs.id || !el.attrs['aria-labelledby'] || !byId.has(el.attrs['aria-labelledby'])) fail(`${label}: Dialog needs id and aria-labelledby pointing to its visible title`);
    }
  }
  for (const el of elements.filter((item) => item.attrs.role === 'tab')) {
    const panel = byId.get(el.attrs['aria-controls']);
    if (!panel) continue;
    const selected = el.attrs['aria-selected'] === 'true';
    if (selected === (panel.attrs.hidden !== undefined)) fail(`${label}: selected tab and panel hidden state disagree`);
  }
  for (const table of elements.filter((el) => el.name === 'table')) {
    const descendants = elements.filter((el) => el.ancestors.includes('table'));
    if (!descendants.some((el) => el.name === 'caption')) fail(`${label}: table needs a caption`);
    if (descendants.some((el) => el.name === 'th' && !['row','col','rowgroup','colgroup'].includes(el.attrs.scope))) fail(`${label}: table headers need a valid scope`);
  }
}

const guide = read('docs/COMPONENTS.md');
const snippets = [...guide.matchAll(/```html\s*([\s\S]*?)```/g)].map((match) => match[1]);
if (snippets.length < 5) fail('docs/COMPONENTS.md: expected the complete set of HTML usage examples');
snippets.forEach((snippet, index) => inspectMarkup(snippet, `docs/COMPONENTS.md HTML example ${index + 1}`));
inspectMarkup(read('components/base/examples.html'), 'components/base/examples.html');

const runtimeContracts = [
  ['Theme', 'components/theme/theme.js', ['window.ChiTheme = {','getMode:','getEffective:','setMode: setMode','setPreviewMode: setPreviewMode','cycle: cycle','bindToggles: bindToggles','chi-theme-change']],
  ['Sidebar', 'components/sidebar/sidebar.js', ['window.ChiSidebar = {','bind: bind','isCollapsed: isCollapsed','setCollapsed: setCollapsed','toggleCollapsed: toggleCollapsed','openMobile: openMobile','closeMobile: closeMobile','chi-sidebar-change']],
  ['Tabs', 'components/tabs/tabs.js', ['window.ChiTabs = { init, initAll }']],
  ['Dialog', 'components/dialog/dialog.js', ['window.ChiDialog = { init, initAll, open, close }']],
];
for (const [name, file, contracts] of runtimeContracts) {
  const source = read(file);
  for (const contract of contracts) if (!source.includes(contract)) fail(`${name} runtime public API missing: ${contract}`);
}
for (const contract of ['ChiTheme.getMode()','ChiTheme.getEffective()','ChiTheme.setMode(mode)','ChiTheme.setPreviewMode(mode)','ChiTheme.bindToggles()','ChiSidebar.bind()','ChiSidebar.setCollapsed(value)','ChiSidebar.openMobile()','ChiSidebar.closeMobile(restoreFocus)','ChiTabs.init(root)','ChiTabs.initAll()','ChiDialog.open(dialog, opener)','ChiDialog.close(dialog, returnValue)','chi-theme-change','chi-sidebar-change']) {
  if (!guide.includes(contract)) fail(`docs/COMPONENTS.md missing runtime API contract: ${contract}`);
}

const requiredSections = ['## Button','## Form fields','## Tabs','## Card、List、Table','## Badge 與資料狀態','## Dialog','## 驗收與變更'];
for (const heading of requiredSections) if (!guide.includes(heading)) fail(`docs/COMPONENTS.md missing section: ${heading}`);
for (const file of ['SPEC.md','README.md']) if (!read(file).includes('docs/COMPONENTS.md')) fail(`${file} should link to the component usage guide`);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Component contract validation passed: ${snippets.length} documented HTML examples + canonical semantic examples.`);
}
