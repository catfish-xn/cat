// Experiment evidence only. Never substitute this output for full CI acceptance.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = process.argv[2] ?? 'artifacts/warmup';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const refs = { 'm6-main': 'a8be9fc151b9ebb895eb4097828bb74c590e2559', m7: '67527610063802d995c4f95044d82c7ad4afe9dc' };
const report = { experimentOnly: true, warmupCycles: 12, measuredCycles: 30, ceilingBytes: 1024 * 1024,
  runId: process.env.GITHUB_RUN_ID ?? null, harnessSha: process.env.GITHUB_SHA ?? null, samples: [], errors: [], passed: false };
const driverHash = hash(fs.readFileSync('scripts/verify-m5-browser.cjs'));
for (const [revision, sha] of Object.entries(refs)) for (const mode of ['dev', 'preview']) {
  const name = `warmup-${revision}-${mode}`, folder = path.join(root, name);
  const sample = { revision, mode, sha };
  report.samples.push(sample);
  try {
    const read = name => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
    const provenance = read('provenance.json'), manifest = read('manifest.json');
    const measured = read('m6-lifecycle.json'), trend = read('m6-heap-trend.json');
    Object.assign(sample, { provenance, measured, trend, sourceFingerprint: manifest.sourceFingerprint,
      node: manifest.node, browser: manifest.browser, cpu: manifest.cpu, manifestHash: hash(fs.readFileSync(path.join(folder, 'manifest.json'))) });
    assert.equal(provenance.targetSha, sha);
    assert.equal(provenance.targetCleanBeforeDriver, true);
    assert.equal(provenance.driverSha256, driverHash, 'same measurement driver for every target');
    if (report.harnessSha) assert.equal(provenance.harnessSha, report.harnessSha);
    assert.equal(manifest.sha, sha);
    assert.equal(manifest.mode, mode);
    assert.equal(manifest.sourceFingerprint, manifest.finalSourceFingerprint, 'application sources unchanged');
    assert.equal(manifest.status, '?? scripts/.m7-warmup-experiment.cjs', 'only the disclosed experiment driver is untracked');
    assert.equal(measured.warmupExperiment, true);
    assert.equal(measured.heapDiagnostics, false);
    assert.equal(measured.warmupCycles, 12);
    assert.equal(measured.cycles, 30);
    assert.equal(measured.rows.length, 30);
    assert.equal(measured.heapDelta, measured.afterHeap.usedSize - measured.beforeHeap.usedSize);
    assert(measured.heapDelta <= report.ceilingBytes, 'first measured window <=1MiB');
    assert.equal(trend.warmupCycles, 12);
    assert.equal(trend.cyclesPerWindow, 30);
    assert.equal(trend.heapDiagnostics, false);
    assert.equal(trend.windows.length, 3);
    assert.deepEqual(trend.windows[0].beforeHeap, measured.beforeHeap);
    assert.deepEqual(trend.windows[0].afterHeap, measured.afterHeap);
    for (let i = 0; i < trend.windows.length; i++) {
      const window = trend.windows[i];
      assert.equal(window.window, i + 1);
      assert.equal(window.cycles, 30);
      if (i) assert.deepEqual(window.beforeHeap, trend.windows[i - 1].afterHeap);
      assert.equal(window.heapDelta, window.afterHeap.usedSize - window.beforeHeap.usedSize);
      assert(window.heapDelta <= report.ceilingBytes, 'follow-up window <=1MiB');
      assert.equal(window.afterResources.listeners, measured.beforeResources.listeners);
      assert(window.afterResources.pendingRaf <= measured.beforeResources.pendingRaf + 1);
    }
    const persistent = trend.windows.every(window => window.heapDelta > 0);
    assert.equal(trend.persistentGrowth, persistent);
    assert(!persistent, 'three growing windows: investigate as a potential real leak');
    assert.deepEqual(manifest.errors, []);
    assert.equal(manifest.passed, true);
    sample.passed = true;
  } catch (error) {
    sample.passed = false;
    sample.error = String(error.stack);
    report.errors.push(`${name}: ${error.message}`);
  }
}
report.passed = report.errors.length === 0 && report.samples.length === 4;
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/warmup-comparison.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, samples: report.samples.map(({ revision, mode, measured, trend, passed, error }) =>
  ({ revision, mode, heapDelta: measured?.heapDelta, windows: trend?.windows.map(window => window.heapDelta), passed, error })), errors: report.errors }, null, 2));
if (!report.passed) process.exitCode = 1;
