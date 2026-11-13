import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist');
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
};

function createStaticServer() {
  return createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let target = path.resolve(distRoot, '.' + pathname);
    if (!target.startsWith(distRoot + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if (statSync(target).isDirectory()) target = path.join(target, 'index.html');
      if (!existsSync(target)) throw new Error('missing');
      response.setHeader('content-type', mimeTypes[path.extname(target)] || 'application/octet-stream');
      response.end(readFileSync(target));
    } catch {
      response.writeHead(404).end();
    }
  });
}

test('All generated sites and local assets serve with HTTP 200 from dist root', async () => {
  const server = createStaticServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    for (const site of ['chi', 'fg', 'h', 'merch', 'nav', 'status']) {
      const pageUrl = new URL(`/sites/${site}/index.html`, origin);
      const pageResponse = await fetch(pageUrl);
      assert.equal(pageResponse.status, 200, `${site} entry page should load`);
      assert.match(pageResponse.headers.get('content-type') || '', /text\/html/);
      const html = await pageResponse.text();
      for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
        if (/^(?:https?:|#|data:|mailto:|tel:)/i.test(asset)) continue;
        const assetUrl = new URL(asset, pageUrl);
        const assetResponse = await fetch(assetUrl);
        assert.equal(assetResponse.status, 200, `${site} local asset should load: ${assetUrl.pathname}`);
        const extension = path.extname(assetUrl.pathname);
        assert.ok(mimeTypes[extension], `${site} asset has an expected file extension: ${assetUrl.pathname}`);
        assert.ok((assetResponse.headers.get('content-type') || '').startsWith(mimeTypes[extension]), `${site} asset has the correct MIME type: ${assetUrl.pathname}`);
      }
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
