import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { PlaceholderBattleResolver } from '../../src/server/room/battle-resolver';
import type { Room } from '../../src/server/room/room';
import type { RoomState } from '../../src/server/room/types';
import { makeRoom, runUntil } from './helpers';

type WorkSeam = { settlementWork: Generator<void, void, void> | null; runSettlementSlice(): void; clearTimer(): void };
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
    expect(room.deferDuringSettlement(() => order.push('command-1'))).toBe(true);
    expect(room.deferDuringSettlement(() => order.push('command-2'))).toBe(true);
    // The competing timer was received before the next slice was scheduled.
    clock.schedule(clock.now(), () => order.push('message'));
    seam(room).runSettlementSlice();
    expect(work).toBe(3); expect(clock.cpu).toBe(21); expect(order).toEqual([]);
    expect(clock.fireNext()).toBe(true); expect(order).toEqual(['message']);
    let callbacks = 0;
    while (clock.pending) {
      const before = clock.cpu;
      expect(clock.fireNext()).toBe(true);
      expect(clock.cpu - before).toBeLessThanOrEqual(21); // budget plus one 7 ms indivisible rules step, below 50 ms
      callbacks++;
    }
    expect(callbacks).toBeGreaterThan(30); expect(work).toBe(100);
    expect(order).toEqual(['message', 'command-1', 'command-2']);
    expect(room.deferDuringSettlement(() => order.push('late'))).toBe(false);
    room.dispose();
  });

  for (const cancel of ['dispose', 'abort'] as const) it(`${cancel} cancels in-flight settlement and its timer`, () => {
    const { room, clock } = makeRoom(undefined, { sliceTicks: 1 });
    room.start();
    seam(room).clearTimer();
    let work = 0, flushed = false;
    seam(room).settlementWork = (function* () { for (;;) { work++; yield; } })();
    seam(room).runSettlementSlice();
    room.deferDuringSettlement(() => { flushed = true; });
    if (cancel === 'dispose') room.dispose();
    else room.abort({ kind: 'invalid-results', detail: 'test cancellation' });
    expect(seam(room).settlementWork).toBeNull();
    expect(clock.pending).toBe(0);
    expect(clock.fireNext()).toBe(false); expect(work).toBe(1);
    expect(flushed).toBe(cancel === 'abort');
    room.dispose();
  });
});
