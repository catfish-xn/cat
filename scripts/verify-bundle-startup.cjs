// Production-request regression: offline code must stay absent through the online
// first interaction, while the default solo entry still boots and starts a match.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
(async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, `.${new URL(req.url, 'http://local').pathname.replace(/\/$/, '/index.html')}`);
    if (!file.startsWith(`${root}/`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
    const results = [];
    for (const online of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      try {
        const page = await context.newPage(), requests = [], errors = [];
        page.on('request', req => requests.push(new URL(req.url()).pathname));
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`http://127.0.0.1:${server.address().port}/${online ? '?mode=online' : ''}`);
        await page.waitForFunction(() => !!window.__CAT_DEBUG__);
        if (online) {
          await page.locator('[data-debug="online:join"]').click();
          assert.match(await page.locator('.lobby-error').textContent(), /没有联机服务器/);
          assert.equal(requests.some(url => url.includes('/assets/solo/')), false, 'online first interaction must not fetch solo');
        } else {
          await page.waitForFunction(() => !document.querySelector('[data-debug="m6-fixed-start"]')?.disabled);
          assert(requests.some(url => url.includes('/assets/solo/')), 'solo application must really load');
          await page.locator('[data-debug="m6-seed-input"]').fill('42');
          await page.locator('[data-debug="m6-fixed-start"]').click();
          await page.waitForFunction(() => { const s = window.__CAT_DEBUG__.read(); return s.state.seed === 42 && s.m6?.mode === 'active'; });
        }
        assert.deepEqual(errors, []);
        results.push({ mode: online ? 'online' : 'solo', soloRequests: requests.filter(url => url.includes('/assets/solo/')), pageErrors: errors });
      } finally { await context.close(); }
    }
    fs.mkdirSync('artifacts/bundle-split', { recursive: true });
    fs.writeFileSync('artifacts/bundle-split/browser-startup.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
