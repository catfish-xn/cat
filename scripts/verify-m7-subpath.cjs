/*
 * Strict sub-path deployment smoke (audit F03): serves ./dist ONLY under /cat/ (no root
 * fallback), loads the page, and requires the app to boot, every request to succeed and all
 * bundled S13 icons to resolve. Usage: node scripts/verify-m7-subpath.cjs [--dist=dist]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const arg = (name, fallback) => (process.argv.find(value => value.startsWith(`--${name}=`)) ?? `=${fallback}`).split('=').slice(1).join('=');
const dist = path.resolve(arg('dist', 'dist')), prefix = '/cat/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const served = [];
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(prefix)) { res.writeHead(404); res.end('outside /cat/'); served.push([url, 404]); return; }
  const file = path.join(dist, url.slice(prefix.length) || 'index.html');
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); served.push([url, 404]); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); fs.createReadStream(file).pipe(res); served.push([url, 200]);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(base);
    await page.waitForFunction(() => { const b = document.querySelector('[data-debug="m6-fixed-start"]'); return b && !b.disabled; }, null, { timeout: 30000 });
    await page.fill('[data-debug="m6-seed-input"]', '42');
    await page.locator('[data-debug="m6-fixed-start"]').click();
    await page.waitForFunction(() => window.__CAT_DEBUG__?.read().m6?.mode === 'active');
    await page.waitForTimeout(1000);
    const icons = await page.evaluate(async () => {
      const urls = [...new Set([...document.querySelectorAll('img')].map(img => img.src))];
      return { shopPortraits: document.querySelectorAll('.shop-card img.hero-portrait').length,
        broken: [...document.querySelectorAll('img')].filter(img => img.complete && img.naturalWidth === 0).map(img => img.src), urls };
    });
    // Every bundled icon listed in the manifest must resolve under the sub-path.
    const manifest = fs.readFileSync(path.resolve('src/presentation/s13-asset-manifest.ts'), 'utf8');
    const assetPaths = [...manifest.matchAll(/"path": "([^"]+)"/g)].map(match => match[1]);
    const statuses = await page.evaluate(async paths => Promise.all(paths.map(async p => (await fetch(p)).status)), assetPaths);
    const failedRequests = served.filter(([, status]) => status !== 200);
    const report = { base, assets: assetPaths.length, assetStatuses: [...new Set(statuses)], shopPortraits: icons.shopPortraits, broken: icons.broken, failedRequests, errors };
    console.log(JSON.stringify(report, null, 2));
    assert.deepEqual(failedRequests, [], 'no request leaves /cat/ or 404s');
    assert.deepEqual(errors, []);
    assert(assetPaths.length >= 40 && statuses.every(status => status === 200), 'all S13 icons resolve under /cat/');
    assert(icons.shopPortraits > 0 && icons.broken.length === 0, 'shop portraits load');
    console.log('ok subpath /cat/');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { await browser.close(); server.close(); }
})();
