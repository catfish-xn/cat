/**
 * Work order B8: what a server holds from one match to the next. Matches run back to back on a ManualClock; after
 * every end the pending timers, the room's own leftovers (frozen envelopes, staged settlement,
 * listeners) and the credentials return to the same baseline, and a replaced room is disposed and silent. The frozen
 * round is resolved in clock slices: the sliced and the one-shot resolution publish the same rounds.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Lobby } from '../../src/server/room/lobby';
import { SLICE_STEP_TICKS, type Room, type RoomRetained } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState } from '../../src/server/room/types';
import { DamageResolver, TIMINGS, makeRoom, runUntil } from './helpers';
import { expectOk, flush, startServer, type NetHarness } from './net/helpers';

const MATCHES = 5;
const RELEASED: RoomRetained = { timers: 0, listeners: 0, frozenInputs: 0, pendingSettlement: false, resolving: false };

/** Every seat but `survivor` takes 100 damage in round 1, so a match ends after one PvE round with a full ranking. */
function oneRoundResolver(survivor: () => string): DamageResolver {
  return new DamageResolver(seatId => seatId === survivor() ? 0 : 100);
}
function runToEnd(room: Room, clock: ManualClock): RoomState {
  const state = runUntil(room, clock, current => current.phase === 'ended');
  expect(state.fault).toBeNull();
  expect(state.ranking).toHaveLength(8);
  return state;
}

describe('B8 lifecycle: a lobby running matches back to back', () => {
  it('returns timers and room leftovers to the baseline after every match and disposes the replaced room', () => {
    const clock = new ManualClock();
    let survivor = '';
    // Room mechanics only (B6): no bot driver, so the clock holds nothing but the room's own deadlines.
    const lobby = new Lobby({ clock, resolver: oneRoundResolver(() => survivor), seed: 42, timings: TIMINGS, bots: null });
    expect(clock.pending).toBe(0);
    let previous: Room | null = null;
    const publications: number[] = [];
    for (let match = 0; match < MATCHES; match++) {
      const joined = lobby.join(`p${match}`); if (!joined.ok) throw new Error(joined.reason);
      survivor = joined.seatId;
      const started = lobby.start(); if (!started.ok) throw new Error(started.reason);
      const room = started.room;
      let published = 0;
      room.subscribe(() => { published++; });
      // The replaced room was disposed by the start: no timer, no listener, and nothing it could still publish.
      if (previous) {
        expect(previous.retained).toEqual(RELEASED);
        const revision = previous.state.roomRevision;
        // Short of the new room's own preparation deadline: only the replaced room's (cancelled) timers could fire here.
        clock.advance(TIMINGS.preparationMs / 2);
        expect(previous.state.roomRevision).toBe(revision);
      }
      // While a round is played the room does hold the round's envelopes and staged settlement: the baseline below is a release, not an empty run.
      runUntil(room, clock, current => current.phase === 'battle');
      expect(room.retained.frozenInputs).toBe(8);
      expect(room.retained.pendingSettlement).toBe(true);
      const ended = runToEnd(room, clock);
      expect(ended.ranking![0]!.seatId).toBe(survivor);
      expect(clock.pending).toBe(0);
      expect(room.retained).toEqual({ ...RELEASED, listeners: 1 });
      // The ended view still carries the final round's results.
      expect(ended.battles).toHaveLength(8);
      publications.push(published);
      previous = room;
    }
    // Same match each time: the same number of publications, nothing accumulates from match to match.
    expect(new Set(publications).size).toBe(1);
    lobby.dispose();
    expect(previous!.retained).toEqual(RELEASED);
    expect(clock.pending).toBe(0);
  });
});

describe('B8 lifecycle: the network server across matches', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  it('keeps connections, credentials, dedupe windows and timers at the same baseline after each of five matches', async () => {
    let survivor = '';
    harness = await startServer({}, oneRoundResolver(() => survivor));
    const { server, clock } = harness;
    const baselines: unknown[] = [];
    let previousSeats: string[] = [];
    for (let match = 0; match < MATCHES; match++) {
      const a = await harness.connect(), b = await harness.connect();
      expectOk(await a.join(`甲${match}`));
      expectOk(await b.join(`乙${match}`));
      survivor = a.seatId!;
      expectOk(await a.start());
      // The previous match's credentials died with it: only this match's two seats hold a session.
      expect(server.retained.sessions).toBe(2);
      for (const seatId of previousSeats) expect(server.room!.state.seats.some(seat => seat.seatId === seatId)).toBe(false);
      await a.waitFor(message => message.type === 'state');
      runToEnd(server.room!, clock);
      await a.waitForView(view => view.phase.kind === 'ended');
      await Promise.all([a.close(), b.close()]);
      await flush();
      expect(clock.pending).toBe(0);
      baselines.push(server.retained);
      previousSeats = [a.seatId!, b.seatId!];
    }
    // Receipts kept per match: A's join and start, B's join. Room listeners: only the server's push; the lobby released
    // its bot driver (B6) and its own watch when the room ended (G3).
    expect(baselines[0]).toEqual({ sessions: 2, dedupeEntries: 3, connections: 0, room: { ...RELEASED, listeners: 1 } });
    for (const baseline of baselines) expect(baseline).toEqual(baselines[0]);
  }, 30_000);
});

