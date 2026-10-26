import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.on('pageerror', e => console.error(e.message));
  await page.route('**/perf-synthetic/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('manifest.json') ? { schemaVersion: 1, models: { renata: { path: 'renata.glb' }, vex: { path: 'vex.glb' } } }
      : path.endsWith('precache.json') ? { schemaVersion: 1, files: [] } : null;
    return route.fulfill({ status: json ? 200 : 404, contentType: 'application/json', body: JSON.stringify(json) });
  });
  await page.route('**/perf.html*', route => route.fulfill({ contentType: 'text/html', body: '<html><body></body></html>' }));
  await page.goto('http://127.0.0.1:5199/perf.html?mode=online&render=3d&debug3d');
  await page.evaluate(async () => { const probe = await import('/tests/rendering3d-perf-probe.ts'); window.probe = await probe.setup(); });
  const result = await page.evaluate(async () => {
    const early = await window.probe.sample(8), late = await window.probe.sample(24), churn = await window.probe.churn(),
      after = await window.probe.sample(24), clear = await window.probe.clear(); window.probe.dispose();
    return { early, late, churn, after, clear, userAgent: navigator.userAgent };
  });
  writeFileSync(process.argv[2] ?? '/tmp/cat-3d-perf.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} finally { await browser.close(); }
