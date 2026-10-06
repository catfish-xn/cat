/* Isolated causal probes, NOT lifecycle acceptance. Never used by compare-evidence. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const url = process.env.M6_DIAGNOSTIC_URL || 'http://127.0.0.1:4193';
assert.equal(new URL(url).hostname, '127.0.0.1', 'diagnostics only use a local build');
const output = process.env.M6_DIAGNOSTIC_OUTPUT || 'artifacts/m6-input-retention';
const fixture = process.env.M6_DIAGNOSTIC_LIFECYCLE_FIXTURE;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const nativeNames = ['UndoStep', 'MediaQueryFeatureExpNode', 'MediaQuerySet', 'MediaQuery', 'HTMLDocument'];

async function snapshot(cdp, file) {
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = await cdp.send('Runtime.getHeapUsage');
  const fd = fs.openSync(file, 'w');
  const onChunk = ({ chunk }) => fs.writeSync(fd, chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  try { await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }); }
  finally { cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk); fs.closeSync(fd); }
  const raw = fs.readFileSync(file);
  const graph = JSON.parse(raw);
  const meta = graph.snapshot.meta, width = meta.node_fields.length;
  const field = Object.fromEntries(meta.node_fields.map((name, i) => [name, i]));
  const counts = Object.fromEntries(nativeNames.map(name => [name, { count: 0, selfSize: 0 }]));
  for (let i = 0; i < graph.nodes.length; i += width) {
    if (meta.node_types[0][graph.nodes[i + field.type]] !== 'native') continue;
    const name = graph.strings[graph.nodes[i + field.name]].replace(/^blink::/, '');
    if (counts[name]) {
      counts[name].count++;
      counts[name].selfSize += graph.nodes[i + field.self_size];
    }
  }
  return { file: path.basename(file), sha256: sha256(raw), heap, native: counts };
}

module.exports = { snapshot };

if (require.main === module) (async () => {
  fs.mkdirSync(output, { recursive: true });
  const report = {
    diagnosticOnly: true, createdAt: new Date().toISOString(), applicationSourceSha: git('rev-parse', 'HEAD'),
    workingTree: git('status', '--porcelain'), driverSha256: sha256(fs.readFileSync(__filename)),
    node: process.version, url, warmup: 12, windows: 3, iterationsPerWindow: 30,
    buildHashes: Object.fromEntries(['dist/index.html', ...fs.readdirSync('dist/assets').filter(name => name.endsWith('.js')).map(name => `dist/assets/${name}`)].map(file => [file, sha256(fs.readFileSync(file))])),
    fixtureSha256: fixture ? sha256(fs.readFileSync(fixture)) : null,
    caveat: 'Fresh context per arm; heap snapshots perturb GC. Isolated actions, not the combined lifecycle acceptance or a frame-rate benchmark.',
    arms: [],
  };
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  report.browser = browser.version();
  try {
    for (const name of fixture ? ['import-only', 'replay-only', 'new-match-only'] : ['seed-fill-repeat', 'seed-fill-once', 'replay-role-query']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      try {
        const page = await context.newPage();
        const arm = { name, errors: [], snapshots: [] };
        report.arms.push(arm);
        page.on('pageerror', error => arm.errors.push(error.message));
        page.on('dialog', async dialog => { await dialog.accept(); });
        await page.goto(url);
        await page.waitForFunction(() => window.__CAT_DEBUG__ && !document.querySelector('[data-debug="m6-seed-input"]').disabled);
        const seed = page.locator('[data-debug="m6-seed-input"]');
        await seed.fill('42');
        const importSave = async () => {
          const epoch = await page.evaluate(() => window.__CAT_DEBUG__.read().m6.token?.activationEpoch);
          await page.locator('[data-debug="m6-import"]').setInputFiles(fixture);
          await page.waitForFunction(previous => {
            const m6 = window.__CAT_DEBUG__.read().m6;
            return m6.mode === 'active' && m6.token?.activationEpoch !== previous;
          }, epoch);
        };
        if (fixture) await importSave();
        const iteration = async () => {
          if (name === 'seed-fill-repeat') await seed.fill('42');
          else if (name === 'seed-fill-once') assert.equal(await seed.inputValue(), '42');
          else if (name === 'replay-role-query') await page.locator('#replay-root').getByRole('button', { name: '返回当前局', exact: true }).count();
          else if (name === 'import-only') await importSave();
          else if (name === 'replay-only') {
            await page.getByLabel('选择已完成战斗').selectOption('0');
            await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'replay');
            await page.locator('#replay-root').getByRole('button', { name: '返回当前局', exact: true }).click();
            await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6.mode === 'active');
          } else {
            const run = await page.evaluate(() => window.__CAT_DEBUG__.read().m6.runId);
            await page.locator('[data-debug="m6-fixed-start"]').click();
            await page.waitForFunction(previous => window.__CAT_DEBUG__.read().m6.runId !== previous, run);
            while (await page.evaluate(() => window.__CAT_DEBUG__.read().state.phase === 'choice')) {
              const offer = await page.evaluate(() => window.__CAT_DEBUG__.read().state.pendingChoice.offers[0]);
              await page.locator(`[data-debug="choice:${offer}"]`).click();
            }
            await page.waitForFunction(() => !document.querySelector('.choice-overlay.dismissal-shield'));
          }
        };
        for (let i = 0; i < 12; i++) await iteration();
        const before = await page.evaluate(() => window.__CAT_DEBUG__.read().state);
        const cdp = await context.newCDPSession(page);
        await cdp.send('HeapProfiler.enable');
        for (let window = 0; window <= 3; window++) {
          if (window) for (let i = 0; i < 30; i++) await iteration();
          const sample = await snapshot(cdp, path.join(output, `${name}-${window * 30}.heapsnapshot`));
          sample.iterations = window * 30;
          arm.snapshots.push(sample);
          console.log(JSON.stringify({ arm: name, iterations: sample.iterations, native: sample.native }));
        }
        assert.deepEqual(await page.evaluate(() => window.__CAT_DEBUG__.read().state), before, 'probes preserve game state');
        assert.deepEqual(arm.errors, []);
      } finally { await context.close(); }
    }
    report.completed = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    await browser.close();
    fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
  }
})();
