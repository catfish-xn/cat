/** Measurement only. Bundle with esbuild; see docs/STAGE5_LAG_REPORT.md. */
import { performance, PerformanceObserver } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { ManualClock, type Clock } from '../src/server/room/clock';
import { RealClock } from '../src/server/room/real-clock';
import { BotDriver } from '../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import { toPlayerView, toSeatPrivateView, startReplaySpotCheck } from '../src/server/room/projection';

const out = process.env.STAGE5_OUT ?? 'artifacts/stage5-lag';
mkdirSync(out, { recursive: true });
const seed = Number(process.argv[2] ?? 42);
const realtimeStage = process.argv[3]; // Fast-forward to this round, then use RealClock until its settlement.
const manual = new ManualClock(), real = new RealClock();
let realtime = false, offset = 0, room: Room;
const samples: any[] = [], groups = new Map<string, any>(), metadata = new Map<number, any>(), fixtures: Record<string, any> = {};
const cpuOffsetUs = Number(process.hrtime.bigint() / 1000n) - performance.now() * 1000;
const gc: any[] = [];
const gcObserver = new PerformanceObserver(list => { for (const e of list.getEntries()) gc.push({ start: e.startTime, ms: e.duration, detail: (e as any).detail }); });
gcObserver.observe({ entryTypes: ['gc'] });
const targets = new Set(['2-1', '2-5', '5-1', '5-5', '6-1']);
const context = () => ({ round: room?.state.round ?? 0, name: room?.state.roundName ?? 'init', phase: room?.state.phase ?? 'waiting', realtime });
const add = (part: string, ms: number, ctx: any) => {
  const key = `${ctx.round}:${ctx.phase}:${part}:${ctx.realtime}`;
  let g = groups.get(key); if (!g) groups.set(key, g = { ...ctx, part, values: [] });
  g.values.push(ms);
};
const record = (part: string, start: number, ctx: any, extra = {}) => {
  const ms = performance.now() - start;
  add(part, ms, ctx);
  if (part === 'callback') samples.push({ ...ctx, part, ms, start, ...extra });
};
const timed = <T>(part: string, fn: () => T): T => { const c = context(), t = performance.now(); try { return fn(); } finally { record(part, t, c); } };
// Record nested inclusive spans. Only callback totals are additive; component spans must not be summed with parents.
function wrap(object: any, names: string[], prefix: string) {
  for (const name of names) {
    const original = object[name];
    if (typeof original !== 'function') throw Error(`missing measurement seam: ${prefix}.${name}`);
    object[name] = function (this: any, ...args: any[]) { return timed(`${prefix}.${name}`, () => original.apply(this, args)); };
  }
}
const handles = new Map<number, { clock: Clock; handle: number }>(); let nextHandle = 1;
const clock: Clock = {
  now: () => realtime ? real.now() - offset : manual.now(),
  cancel(id) { const saved = handles.get(id); if (saved) saved.clock.cancel(saved.handle); handles.delete(id); },
  schedule(at, fn) {
    const id = nextHandle++, backend = realtime ? real : manual;
    const handle = backend.schedule(realtime ? at + offset : at, () => {
      handles.delete(id);
      const c = context(), t = performance.now(), late = Math.max(0, clock.now() - at);
      try { fn(); } finally { record('callback', t, c, { late }); }
    });
    handles.set(id, { clock: backend, handle }); return id;
  },
};
room = new Room(Array.from({ length: 8 }, (_, i) => ({ seatId: `bot-${i}`, name: `机器人${i}`, kind: 'bot' as const })), {
  ...ROOM_TIMING_DEFAULTS, clock, roomId: `stage5-${seed}`, seed,
  resolver: new TwoSidedBattleResolver(), carousel: CAROUSEL_RULES_BINDING,
  combatStreaming: true, sliceTicks: 100, sliceMs: 20, sliceNow: () => performance.now(),
  onCombatWork: ms => add('combatTick', ms, context()),
});
wrap(room, ['freezeAndResolve', 'runSettlementSlice', 'advanceStreams', 'commitPending', 'commitSettlement', 'advanceRound', 'autoDeploy', 'drawRound', 'buildInputs', 'replace', 'assertConserved'], 'room');
const originalFreeze = (room as any).freezeAndResolve;
(room as any).freezeAndResolve = function () {
  if (room.state.roundName === realtimeStage && !realtime) {
    // Freeze runs in the final ManualClock callback. All further schedules use the real backend.
    realtime = true; offset = real.now() - manual.now();
  }
  if (process.env.STAGE5_FIXTURES !== '0' && targets.has(room.state.roundName)) fixtures[room.state.roundName] = { prep: room.state, now: clock.now() };
  return originalFreeze.call(this);
};
const finish = (room as any).finishStreams;
(room as any).finishStreams = function () {
  const f = fixtures[room.state.roundName];
  if (f) {
    // Retain immutable references only; serialize fixtures after the measurement.
    f.battle = room.state;
    f.streams = room.state.seats.map(s => ({ seatId: s.seatId, stream: room.combatStreamFor(s.seatId) })).filter(s => s.stream);
  }
  return finish.call(this);
};
const bots = new BotDriver(room, seed, {});
wrap(bots, ['step', 'sync'], 'bot');
let bytes = 0, messages = 0;
const roomRevision = new Map(), seatRevision = new Map(), cursors = new Map();
function send(message: unknown) { const json = timed('stringify', () => JSON.stringify(message)); bytes += Buffer.byteLength(json); messages++; }
function push() {
  timed('push', () => {
    const state = room.state;
    for (const seat of state.seats) {
      if (roomRevision.get(seat.seatId) !== state.roomRevision) {
        roomRevision.set(seat.seatId, state.roomRevision);
        send({ type: 'view', roomId: state.roomId, roomRevision: state.roomRevision, view: timed('projection.view', () => toPlayerView(state, seat.seatId, clock.now())) });
      }
      if ((seat.alive || seat.eliminatedRound === state.round) && seatRevision.get(seat.seatId) !== seat.seatRevision) {
        seatRevision.set(seat.seatId, seat.seatRevision);
        send({ type: 'state', roomId: state.roomId, round: state.round, seatRevision: seat.seatRevision,
          state: timed('projection.state', () => toSeatPrivateView(seat.match, seat.choiceDeadline)) });
      }
      if (room.streamingBoundaryPending) continue;
      const stream = timed('projection.stream', () => room.combatStreamFor(seat.seatId));
      if (!stream) continue;
      const envelope = { roomId: state.roomId, round: state.round, battleId: stream.battleId, revision: stream.revision, seatId: seat.seatId, watch: false };
      const cursor = cursors.get(seat.seatId), from = cursor?.battleId === stream.battleId ? cursor.nextTick : 1;
      if (!cursor || cursor.battleId !== stream.battleId) send({ ...envelope, type: 'combat-open', initial: stream.initial, frame: stream.ticks[0], unitIds: stream.unitIds });
      if (stream.ticks.length > from) send({ type: 'combat-chunk', chunks: [{ ...envelope, fromTick: from, throughTick: stream.ticks.length - 1, ticks: stream.ticks.slice(from) }] });
      if (stream.terminal && !cursor?.ended) send({ ...envelope, type: 'combat-end', throughTick: stream.ticks.length - 1, terminal: stream.terminal });
      cursors.set(seat.seatId, { battleId: stream.battleId, nextTick: stream.ticks.length, ended: !!stream.terminal });
    }
  });
}
room.subscribe(push); room.subscribeStreams(push);
let auditedRound = -1, eligible = 0;
if (process.env.STAGE5_AUDIT === '1') room.subscribe(state => {
  if (state.phase !== 'battle' || !state.battles.length || auditedRound === state.round) return;
  auditedRound = state.round;
  const check = startReplaySpotCheck(state.battles, state.round, false, state.battleSeeds);
  if (!check || eligible++ % 4 !== 0) return;
  const slice = () => {
    let results: ReturnType<typeof check.advance> = null;
    timed('replayAudit', () => {
      for (let spent = 0, deadline = performance.now() + 20; !results && spent < 100 && performance.now() < deadline; spent++) results = check.advance(1);
    });
    if (!results) clock.schedule(clock.now(), slice);
    else if ((results as any[]).some(r => r.firstDifference !== null)) throw Error(`replay audit mismatch: ${JSON.stringify(results)}`);
  };
  clock.schedule(clock.now(), slice);
});
room.subscribe(state => {
  if (!metadata.has(state.round)) process.stderr.write(`${seed} ${state.roundName}\n`);
  metadata.set(state.round, { round: state.round, name: state.roundName, kind: state.roundKind, startAlive: metadata.get(state.round)?.startAlive ?? state.seats.filter(s => s.alive).length,
    alive: state.seats.filter(s => s.alive).length, heap: metadata.get(state.round)?.heap ?? process.memoryUsage(),
    boardUnits: state.seats.map(s => s.match.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length) });
});
room.start();
for (let i = 0; !realtime && room.state.phase !== 'ended' && i < 300_000; i++) if (!manual.fireNext()) break;
if (realtime) await new Promise<void>((resolve, reject) => {
  const poll = setInterval(() => {
    if (room.state.fault) { clearInterval(poll); reject(Error(JSON.stringify(room.state.fault))); }
    else if (room.state.phase === 'settlement' || room.state.phase === 'ended') { clearInterval(poll); resolve(); }
  }, 50);
});
if (room.state.fault || (!realtimeStage && room.state.phase !== 'ended')) throw Error(JSON.stringify(room.state.fault ?? room.state.phase));
await new Promise(resolve => setTimeout(resolve, 0));
gcObserver.disconnect();
const result = { seed, node: process.version, realtimeStage, cpuOffsetUs, bytes, messages, finalRound: room.state.roundName, gc, rounds: [...metadata.values()], samples, groups: [...groups.values()] };
for (const [name, f] of Object.entries(fixtures)) {
  if (!f.streams?.length) continue;
  const chosen = [...f.streams].sort((a, b) => b.stream.initial.units.length - a.stream.initial.units.length)[0];
  const seatId = chosen.seatId;
  const snapshot = (state: any) => ({ view: toPlayerView(state, seatId, f.now), state: toSeatPrivateView(state.seats.find((s: any) => s.seatId === seatId).match), roomRevision: state.roomRevision, seatRevision: state.seats.find((s: any) => s.seatId === seatId).seatRevision });
  writeFileSync(`${out}/fixture-${seed}-${name}.json`, JSON.stringify({ seed, name, seatId, roomId: f.prep.roomId, round: f.prep.round,
    prep: snapshot(f.prep), battle: snapshot(f.battle), stream: chosen.stream }));
}
writeFileSync(`${out}/server-${seed}${realtimeStage ? `-real-${realtimeStage}` : ''}${process.env.STAGE5_AUDIT === '1' ? '-audit' : ''}.json`, JSON.stringify(result));
bots.dispose(); room.dispose(); real.dispose();
process.stderr.write(`done ${seed} ${result.finalRound}, ${samples.length} samples, ${messages} messages\n`);
