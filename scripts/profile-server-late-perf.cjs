// Measurement only. Does not patch src/server. Times are synchronous CPU, not phase duration.
// node --expose-gc --cpu-prof --cpu-prof-dir=artifacts/server-late-perf --cpu-prof-name=before.cpuprofile \
//   scripts/profile-server-late-perf.cjs artifacts/server-late-perf/before 42
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { createHash } = require('node:crypto');
const { build } = require('esbuild');
const assert = require('node:assert/strict');

const output = path.resolve(process.argv[2] || 'artifacts/server-late-perf/before');
const seed = Number(process.argv[3] || 42);
const root = path.resolve(__dirname, '..');

async function main() {
  if (process.argv[2] === '--prefix') {
    const chunks = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    process.stdout.write(JSON.stringify(benchmarkPrefix(chunks), null, 2) + '\n');
    return;
  }
  if (process.argv[2] === '--tail') {
    process.stdout.write(JSON.stringify(benchmarkTail(), null, 2) + '\n');
    return;
  }
  fs.mkdirSync(output, { recursive: true });
  const bundle = path.join(output, 'room.cjs');
  await build({
    stdin: {
      resolveDir: root,
      contents: `
        export { Room, ROOM_TIMING_DEFAULTS } from './src/server/room/room';
        export { ManualClock } from './src/server/room/clock';
        export { BotDriver } from './src/server/room/bot-driver';
        export { TwoSidedBattleResolver } from './src/server/room/two-sided-resolver';
        export { CAROUSEL_RULES_BINDING } from './src/server/room/carousel';
        export { toPlayerView, toSeatPrivateView } from './src/server/room/projection';
      `,
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundle,
    sourcemap: true,
    logLevel: 'warning',
  });
  const api = require(bundle);
  const manual = new api.ManualClock();
  const rounds = new Map();
  let room;
  let active = null;
  const sample = () => {
    const state = room.state;
    let row = rounds.get(state.round);
    if (!row) {
      row = {
        round: state.round, roundId: state.roundId, roundName: state.roundName,
        callbacks: 0, callbackMs: 0, callbackMaxMs: 0, callbackMaxPhase: '', callbackMaxStack: '',
        publications: 0, publishMs: 0, publishMaxMs: 0, conservationMs: 0, combatMs: 0,
        projectionMs: 0, stringifyMs: 0, streamPushMs: 0, bytes: 0,
        chunks: 0, chunkTicks: 0, maxChunkTicks: 0, maxStreamFrames: 0,
      };
      rounds.set(state.round, row);
    }
    return row;
  };
  const clock = {
    now: () => manual.now(),
    cancel: id => manual.cancel(id),
    schedule: (at, fn) => manual.schedule(at, () => {
      const row = sample();
      const phase = room.state.phase;
      active = row;
      const started = performance.now();
      try { fn(); }
      finally {
        const ms = performance.now() - started;
        row.callbacks++;
        row.callbackMs += ms;
        if (ms > row.callbackMaxMs) {
          row.callbackMaxMs = ms;
          row.callbackMaxPhase = phase;
          row.callbackMaxStack = ms >= 40 ? new Error().stack.split('\n').slice(2, 8).map(line => line.trim()).join(' | ') : '';
        }
        active = null;
      }
    }),
  };
  const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: `b${i}`, name: `bot ${i}`, kind: 'bot' }));
  room = new api.Room(seats, {
    ...api.ROOM_TIMING_DEFAULTS,
    roomId: 'late-perf',
    seed,
    clock,
    resolver: new api.TwoSidedBattleResolver(),
    carousel: api.CAROUSEL_RULES_BINDING,
    combatStreaming: true,
    sliceTicks: 100,
    sliceMs: 20,
    sliceNow: () => performance.now(),
    onCombatWork: ms => { (active ?? sample()).combatMs += ms; },
  });
  for (const [name, total, max] of [['replace', 'publishMs', 'publishMaxMs'], ['assertConserved', 'conservationMs']]) {
    const original = room[name].bind(room);
    if (typeof original !== 'function') throw new Error(`missing ${name}`);
    room[name] = (...args) => {
      const row = active ?? sample();
      const started = performance.now();
      try { return original(...args); }
      finally {
        const ms = performance.now() - started;
        row[total] += ms;
        if (max) { row[max] = Math.max(row[max], ms); row.publications++; }
      }
    };
  }
  const seatRevisions = new Map();
  const cursors = new Map();
  // Chunk lengths only. Frame graphs are not retained, so the match profile stays the room's.
  const chunkLog = [];
  function send(message, row) {
    const started = performance.now();
    const json = JSON.stringify(message);
    row.stringifyMs += performance.now() - started;
    row.bytes += Buffer.byteLength(json);
  }
  room.subscribe(state => {
    const row = active ?? sample();
    for (const seat of state.seats) {
      let started = performance.now();
      const view = api.toPlayerView(state, seat.seatId, clock.now());
      row.projectionMs += performance.now() - started;
      send({ type: 'view', view }, row);
      if (seatRevisions.get(seat.seatId) !== seat.seatRevision && (seat.alive || seat.eliminatedRound === state.round)) {
        seatRevisions.set(seat.seatId, seat.seatRevision);
        started = performance.now();
        const stateView = api.toSeatPrivateView(seat.match, seat.choiceDeadline);
        row.projectionMs += performance.now() - started;
        send({ type: 'state', state: stateView }, row);
      }
    }
  });
  room.subscribeStreams(() => {
    const row = active ?? sample();
    const started = performance.now();
    let frames = 0;
    for (const seat of seats) {
      const projected = performance.now();
      const stream = room.combatStreamFor(seat.seatId);
      row.projectionMs += performance.now() - projected;
      if (!stream) continue;
      const cursor = cursors.get(seat.seatId);
      const next = cursor?.battleId === stream.battleId ? cursor.next : 0;
      const count = stream.ticks.length - next;
      frames += stream.ticks.length;
      if (count > 0) {
        row.chunks++;
        row.chunkTicks += count;
        row.maxChunkTicks = Math.max(row.maxChunkTicks, count);
        chunkLog.push({ round: row.round, roundId: row.roundId, seatId: seat.seatId, from: next, count });
        send({ type: 'combat-chunk', ticks: stream.ticks.slice(next) }, row);
      }
      cursors.set(seat.seatId, { battleId: stream.battleId, next: stream.ticks.length });
    }
    row.maxStreamFrames = Math.max(row.maxStreamFrames, frames);
    row.streamPushMs += performance.now() - started;
  });
  const bots = new api.BotDriver(room, seed, {});
  const hash = createHash('sha256');
  let lastRound = 0;
  room.start();
  const started = performance.now();
  for (let fired = 0; room.state.phase !== 'ended' && fired < 200_000; fired++) {
    assert.equal(manual.fireNext(), true, 'room stalled');
    if (room.state.round !== lastRound || room.state.phase === 'ended') {
      if (lastRound) {
        const row = rounds.get(lastRound);
        const state = room.state;
        row.alive = state.seats.filter(seat => seat.alive).length;
        row.provenance = state.seats.map(seat => seat.match.resourceProvenance.entries.length);
        row.facts = state.seats.map(seat => seat.match.augmentHistory?.facts.length ?? 0);
        if (global.gc) global.gc();
        row.heapBytes = process.memoryUsage().heapUsed;
        hash.update(JSON.stringify(state));
        process.stderr.write(`${row.roundId || row.round}: cpu ${row.callbackMs.toFixed(0)} publish ${row.publishMs.toFixed(0)} maxCb ${row.callbackMaxMs.toFixed(1)} maxPub ${row.publishMaxMs.toFixed(1)} combat ${row.combatMs.toFixed(0)}\n`);
      }
      lastRound = room.state.round;
    }
  }
  assert.equal(room.state.phase, 'ended');
  assert.equal(room.state.fault, null);
  const finalState = JSON.stringify(room.state);
  const finalHash = createHash('sha256').update(finalState).digest('hex');
  bots.dispose();
  room.dispose();
  assert.equal(manual.pending, 0);
  const rows = [...rounds.values()];
  const report = {
    node: process.version,
    seed,
    head: process.env.GIT_HEAD || null,
    elapsedMs: performance.now() - started,
    finalHash,
    finalBytes: Buffer.byteLength(finalState),
    checkpointHash: hash.digest('hex'),
    rounds: rows,
  };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'chunks.json'), JSON.stringify(chunkLog) + '\n');
  const prefix = benchmarkPrefix(chunkLog);
  fs.writeFileSync(path.join(output, 'prefix.json'), JSON.stringify(prefix, null, 2) + '\n');
  process.stdout.write(JSON.stringify({
    output, finalHash, finalBytes: report.finalBytes, rounds: rows.filter(row => row.roundId).length,
    elapsedMs: Math.round(report.elapsedMs), prefixMs: Math.round(prefix.totalMs), prefixCompares: prefix.compares,
  }) + '\n');
}

