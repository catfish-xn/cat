// Deterministic full eight-bot matches using the same Room/ManualClock/resolver
// as tests/server/bot-driver-helper.ts. No time budgets or rule data are changed.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { performance } = require('node:perf_hooks');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const output = path.resolve(process.argv[3] || 'artifacts/mp-sim-perf');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-sim-probe-'));
  try {
    const esbuild = require('esbuild');
    const built = await esbuild.build({ stdin: { contents: `
      export { ManualClock } from './src/server/room/clock';
      export { Room, ROOM_TIMING_DEFAULTS } from './src/server/room/room';
      export { BotDriver } from './src/server/room/bot-driver';
      export { TwoSidedBattleResolver } from './src/server/room/two-sided-resolver';
    `, resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', write: false });
    const bundle = path.join(temp, 'probe.cjs'); fs.writeFileSync(bundle, built.outputFiles[0].contents);
    const { Room, ManualClock, ROOM_TIMING_DEFAULTS, BotDriver, TwoSidedBattleResolver } = require(bundle);
    const results = [];
    for (const seed of [42, 7, 11]) {
      const clock = new ManualClock(), steps = [], ledgerHash = createHash('sha256');
      const ledgerFile = path.join(output, `seed-${seed}-ledger.ndjson`);
      fs.writeFileSync(ledgerFile, '');
      let battles = 0, events = 0;
      const resolver = new TwoSidedBattleResolver();
      const startBattle = resolver.startBattle.bind(resolver);
      resolver.startBattle = (...args) => {
        const job = startBattle(...args); let recorded = false;
        return { advance(...budget) {
          const result = job.advance(...budget);
          if (result && !recorded) {
            recorded = true; battles++;
            const { roomRevision, ...rulesResult } = result;
            const bytes = JSON.stringify(rulesResult) + '\n';
            events += result.battle?.events.length ?? result.outcomes?.reduce((n, s) => n + (s.combat?.events.length ?? 0), 0) ?? 0;
            ledgerHash.update(bytes); fs.appendFileSync(ledgerFile, bytes);
          }
          return result;
        } };
      };
      const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: `b${i}`, name: `机器人 ${i}`, kind: 'bot' }));
      const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'bot-room', seed, clock, resolver });
      const bots = new BotDriver(room, seed, { onStep: row => steps.push(row) });
      // Match wall-time slicing is scheduling only; compare authoritative rule
      // bytes and ledgers, excluding room scheduling revisions/timer timestamps.
      const started = performance.now();
      try {
        room.start();
        for (let n = 0; room.state.phase !== 'ended' && n < 200000; n++) assert(clock.runNext());
        assert.equal(room.state.phase, 'ended'); assert.equal(room.state.fault, null);
        assert.deepEqual(room.state.ranking.map(row => row.rank).sort((a,b)=>a-b), [1,2,3,4,5,6,7,8]);
        const terminal = JSON.stringify({ round: room.state.round, ranking: room.state.ranking,
          pool: room.state.pool, settlements: room.state.settlements, carouselLedger: room.state.carouselLedger, rngState: room.state.rngState, seats: room.state.seats.map(s => ({ seatId: s.seatId, hp: s.hp, rank: s.rank, match: s.match })) });
        const intentions = JSON.stringify(steps);
        fs.writeFileSync(path.join(output, `seed-${seed}-terminal.json.gz`), gzipSync(terminal));
        fs.writeFileSync(path.join(output, `seed-${seed}-steps.json.gz`), gzipSync(intentions));
        fs.writeFileSync(ledgerFile + '.gz', gzipSync(fs.readFileSync(ledgerFile))); fs.unlinkSync(ledgerFile);
        const gcApplied = typeof globalThis.gc === 'function';
        if (gcApplied) globalThis.gc();
        const memory = process.memoryUsage();
        const result = { gcApplied, rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, seed, round: room.state.round, terminalBytes: Buffer.byteLength(terminal), terminalSha256: sha(terminal),
          ledgerSha256: ledgerHash.digest('hex'), battles, events, intentionsSha256: sha(intentions), steps: steps.length, durationMs: performance.now() - started };
        results.push(result); console.error(JSON.stringify(result));
      } finally { bots.dispose(); room.dispose(); }
    }
    fs.writeFileSync(path.join(output, 'probe.json'), JSON.stringify(results, null, 2));
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
