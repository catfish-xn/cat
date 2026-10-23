import { describe, expect, it } from 'vitest';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { readLootView } from '../../src/simulation/loot-view';
import { runUntil, SEATS, TIMINGS } from './helpers';

const orbIds = (room: Room, seatId: string) => (readLootView(room.state.seats.find(seat => seat.seatId === seatId)!.match).unclaimedOrbs ?? []).map(orb => orb.orbId).sort();

describe('streamed PvE: orbs drop at the kill, the last one included', () => {
  it('every orb of the round is on the live seat once its battle ended, before the settlement, and the settlement adds none', () => {
    const clock = new ManualClock();
    const room = new Room(SEATS.map(s => ({ ...s, kind: 'human' })), { ...ROOM_TIMING_DEFAULTS, ...TIMINGS,
      roomId: 'orb-drop', seed: 42, clock, resolver: new TwoSidedBattleResolver(), combatStreaming: true, sliceTicks: 8, sliceMs: 20 });
    room.start();
    let rounds = 0;
    for (let round = 1; round <= 4; round++) {
      runUntil(room, clock, s => s.round === round && s.phase === 'battle', 20_000);
      if (room.state.seats.some(seat => seat.match.m8.round.kind !== 'pve')) continue;
      const before = orbIds(room, 's0');
      runUntil(room, clock, () => room.combatStreamFor('s0')?.terminal != null, 20_000);
      expect(room.state.phase).toBe('battle');
      expect(room.state.seats.find(seat => seat.seatId === 's0')!.match.phase).toBe('combat');
      const atEnd = orbIds(room, 's0');
      runUntil(room, clock, s => s.settlements.length >= round, 20_000);
      expect(room.state.fault).toBeNull();
      const settled = orbIds(room, 's0');
      expect(settled).toEqual(atEnd);
      if (settled.length > before.length) rounds++;
    }
    // At least one PvE round of the seed dropped something, so the check above was not vacuous.
    expect(rounds).toBeGreaterThan(0);
    room.dispose();
  }, 60_000);
});
