/* F4: require M6 product evidence from the same clean commit as the M5 gates. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { sourceFingerprint } = require('./m5-evidence.cjs');
const { hash } = require('./m4-evidence.cjs');
// This frozen constants module contains only JavaScript-compatible declarations.
// Read its values directly so the evidence checker cannot define a second budget.
const limits = require('node:vm').runInNewContext(fs.readFileSync('src/m6/limits.ts', 'utf8').replace(/^export /gm, '') + '\n({PERFORMANCE_BUDGET_MS, LIFECYCLE_CYCLES, MAX_POST_GC_HEAP_GROWTH_BYTES, MIN_PIECE_DIAMETER_CSS, MIN_DOM_TARGET_CSS, MAX_HORIZONTAL_OVERFLOW_CSS})');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const fingerprint = sourceFingerprint();
const records = [];
function read(folder) {
  const file = `artifacts/${folder}/manifest.json`;
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(report.passed, true, `${folder} failed`);
  assert.equal(report.sha, sha, `${folder} commit mismatch`);
  assert.equal(report.dirty ?? report.status, '', `${folder} requires clean committed sources`);
  assert.equal(report.sourceFingerprint, fingerprint, `${folder} source mismatch`);
  assert.equal(report.finalSourceFingerprint, fingerprint, `${folder} source changed during verification`);
  if (report.errors) assert.deepEqual(report.errors, [], `${folder} browser errors`);
  records.push({ folder, sha, sourceFingerprint: fingerprint, manifestHash: hash(fs.readFileSync(file, 'utf8')), passed: true });
  return report;
}
for (const mode of ['dev', 'preview']) {
  const route = read(`m5-${mode}-cannon`);
  assert.equal(route.m6RoundTrip?.sameRunIdNewEpoch, true, 'third battle file/refresh continuation');
  assert.equal(route.m6Replay?.isolated, true, 'previous two battles read-only replay');
  for (const key of ['quotaObserved', 'switchedBattleWithoutWrite', 'durableRevisionUnchanged', 'activeSavingRecovered'])
    assert.equal(route.m6ReplayFailureIsolation?.[key], true, `quota/replay failure isolation: ${key}`);
  assert.equal(typeof route.m6ReplayFailureIsolation.visibilityCoverage, 'string');
  assert.equal(route.m6RejectedImport?.atomic, true, 'invalid history preserves active and durable state');
  assert.equal(route.m6Seeds?.newIdentity, true, 'public seed controls');
  assert.deepEqual(route.m6Seeds.boundaries, [0, 42, 4294967295]);
  for (const key of ['accepted', 'rngChanged', 'completeStateAndLedgerEqual'])
    assert.equal(route.m6Seeds.publicCommandSequence?.[key], true, `random/fixed same-command reproduction: ${key}`);
  assert.equal(route.m6Lifecycle?.cycles, limits.LIFECYCLE_CYCLES, 'full application lifecycle cycles');
  assert.equal(route.m6Lifecycle.rows.length, limits.LIFECYCLE_CYCLES);
  assert(route.m6Lifecycle.heapDelta <= limits.MAX_POST_GC_HEAP_GROWTH_BYTES, 'full application post-GC heap');
  assert.equal(route.m6Lifecycle.afterResources.listeners, route.m6Lifecycle.beforeResources.listeners, 'full application listener cleanup');
  assert(route.m6Lifecycle.afterResources.pendingRaf <= route.m6Lifecycle.beforeResources.pendingRaf + 1, 'full application frame scheduler cleanup');
  const layout = read(`m6-layout-${mode}`);
  assert.deepEqual(layout.rows.map(r => [r.width, r.height]), [[1440, 1000], [1440, 600], [390, 844], [844, 390], [360, 640]]);
  for (const row of layout.rows) {
    assert.equal(row.seed, 42);
    assert.equal(row.contentDigest, route.versions.contentDigest);
    assert.equal(row.overflow, limits.MAX_HORIZONTAL_OVERFLOW_CSS);
    assert(row.pieceDiameterCSS >= limits.MIN_PIECE_DIAMETER_CSS);
    assert(row.minTargetWidth >= limits.MIN_DOM_TARGET_CSS && row.minTargetHeight >= limits.MIN_DOM_TARGET_CSS);
    assert.equal(row.badTargets.length, 0);
    assert.equal(row.choiceFocusTrapped, true);
    assert.deepEqual(row.errors, []);
    assert(row.nativeInputs.length > 0 && row.nativeInputs.every(e => e.trusted));
  }
  assert.equal(layout.rotation?.cancelPreserved, true);
  assert.equal(layout.rotation?.normalReleasePaired, true);
}
const storage = read('m6-storage');
for (const name of [
  'initial activation exact envelope', 'bad JSON rejected', 'bare M5 rejected',
  'boundary failures never reach history validator', 'invalid candidates preserve durable baseline',
  'export/parse legal initial state round trip', 'valid envelope calls history validator exactly once',
  'oversize rejected before text read', 'two connections exactly one CAS writer wins',
  'losing concurrent writer reports conflict', 'same runId activation changes epoch and revision',
  'old same-run queued write cannot overwrite import (conflict)', 'native IDB transaction abort (abort)',
  'abort preserves pointer and last valid save', 'old-run write cannot win after new activation (conflict)',
  'current pointer remains new run', 'quota failure reports quota (quota)',
  'quota failure preserves complete last valid save', 'export available after storage failure',
  'three actual completed runs retained', 'fourth archive transaction abort (abort)',
  'failed fourth archive preserves current', 'failed fourth archive does not evict oldest',
  'fourth archive success evicts exactly oldest', 'oldest completed run removed (validation)',
  'retained completed archive and full events unchanged',
  'immutable completed record cannot be overwritten (validation)', 'immutable-record rejection fully rolls back',
]) assert(storage.results.includes(name), `missing native IndexedDB case: ${name}`);
assert.equal(storage.results.filter(name => name === 'format/schema/digest/runtime rejected').length, 5);
const failures = read('m6-application-failures');
const unavailable = failures.results.G04_unavailable_open_public_play_and_same_tick_export;
assert.equal(unavailable?.passed, true, 'initial storage unavailability');
assert.equal(unavailable.tick, 40);
assert.equal(unavailable.wholeMatchAndLedgerEqual, true);
assert(Number.isSafeInteger(unavailable.nextEventSeq) && unavailable.nextEventSeq > 0);
const phases = failures.results.G02_all_phase_native_roundtrip_and_exact_next_transition;
assert.equal(phases?.passed, true, 'all-phase application save/continue matrix');
assert.deepEqual(phases.samples.map(row => row.phase).sort(), [
  'initial_component_0', 'initial_component_1', 'augment', 'anomaly_target', 'anomaly_offer',
  'preparation', 'combat_39', 'combat_40', 'combat_41', 'settlement',
  'supply_settlement', 'reward_choice', 'game_over',
].sort());
assert(phases.samples.every(row => row.passed));
const archive = failures.results.ROOT_03_same_run_completion_archive_refresh;
assert.equal(archive?.passed, true);
assert.equal(archive.displayedBattles, 90);
assert.equal(archive.currentBattles, 30);
assert.deepEqual(archive.durableRunIds, [failures.fixture.ids.C, failures.fixture.ids.D, failures.fixture.ids.A]);
assert.deepEqual(archive.live, { applications: 1, sessions: 1, observers: 1 });
for (const key of ['ROOT_04_initialize_dispose_then_idb_abort', 'ROOT_04_import_dispose_then_file_failure', 'ROOT_04_candidate_dispose_then_activation_abort']) {
  const result = failures.results[key];
  assert.equal(result?.passed, true, key);
  assert.deepEqual(result.lateHooks, []);
  assert.deepEqual(result.unhandled, []);
  assert.deepEqual(result.live, { applications: 0, sessions: 0, observers: 0 });
  assert.equal(result.saveChildren, 0);
}
const performance = read('m6-performance');
const expectedGates = {
  capture: ['p95', 'incrementalCaptureP95'], write: ['p95', 'incrementalWriteP95'],
  fullCapture: ['p95', 'fullCaptureP95'], activation: ['max', 'activationWriteP95'],
  completeImport: ['max', 'completeImport'], firstSeek: ['max', 'firstSeek'],
  cachedSeek: ['max', 'cachedSeek'], statsBatch: ['max', 'stats40TickBatch'],
};
assert.equal(performance.measurements.gates.length, Object.keys(expectedGates).length);
for (const [name, [metric, budget]] of Object.entries(expectedGates)) {
  const matching = performance.measurements.gates.filter(g => g.name === name);
  assert.equal(matching.length, 1, `${name} must have exactly one gate`);
  const gate = matching[0], samples = performance.measurements.summary[name].samples;
  assert(samples.length > 0 && samples.every(Number.isFinite), `${name} real samples`);
  const minimumSamples = ['capture', 'write', 'fullCapture', 'activation', 'cachedSeek'].includes(name) ? 12 : ['completeImport', 'firstSeek'].includes(name) ? 3 : 1;
  assert(samples.length >= minimumSamples, `${name} measured sample count`);
  const ordered = [...samples].sort((a, b) => a - b);
  const actual = metric === 'max' ? ordered.at(-1) : ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * .95))];
  assert.equal(gate.metric, metric);
  assert.equal(gate.ceiling, limits.PERFORMANCE_BUDGET_MS[budget], `${name} frozen ceiling`);
  assert.equal(gate.actual, actual, `${name} sample-derived result`);
  assert.equal(gate.passed, true);
  assert(actual <= gate.ceiling, `${name} exceeds frozen budget`);
}
assert(performance.fullLoadCoverage.some(load => load.players === 9 && load.enemies === 8 && load.equipped === 15), 'same measured legal full-load scenario');
assert.equal(performance.measurements.fullLoadRoundTrip?.verified, true);
assert.equal(performance.measurements.fullLoadRoundTrip.battles, 30);
assert(performance.measurements.fullLoadRoundTrip.milliseconds <= limits.PERFORMANCE_BUDGET_MS.completeImport, 'full-load import/activation roundtrip budget');
assert.equal(performance.lifecycle.cycles, limits.LIFECYCLE_CYCLES);
assert.equal(performance.lifecycle.extraListeners, 0);
assert.equal(performance.lifecycle.remainingComponentRoots, 0);
assert(performance.lifecycle.heapDeltaBytes <= limits.MAX_POST_GC_HEAP_GROWTH_BYTES);
fs.writeFileSync('artifacts/m6-final-comparison.json', JSON.stringify({ sha, sourceFingerprint: fingerprint, records, passed: true }, null, 2));
console.log(JSON.stringify({ sha, manifests: records.length, passed: true }));
