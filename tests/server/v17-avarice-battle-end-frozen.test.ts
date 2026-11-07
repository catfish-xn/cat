/**
 * v17 server acceptance 5 (docs/V17_AVARICE_ONLINE.md): gold changes near the end of a battle. The live run follows the
 * battle clock LIVE_BANK_LEAD_TICKS ahead; a change whose live tick is past the frozen end is not sampled, one exactly at
 * the end has no rules step left to read it, and a change after a live run finished leaves its result alone. None of
 * these faults or re-settles; the economy command itself still changes only the seat's real gold.
 */
import { describe, expect } from 'vitest';
import { pvpBattleOf, seatOf, spendGold } from './v17-avarice-helpers';
import { liveTickAt } from './v17-avarice-battle-end-helpers';

import { atBattleRoute } from './avarice-route';
import { registerSlowRoute, routeUntil } from './slow-route';

describe('v17 avarice: gold changes at the end of a battle', () => {
  registerSlowRoute('exactly at the frozen end, or past it, the change is not sampled and the frozen battle settles; no fault', function* (env) {
    for (const offset of [0, 1, 40]) {
      // R1 also deploys bot benches at timeout. s2 now lasts 546 ticks; use the
      // real s3/s4 battle (222 ticks), leaving all three offsets inside 4-6.
      // v26 (14.24 neutrals 568eeea4, PvE loss damage, targeting P0/P1, D5 offers) re-pairs 4-6: s3 now meets s2 for 756
      // ticks (50 ms each), so end+40 lands past the 4-6 deadline. Use the real human-vs-bot s0/s5 battle (468 ticks).
      const { room, clock, seat, frozen, end, startedAt } = yield* atBattleRoute(env, 's0');
      expect(frozen.battle.a.seatId).toBe('s0');
      expect(frozen.battle.b.seatId).toBe('s5');
      expect(end).toBe(468);
      expect(room.state.roundName).toBe('4-6');
      expect(room.state.phase).toBe('battle');
      const sampleAt = liveTickAt(startedAt, end + offset);
      expect(sampleAt).toBeLessThan(room.state.deadlineAt!);
      const hp = seatOf(room.state, seat).hp;
      clock.advance(sampleAt - clock.now());
      expect(room.state.roundName).toBe('4-6');
      expect(room.state.phase).toBe('battle');
      const before = seatOf(room.state, seat).match.gold;
      const gold = spendGold(room, seat);
      // The economy command itself went through: only the seat's real gold changed.
      expect(gold).toBeLessThan(before);
      expect(room.liveFrames(frozen.battleId)).toBeNull();
      yield* routeUntil(room, clock, state => state.roundName === '4-6' && state.phase !== 'battle');
      expect(room.state.fault, `offset ${offset}`).toBeNull();
      expect(pvpBattleOf(room.state, seat), `offset ${offset}`).toBe(frozen);
      expect(seatOf(room.state, seat).hp).toBe(Math.max(0, hp - frozen.proposals.a.damage));
      room.dispose();
    }
  });
});
