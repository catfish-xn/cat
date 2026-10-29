/* Fresh-process baseline/optimized runs of the same public seed-230 route.
 * This driver supplies production trajectories, never oracle expectations.
 * Usage: node scripts/benchmark-h3-oracle.cjs baseline|optimized [output-dir]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2];
assert(['baseline', 'optimized'].includes(mode));
const output = path.resolve(process.argv[3] ?? 'artifacts/h3-oracle-fast');
fs.mkdirSync(output, { recursive: true });
if (!process.argv.includes('--child')) {
  for (let repetition = 1; repetition <= 3; repetition++) {
    const child = spawnSync(process.execPath, [__filename, mode, output, '--child', String(repetition)], { stdio: 'inherit' });
    assert.equal(child.status, 0, `${mode} repetition ${repetition}`);
  }
  if (mode === 'optimized') {
    const seconds = kind => [1, 2, 3].map(n => JSON.parse(fs.readFileSync(path.join(output, `${kind}-${n}.json`), 'utf8')).seconds);
    const median = values => [...values].sort((a, b) => a - b)[1];
    const baseline = seconds('baseline'), optimized = seconds('optimized');
    const comparison = { baseline, optimized, baselineMedian: median(baseline), optimizedMedian: median(optimized),
      speedup: median(baseline) / median(optimized), reductionPercent: 100 * (1 - median(optimized) / median(baseline)) };
    fs.writeFileSync(path.join(output, 'comparison.json'), JSON.stringify(comparison, null, 2));
    console.log(JSON.stringify(comparison));
  }
} else {
  (async () => {
    const oraclePath = require.resolve('../tests/fixtures/m5/h3-growth-oracle.cjs');
    const h3 = require(mode === 'baseline'
      ? '../tests/fixtures/m5/h3-growth-oracle-v25-baseline.cjs' : oraclePath);
    const verdicts = [];
    require.cache[oraclePath] = { id: oraclePath, filename: oraclePath, loaded: true, exports: {
      ...h3, auditH3: h3.auditH3 ?? ((memory, state) => { h3.checkH3Growth(memory, state, state); }),
      checkH3Growth(...args) {
        try { const next = h3.checkH3Growth(...args); verdicts.push('1'); return next; }
        catch (error) { verdicts.push(`0:${error.code}:${error.message}`); throw error; }
      },
    } };
    const { createServer } = await import('vite');
    const server = await createServer({ root, configFile: false, server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
    const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
    try {
      const api = await server.ssrLoadModule('/src/simulation/match.ts');
      const { run } = require('./generate-m5-route.cjs');
      const started = performance.now();
      let route, error;
      try { route = await run(api, { seed: 230, build: 'cannon', onRound(state) {
        console.error(`${mode}-${process.argv.at(-1)} ${state.roundDefinitionId} ${(performance.now() - started).toFixed(0)} ms`);
      } }); }
      catch (e) { error = { code: e.code, message: e.message }; }
      const seconds = (performance.now() - started) / 1000;
      const repetition = Number(process.argv.at(-1));
      const result = { mode, repetition, seconds, node: process.version, verdicts: verdicts.join(''), error: error ?? null };
      if (route) {
        const { durationSeconds, tickTimingMs, ...summary } = route.summary;
        Object.assign(result, { summary, finalHash: hash(route.final), actionsHash: hash(route.actions),
          roundsHash: hash(route.rounds), ledgerHash: hash(route.ledger),
          facts: route.final.augmentHistory.facts.length,
          deaths: route.final.augmentHistory.facts.filter(f => f.kind === 'deaths').length });
        assert.equal(route.final.phase, 'gameOver');
        assert.equal(route.final.roundDefinitionId, '6-7');
        assert(route.final.augments.some(a => a.definitionId === 'loot-explosion'));
      }
      fs.writeFileSync(path.join(output, `${mode}-${repetition}.json`), JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ ...result, verdicts: `${verdicts.length} observations` }));
      assert.equal(error, undefined, 'route must pass every existing oracle assertion');
      if (mode === 'optimized') {
        const baseline = JSON.parse(fs.readFileSync(path.join(output, `baseline-${repetition}.json`), 'utf8'));
        for (const key of ['verdicts', 'error', 'summary', 'finalHash', 'actionsHash', 'roundsHash', 'ledgerHash', 'facts', 'deaths'])
          assert.deepEqual(result[key], baseline[key], `baseline/optimized ${key}`);
        assert.equal(JSON.stringify(result.summary), JSON.stringify(baseline.summary), 'deterministic summary bytes');
      }
    } finally { await server.close(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
