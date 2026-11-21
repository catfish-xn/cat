/* Regression: seeds 91 and 106 (record-*-battle-start.cjs one-human/seven-bot setup) crashed the room timer with a
 * TypeError: a periodic effect or status still named a source unit that a Trench split had removed from combat, and
 * the pulse looked that source up without a null check. The removed source is now kept in CombatState.departedUnits
 * (src/simulation/effect-source.ts) and the effect runs to its end with its original source. Both rooms ended in a
 * resolver-error fault at these rounds before the fix. */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { BotDriver } from '../../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';

describe('departed effect source: seed rooms', () => {
  it.each([[91, 22], [106, 23]])('seed %i runs past round %i with no fault', (seed, throughRound) => {
    const clock = new ManualClock();
    const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: i ? `bot-${i}` : 'seat-1', name: `s${i}`, kind: i ? 'bot' as const : 'human' as const }));
    const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'room-1', seed, clock, resolver: new TwoSidedBattleResolver(),
      combatStreaming: true, sliceTicks: 100, sliceMs: 20, sliceNow: () => 0, assertPoolConservation: true, carousel: CAROUSEL_RULES_BINDING });
    const bots = new BotDriver(room, seed);
    try {
      room.start();
      for (let n = 0; room.state.round <= throughRound && room.state.phase !== 'ended' && n < 400000; n++) {
        expect(room.state.fault).toBeNull();
        const human = room.state.seats[0]!;
        if (room.state.phase === 'preparation' && human.alive && human.match.phase === 'preparation')
          while (room.state.seats[0]!.match.gold >= 4 && room.state.seats[0]!.match.level < 10)
            expect(room.handle('seat-1', { type: 'buyXp' }).ok).toBe(true);
        expect(clock.fireNext()).toBe(true);
      }
      expect(room.state.fault).toBeNull();
      expect(room.state.round).toBeGreaterThan(throughRound);
    } finally { bots.dispose(); room.dispose(); }
  }, 300_000);
});
