/* F4: require M6 product evidence from the same clean commit as the M5 gates. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { sourceFingerprint, applicationHeapCeilingBytes, applicationHeapGate, warnApplicationHeap } = require('./m5-evidence.cjs');
const { hash } = require('./m4-evidence.cjs');
// This frozen constants module contains only JavaScript-compatible declarations.
// Read module budgets directly; full-application mode limits use the shared policy.
const limits = require('node:vm').runInNewContext(fs.readFileSync('src/m6/limits.ts', 'utf8').replace(/^export /gm, '') + '\n({PERFORMANCE_BUDGET_MS, LIFECYCLE_CYCLES, MAX_POST_GC_HEAP_GROWTH_BYTES, MIN_PIECE_DIAMETER_CSS, MIN_DOM_TARGET_CSS, MAX_HORIZONTAL_OVERFLOW_CSS, MAX_BATTLE_RECORDS})');
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
  records.push({ folder, sha, sourceFingerprint: fingerprint, manifestHash: hash(fs.readFileSync(file, 'utf8')), acceptanceScope: report.acceptanceScope ?? 'unchanged original gate', skipped: report.skipped ?? [], fullApplicationRoutePassed: report.fullApplicationRoutePassed ?? null, passed: true });
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
  assert.equal(route.m6Seeds.invalidPreserved, 6, 'public invalid seeds include NaN');
  for (const key of ['accepted', 'rngChanged', 'completeStateAndLedgerEqual'])
    assert.equal(route.m6Seeds.publicCommandSequence?.[key], true, `random/fixed same-command reproduction: ${key}`);
  assert.equal(route.m6Lifecycle?.cycles, limits.LIFECYCLE_CYCLES, 'full application lifecycle cycles');
  assert.notEqual(route.m6Lifecycle.heapDiagnostics, true, 'heap snapshot diagnostics cannot replace final lifecycle evidence');
  assert.notEqual(route.m6Lifecycle.warmupExperiment, true, 'warmup experiments cannot replace final lifecycle evidence');
  assert.equal(route.m6Lifecycle.warmupCycles ?? 2, 2, 'production warmup method remains frozen pending adoption');
  assert.equal(route.m6Lifecycle.rows.length, limits.LIFECYCLE_CYCLES);
  assert.equal(route.mode, mode, 'full application measurement mode');
  assert.equal(route.m6Lifecycle.heapCeilingBytes, applicationHeapCeilingBytes(mode), 'full application recorded heap ceiling');
  const heapGate = applicationHeapGate(mode, route.m6Lifecycle.beforeHeap, route.m6Lifecycle.afterHeap);
  assert.equal(route.m6Lifecycle.heapDelta, heapGate.deltaBytes, 'full application heap delta matches raw readings');
  assert.deepEqual(route.m6Lifecycle.heapGate, heapGate, 'full application heap warning matches measured overrun');
  warnApplicationHeap(route.m6Lifecycle.heapGate);
  assert.equal(route.m6Lifecycle.afterResources.listeners, route.m6Lifecycle.beforeResources.listeners, 'full application listener cleanup');
  assert(route.m6Lifecycle.afterResources.pendingRaf <= route.m6Lifecycle.beforeResources.pendingRaf + 1, 'full application frame scheduler cleanup');
  for(const key of ['sameBattle','fullStateLedgerRevisionPreserved','nativeKeyboard','durableRevisionUnchanged'])assert.equal(route.m6ReplayReopen?.[key],true,`same-battle native reopen: ${key}`);
  const nativeInput=read(`m5-input-${mode}`);
  for(const edge of ['left','right','top'])for(const suffix of ['exit-clears-hover','reentry-restores-hover-sale'])assert(nativeInput.interactions.some(row=>row.name===`native-viewport-${edge}-${suffix}`),`missing native viewport ${edge} ${suffix}`);
  for(const selection of ['explicit-selected','dragging'])assert(nativeInput.interactions.some(row=>row.name===`native-viewport-exit-preserves-${selection}-sale`),`missing viewport ${selection} preservation`);
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
assert.equal(phases?.status, 'passed', 'application phase results cover every phase (B9: no deferral)');
// B8 restored the opening (1-3/1-4) and post-PvE loot picks; B9 restored the full terminal import.
const livePhases=['opening_choice_1-3','opening_choice_1-4','post_pve_choice','augment','anomaly_target','anomaly_offer','preparation','combat_39','combat_40','combat_41','settlement','supply_settlement','supply_choice','game_over'];
assert.deepEqual(phases.samples.map(row=>row.phase).sort(),[...livePhases].sort(),'unknown missing or extra phase sample');
for(const phase of livePhases)assert.equal(phases.samples.find(row=>row.phase===phase)?.passed,true,`${phase}: real application roundtrip`);
assert.deepEqual(failures.skipped??[],[],'application failure gate may not defer any case after B9');
const catalogBattles=failures.fixture.battles;
assert.equal(catalogBattles,limits.MAX_BATTLE_RECORDS,'fixture route fills the catalog capacity');
const archive = failures.results.ROOT_03_same_run_completion_archive_refresh;
assert.equal(archive?.passed, true);
assert.equal(archive.displayedBattles, 3*catalogBattles);
assert.equal(archive.currentBattles, catalogBattles);
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
for(const [key,sameRun] of [['P2_stale_archive_success_after_new_run',false],['P2_stale_archive_reject_after_same_run_new_epoch',true]]){
 const result=failures.results[key];assert.equal(result?.passed,true,key);assert.equal(result.fullStateLedgerStatusRevisionEqual,true);assert.equal(result.optionsUnchanged,true);assert.equal(result.sameRunNewEpoch,sameRun);
}
const r4=failures.results.R4_inflight_combat_then_pending_terminal_commit;
assert.equal(r4?.passed,true,'in-flight combat write followed by pending terminal commit');
assert.equal(r4.inflightTick,80);assert.equal(r4.terminalTick,failures.fixture.finalEndTick);assert(r4.terminalTick>80&&r4.terminalTick<120,'one periodic save before the real terminal tick');
assert.equal(r4.pendingTerminalCount,1);assert.equal(r4.actualNativeTransactions,2);
assert.equal(r4.oldCommitRefreshCount,0);assert.equal(r4.finalCommitRefreshCount,1);assert.equal(r4.displayedBattles,3*catalogBattles);
assert.deepEqual(r4.durableRunIds,[failures.fixture.ids.C,failures.fixture.ids.D,failures.fixture.ids.A]);
for(const key of ['completeTerminalSnapshotEqual','savedWithoutFalseFailure','revisionAdvancedExactlyTwice','saveControlsSuccess','allRefreshesSettled'])assert.equal(r4[key],true,`R4 ${key}`);
const performance = read('m6-performance');
assert.deepEqual(performance.routes.map(route=>route.build),['cannon','sniper','mage','sniper-caitlyn','full-load'],'all five original workload policies participate');
assert.deepEqual(performance.skipped??[],[],'no performance workload deferral after B9 (issue #23)');
assert.deepEqual(performance.measurements.deferredMetrics,[],'every original performance metric is measured');
assert.deepEqual(performance.measurements.skipped,[],'no deferred measurement callback');
assert.equal(performance.measurements.completeBattleCount,limits.MAX_BATTLE_RECORDS,'complete payload is the full catalog run');

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
  const gate=matching[0];
  const verifyOriginalGate=()=>{
   const samples = performance.measurements.summary[name].samples;
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
  };
  verifyOriginalGate();
}
// Restored after B8: the measured full-load route really reaches the F1 maximal load.
assert(performance.fullLoadCoverage.some(load => load.players === 9 && load.enemies === 8 && load.equipped === 15), 'same measured legal full-load scenario');
assert(Array.isArray(performance.fullLoadObserved)&&performance.fullLoadObserved.length>0,'actual fifth-route load observations retained');
assert.equal(performance.measurements.fullLoadRoundTrip?.verified, true);
assert.equal(performance.measurements.fullLoadRoundTrip.battles, performance.measurements.completeBattleCount);
assert(performance.measurements.fullLoadRoundTrip.milliseconds <= limits.PERFORMANCE_BUDGET_MS.completeImport, 'full-load import/activation roundtrip budget');
assert.equal(performance.lifecycle.cycles, limits.LIFECYCLE_CYCLES);
assert.equal(performance.lifecycle.extraListeners, 0);
assert.equal(performance.lifecycle.remainingComponentRoots, 0);
assert(performance.lifecycle.heapDeltaBytes <= limits.MAX_POST_GC_HEAP_GROWTH_BYTES);
// The final SHA cannot be embedded in its own committed documentation. Produce
// an actual same-SHA report only after both complete evidence comparisons pass.
const original = JSON.parse(fs.readFileSync('artifacts/m5-cross-mode-comparison.json', 'utf8'));
assert.equal(original.length, 3);
assert(original.every(row => row.passed && row.sha === sha && row.evidenceClass === 'final-clean-commit'));
const commands = [];
for (const folder of fs.readdirSync('artifacts').filter(name => name.startsWith('m5-ci-timing-')).sort()) {
  for (const name of fs.readdirSync(`artifacts/${folder}`).filter(name => name.endsWith('.json')).sort()) {
    const step = JSON.parse(fs.readFileSync(`artifacts/${folder}/${name}`, 'utf8'));
    assert.equal(step.sha, sha, `${folder}/${name} timing commit`);
    assert.equal(step.exitCode, 0, `${folder}/${name} command failed`);
    assert.equal(step.signal, null, `${folder}/${name} interrupted command`);
    commands.push(step);
  }
}
assert.equal(new Set(commands.map(step => step.job)).size, 9, 'all nine execution jobs recorded');
const sample = commands[0].job.match(/sample\d+$/)?.[0];
assert(sample && commands.every(step => step.job.endsWith(sample)), 'one consistent CI sample');
const requireSteps = (job, steps) => {
  for (const name of steps) assert(commands.some(step => step.job === job && step.step === name), `${job} missing ${name} timing`);
};
requireSteps(`test-and-build-${sample}`, ['install', 'tests', 'build', 'headless', 'performance']);
for (const mode of ['dev', 'preview']) {
  for (const build of ['cannon', 'sniper', 'mage']) requireSteps(`browser-${mode}-${build}-${sample}`, ['install', 'browser-install', 'build', 'route']);
  requireSteps(`input-${mode}-${sample}`, ['install', 'browser-install', 'build', 'input', 'touch-route', 'm6-layout',
    ...(mode === 'dev' ? ['m6-storage', 'm6-components', 'm6-performance', 'm6-retry', 'm6-application-failures'] : [])]);
}
const normalRoutes = ['dev', 'preview'].flatMap(mode => ['cannon', 'sniper', 'mage', 'cannon-touch'].map(build => {
  const report = JSON.parse(fs.readFileSync(`artifacts/m5-${mode}-${build}/manifest.json`, 'utf8'));
  return { mode, build, durationSeconds: report.durationSeconds, browser: report.browser,
    manifestHash: hash(fs.readFileSync(`artifacts/m5-${mode}-${build}/manifest.json`, 'utf8')),
    cpu: report.cpu, cpuCount: report.cpuCount, node: report.node, memoryBytes: report.memoryBytes,
    versions: report.versions, seed: 42, fullApplicationRoutePassed: report.fullApplicationRoutePassed, completedBrowserRounds: report.completedBrowserRounds, skipped: report.skipped ?? [] };
}));
// B9: every browser route ran the whole catalog in the real application; no manifest may skip anything.
for (const row of normalRoutes) {
  assert.equal(row.fullApplicationRoutePassed, true, `${row.mode}-${row.build}: full application route`);
  assert.equal(row.completedBrowserRounds?.length, limits.MAX_BATTLE_RECORDS, `${row.mode}-${row.build}: every catalog battle observed`);
}
for (const record of records) assert.deepEqual(record.skipped, [], `${record.folder}: no deferred check after B9`);
const audit = { sha, dirty: '', sourceFingerprint: fingerprint, generatedAt: new Date().toISOString(),
  goalHash: require('node:crypto').createHash('sha256').update(fs.readFileSync('M6_GOAL.md')).digest('hex'),
  m5ComparisonHash: hash(fs.readFileSync('artifacts/m5-cross-mode-comparison.json', 'utf8')),
  runId: process.env.GITHUB_RUN_ID ?? null, commands, normalRoutes, records,
  acceptanceScope: 'all M6 application, browser and performance gates at the catalog capacity (B9)', fullApplicationRoutePassed: true,
  skipped: [],
  performance: performance.measurements, moduleLifecycle: performance.lifecycle,
  applicationLifecycle: Object.fromEntries(['dev', 'preview'].map(mode => [mode,
    JSON.parse(fs.readFileSync(`artifacts/m5-${mode}-cannon/manifest.json`, 'utf8')).m6Lifecycle])),
  passed: true };
fs.writeFileSync('artifacts/m6-validation.json', JSON.stringify(audit, null, 2));
const commandRows = commands.map(step => `| ${step.job} | \`${[step.command, ...step.args].join(' ')}\` | ${step.durationSeconds} | 0 |`).join('\n');
const budgetRows = performance.measurements.gates.map(gate => `| ${gate.name} | ${gate.metric} | ${gate.actual} | ${gate.ceiling} | 通过 |`).join('\n');
const header = `# M6 同提交机器验证\n\n状态：本SHA的M6应用、浏览器完整33战路线与原F4性能门禁全部通过，无B8/B9跳过。这不代表用户最终验收，不自动合并。\n\nSHA：\`${sha}\`；dirty：空；sourceFingerprint：\`${fingerprint}\`；seed：42。完整版本/digest、Node/Chromium/硬件、实际命令与耗时、证据 hash 均见同包 \`m6-validation.json\`。\n`;
fs.writeFileSync('artifacts/M6_VALIDATION.md', `${header}\n## 实际命令\n\n| CI job | 命令 | 耗时秒 | 退出码 |\n|---|---|---:|---:|\n${commandRows}\n\n## 冻结性能预算\n\n| 项目 | 统计 | 实测ms | 冻结ms | 结果 |\n|---|---|---:|---:|---|\n${budgetRows}\n\n## 历史记录与限制\n\n以下为本提交文档中的历史记录；旧 SHA/dirty 结果保持历史身份。真实后台切换没有被合成 visibility 事件冒充；heap snapshot 诊断没有被最终门禁采用。\n\n${fs.readFileSync('docs/M6_VALIDATION.md', 'utf8')}`);
fs.writeFileSync('artifacts/M6_REVIEW.md', `${header}\n本报告适用M8新日程与B9正式容量。四条完整领域路线有独立账本与真实回放；浏览器三构筑与触摸路线在应用中跑完全部33战并逐快照比较，应用档案/竞争/末战提交场景与原性能门禁全部执行。下面保留的旧审查文字只属于各自历史SHA；本次范围和结果由同SHA的 \`m6-validation.json\` 和两项 comparison 决定。\n\n${fs.readFileSync('docs/M6_REVIEW.md', 'utf8')}`);
fs.writeFileSync('artifacts/m6-final-comparison.json', JSON.stringify({ sha, sourceFingerprint: fingerprint, acceptanceScope: audit.acceptanceScope, fullApplicationRoutePassed: true, skipped: [], records, passed: true }, null, 2));
console.log(JSON.stringify({ sha, manifests: records.length, acceptanceScope: audit.acceptanceScope, fullApplicationRoutePassed: true, skipped: [], passed: true }));
