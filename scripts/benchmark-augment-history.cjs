/* Fresh-process seed230 whole-route comparison. No production instrumentation,
 * no oracle substitutions. Baseline is loaded from a read-only Git blob.
 * node scripts/benchmark-augment-history.cjs before|after [--count] [--production-only]
 * Timings exclude module loading, include createMatch through gameOver and all
 * existing route/oracle assertions. --count is a separate instrumented run. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..'), mode = process.argv[2], count = process.argv.includes('--count');
const productionOnly = process.argv.includes('--production-only');
assert(['before', 'after'].includes(mode));
assert(process.argv.slice(3).every(arg => ['--count', '--production-only'].includes(arg)));
const base = '4baaaf5a9a74335d46fa0e037a93e4e595f05384';
const metrics = { appends: 0, appendCopies: 0, deathScanVisits: 0, boundaryScanVisits: 0, terminalRowVisits: 0,
  preparationScanVisits: 0, indexVisits: 0, materializedFacts: 0 };
globalThis.__histperf = metrics;
function replace(source, from, to) { assert(source.includes(from), `Instrumentation anchor: ${from}`); return source.replace(from, to); }
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root, configFile: false, cacheDir: 'artifacts/histperf/vite-cache',
    server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom',
    plugins: [{ name: 'histperf-read-only-baseline', enforce: 'pre', transform(source, id) {
      if (id === path.join(root, 'src/simulation/augment-history.ts') && mode === 'before') {
        source = execFileSync('git', ['show', `${base}:src/simulation/augment-history.ts`], { encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
        if (count) {
          source = replace(source, 'return { ...s, augmentHistory: { ...s.augmentHistory, facts: [...s.augmentHistory.facts, row] } };',
            'globalThis.__histperf.appends++; globalThis.__histperf.appendCopies += s.augmentHistory.facts.length; return { ...s, augmentHistory: { ...s.augmentHistory, facts: [...s.augmentHistory.facts, row] } };');
          source = replace(source, 'const deathRows = next.augmentHistory!.facts.filter', 'globalThis.__histperf.deathScanVisits += next.augmentHistory!.facts.length; const deathRows = next.augmentHistory!.facts.filter');
          source = replace(source, 'const recorded = new Set(after.combat?.status', 'globalThis.__histperf.terminalRowVisits += after.combat?.status === "finished" ? deathRows.length : 0; const recorded = new Set(after.combat?.status');
          source = replace(source, "const boundaryRecorded = deathRows.some(f => f.kind === 'deaths' && f.completeThroughTick === after.combat?.tick);",
            "const boundaryRecorded = deathRows.some(f => (globalThis.__histperf.boundaryScanVisits++, f.kind === 'deaths' && f.completeThroughTick === after.combat?.tick));");
          source = replace(source, 'const fact=s.augmentHistory?.facts.filter', 'globalThis.__histperf.preparationScanVisits += s.augmentHistory?.facts.length ?? 0; const fact=s.augmentHistory?.facts.filter');
          source = replace(source, "const last = s.augmentHistory?.facts.filter(f => f.kind === 'preparation-time'", "globalThis.__histperf.preparationScanVisits += s.augmentHistory?.facts.length ?? 0; const last = s.augmentHistory?.facts.filter(f => f.kind === 'preparation-time'");
        }
        return source;
      }
      if (count && mode === 'after' && id === path.join(root, 'src/simulation/append-only-log.ts')) {
        source = replace(source, 'return { entries: values.slice(), length: values.length };', "if (values[0]?.kind) globalThis.__histperf.appendCopies += values.length; return { entries: values.slice(), length: values.length };");
        source = replace(source, 'entries.push(value);', 'if (value.kind) { globalThis.__histperf.appends++; if (before.length !== before.entries.length) globalThis.__histperf.appendCopies += before.length; } entries.push(value);');
        source = replace(source, 'values = log.entries.slice(0, log.length);', 'if (log.entries[0]?.kind) globalThis.__histperf.materializedFacts += log.length; values = log.entries.slice(0, log.length);');
        return source;
      }
      if (count && mode === 'after' && id === path.join(root, 'src/simulation/augment-history-log.ts'))
        return replace(source, 'const fact = log.entries[index.through];', 'globalThis.__histperf.indexVisits++; const fact = log.entries[index.through];');
    } }],
  });
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const serialization = await server.ssrLoadModule('/src/simulation/serialization.ts');
    let commandMs = 0;
    const measured = Object.fromEntries(Object.entries(api).map(([key, fn]) => [key, typeof fn !== 'function' ? fn : (...args) => {
      const start = performance.now(); try { return fn(...args); } finally { commandMs += performance.now() - start; }
    }]));
    const directory = path.join(root, 'artifacts/histperf'); fs.mkdirSync(directory, { recursive: true });
    const driver = require('./generate-m5-route.cjs');
    const commands = productionOnly ? JSON.parse(fs.readFileSync(path.join(directory, 'commands.json'), 'utf8')) : undefined;
    const started = performance.now();
    let route;
    if (productionOnly) {
      // Same complete baseline transcript, public commands only, including every
      // combat tick. This separate measurement isolates production from oracle
      // reads of the complete fact array; the normal run retains all assertions.
      let state = measured.createMatch(230), ticks = 0;
      const finish = () => { while (state.phase === 'combat') { const result = measured.stepMatch(state); assert.notEqual(result.ok, false); state = result.state; ticks++; } };
      for (const command of commands) { finish(); const result = driver.dispatch(measured, state, command); assert.notEqual(result.ok, false, result.reason); state = result.state; }
      finish();
      route = { final: state, summary: { ticks, commands: commands.length } };
    } else route = await driver.run(measured, { seed: 230, build: 'cannon' });
    const elapsedMs = performance.now() - started;
    const routeMetrics = { ...metrics };
    console.error(JSON.stringify({ phase: 'route-complete', mode, count, productionOnly, elapsedMs, commandMs, ...(count ? { metrics: routeMetrics } : {}) }));
    const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
    const { durationSeconds, tickTimingMs, ...summary } = route.summary;
    const result = { mode, count, productionOnly, node: process.version, base, elapsedMs, commandMs, summary,
      facts: route.final.augmentHistory.facts.length, deaths: route.final.augmentHistory.facts.filter(f => f.kind === 'deaths').length,
      finalHash: hash(route.final), saveHash: count ? null : hash(serialization.serializeMatch(route.final)), actionsHash: hash(route.actions ?? commands),
      roundsHash: route.rounds ? hash(route.rounds) : null, ledgerHash: route.ledger ? hash(route.ledger) : null, ...(count ? { metrics: routeMetrics } : {}) };
    assert.equal(route.final.phase, 'gameOver'); assert.equal(route.final.roundDefinitionId, '6-7');
    assert.equal(result.facts, 9863); assert.equal(result.deaths, 9637); assert.equal(summary.ticks, 10661);
    const suffix = `${productionOnly ? '-production' : ''}${count ? '-count' : ''}`;
    if (!productionOnly) fs.writeFileSync(path.join(directory, 'commands.json'), JSON.stringify(route.actions.map(action => action.command)) + '\n');
    else assert.equal(result.finalHash, JSON.parse(fs.readFileSync(path.join(directory, 'before.json'), 'utf8')).finalHash, 'complete baseline transcript final bytes');
    if (mode === 'after') {
      const before = JSON.parse(fs.readFileSync(path.join(directory, `before${suffix}.json`), 'utf8'));
      for (const key of ['summary', 'facts', 'deaths', 'finalHash', 'saveHash', 'actionsHash', 'roundsHash', 'ledgerHash']) assert.deepEqual(result[key], before[key], key);
    }
    fs.writeFileSync(path.join(directory, `${mode}${suffix}.json`), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally { await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
