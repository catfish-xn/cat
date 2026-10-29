// Local-only eight-bot profiling. No server instrumentation/API or serialized state changes.
// node --expose-gc --cpu-prof --cpu-prof-dir=artifacts/lag scripts/profile-late-game.cjs artifacts/lag/baseline 42
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { build } = require('esbuild');
const assert = require('node:assert/strict');
const output = path.resolve(process.argv[2] || 'artifacts/lag/run');
const seed = Number(process.argv[3] || 42);
const streaming = true;
const root = path.resolve(__dirname, '..');
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const bundle = path.join(output, 'room.cjs');
  await build({ stdin: { resolveDir: root, contents: `
    export { Room, ROOM_TIMING_DEFAULTS } from './src/server/room/room';
    export { ManualClock } from './src/server/room/clock';
    export { BotDriver } from './src/server/room/bot-driver';
    export { TwoSidedBattleResolver } from './src/server/room/two-sided-resolver';
    export { CAROUSEL_RULES_BINDING } from './src/server/room/carousel';
    export { toPlayerView, toSeatPrivateView } from './src/server/room/projection';
  ` }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle, sourcemap: true });
  const api = require(bundle), manual = new api.ManualClock(), rounds = new Map();
  let room, active;
  const sample = () => {
    const s = room.state;
    if (!rounds.has(s.round)) rounds.set(s.round, { round: s.round, roundId: s.roundId, callbacks: 0, callbackMs: 0,
      callbackMaxMs: 0, callbackMaxPhase: '', callbackMaxCause: '', publications: 0, publishMs: 0, publishMaxMs: 0, conservationMs: 0, combatMs: 0,
      projectionMs: 0, stringifyMs: 0, streamPushMs: 0, bytes: 0, maxStreamFrames: 0, maxStreamEvents: 0 });
    return rounds.get(s.round);
  };
  const clock = { now: () => manual.now(), cancel: id => manual.cancel(id), schedule: (at, fn) => manual.schedule(at, () => {
    const row = sample(), phase = room.state.phase; active = row;
    const started = performance.now(); fn(); const ms = performance.now() - started;
    row.callbacks++; row.callbackMs += ms;
    if (ms > row.callbackMaxMs) { row.callbackMaxMs = ms; row.callbackMaxPhase = phase; row.callbackMaxCause = String(fn).slice(0, 200); }
    active = null;
  }) };
  const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: `b${i}`, name: `bot ${i}`, kind: 'bot' }));
  room = new api.Room(seats, { ...api.ROOM_TIMING_DEFAULTS, roomId: 'lag-probe', seed, clock,
    resolver: new api.TwoSidedBattleResolver(), carousel: api.CAROUSEL_RULES_BINDING, combatStreaming: streaming,
    sliceTicks: 100, sliceMs: 20, sliceNow: () => performance.now(), onCombatWork: ms => (active ?? sample()).combatMs += ms });
  for (const [name, total, max] of [['replace', 'publishMs', 'publishMaxMs'], ['assertConserved', 'conservationMs']]) {
    const original = room[name].bind(room);
    room[name] = (...args) => { const row = active ?? sample(), started = performance.now();
      try { return original(...args); } finally { const ms = performance.now() - started; row[total] += ms;
        if (max) { row[max] = Math.max(row[max], ms); row.publications++; } }
    };
  }
  const seatRevisions = new Map(), cursors = new Map();
  function send(message, row) { const t = performance.now(), json = JSON.stringify(message); row.stringifyMs += performance.now() - t; row.bytes += Buffer.byteLength(json); }
  room.subscribe(state => {
    const row = active ?? sample();
    for (const seat of state.seats) {
      let t = performance.now(); const view = api.toPlayerView(state, seat.seatId, clock.now()); row.projectionMs += performance.now() - t;
      send({ type: 'view', view }, row);
      if (seatRevisions.get(seat.seatId) !== seat.seatRevision && (seat.alive || seat.eliminatedRound === state.round)) {
        seatRevisions.set(seat.seatId, seat.seatRevision);
        t = performance.now(); const stateView = api.toSeatPrivateView(seat.match, seat.choiceDeadline); row.projectionMs += performance.now() - t;
        send({ type: 'state', state: stateView }, row);
      }
    }
  });
  room.subscribeStreams(() => {
    const row = active ?? sample(), started = performance.now();
    let frames = 0, events = 0;
    for (const seat of seats) {
      const t = performance.now(), stream = room.combatStreamFor(seat.seatId); row.projectionMs += performance.now() - t;
      if (!stream) continue;
      const cursor = cursors.get(seat.seatId), next = cursor?.battleId === stream.battleId ? cursor.next : 0;
      const ticks = stream.ticks.slice(next), count = (next ? cursor.events : 0) + ticks.reduce((n, frame) => n + frame.events.length, 0);
      frames += stream.ticks.length; events += count;
      if (ticks.length) send({ type: 'combat-chunk', ticks }, row);
      cursors.set(seat.seatId, { battleId: stream.battleId, next: stream.ticks.length, events: count });
    }
    row.maxStreamFrames = Math.max(row.maxStreamFrames, frames); row.maxStreamEvents = Math.max(row.maxStreamEvents, events);
    row.streamPushMs += performance.now() - started;
  });
  const bots = new api.BotDriver(room, seed, {}), hash = createHash('sha256');
  let lastRound = 0;
  room.start(); const started = performance.now();
  for (let fired = 0; room.state.phase !== 'ended' && fired < 200_000; fired++) {
    assert(manual.fireNext(), 'room stalled');
    if (room.state.round !== lastRound || room.state.phase === 'ended') {
      if (lastRound) {
        const row = rounds.get(lastRound), state = room.state;
        row.alive = state.seats.filter(s => s.alive).length;
        row.poolRewards = state.pool.rewards.length;
        row.histories = state.seats.map(s => ({ seatId: s.seatId, publicationEvents: s.serverEvents?.events.length ?? 0,
          provenance: s.match.resourceProvenance.entries.length, results: s.match.roundResults.length }));
        row.retained = room.retained;
        if (global.gc) global.gc(); row.heapBytes = process.memoryUsage().heapUsed;
        hash.update(JSON.stringify(state));
        process.stderr.write(`${row.roundId}: CPU ${row.callbackMs.toFixed(0)}ms publish ${row.publishMs.toFixed(0)}ms max ${row.callbackMaxMs.toFixed(1)}ms\n`);
      }
      lastRound = room.state.round;
    }
  }
  assert.equal(room.state.phase, 'ended'); assert.equal(room.state.fault, null);
  const finalHash = createHash('sha256').update(JSON.stringify(room.state)).digest('hex');
  bots.dispose(); room.dispose(); assert.equal(manual.pending, 0);
  const report = { node: process.version, seed, streaming, elapsedMs: performance.now() - started,
    finalHash, checkpointHash: hash.digest('hex'), retained: room.retained, rounds: [...rounds.values()] };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ output, finalHash, rounds: [...rounds.values()].filter(r => r.roundId).length, elapsedMs: report.elapsedMs }) + '\n');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
