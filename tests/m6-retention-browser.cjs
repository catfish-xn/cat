/* Native resource regression only; original lifecycle gates and routes are unchanged. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.M6_RETENTION_URL || 'http://127.0.0.1:6193';
const output = process.env.M6_RETENTION_OUTPUT || 'artifacts/m6-retention';
const names = ['UndoStep', 'MediaQueryFeatureExpNode', 'MediaQueryList'];
async function nativeSnapshot(cdp, label, keep = true) {
  await cdp.send('HeapProfiler.collectGarbage');
  const chunks = [];
  const collect = ({ chunk }) => chunks.push(chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', collect);
  try { await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }); }
  finally { cdp.off('HeapProfiler.addHeapSnapshotChunk', collect); }
  const text = chunks.join('');
  if (keep) fs.writeFileSync(path.join(output, `${label}.heapsnapshot`), text);
  const graph = JSON.parse(text), fields = graph.snapshot.meta.node_fields;
  const width = fields.length, type = fields.indexOf('type'), name = fields.indexOf('name');
  const counts = Object.fromEntries(names.map(name => [name, 0]));
  for (let i = 0; i < graph.nodes.length; i += width) {
    if (graph.snapshot.meta.node_types[0][graph.nodes[i + type]] !== 'native') continue;
    const label = graph.strings[graph.nodes[i + name]].replace(/^blink::/, '');
    if (label in counts) counts[label]++;
  }
  return counts;
}
(async () => {
  const started = performance.now();
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const { execFileSync } = require('node:child_process');
  const { sourceFingerprint } = require('../scripts/m5-evidence.cjs');
  const report = { sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), status: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), sourceFingerprint: sourceFingerprint(), node: process.version, mutation: process.env.M6_RETENTION_MUTATION || null, browser: browser.version(), cases: [], passed: false };
  try {
    for (const arm of ['seed-owner', 'table-media-owner']) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.route(url + '/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"></head><body><div id="host"></div></body></html>' }));
        await page.goto(url);
        const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.enable');
        const result = { arm }; report.cases.push(result);
        try {
          if (arm === 'seed-owner') {
            await page.evaluate(async () => {
              const { createSaveControls } = await import('/src/persistence/save-controls.ts');
              window.__calls = [];
              window.__view = { startup: false, canContinue: false, seed: 42, runId: 'run-1', busy: false, status: null, hasActive: true };
              window.__controls = createSaveControls(document.querySelector('#host'), { onNewFixed: seed => window.__calls.push(seed), onNewRandom() {}, onContinue() {}, onImport() {}, onExport() {} });
              window.__controls.update(window.__view);
            });
            const seed = page.locator('[data-debug="m6-seed-input"]');
            for (let i = 0; i < 5; i++) await seed.fill('42');
            result.before = await nativeSnapshot(cdp, `${arm}-before`);
            assert.equal(result.before.UndoStep, 5, 'independent input reproduces five retained edits');
            await page.evaluate(() => {
              const seed = document.querySelector('[data-debug="m6-seed-input"]');
              seed.focus(); seed.setSelectionRange(1, 2, 'backward');
              window.__controls.update({ ...window.__view, status: { kind: 'saving' } });
              const assertSame = document.querySelector('[data-debug="m6-seed-input"]') === seed;
              if (!assertSame) throw Error('ordinary updates must retain the editing owner');
              const attributes = seed.getAttributeNames().map(name => [name, seed.getAttribute(name)]);
              window.__controls.releaseRunResources();
              const next = document.querySelector('[data-debug="m6-seed-input"]');
              if (next === seed || seed.isConnected || next.value !== '42' || document.activeElement !== next || next.selectionStart !== 1 || next.selectionEnd !== 2 || next.selectionDirection !== 'backward') throw Error('run handoff must release the old owner and preserve input state');
              if (JSON.stringify(attributes) !== JSON.stringify(next.getAttributeNames().map(name => [name, next.getAttribute(name)]))) throw Error('input attributes changed');
            });
            result.released = await nativeSnapshot(cdp, `${arm}-released`);
            assert.equal(result.released.UndoStep, 0, 'old run editing history is released');
            await seed.fill('7'); await page.locator('[data-debug="m6-fixed-start"]').click();
            await page.waitForFunction(() => window.__calls.length === 1);
            assert.deepEqual(await page.evaluate(() => window.__calls), [7], 'fixed start reads the renewed input');
            await seed.fill('9'); await seed.press('Control+z');
            assert.equal(await seed.inputValue(), '7', 'editing undo remains available within the current run');
            await page.evaluate(() => { window.__controls.dispose(); window.__controls = null; });
            result.disposed = await nativeSnapshot(cdp, `${arm}-disposed`);
            assert.equal(result.disposed.UndoStep, 0, 'disposing controls releases editing history');
          } else {
            await page.evaluate(async () => {
              const { createStatsPanel } = await import('/src/stats/stats-panel.ts');
              window.__panel = createStatsPanel(document.querySelector('#host'), () => {});
              void document.querySelector('table').offsetWidth;
            });
            result.before = await nativeSnapshot(cdp, `${arm}-before`);
            for (let i = 0; i < 30; i++) await page.evaluate(() => { const table = document.querySelector('table'); table.hidden = true; void table.offsetWidth; table.hidden = false; void table.offsetWidth; });
            result.after = await nativeSnapshot(cdp, `${arm}-after`);
            assert.equal(result.after.MediaQueryFeatureExpNode, result.before.MediaQueryFeatureExpNode, '30 table lifecycles must not retain new native media queries');
            assert.equal(await page.$eval('thead', node => getComputedStyle(node).breakInside), 'auto', 'screen pagination stays unchanged');
            await page.emulateMedia({ media: 'print' });
            await page.waitForFunction(() => getComputedStyle(document.querySelector('thead')).breakInside === 'avoid');
            await page.emulateMedia({ media: 'screen' });
            await page.waitForFunction(() => getComputedStyle(document.querySelector('thead')).breakInside === 'auto');
            await page.evaluate(() => { window.__panel.dispose(); window.__panel = null; });
            result.disposed = await nativeSnapshot(cdp, `${arm}-disposed`);
            assert.equal(result.disposed.MediaQueryList, 0, 'disposing stats releases the owned media query/listener');
          }
          result.passed = true;
        } catch (error) { result.failure = error.stack; result.passed = false; }
      } finally { await context.close(); }
    }
    assert(process.env.M6_RETENTION_FIXTURE, 'run npm run test:retention to start the required server and generate a current legal save');
    report.cases.push(await require('./m6-retention-application.cjs')(browser, nativeSnapshot, {
      url, fixture: JSON.parse(fs.readFileSync(process.env.M6_RETENTION_FIXTURE, 'utf8')),
      progress: result => fs.writeFileSync(path.join(output, 'application-progress.json'), JSON.stringify(result, null, 2)),
    }));
    report.passed = report.cases.every(result => result.passed);
    if (!report.passed) process.exitCode = 1;
  } finally { await browser.close(); report.durationSeconds = (performance.now() - started) / 1000; fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); }
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
