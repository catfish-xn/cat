/* Diagnostic interception of matchMedia; never an acceptance run. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fixture = process.env.M6_DIAGNOSTIC_LIFECYCLE_FIXTURE;
assert(fixture, 'provide a publicly exported M6 save with completed battles');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const report = { diagnosticOnly: true, browser: browser.version(), stages: [] };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      const original = window.matchMedia;
      const counts = {};
      window.__MEDIA_QUERY_DIAG__ = counts;
      window.matchMedia = function (...args) {
        const key = JSON.stringify({ query: args[0], stack: new Error().stack });
        counts[key] = (counts[key] || 0) + 1;
        return Reflect.apply(original, this, args);
      };
    });
    const page = await context.newPage();
    page.on('dialog', async dialog => { await dialog.accept(); });
    await page.goto('http://127.0.0.1:4193');
    await page.waitForFunction(() => window.__CAT_DEBUG__ && !document.querySelector('[data-debug="m6-seed-input"]').disabled);
    const record = async label => report.stages.push({ label, calls: await page.evaluate(() => window.__MEDIA_QUERY_DIAG__) });
    await record('startup');
    await page.locator('[data-debug="m6-seed-input"]').fill('42');
    for (let i = 0; i < 5; i++) {
      const epoch = await page.evaluate(() => window.__CAT_DEBUG__.read().m6.token?.activationEpoch);
      await page.locator('[data-debug="m6-import"]').setInputFiles(fixture);
      await page.waitForFunction(previous => window.__CAT_DEBUG__.read().m6.token?.activationEpoch !== previous, epoch);
    }
    await record('five-imports');
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('选择已完成战斗').selectOption('0');
      await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'replay');
      await page.locator('#replay-root').getByRole('button', { name: '返回当前局', exact: true }).click();
      await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'active');
    }
    await record('five-replays');
    report.completed = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    await browser.close();
    fs.mkdirSync('artifacts/m6-media-trace', { recursive: true });
    fs.writeFileSync('artifacts/m6-media-trace/summary.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  }
})();
