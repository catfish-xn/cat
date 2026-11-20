/* Regression: with seed 20261012 the public one-human/seven-bot room (record-*-battle-start.cjs setup) faulted at
 * round 11 with `seat bot-3: battle-validation:invalid-snapshot` — a Shocking Troll Trundle's persistent growth was
 * refused by a Tristana-only snapshot check. Every growth validator now reads src/simulation/persistent-growth.ts. */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { BotDriver } from '../../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';

const SEED = 20261012, THROUGH_ROUND = 11;

describe('persistent growth: seed 20261012 room', () => {
  it('passes round 11 without a fault, with non-Tristana growth on a seat', () => {
    const clock = new ManualClock();
    const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: i ? `bot-${i}` : 'seat-1', name: `s${i}`, kind: i ? 'bot' as const : 'human' as const }));
    const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'room-1', seed: SEED, clock, resolver: new TwoSidedBattleResolver(),
      combatStreaming: true, sliceTicks: 100, sliceMs: 20, sliceNow: () => 0, assertPoolConservation: true, carousel: CAROUSEL_RULES_BINDING });
    const bots = new BotDriver(room, SEED);
    let sawForeignGrowth = false;
    try {
      room.start();
      for (let n = 0; room.state.round <= THROUGH_ROUND && n < 200000; n++) {
        expect(room.state.fault).toBeNull();
        expect(room.state.phase).not.toBe('ended');
        const human = room.state.seats[0]!;
        if (room.state.phase === 'preparation' && human.alive && human.match.phase === 'preparation')
          while (room.state.seats[0]!.match.gold >= 4 && room.state.seats[0]!.match.level < 10)
            expect(room.handle('seat-1', { type: 'buyXp' }).ok).toBe(true);
        sawForeignGrowth ||= room.state.seats.some(seat => seat.match.persistentGrowth.some(growth =>
          seat.match.preparation.units.find(u => u.id === growth.unitId)?.definitionId !== 'tristana'));
        expect(clock.fireNext()).toBe(true);
      }
      expect(room.state.fault).toBeNull();
      expect(room.state.round).toBe(THROUGH_ROUND + 1);
      // The scenario is still exercised: some seat carried growth on a champion other than Tristana into a battle.
      expect(sawForeignGrowth).toBe(true);
    } finally { bots.dispose(); room.dispose(); }
  }, 180_000);
});
