import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { Room, ROOM_TIMING_DEFAULTS, type RoomOptions } from '../../src/server/room/room';
import { Lobby } from '../../src/server/room/lobby';
import { BotDriver, deriveBotRng, type BotDriverOptions, type BotStepRecord } from '../../src/server/room/bot-driver';
import { toPlayerView } from '../../src/server/room/projection';
import { BOT_MAX_STEPS } from '../../src/server-entry';
import type { RoomCommandResult, SeatCommand, SeatSpec } from '../../src/server/room/types';
import { expectUniqueRanking, runUntil, SEATS } from './helpers';
import { expectWallClockBelow } from '../fixtures/wallclock';

/** The rules battle runs in full; only the second playback pass is skipped (nobody watches these matches). */
const headlessResolver = () => new TwoSidedBattleResolver();
const BOTS: readonly SeatSpec[] = Array.from({ length: 8 }, (_, index) => ({ seatId: `b${index}`, name: `机器人 ${index}`, kind: 'bot' }));

type Logged = BotStepRecord;

function botRoom(seats: readonly SeatSpec[] = BOTS, driver: Partial<BotDriverOptions> = {}, overrides: Partial<RoomOptions> = {}, RoomClass: typeof Room = Room) {
  const clock = new ManualClock();
  const room = new RoomClass(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'bot-room', seed: 42, clock, resolver: headlessResolver(), ...overrides });
  const log: Logged[] = [];
  const bots = new BotDriver(room, overrides.seed ?? 42, { ...driver, onStep: record => { log.push(record); driver.onStep?.(record); } });
  disposers.push(() => { bots.dispose(); room.dispose(); });
  return { room, clock, bots, log };
}
const disposers: (() => void)[] = [];
const disposeRooms = () => { for (const dispose of disposers.splice(0)) dispose(); };
afterEach(disposeRooms);
afterAll(disposeRooms); // Also release fixtures when an ordered setup hook fails.

const actionsOf = (log: readonly Logged[]) => log.filter(record => record.action !== 'done');
const budgetsHold = (log: readonly Logged[], limit: number) => {
  const most = new Map<string, number>();
  for (const record of log) { const key = `${record.seatId}:${record.round}`; most.set(key, Math.max(most.get(key) ?? 0, record.stepsTaken)); }
  for (const [key, steps] of most) expect(steps, key).toBeLessThanOrEqual(limit);
};

