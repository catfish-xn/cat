// Fixed-input allocation diagnostic. Variants only replace source in esbuild's
// in-memory bundle; no rule files, test budgets or game values are edited.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const inspector = require('node:inspector');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { gzipSync } = require('node:zlib');
const root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const variant = process.argv[4] || 'current';
const oldRoot = process.argv[5] && path.resolve(process.argv[5]);
const session = new inspector.Session();
const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
async function main() {
  assert(['current', 'old-copy', 'old-cache', 'old-both'].includes(variant));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-allocation-'));
  fs.mkdirSync(output, { recursive: true });
  try {
    const built = await require('esbuild').build({ stdin: { contents: `
      export { Room, ROOM_TIMING_DEFAULTS } from './src/server/room/room';
      export { ManualClock } from './src/server/room/clock';
      export { BotDriver } from './src/server/room/bot-driver';
      export { TwoSidedBattleResolver } from './src/server/room/two-sided-resolver';
    `, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'diagnostic-variant', setup(build) {
      build.onLoad({ filter: /src\/simulation\/(combat-s13\.ts|content\/index\.ts)$/ }, args => {
        const relative = path.relative(root, args.path);
        const replace = relative.endsWith('combat-s13.ts') ? ['old-copy', 'old-both'].includes(variant) : ['old-cache', 'old-both'].includes(variant);
        return replace ? { contents: fs.readFileSync(path.join(oldRoot, relative), 'utf8'), loader: 'ts', resolveDir: path.dirname(args.path) } : undefined;
      });
    } }] });
    const file = path.join(temp, 'probe.cjs'); fs.writeFileSync(file, built.outputFiles[0].contents);
    const { Room, ROOM_TIMING_DEFAULTS, ManualClock, BotDriver, TwoSidedBattleResolver } = require(file);
    session.connect();
    await post('HeapProfiler.startSampling', { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    await post('Profiler.enable'); await post('Profiler.start');
    const clock = new ManualClock(), resolver = new TwoSidedBattleResolver(), ledger = createHash('sha256');
    let battles = 0, peakRssBytes = 0, peakHeapBytes = 0, peakHeapTotalBytes = 0, peakExternalBytes = 0;
    const original = resolver.startBattle.bind(resolver);
    resolver.startBattle = (...args) => {
      const job = original(...args); let recorded = false;
      return { advance(...budget) {
        const result = job.advance(...budget);
        if (result && !recorded) { recorded = true; battles++; const { roomRevision, ...data } = result; ledger.update(JSON.stringify(data) + '\n'); }
        return result;
      } };
    };
    const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: `b${i}`, name: `机器人 ${i}`, kind: 'bot' }));
    const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'bot-room', seed: 42, clock, resolver });
    const bots = new BotDriver(room, 42);
    const started = performance.now();
    try {
      room.start();
      for (let n = 0; room.state.phase !== 'ended' && n < 200000; n++) {
        assert(clock.runNext());
        const memory = process.memoryUsage();
        peakRssBytes = Math.max(peakRssBytes, memory.rss); peakHeapBytes = Math.max(peakHeapBytes, memory.heapUsed);
        peakHeapTotalBytes = Math.max(peakHeapTotalBytes, memory.heapTotal); peakExternalBytes = Math.max(peakExternalBytes, memory.external);
      }
      assert.equal(room.state.phase, 'ended'); assert.equal(room.state.fault, null);
      const terminal = JSON.stringify({ round: room.state.round, ranking: room.state.ranking, pool: room.state.pool,
        settlements: room.state.settlements, carouselLedger: room.state.carouselLedger, rngState: room.state.rngState,
        seats: room.state.seats.map(s => ({ seatId: s.seatId, hp: s.hp, rank: s.rank, match: s.match })) });
      const cpu = await post('Profiler.stop'), heap = await post('HeapProfiler.stopSampling');
      fs.writeFileSync(path.join(output, 'cpu.json.gz'), gzipSync(JSON.stringify(cpu.profile)));
      fs.writeFileSync(path.join(output, 'heap.json.gz'), gzipSync(JSON.stringify(heap.profile)));
      if (global.gc) global.gc();
      const summary = { variant, seed: 42, battles, round: room.state.round, durationMs: performance.now() - started,
        terminalSha256: createHash('sha256').update(terminal).digest('hex'), ledgerSha256: ledger.digest('hex'),
        peakRssBytes, peakHeapBytes, peakHeapTotalBytes, peakExternalBytes, gcApplied: !!global.gc, memory: process.memoryUsage() };
      fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
    } finally { bots.dispose(); room.dispose(); }
  } finally { session.disconnect(); fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
