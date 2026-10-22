import { describe, expect, it, vi } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { PlaceholderBattleResolver } from '../../src/server/room/battle-resolver';
import { MAX_STALE_SEAT_RETRIES, type Room } from '../../src/server/room/room';
import { readLootView } from '../../src/simulation/match';
import type { RoomState } from '../../src/server/room/types';
import { makeRoom, runUntil } from './helpers';

type WorkSeam = { settlementWork: Generator<void, void, void> | null; runSettlementSlice(): void; clearTimer(): void; commitPending(): void; drainingSettlementCommands: boolean; settlementFrozen: boolean };
const seam = (room: Room) => room as unknown as WorkSeam;

/** Reads a controllable CPU clock without moving/firing the timer queue recursively. */
class CpuClock extends ManualClock {
  cpu = 0;
  override now(): number { return super.now() + this.cpu; }
}

describe('settlement slices', () => {
  for (const avarice of [false, true]) it(`preserves every global byte and publication through PvE round 3 (live gold=${avarice})`, () => {
    function run(sliceTicks?: number) {
      const { room, clock } = makeRoom(new PlaceholderBattleResolver(), { sliceTicks });
      const publications: string[] = [];
      try {
        room.start();
        runUntil(room, clock, s => s.round === 3 && s.phase === 'preparation');
        if (avarice) {
          const holder = room as unknown as { current: RoomState };
          holder.current = { ...room.state, seats: room.state.seats.map(seat => {
            if (seat.seatId !== 's0') return seat;
            const unit = seat.match.preparation.units.find(u => u.team === 'player' && u.location.kind === 'board')!;
            return { ...seat, match: { ...seat.match, anomalyBinding: {
              definitionId: 'avarice-incarnate', unitId: unit.id, choiceId: 'slice-test', boundRound: 3,
            } } };
          }) };
        }
        runUntil(room, clock, s => s.round === 3 && s.phase === 'battle');
        const seat = room.state.seats[0]!;
        expect(room.handle(seat.seatId, { type: 'shopLock', locked: true, generation: seat.match.shop.generation }).ok).toBe(true);
        // A lock invalidates the stage. Also change the bank on the live-reader path.
        if (avarice) expect(room.handle(seat.seatId, { type: 'buyXp' }).ok).toBe(true);
        room.subscribe(s => publications.push(JSON.stringify(s)));
        // Same logical arrival time: sync buys immediately before settlement, sliced buys after its first yield.
        seam(room).clearTimer();
        const buy = () => {
          const latest = room.state.seats[0]!;
          const slot = latest.match.shop.slots.findIndex(offer => offer.status === 'available');
          expect(room.handle(latest.seatId, { type: 'buy', slot, generation: latest.match.shop.generation }).ok).toBe(true);
        };
        if (sliceTicks) {
          seam(room).commitPending();
          expect(room.deferDuringSettlement(buy)).toBe(true);
        } else { buy(); seam(room).commitPending(); }
        runUntil(room, clock, s => s.phase !== 'battle');
        expect(room.state.fault).toBeNull();
        expect(room.state.settlements).toContain('test-room:round-3');
        return { state: JSON.stringify(room.state), publications };
      } finally { room.dispose(); }
    }
    expect(run(1)).toEqual(run());
  }, 60_000);

  it('checks the 20 ms budget after each work unit, yields to timers, then releases commands FIFO', () => {
    const clock = new CpuClock();
    const { room } = makeRoom(undefined, { clock, sliceMs: 20 });
    const order: string[] = [];
    let work = 0;
    seam(room).settlementWork = (function* () {
      for (let n = 0; n < 100; n++) { clock.cpu += 7; work++; yield; }
    })();
    expect(room.deferDuringSettlement(() => { clock.cpu += 7; order.push('command-1'); })).toBe(true);
    expect(room.deferDuringSettlement(() => { clock.cpu += 7; order.push('command-2'); })).toBe(true);
    // The competing timer was received before the next slice was scheduled.
    clock.schedule(clock.now(), () => order.push('message'));
    seam(room).runSettlementSlice();
    expect(work).toBe(1); expect(clock.cpu).toBe(21); expect(order).toEqual(['command-1', 'command-2']);
    expect(clock.fireNext()).toBe(true); expect(order).toEqual(['command-1', 'command-2', 'message']);
    let callbacks = 0;
    while (clock.pending) {
      const before = clock.cpu;
      expect(clock.fireNext()).toBe(true);
      expect(clock.cpu - before).toBeLessThanOrEqual(21); // budget plus one 7 ms indivisible rules step, below 50 ms
      callbacks++;
    }
    expect(callbacks).toBeGreaterThan(30); expect(work).toBe(100);
    expect(order).toEqual(['command-1', 'command-2', 'message']);
    expect(room.deferDuringSettlement(() => order.push('late'))).toBe(false);
    room.dispose();
  });

  for (const cancel of ['dispose', 'abort'] as const) for (const frozen of [false, true]) it(`${cancel} cancels in-flight settlement and its timer (frozen=${frozen})`, () => {
    const { room, clock } = makeRoom(undefined, { sliceTicks: 1 });
    room.start();
    seam(room).clearTimer();
    let work = 0, flushed = false;
    room.startSettlementWork(() => (function* () { for (;;) { work++; yield; } })());
    if (frozen) {
      room.deferDuringSettlement(() => {});
      expect(clock.fireNext()).toBe(true);
      expect(seam(room).settlementFrozen).toBe(true);
    }
    room.deferDuringSettlement(() => { flushed = true; });
    const beforeCancel = work;
    if (cancel === 'dispose') room.dispose();
    else room.abort({ kind: 'invalid-results', detail: 'test cancellation' });
    expect(seam(room).settlementWork).toBeNull();
    expect(seam(room).settlementFrozen).toBe(false);
    expect(clock.pending).toBe(0);
    expect(clock.fireNext()).toBe(false); expect(work).toBe(beforeCancel);
    expect(flushed).toBe(cancel === 'abort');
    room.dispose();
  });
  it('queues every public seat writer and walks until the next slice, on the original state', () => {
    const { room, clock } = makeRoom(undefined, { sliceTicks: 1 });
    room.start(); runUntil(room, clock, state => state.round === 3 && state.phase === 'preparation');
    seam(room).clearTimer();
    room.setConnected('s1', false);
    const before = room.state;
    seam(room).settlementWork = (function* () { yield; yield; })();
    const bot = before.seats.find(seat => seat.kind === 'bot')!;
    const humanOrb = readLootView(before.seats[0]!.match).unclaimedOrbs![0]!;
    expect(humanOrb).toBeDefined();
    expect(readLootView(bot.match).unclaimedOrbs!.length).toBeGreaterThan(0);
    const lock = { type: 'shopLock' as const, locked: true, generation: bot.match.shop.generation };
    expect(room.handleBot(bot.seatId, bot.controlEpoch, lock)).toMatchObject({ reason: 'settlement-pending' });
    expect(room.claimBotOrbs(bot.seatId, bot.controlEpoch)).toMatchObject({ reason: 'settlement-pending' });
    expect(room.takeOver('s1')).toBe(true);
    expect(room.setConnected('s0', false)).toBe(true);
    expect(room.walkLegend('s0', { scene: 'board', to: { x: 1, y: 1 } })).toMatchObject({ reason: 'settlement-pending' });
    expect(room.handle('s0', { type: 'claimOrb', round: before.round, orbId: humanOrb.orbId })).toMatchObject({ reason: 'settlement-pending' });
    expect(room.state).toBe(before); expect(room.walks).toHaveLength(0);
    seam(room).runSettlementSlice();
    while (seam(room).drainingSettlementCommands) expect(clock.fireNext()).toBe(true);
    expect(room.state.seats.find(seat => seat.seatId === 's1')!.controller).toBe('takeover');
    expect(room.state.seats[0]!.connected).toBe(false);
    expect(room.state.seats.find(seat => seat.seatId === bot.seatId)!.match.shop.locked).toBe(true);
    expect(room.walks).toHaveLength(1);
    expect(readLootView(room.state.seats[0]!.match).unclaimedOrbs!.some(orb => orb.orbId === humanOrb.orbId)).toBe(false);
    expect(readLootView(room.state.seats.find(seat => seat.seatId === bot.seatId)!.match).unclaimedOrbs).toHaveLength(0);
    while (room.retained.resolving) expect(clock.fireNext()).toBe(true);
    room.dispose();
  }, 60_000);

  it('faults with an explicit reason after bounded stale-seat retries', () => {
    const { room, clock } = makeRoom();
    room.start(); runUntil(room, clock, state => state.phase === 'battle');
    const commit = vi.spyOn(room, 'commitSettlement').mockImplementation(() => ({ ok: false, reason: 'stale-seat', state: room.state }));
    runUntil(room, clock, state => state.phase === 'ended');
    expect(commit).toHaveBeenCalledTimes(MAX_STALE_SEAT_RETRIES + 1);
    expect(room.state.fault).toEqual({ kind: 'invalid-results', detail: `stale-seat-retry-limit:${MAX_STALE_SEAT_RETRIES}` });
    expect(room.retained.resolving).toBe(false);
    expect(clock.pending).toBe(0);
    room.dispose();
  });

  it('rebuilds once, then finishes within the slice budget despite more than nine batches of writers', () => {
    const clock = new CpuClock();
    const { room } = makeRoom(undefined, { clock, sliceTicks: 1, sliceMs: 20 });
    room.start(); seam(room).clearTimer();
    let builds = 0, published = false;
    const order: number[] = [], afterPublication: boolean[] = [];
    room.startSettlementWork(() => (function* () {
      builds++;
      for (let n = 0; n < 30; n++) { clock.cpu += 7; yield; }
      published = true;
    })());
    const enqueue = (id: number) => expect(room.deferDuringSettlement(() => {
      order.push(id); afterPublication.push(published);
    })).toBe(true);
    enqueue(0); enqueue(1);
    expect(clock.fireNext()).toBe(true); // First batch starts draining; its boundary is already frozen.
    enqueue(2);
    let batches = 0;
    while (room.retained.resolving && batches < 100) {
      enqueue(batches + 3);
      const before = clock.cpu;
      expect(clock.fireNext()).toBe(true);
      expect(clock.cpu - before).toBeLessThanOrEqual(21);
      batches++;
    }
    expect(batches).toBeGreaterThan(9);
    expect(room.retained.resolving).toBe(false);
    expect(builds).toBe(2);
    expect(published).toBe(true);
    expect(order).toEqual(Array.from({ length: batches + 3 }, (_, n) => n));
    expect(afterPublication).toEqual([false, false, ...Array<boolean>(batches + 1).fill(true)]);
    expect(room.state.fault).toBeNull();
    expect(clock.pending).toBe(0);
    room.dispose();
  });

});
