/* Prove a new site is generated from only one brand file and one site file. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildTokens } from './build-tokens.mjs';
import { buildSite } from './build-site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = [
  { id: 'contract-probe', name: 'Contract Probe', layout: undefined },
  { id: 'contract-probe-sidebar', name: 'Contract Probe Sidebar', layout: 'sidebar' },
];
const created = [];

try {
  for (const fixture of fixtures) {
    const brandPath = path.join(ROOT, 'tokens', 'brands', `${fixture.id}.tokens.json`);
    const sitePath = path.join(ROOT, 'sites', `${fixture.id}.json`);
    assert.equal(existsSync(brandPath), false, `fixture brand must not already exist: ${fixture.id}`);
    assert.equal(existsSync(sitePath), false, `fixture site must not already exist: ${fixture.id}`);
    const brand = {
      $description: 'Temporary integration-test brand. Removed after the test.',
      color: { brand: { $type: 'color', $value: '{color.blue.500}' } },
    };
    const site = {
      id: fixture.id,
      name: fixture.name,
      brand: fixture.id,
      description: 'Temporary new-site integration fixture.',
      icon: 'house',
      url: `https://${fixture.id}.example.invalid/`,
      logoLight: 'logo/chi-b.png',
      logoDark: 'logo/chi-w.png',
    };
    if (fixture.layout) site.layout = fixture.layout;
    created.push({ brandPath, sitePath, fixture });
    writeFileSync(brandPath, JSON.stringify(brand, null, 2) + '\n');
    writeFileSync(sitePath, JSON.stringify(site, null, 2) + '\n');
  }

  const tokenResult = buildTokens();
  assert.ok(tokenResult.brands['contract-probe']);
  assert.ok(tokenResult.brands['contract-probe-sidebar']);
  const tokenCss = readFileSync(path.join(ROOT, 'dist', 'tokens.css'), 'utf8');
  assert.match(tokenCss, /\[data-chi-brand="contract-probe"\]\s*\{/);
  assert.match(tokenCss, /\[data-chi-brand="contract-probe-sidebar"\]\s*\{/);

  const buildResult = buildSite();
  assert.equal(buildResult.sites, 8);
  const validation = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'validate.mjs')], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(validation.status, 0, `full site validation failed:\n${validation.stdout}\n${validation.stderr}`);
  const preview = JSON.parse(readFileSync(path.join(ROOT, 'preview', 'sites.json'), 'utf8'));
  assert.ok(preview.some((site) => site.id === 'contract-probe'));
  assert.ok(preview.some((site) => site.id === 'contract-probe-sidebar'));

  for (const { fixture } of created) {
    const outputPath = path.join(ROOT, 'dist', 'sites', fixture.id, 'index.html');
    assert.ok(existsSync(outputPath), `site output exists: ${fixture.id}`);
    const html = readFileSync(outputPath, 'utf8');
    assert.ok(html.includes(`data-chi-brand="${fixture.id}"`));
    assert.ok(html.includes(`>${fixture.name}</span>`));
    assert.ok(html.includes('../../logo/chi-b.png'));
    assert.ok(html.includes('../../components.css'));
    const markup = html.replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(!/\{\{[^}]+\}\}/.test(markup));
    const expectedLayout = fixture.layout || 'header';
    assert.ok(html.includes(`data-chi-layout="${expectedLayout}"`));
  }

  console.log('Fresh-site integration passed: 2 new brands/sites, default Header and explicit Sidebar layouts generated from configuration.');
} finally {
  for (const { brandPath, sitePath } of created) {
    rmSync(brandPath, { force: true });
    rmSync(sitePath, { force: true });
  }
  buildTokens();
  buildSite();
}
