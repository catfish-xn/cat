/* Regression: with seeds 22 and 38 (record-*-battle-start.cjs one-human/seven-bot setup) a bot previewed Recombobulator
 * at round 12 outside the room's shared-pool transaction; the rules threw out of the bot's timer, which ends the
 * server process (src/server/main.ts uncaughtException). The preview now gets `shared-pool-required` and leaves the
 * pick to the room, which runs it with the pool. */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { BotDriver, type BotStepRecord } from '../../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';

const THROUGH_ROUND = 13;

describe('Recombobulator bot preview in a shared-pool room', () => {
  it.each([22, 38])('seed %i plays past round 12; a bot takes Recombobulator through the room', seed => {
    const clock = new ManualClock();
    const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: i ? `bot-${i}` : 'seat-1', name: `s${i}`, kind: i ? 'bot' as const : 'human' as const }));
    const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'room-1', seed, clock, resolver: new TwoSidedBattleResolver(),
      combatStreaming: true, sliceTicks: 100, sliceMs: 20, sliceNow: () => 0, assertPoolConservation: true, carousel: CAROUSEL_RULES_BINDING });
    const steps: BotStepRecord[] = [];
    const bots = new BotDriver(room, seed, { onStep: record => steps.push(record) });
    try {
      room.start();
      for (let n = 0; room.state.round <= THROUGH_ROUND && n < 200000; n++) {
        expect(room.state.fault).toBeNull();
        const human = room.state.seats[0]!;
        if (room.state.phase === 'preparation' && human.alive && human.match.phase === 'preparation')
          while (room.state.seats[0]!.match.gold >= 4 && room.state.seats[0]!.match.level < 10)
            expect(room.handle('seat-1', { type: 'buyXp' }).ok).toBe(true);
        expect(clock.fireNext()).toBe(true);
      }
      expect(room.state.fault).toBeNull();
      const picks = steps.filter(s => s.action !== 'done' && s.action.type === 'choose' && s.action.definitionId === 'recombobulator');
      expect(picks.length).toBeGreaterThan(0);
      expect(picks.every(s => s.ok === true)).toBe(true);
      expect(room.state.seats.some(s => s.match.augments.some(a => a.definitionId === 'recombobulator'))).toBe(true);
      expect(steps.some(s => s.reason === 'policy-error')).toBe(false);
    } finally { bots.dispose(); room.dispose(); }
  }, 180_000);
});
