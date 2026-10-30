/* Selected replay cases only. The oracle route is collected once, just as in
 * m5-replay-helper; no test assertions or restore checks are bypassed.
 * node scripts/profile-m5-replay.cjs ROOT OUTPUT [BUILD] [FIRST,...] [prepare]
 * Reuse OUTPUT.route.json to separate collection from cold/warm case profiling.
 * Delete that file when changing simulation code. Profiles contain local saves.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const inspector = require('node:inspector');
const { performance } = require('node:perf_hooks');

async function main() {
  const root = path.resolve(process.argv[2] ?? '.');
  const output = path.resolve(process.argv[3] ?? '/tmp/m5-profile');
  const build = process.argv[4] ?? 'mage';
  const starts = (process.argv[5] ?? '1,2897,5801,8697,11593,14433').split(',').map(Number);
  const { createServer } = await import('vite');
  const server = await createServer({ root, configFile: false, cacheDir: `${output}.vite`,
    server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { restoreMatch } = await server.ssrLoadModule('/src/simulation/serialization.ts');
    const prepare = process.argv[6] === 'prepare'
      ? (await server.ssrLoadModule('/src/simulation/augment-history-restore.ts')).prepareAugmentHistoryReplay : undefined;
    // Keep the driver AND independent oracle identical when comparing revisions.
    // The old revision's own oracle predates its stage-ban corrections.
    const { run, dispatch } = require('./generate-m5-route.cjs');
    const { routeOptions } = require('./v25-online-rules-route.cjs');
    let route;
    const routeFile = `${output}.route.json`;
    if (fs.existsSync(routeFile)) route = JSON.parse(fs.readFileSync(routeFile, 'utf8'));
    else {
      const chunks = [];
      let steps = 0;
      const collected = await run(api, { build, seed: 42, ...routeOptions(build, 42),
        onRound(state) { console.error(JSON.stringify({ collectedRound: state.roundDefinitionId, steps, tick: state.combat?.tick })); },
        onStep(before, result, command) {
        steps++;
        for (const first of starts) {
          if (steps === first) chunks.push({ first, before: JSON.stringify(before), inputs: [] });
          if (steps >= first && steps < first + 8) {
            const chunk = chunks.find(c => c.first === first);
            chunk.inputs.push(command ?? null);
            chunk.after = JSON.stringify(result.state);
          }
        }
      } });
      route = { build, steps, summary: collected.summary,
        rounds: collected.rounds.map(r => ({ round: r.roundDefinitionId, ...r.result })), chunks };
      fs.writeFileSync(routeFile, JSON.stringify(route));
    }
    console.log(JSON.stringify({ build, steps: route.steps, summary: route.summary, rounds: route.rounds }));
    const session = new inspector.Session(); session.connect();
    const post = method => new Promise((resolve, reject) => session.post(method, (err, result) => err ? reject(err) : resolve(result)));
    await post('Profiler.enable'); await post('Profiler.start');
    try {
      for (const entry of route.chunks.filter(c => starts.includes(c.first))) {
        const times = {}, counts = {}, restoreSamples = [];
        const preparationStarted = performance.now();
        let preparationSlices = 0;
        if (prepare) {
          const work = prepare(JSON.parse(entry.before));
          while (!work.next().done) { preparationSlices++; await new Promise(resolve => setImmediate(resolve)); }
        }
        const preparationMs = prepare ? performance.now() - preparationStarted : 0;
        function timed(label, fn) {
          const now = performance.now();
          try { return fn(); } finally {
            const elapsed = performance.now() - now;
            times[label] = (times[label] ?? 0) + elapsed; counts[label] = (counts[label] ?? 0) + 1;
            if (label === 'restore') restoreSamples.push(elapsed);
          }
        }
        const started = performance.now();
        let before = timed('decode', () => JSON.parse(entry.before));
        const info = { first: entry.first, round: before.roundDefinitionId, tick: before.combat?.tick,
          bytes: entry.before.length, history: before.augmentHistory?.facts.length,
          historySteps: before.augmentHistory?.proof.commands?.reduce((sum, c) => sum + c.count, 0) };
        let error;
        try {
          let restored = entry.first === 1 ? api.createMatch(42) : timed('restore', () => restoreMatch(entry.before));
          for (const [index, command] of entry.inputs.entries()) {
            const result = timed('referenceDispatch', () => command ? dispatch(api, before, command) : api.stepMatch(before));
            timed('assert', () => assert.deepEqual(restored, before));
            const frozen = timed('stringify', () => JSON.stringify(restored));
            const failures = timed('rejections', () => [api.buyUnit(restored, -1, restored.shop.generation), api.sellUnit(restored, 'absent'),
              api.selectChoice(restored, 'stale', -1, 'absent'), api.nextRound(restored, -1)]);
            timed('assert', () => { for (const failed of failures) {
              assert.equal(failed.ok, false); assert.equal(failed.state, restored); assert.equal('events' in failed, false);
            } });
            const unchanged = timed('stringify', () => JSON.stringify(restored));
            timed('assert', () => assert.equal(unchanged, frozen));
            const second = timed('restoredDispatch', () => command ? dispatch(api, restored, command) : api.stepMatch(restored));
            timed('assert', () => assert.deepEqual(second, result));
            const text = timed('stringify', () => JSON.stringify(second.state));
            if (index === entry.inputs.length - 1 && entry.first + entry.inputs.length - 1 < route.steps) {
              timed('assert', () => assert.equal(text, entry.after)); restored = second.state;
            } else {
              restored = timed('restore', () => restoreMatch(text));
              timed('assert', () => assert.deepEqual(restored, second.state));
            }
            before = result.state;
          }
          timed('assert', () => { assert.deepEqual(before, JSON.parse(entry.after)); assert.deepEqual(restored, JSON.parse(entry.after)); });
        } catch (e) { error = e.stack; process.exitCode = 1; }
        console.log(JSON.stringify({ ...info, preparationMs, preparationSlices, milliseconds: performance.now() - started, times, counts, restoreSamples, error }));
      }
    } finally {
      const { profile } = await post('Profiler.stop');
      fs.writeFileSync(`${output}.cpuprofile`, JSON.stringify(profile)); session.disconnect();
    }
  } finally { await server.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