/** Shallow prefix copy + reference scan, the client assembly in ws-client / remote-session. */
function benchmarkPrefix(chunkLog) {
  const byRound = new Map();
  for (const chunk of chunkLog) {
    let row = byRound.get(chunk.round);
    if (!row) { row = { round: chunk.round, roundId: chunk.roundId, seats: new Map() }; byRound.set(chunk.round, row); }
    let series = row.seats.get(chunk.seatId);
    if (!series) row.seats.set(chunk.seatId, series = []);
    series.push(chunk.count);
  }
  let totalMs = 0, copies = 0, compares = 0, spreadMs = 0, everyMs = 0;
  const rounds = [];
  for (const row of byRound.values()) {
    let roundMs = 0, roundCopies = 0, roundCompares = 0;
    for (const counts of row.seats.values()) {
      let ticks = [];
      let tick = 0;
      for (const count of counts) {
        const extra = Array.from({ length: count }, (_, index) => ({ tick: tick + index, n: index }));
        tick += count;
        const started = performance.now();
        const next = [...ticks, ...extra];
        const spread = performance.now() - started;
        const compared = performance.now();
        const same = ticks.every((frame, index) => frame === next[index]);
        const scan = performance.now() - compared;
        if (!same) throw new Error('prefix identity drifted');
        spreadMs += spread; everyMs += scan; roundMs += spread + scan;
        roundCopies += ticks.length; roundCompares += ticks.length;
        ticks = next;
      }
    }
    totalMs += roundMs; copies += roundCopies; compares += roundCompares;
    rounds.push({ round: row.round, roundId: row.roundId, ms: roundMs, copies: roundCopies, compares: roundCompares });
  }
  return { totalMs, copies, compares, spreadMs, everyMs, rounds };
}

