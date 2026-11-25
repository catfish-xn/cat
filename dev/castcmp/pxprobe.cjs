// REC ONLY (claude/rec-pxprobe): node dev/castcmp/pxprobe.cjs [--gl gpu|swift] [--port 5471] [--out pxprobe.json]
// Starts vite on the repo, opens pxprobe.html in headless Chrome (same launch options as v-capture), writes the readback.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const { launchOptions } = require('./common.cjs');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
(async () => {
  const { createServer } = await import('vite');
  const port = Number(opt('port') ?? 5471), root = path.resolve(__dirname, '../..');
  const server = await createServer({ root, server: { port, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' }); await server.listen();
  const launch = launchOptions(opt); const browser = await chromium.launch(launch.options);
  const page = await browser.newPage(); page.on('console', m => console.log('[page]', m.text()));
  await page.goto(`http://127.0.0.1:${port}/dev/castcmp/pxprobe.html`);
  const result = await page.waitForFunction(() => window.__pxprobe, null, { timeout: 120000 }).then(h => h.jsonValue());
  const out = opt('out') ?? 'pxprobe.json'; fs.writeFileSync(out, JSON.stringify({ gl: launch.gl, ...result }, null, 1));
  for (const r of result.rows) console.log(`ground ${r.ground} ${r.overlay.padEnd(34)} read ${JSON.stringify(r.read)} display ${JSON.stringify(r.expectDisplay)} linear ${JSON.stringify(r.expectLinear)}`);
  console.log('renderer', result.renderer, 'outputColorSpace', result.outputColorSpace, 'drawingBufferColorSpace', result.drawingBufferColorSpace);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
