/* Browser-only reduction: no app, Phaser, game state, or acceptance result. */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { snapshot } = require('./diagnose-m6-input-retention.cjs');
const output = 'artifacts/m6-native-controls';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const report = { diagnosticOnly: true, browser: browser.version(), node: process.version, arms: [] };
  try {
    for (const name of ['select-disabled', 'file-disabled', 'range-hidden', 'select-control']) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.setContent(name.startsWith('select') ? '<select><option>one</option><option>two</option></select>' : name === 'file-disabled' ? '<input type="file">' : '<input type="range">');
        const iterate = () => page.evaluate(mode => {
          const element = document.querySelector('select, input');
          if (mode.endsWith('-disabled')) {
            element.disabled = true; void element.offsetWidth;
            element.disabled = false; void element.offsetWidth;
          } else if (mode === 'range-hidden') {
            element.hidden = true; void element.offsetWidth;
            element.hidden = false; void element.offsetWidth;
          } else { void element.offsetWidth; }
        }, name);
        for (let i = 0; i < 12; i++) await iterate();
        const cdp = await context.newCDPSession(page);
        await cdp.send('HeapProfiler.enable');
        const arm = { name, snapshots: [] }; report.arms.push(arm);
        for (let window = 0; window <= 3; window++) {
          if (window) for (let i = 0; i < 30; i++) await iterate();
          const sample = await snapshot(cdp, path.join(output, `${name}-${window * 30}.heapsnapshot`));
          sample.iterations = window * 30; arm.snapshots.push(sample);
          console.log(JSON.stringify({ name, iterations: sample.iterations, native: sample.native }));
        }
      } finally { await context.close(); }
    }
    report.completed = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  }
})();
