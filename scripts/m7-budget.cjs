/*
 * M7 hard budgets (M7_PLAN §5) measured as a pair on the same machine:
 *  - production JS gzip  <= baseline × 1.10
 *  - first interactive   <= baseline median × 1.20 (navigation → public 以固定种子开始 enabled)
 * The historical interaction baseline is the signed-off M6 tree. M8 CI supplies a separate
 * --js-base signed-off M7 build, per M8_PLAN §7.6 (2026-10-08); thresholds stay unchanged.
 * Both interaction dist folders are served from the
 * root by the same static server; samples alternate base/current to share machine noise.
 * Usage: node scripts/m7-budget.cjs --base=<base dist> --current=<current dist> [--js-base=<JS base dist>] [--samples=9]
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const zlib = require('node:zlib');
const { chromium } = require('playwright');

const arg = (name, fallback) => (process.argv.find(value => value.startsWith(`--${name}=`)) ?? `=${fallback}`).split('=').slice(1).join('=');
const baseDir = path.resolve(arg('base', '')), currentDir = path.resolve(arg('current', 'dist')), samples = Number(arg('samples', '9'));
const jsBaseDir = path.resolve(arg('js-base', baseDir));
const out = arg('out', 'artifacts/m7-budget');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

function jsGzip(dir) {
  const assets = path.join(dir, 'assets');
  return fs.readdirSync(assets).filter(file => file.endsWith('.js')).reduce((sum, file) => sum + zlib.gzipSync(fs.readFileSync(path.join(assets, file)), { level: 9 }).length, 0);
}
function serve(dir) {
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

(async () => {
  if (!fs.existsSync(path.join(baseDir, 'index.html'))) throw new Error(`missing base build at ${baseDir}`);
  const size = { base: jsGzip(jsBaseDir), current: jsGzip(currentDir) };
  const servers = { base: await serve(baseDir), current: await serve(currentDir) };
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const times = { base: [], current: [] };
  try {
    for (let i = 0; i < samples + 1; i++) for (const key of i % 2 ? ['current', 'base'] : ['base', 'current']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage(), started = Date.now();
      await page.goto(`http://127.0.0.1:${servers[key].address().port}/`, { waitUntil: 'commit' });
      await page.waitForFunction(() => { const b = document.querySelector('[data-debug="m6-fixed-start"]'); return b && !b.disabled; }, null, { timeout: 30000 });
      if (i > 0) times[key].push(Date.now() - started); // first pair warms the browser and disk cache
      await context.close();
    }
  } finally { await browser.close(); for (const server of Object.values(servers)) server.close(); }
  const result = {
    baselineDirectories: { js: jsBaseDir, interactive: baseDir },
    jsGzipBytes: size, jsRatio: size.current / size.base, jsBudget: 1.10,
    interactiveMs: { base: times.base, current: times.current, baseMedian: median(times.base), currentMedian: median(times.current) },
    interactiveRatio: median(times.current) / median(times.base), interactiveBudget: 1.20,
  };
  result.passed = result.jsRatio <= result.jsBudget && result.interactiveRatio <= result.interactiveBudget;
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
