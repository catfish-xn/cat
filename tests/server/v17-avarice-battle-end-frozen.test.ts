/**
 * v17 server acceptance 5 (docs/V17_AVARICE_ONLINE.md): gold changes near the end of a battle. The live run follows the
 * battle clock LIVE_BANK_LEAD_TICKS ahead; a change whose live tick is past the frozen end is not sampled, one exactly at
 * the end has no rules step left to read it, and a change after a live run finished leaves its result alone. None of
 * these faults or re-settles; the economy command itself still changes only the seat's real gold.
 */
import { describe, expect, it } from 'vitest';
import { pvpBattleOf, seatOf, spendGold } from './v17-avarice-helpers';
import { atBattle, disposeAfterEach, liveTickAt, settle } from './v17-avarice-battle-end-helpers';

// Split out of v17-avarice-battle-end.test.ts (three whole rooms to 4-6) so it runs on its own worker.
disposeAfterEach();

describe('v17 avarice: gold changes at the end of a battle', () => {
  it('exactly at the frozen end, or past it, the change is not sampled and the frozen battle settles; no fault', () => {
    for (const offset of [0, 1, 40]) {
      const { room, clock, seat, frozen, end, startedAt } = atBattle();
      const hp = seatOf(room.state, seat).hp;
      clock.advance(liveTickAt(startedAt, end + offset) - clock.now());
      expect(room.state.phase).toBe('battle');
      const before = seatOf(room.state, seat).match.gold;
      const gold = spendGold(room, seat);
      // The economy command itself went through: only the seat's real gold changed.
      expect(gold).toBeLessThan(before);
      expect(room.liveFrames(frozen.battleId)).toBeNull();
      settle(room, clock);
      expect(room.state.fault, `offset ${offset}`).toBeNull();
      expect(pvpBattleOf(room.state, seat), `offset ${offset}`).toBe(frozen);
      expect(seatOf(room.state, seat).hp).toBe(Math.max(0, hp - frozen.proposals.a.damage));
      room.dispose();
    }
  }, 300_000);
});
