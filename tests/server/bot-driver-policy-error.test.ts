/* A policy exception is contained in its step: the seat stops for the round, the room keeps running. */
import { describe, expect, it, vi } from 'vitest';

const fault = vi.hoisted(() => ({ seatId: 'bot-2', thrown: 0 }));
vi.mock('../../src/server-entry', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/server-entry')>();
  return { ...real,
    decideBotAction: (...args: Parameters<typeof real.decideBotAction>) => {
      if (args[1].self.seatId === fault.seatId) { fault.thrown++; throw new RangeError('policy failure'); }
      return real.decideBotAction(...args);
    } };
});

import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { BotDriver, type BotStepRecord } from '../../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';

describe('BotDriver policy exception', () => {
  it('records policy-error once per round for that seat and never escapes the clock', () => {
    const clock = new ManualClock();
    const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: i ? `bot-${i}` : 'seat-1', name: `s${i}`, kind: i ? 'bot' as const : 'human' as const }));
    const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'policy-error', seed: 7, clock, resolver: new TwoSidedBattleResolver() });
    const steps: BotStepRecord[] = [];
    const bots = new BotDriver(room, 7, { onStep: record => steps.push(record) });
    try {
      room.start();
      for (let n = 0; room.state.round <= 3 && n < 50000; n++) {
        expect(room.state.fault).toBeNull();
        expect(clock.fireNext()).toBe(true);
      }
      const errors = steps.filter(s => s.reason === 'policy-error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.every(s => s.seatId === fault.seatId && s.action === 'done' && s.ok === false)).toBe(true);
      expect(new Set(errors.map(s => s.round)).size).toBe(errors.length);
      expect(fault.thrown).toBe(errors.length);
      expect(steps.some(s => s.seatId !== fault.seatId && s.action !== 'done')).toBe(true);
    } finally { bots.dispose(); room.dispose(); }
  }, 120_000);
});
