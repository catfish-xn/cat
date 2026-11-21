/* Regression: seed 200 (record-*-battle-start.cjs one-human/seven-bot setup) faulted at round 26 with
 * `seat bot-4: invalid-receipt`: an opponent ended a lost battle with eleven counted survivors, and the receipt check
 * capped survivors at the max level. The cap is now the board ceiling (src/simulation/survivor-bound.ts). */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { BotDriver } from '../../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';

const SEED = 200, THROUGH_ROUND = 26;

describe('survivor bound: seed 200 room', () => {
  it('settles round 26 with eleven opposing survivors and no fault', () => {
    const clock = new ManualClock();
    const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: i ? `bot-${i}` : 'seat-1', name: `s${i}`, kind: i ? 'bot' as const : 'human' as const }));
    const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'room-1', seed: SEED, clock, resolver: new TwoSidedBattleResolver(),
      combatStreaming: true, sliceTicks: 100, sliceMs: 20, sliceNow: () => 0, assertPoolConservation: true, carousel: CAROUSEL_RULES_BINDING });
    const bots = new BotDriver(room, SEED);
    let maxSurvivors = 0;
    try {
      room.start();
      for (let n = 0; room.state.round <= THROUGH_ROUND && room.state.phase !== 'ended' && n < 400000; n++) {
        expect(room.state.fault).toBeNull();
        const human = room.state.seats[0]!;
        if (room.state.phase === 'preparation' && human.alive && human.match.phase === 'preparation')
          while (room.state.seats[0]!.match.gold >= 4 && room.state.seats[0]!.match.level < 10)
            expect(room.handle('seat-1', { type: 'buyXp' }).ok).toBe(true);
        for (const seat of room.state.seats) for (const result of seat.match.roundResults) maxSurvivors = Math.max(maxSurvivors, result.survivingEnemyCount);
        expect(clock.fireNext()).toBe(true);
      }
      expect(room.state.fault).toBeNull();
      expect(room.state.round).toBeGreaterThan(THROUGH_ROUND);
      expect(maxSurvivors).toBeGreaterThan(10); // the scenario is still exercised
    } finally { bots.dispose(); room.dispose(); }
  }, 300_000);
});