/** replayTail before/after on a shared-reference prefix. Not a room publication. */
function benchmarkTail() {
  const unit = index => ({ id: `unit-${index}`, hp: 1800, mana: 50, star: 2, cell: { q: index % 7, r: (index / 7) | 0 }, items: ['item-a', 'item-b'], name: 'Champion', shields: [100, 40] });
  const frame = (tick, changed) => ({ tick, events: changed ? [{ type: 'unitUpdated', unitId: 'unit-0', changes: { hp: 1 } }] : [], units: Array.from({ length: 16 }, (_, index) => unit(index)) });
  const shared = Array.from({ length: 1500 }, (_, tick) => frame(tick, false));
  const terminal = { tick: 1500, status: 'running' };
  const previous = { ticks: shared, terminal };
  const revised = { ticks: [...shared, frame(1500, true)], terminal };
  const frameBytes = Buffer.byteLength(JSON.stringify(shared[0]));
  const diverge = (ticks, other, compare) => {
    let index = 0;
    const shorter = Math.min(ticks.length, other.length);
    while (index < shorter) {
      if (compare(ticks[index], other[index])) break;
      index++;
    }
    return index;
  };
  const jsonCompare = (left, right) => JSON.stringify(left) !== JSON.stringify(right);
  const refCompare = (left, right) => left !== right && JSON.stringify(left) !== JSON.stringify(right);
  const repeat = (compare, left, right) => {
    const started = performance.now();
    let index = 0;
    for (let n = 0; n < 20; n++) index = diverge(left, right, compare);
    return { ms: performance.now() - started, index };
  };
  const sharedJson = repeat(jsonCompare, previous.ticks, revised.ticks);
  const sharedRef = repeat(refCompare, previous.ticks, revised.ticks);
  const copied = shared.slice(0, 200).map(item => JSON.parse(JSON.stringify(item)));
  const copiedJson = repeat(jsonCompare, shared.slice(0, 200), copied);
  const copiedRef = repeat(refCompare, shared.slice(0, 200), copied);
  return {
    frameBytes, sharedTicks: shared.length, repeats: 20,
    sharedJsonMs: sharedJson.ms, sharedRefMs: sharedRef.ms, sharedIndex: sharedRef.index,
    copiedTicks: copied.length, copiedJsonMs: copiedJson.ms, copiedRefMs: copiedRef.ms, copiedIndex: copiedRef.index,
    sameIndex: sharedJson.index === sharedRef.index && copiedJson.index === copiedRef.index,
  };
}

main().catch(error => { console.error(error); process.exitCode = 1; });