describe('B8 sliced resolution', () => {
  const prepared = new Map<string, ReturnType<typeof makeRoom>>();
  for (const key of ['commands', 'dispose']) beforeAll(() => {
    const own = makeRoom(new TwoSidedBattleResolver(), { sliceTicks: 50 });
    own.room.start();
    runUntil(own.room, own.clock, current => current.round === 4 && current.phase === 'preparation');
    prepared.set(key, own);
  });
  // Every clock read during resolution costs 1 ms, as if each step of rules work took that long.
  class BusyClock extends ManualClock { busy = false; override now(): number { if (this.busy) this.advance(1); return super.now(); } }
  let budgetInput: { oneShot: ReturnType<typeof makeRoom>; clock: BusyClock; room: Room };
  beforeAll(() => {
    const oneShot = makeRoom(new TwoSidedBattleResolver(), { sliceTicks: 50 });
    const clock = new BusyClock();
    const { room } = makeRoom(new TwoSidedBattleResolver(), { sliceTicks: 50, sliceMs: 1, clock });
    for (const { room: each } of [oneShot, { room }]) each.start();
    const ready = (current: RoomState) => current.round === 4 && current.phase === 'preparation';
    runUntil(oneShot.room, oneShot.clock, ready); runUntil(room, clock, ready);
    budgetInput = { oneShot, clock, room };
  });
  afterAll(() => {
    for (const own of prepared.values()) own.room.dispose();
    budgetInput.oneShot.room.dispose(); budgetInput.room.dispose();
  });

  it('publishes the same rounds whether a frozen round is resolved in one go or in slices of a few ticks', () => {
    const oneShot = makeRoom(new TwoSidedBattleResolver());
    const sliced = makeRoom(new TwoSidedBattleResolver(), { sliceTicks: 37 });
    for (const { room } of [oneShot, sliced]) room.start();
    const reached = (current: RoomState) => current.round === 4 && current.phase === 'settlement';
    const a = runUntil(oneShot.room, oneShot.clock, reached), b = runUntil(sliced.room, sliced.clock, reached);
    expect(a.fault).toBeNull();
    expect(b.settlements).toEqual(a.settlements);
    expect(b.seats.map(seat => [seat.seatId, seat.hp, seat.seatRevision])).toEqual(a.seats.map(seat => [seat.seatId, seat.hp, seat.seatRevision]));
    expect(JSON.stringify(b.seats.map(seat => seat.match))).toBe(JSON.stringify(a.seats.map(seat => seat.match)));
    expect(b.pool).toEqual(a.pool);
    expect(JSON.stringify(b.battles)).toBe(JSON.stringify(a.battles));
    // Only the bookkeeping differs: the sliced room published the same states but needed more clock slices.
    expect(b.roomRevision).toBe(a.roomRevision);
  }, 120_000);

  it('refuses commands while the round is frozen and resolves one slice per clock turn', () => {
    const { room, clock } = prepared.get('commands')!;
    clock.fireNext();
    // The deadline froze the round and scheduled the first slice; nothing is resolved yet.
    expect(room.state.phase).toBe('frozen');
    expect(room.state.battles).toEqual([]);
    expect(room.handle('s0', { type: 'buyXp' })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    let slices = 0;
    while (room.state.phase === 'frozen') { expect(clock.fireNext()).toBe(true); slices++; }
    expect(room.state.phase).toBe('battle');
    expect(room.state.battles).toHaveLength(4);
    // Since §19 (C19 item 3) a PvP battle is a resumable task: one slice per started 50-tick budget of each battle,
    // the one that finishes it included (the old indivisible entry took exactly one slice per battle).
    const ticks = room.state.battles.map(battle => battle.kind === 'two-sided' ? battle.battle.terminal.tick : 0);
    expect(slices).toBe(ticks.reduce((sum, tick) => sum + Math.max(1, Math.ceil(tick / 50)), 0));
    expect(slices).toBeGreaterThan(4);
  }, 60_000);

  it('ends a slice once the clock passed sliceMs, in steps of SLICE_STEP_TICKS, and publishes the same round', () => {
    const { oneShot, clock, room } = budgetInput;
    oneShot.clock.fireNext(); clock.fireNext();
    expect(room.state.phase).toBe('frozen');
    clock.busy = true;
    let slices = 0;
    while (room.state.phase === 'frozen') { expect(clock.fireNext()).toBe(true); slices++; }
    clock.busy = false;
    while (oneShot.room.state.phase === 'frozen') oneShot.clock.fireNext();
    expect(room.state.fault).toBeNull();
    // A 1 ms budget is spent by the first step: one slice per started SLICE_STEP_TICKS of each battle, not per 50.
    const ticks = room.state.battles.map(battle => battle.kind === 'two-sided' ? battle.battle.terminal.tick : 0);
    expect(slices).toBe(ticks.reduce((sum, tick) => sum + Math.max(1, Math.ceil(tick / SLICE_STEP_TICKS)), 0));
    expect(slices).toBeGreaterThan(ticks.reduce((sum, tick) => sum + Math.max(1, Math.ceil(tick / 50)), 0));
    expect(JSON.stringify(room.state.battles)).toBe(JSON.stringify(oneShot.room.state.battles));
  }, 60_000);

  it('stops resolving and publishes nothing once disposed in the middle of a frozen round', () => {
    const { room, clock } = prepared.get('dispose')!;
    clock.fireNext(); clock.fireNext();
    expect(room.state.phase).toBe('frozen');
    expect(room.retained.resolving).toBe(true);
    let published = 0;
    room.subscribe(() => { published++; });
    const revision = room.state.roomRevision;
    room.dispose();
    expect(room.retained).toEqual(RELEASED);
    expect(clock.pending).toBe(0);
    clock.advance(60_000);
    expect(published).toBe(0);
    expect(room.state.roomRevision).toBe(revision);
  }, 60_000);
});