export function registerBotDriver(mode: 'fast' | 'timing'): void {
if (mode === 'timing') describe('BotDriver: whole matches (§13.3)', () => {
  if (mode === 'timing') { it('plays eight bots from the first round to a unique ranking; every intention is accepted by the rules', () => {
    const started = performance.now();
    const { room, clock, bots, log } = botRoom();
    room.start();
    let idleChecks = 0;
    for (let fired = 0; room.state.phase !== 'ended' && fired < 200_000; fired++) {
      clock.runNext();
      // Frozen and battle phases never hold a pending bot step.
      if (room.state.phase === 'frozen' || room.state.phase === 'battle') { idleChecks++; for (const seat of BOTS) expect(bots.inspect(seat.seatId)!.pending).toBe(false); }
    }
    expect(room.state.fault).toBeNull();
    expectUniqueRanking(room.state);
    expect(room.state.round).toBeGreaterThanOrEqual(20);
    expect(idleChecks).toBeGreaterThan(0);
    // Every executed intention passed the rules; nothing was sent outside the preparation and choice phases.
    expect(actionsOf(log).filter(record => record.ok !== true)).toEqual([]);
    for (const record of log) expect(['preparation', 'choice']).toContain(record.phase);
    budgetsHold(log, BOT_MAX_STEPS);
    const kinds = new Set(actionsOf(log).map(record => (record.action as SeatCommand).type));
    for (const kind of ['buy', 'deploy', 'reroll', 'buyXp', 'choose']) expect(kinds, kind).toContain(kind);
    // The bots built up: every seat levelled, and some upgraded a hero to two stars through the buy command.
    expect(room.state.seats.every(seat => seat.match.level >= 5)).toBe(true);
    expect(room.state.seats.some(seat => seat.match.preparation.units.some(unit => unit.team === 'player' && unit.starLevel >= 2))).toBe(true);
    expectWallClockBelow('bot-driver eight bots whole match', performance.now() - started, 60_000);
  }, 60_000); }

  if (mode === 'timing') { it('plays one idle human and seven bots through the lobby to a unique ranking; the human seat is never driven', () => {
    const started = performance.now();
    const clock = new ManualClock();
    const log: BotStepRecord[] = [];
    const lobby = new Lobby({ clock, resolver: headlessResolver(), seed: 7, roomId: 'mixed', bots: { onStep: record => log.push(record) } });
    disposers.push(() => lobby.dispose());
    const joined = lobby.join('玩家');
    expect(joined.ok).toBe(true);
    const seatId = joined.ok ? joined.seatId : '';
    const opened = lobby.start();
    expect(opened.ok).toBe(true);
    const room = lobby.room!;
    expect(lobby.bots).not.toBeNull();
    runUntil(room, clock, state => state.phase === 'ended', 200_000);
    expect(room.state.fault).toBeNull();
    expectUniqueRanking(room.state);
    expect(log.some(record => record.seatId === seatId)).toBe(false);
    expect(room.state.seats.find(seat => seat.seatId === seatId)!.controller).toBe('human');
    expect(log.filter(record => record.action !== 'done' && record.ok !== true)).toEqual([]);
    expect(new Set(log.map(record => record.seatId)).size).toBe(7);
    for (const record of log) expect(['preparation', 'choice']).toContain(record.phase);
    budgetsHold(log, BOT_MAX_STEPS);
    // 临时、用户 10-20 批准：v15 起 bot 在准备阶段领取法球、阵容更大，本机实测约 62 秒（原限 60 秒），按约 2 倍放宽到 120 秒；断言不变。
    expectWallClockBelow('bot-driver idle human and seven bots whole match', performance.now() - started, 120_000);
  }, 120_000); }
});

if (mode === 'fast') describe('BotDriver: scheduling', () => {
  describe('independent deterministic runs', () => {
    const snapshots: { log: string; seats: string; rng: number[] }[] = [];
    // Two genuine runs, with a separate bounded hook for each real round.
    // Consumers never depend on another assertion case warming this fixture.
    for (let run = 0; run < 2; run++) {
      let ctx: ReturnType<typeof botRoom>;
      beforeAll(() => { ctx = botRoom(); ctx.room.start(); });
      for (let round = 1; round <= 7; round++) beforeAll(() => {
        runUntil(ctx.room, ctx.clock, state => state.round >= round, 20_000);
      });
      beforeAll(() => {
        snapshots.push({ log: JSON.stringify(ctx.log), seats: JSON.stringify(ctx.room.state.seats.map(seat => seat.match)),
          rng: BOTS.map(seat => ctx.bots.inspect(seat.seatId)!.rng) });
      });
    }
    it('behaves the same for the same input: identical intentions, policy streams and seat states', () => {
      const [first, second] = snapshots;
      expect(second.log).toBe(first.log);
      expect(second.seats).toBe(first.seats);
      expect(second.rng).toEqual(first.rng);
    }, 30_000);
  });

  if (mode === 'fast') { it('draws the policy stream from its own derivation, never from the room stream', () => {
    const plain = new Room(BOTS, { ...ROOM_TIMING_DEFAULTS, roomId: 'bot-room', seed: 42, clock: new ManualClock(), resolver: headlessResolver() });
    const { room } = botRoom();
    plain.start(); room.start();
    expect(room.state.rngState).toBe(plain.state.rngState);
    expect(room.state.pairings).toEqual(plain.state.pairings);
    expect(room.state.seats.map(seat => seat.seed)).toEqual(plain.state.seats.map(seat => seat.seed));
    plain.dispose();
    const streams = BOTS.map((_, index) => deriveBotRng(42, index));
    expect(new Set(streams).size).toBe(8);
    for (const value of streams) expect(Number.isInteger(value) && value >= 0 && value <= 0xffffffff).toBe(true);
  }); }

  if (mode === 'fast') { it('spreads steps over the phase on the clock instead of firing them all at the deadline', () => {
    const { room, clock, log } = botRoom(BOTS, { stepMs: 500 });
    room.start();
    runUntil(room, clock, state => state.phase === 'preparation');
    const opened = clock.now();
    clock.advance(499);
    expect(log.filter(record => record.round === room.state.round && record.action !== 'done')).toHaveLength(0);
    clock.advance(10_000);
    const early = log.filter(record => record.round === room.state.round && record.action !== 'done');
    expect(early.length).toBeGreaterThan(0);
    expect(early.length).toBeLessThanOrEqual(8 * Math.ceil(10_499 / 500));
    expect(clock.now() - opened).toBeLessThan(30_000);
  }); }

  if (mode === 'fast') { it('caps every seat at maxSteps attempts per round and keeps the count across phases', () => {
    const { room, clock, log } = botRoom(BOTS, { maxSteps: 3 });
    room.start();
    runUntil(room, clock, state => state.round >= 6, 20_000);
    budgetsHold(log, 3);
    const perRound = new Map<string, number>();
    for (const record of actionsOf(log)) { const key = `${record.seatId}:${record.round}`; perRound.set(key, (perRound.get(key) ?? 0) + 1); }
    expect(Math.max(...perRound.values())).toBe(3);
  }, 30_000); }

  if (mode === 'fast') { it('stops a seat for the rest of the round after one refusal (policy answers done) and plays again next round', () => {
    let refuse = true;
    class RefusingRoom extends Room {
      override handleBot(seatId: string, controlEpoch: number, command: SeatCommand): RoomCommandResult {
        if (seatId === 'b0' && refuse && this.state.phase === 'preparation') {
          refuse = false;
          const seat = this.state.seats.find(candidate => candidate.seatId === seatId)!;
          return { ok: false, reason: 'insufficient-gold', state: seat.match };
        }
        return super.handleBot(seatId, controlEpoch, command);
      }
    }
    const { room, clock, bots, log } = botRoom(BOTS, {}, {}, RefusingRoom);
    room.start();
    runUntil(room, clock, state => !refuse && state.phase !== 'preparation', 20_000);
    const round = log.find(record => record.seatId === 'b0' && record.ok === false)!.round;
    const ofRound = log.filter(record => record.seatId === 'b0' && record.round === round);
    const refusedAt = ofRound.findIndex(record => record.ok === false);
    expect(ofRound.slice(refusedAt + 1).map(record => record.action)).toEqual(['done']);
    expect(bots.inspect('b0')!.lastFailure).toMatchObject({ reason: 'insufficient-gold' });
    expect(bots.inspect('b0')!.closed).toBe(true);
    runUntil(room, clock, state => state.round > round && state.phase === 'preparation', 20_000);
    clock.advance(5_000);
    expect(bots.inspect('b0')!.lastFailure).toBeNull();
    expect(log.some(record => record.seatId === 'b0' && record.round > round && record.ok === true)).toBe(true);
  }, 30_000); }
});

if (mode === 'fast') describe('BotDriver: no takeover by default (P2, TFT behaviour)', () => {
  let ctx: ReturnType<typeof botRoom>, round: number;
  const seat = () => ctx.room.state.seats.find(candidate => candidate.seatId === 's0')!;
  beforeAll(() => {
    ctx = botRoom(SEATS, { stepMs: 300 });
    ctx.room.start();
    runUntil(ctx.room, ctx.clock, state => state.phase === 'preparation');
    expect(ctx.room.setConnected('s0', false)).toBe(true);
    expect(ctx.bots.inspect('s0')!.takeoverPending).toBe(false);
    round = ctx.room.state.round;
  });
  // Advance the same disconnected seat across both genuine rounds, independently of test order.
  for (const offset of [1, 2]) beforeAll(() => {
    runUntil(ctx.room, ctx.clock, state => state.round >= round + offset && state.phase === 'preparation', 20_000);
  });
  if (mode === 'fast') { it('leaves a disconnected human seat alone: no takeover timer, no bot step, the seat stays human and its board still fights', () => {
    const { room, bots, log } = ctx;
    expect(seat()).toMatchObject({ controller: 'human', controlEpoch: 0, connected: false });
    expect(bots.inspect('s0')!.takeoverPending).toBe(false);
    expect(log.some(record => record.seatId === 's0')).toBe(false);
    // Fill-in bots still play; the disconnected seat's board took part in the battles.
    expect(log.some(record => record.seatId === 's4' && record.ok === true)).toBe(true);
    expect(room.state.fault).toBeNull();
    // Coming back is a plain reconnect: same controller, same generation.
    expect(room.setConnected('s0', true)).toBe(true);
    expect(seat()).toMatchObject({ controller: 'human', controlEpoch: 0, connected: true });
  }); }
});

if (mode === 'fast') describe('BotDriver: disconnect takeover when switched on (§13.3 item 1)', () => {
  const firstPreparation = () => {
    const ctx = botRoom(SEATS, { takeover: true, takeoverMs: 5_000, stepMs: 300 });
    ctx.room.start();
    runUntil(ctx.room, ctx.clock, state => state.phase === 'preparation');
    return ctx;
  };
  const seat = (room: Room, seatId: string) => room.state.seats.find(candidate => candidate.seatId === seatId)!;

  if (mode === 'fast') { it('hands a seat to a bot only after takeoverMs disconnected, and back at once on resume; one controller at a time', () => {
    const { room, clock, bots, log } = firstPreparation();
    expect(room.setConnected('s0', false)).toBe(true);
    clock.advance(4_999);
    expect(seat(room, 's0').controller).toBe('human');
    expect(log.some(record => record.seatId === 's0')).toBe(false);
    clock.advance(1);
    expect(seat(room, 's0')).toMatchObject({ controller: 'takeover', controlEpoch: 1, connected: false });
    // Same MatchState, same pool: a takeover recreates nothing.
    expect(toPlayerView(room.state, 's1', clock.now()).seats.find(entry => entry.seatId === 's0')!.controller).toBe('takeover');
    // The player cannot act on a bot-controlled seat (in practice they resume first).
    expect(room.handle('s0', { type: 'buyXp' })).toMatchObject({ ok: false, reason: 'seat-controlled' });
    clock.advance(3_000);
    const driven = log.filter(record => record.seatId === 's0');
    expect(driven.length).toBeGreaterThan(0);
    for (const record of driven) expect(record).toMatchObject({ controller: 'takeover', controlEpoch: 1 });
    const stepsBefore = bots.inspect('s0')!.stepsTaken;
    // Resume: the controller goes back to the human under a new generation; pending bot work is cancelled.
    expect(room.setConnected('s0', true)).toBe(true);
    expect(seat(room, 's0')).toMatchObject({ controller: 'human', controlEpoch: 2, connected: true });
    expect(bots.inspect('s0')!.pending).toBe(false);
    expect(bots.inspect('s0')!.takeoverPending).toBe(false);
    expect(room.handleBot('s0', 1, { type: 'buyXp' })).toMatchObject({ ok: false, reason: 'control-revoked' });
    expect(room.handleBot('s0', 2, { type: 'buyXp' })).toMatchObject({ ok: false, reason: 'control-revoked' });
    const count = log.length;
    clock.advance(5_000);
    expect(log.slice(count).some(record => record.seatId === 's0')).toBe(false);
    // A second takeover in the same round keeps the round's attempt count (§13.3 item 4).
    const round = room.state.round;
    room.setConnected('s0', false);
    clock.advance(5_000);
    expect(room.state.round).toBe(round);
    expect(seat(room, 's0')).toMatchObject({ controller: 'takeover', controlEpoch: 3 });
    expect(bots.inspect('s0')!.stepsTaken).toBeGreaterThanOrEqual(stepsBefore);
  }); }

  if (mode === 'fast') { it('does not take over a seat whose player came back in time, nor a fill-in bot seat or a seat in a finished room', () => {
    const { room, clock } = firstPreparation();
    room.setConnected('s1', false);
    clock.advance(4_000);
    room.setConnected('s1', true);
    clock.advance(10_000);
    expect(seat(room, 's1')).toMatchObject({ controller: 'human', controlEpoch: 0 });
    expect(room.takeOver('s4')).toBe(false);
    expect(room.takeOver('s2')).toBe(false); // still connected
    expect(seat(room, 's4').controller).toBe('bot');
  }); }

  if (mode === 'fast') { it('refuses a step that was already queued when the player resumed (control generation)', () => {
    const tasks: (() => void)[] = [];
    const ctx = botRoom(SEATS, { takeover: true, takeoverMs: 1_000, stepMs: 300, enqueue: task => tasks.push(task) });
    const { room, clock, log } = ctx;
    const drain = () => { while (tasks.length) tasks.shift()!(); };
    room.start();
    for (let guard = 0; room.state.phase !== 'preparation' && guard < 500; guard++) { clock.runNext(); drain(); }
    room.setConnected('s0', false);
    clock.advance(1_000); drain();
    expect(seat(room, 's0').controller).toBe('takeover');
    // Fire the takeover seat's first step timer, but leave the task waiting in the queue.
    clock.advance(300 + 300);
    const queued = tasks.length;
    expect(queued).toBeGreaterThan(0);
    const before = seat(room, 's0').match;
    room.setConnected('s0', true);
    drain();
    expect(log.some(record => record.seatId === 's0')).toBe(false);
    expect(seat(room, 's0').match).toBe(before);
  }); }
});
}
