// Segment timing of tests/m5-replay.test.ts body (same operations, same order), one build. Usage: node replay-profile.cjs <root> <build>
const path = require('node:path'), assert = require('node:assert/strict');
const [, , root, build = 'sniper'] = process.argv;
(async () => {
  const { createServer } = require(require.resolve('vite', { paths: [root] }));
  const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] } });
  const api = await server.ssrLoadModule('/src/simulation/match.ts');
  const { restoreMatch } = await server.ssrLoadModule('/src/simulation/serialization.ts');
  const { run, dispatch } = require(path.join(root, 'scripts/generate-m5-route.cjs'));
  const t = { deepBefore: 0, stringify2: 0, failures: 0, recompute: 0, deepResult: 0, serialize: 0, restore: 0, deepRestored: 0 };
  const lap = (k, f) => { const s = performance.now(); const v = f(); t[k] += performance.now() - s; return v; };
  let restored = api.createMatch(42), commands = 0, ticks = 0, bytes = 0, maxBytes = 0, events = 0;
  const started = performance.now();
  await run(api, { build, seed: 42, onStep(before, result, command) {
    lap('deepBefore', () => assert.deepEqual(restored, before));
    const frozen = lap('stringify2', () => JSON.stringify(restored));
    lap('failures', () => { for (const f of [api.buyUnit(restored, -1, restored.shop.generation), api.sellUnit(restored, 'absent'), api.selectChoice(restored, 'stale', -1, 'absent'), api.nextRound(restored, -1)]) { assert.equal(f.ok, false); assert.equal(f.state, restored); } });
    lap('stringify2', () => assert.equal(JSON.stringify(restored), frozen));
    const second = lap('recompute', () => command ? dispatch(api, restored, command) : api.stepMatch(restored));
    lap('deepResult', () => assert.deepEqual(second, result));
    const text = lap('serialize', () => JSON.stringify(second.state));
    bytes += text.length; maxBytes = Math.max(maxBytes, text.length); events += result.events?.length ?? 0;
    restored = lap('restore', () => restoreMatch(text));
    lap('deepRestored', () => assert.deepEqual(restored, second.state));
    if (command) commands++; else ticks++;
  } });
  const total = performance.now() - started, inStep = Object.values(t).reduce((a, b) => a + b, 0);
  console.log(JSON.stringify({ root, build, commands, ticks, totalMs: Math.round(total), routeMs: Math.round(total - inStep),
    segmentsMs: Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v)])), stateBytesAvg: Math.round(bytes / (commands + ticks)), stateBytesMax: maxBytes, events }));
  await server.close();
})().catch(e => { console.error(e); process.exit(1); });
