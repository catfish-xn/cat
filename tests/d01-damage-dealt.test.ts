import { beforeAll, describe, expect, it } from 'vitest';
import { applyRoundSettlement } from '../src/simulation/round-settlement';
import { pvpSettlementHpLost } from '../src/simulation/pvp-settlement-health';
import { MAX_SUPPORTED_PLAYER_HP } from '../src/simulation/augment-pool-batch5-h7-health';
import { toSeatPrivateView, toPublicBoard } from '../src/server/room/projection';
import type { MatchState } from '../src/simulation/match-types';
import { freeze } from './combat-helpers';
import { opening, receipt, settle } from './d01-helpers';

let base: MatchState;
beforeAll(() => { base = opening(); });

describe('D0 authoritative damage dealt', () => {
  it.each([0, 1, 35, MAX_SUPPORTED_PLAYER_HP])('commits and projects %i damage separately from incoming damage', damageDealt => {
    const next = settle(freeze(base), { damageDealt });
    expect(next.roundResults.at(-1)).toMatchObject({ playerDamage: 0, hpLost: 0, damageDealt });
    expect(next.multiplayer!.receipts.at(-1)!.damageDealt).toBe(damageDealt);
    expect(toSeatPrivateView(next).roundResults.at(-1)!.damageDealt).toBe(damageDealt);
    expect(JSON.stringify(toSeatPrivateView(next))).not.toContain('settlementId');
    expect(JSON.stringify(toPublicBoard(next))).not.toContain('damageDealt');
    expect(next.rngState).toBe(base.rngState);
  });

  it.each([-1, 0.5, MAX_SUPPORTED_PLAYER_HP + 1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, null, '35', undefined])(
    'atomically rejects an invalid explicitly present damageDealt: %s', damageDealt => {
      const before = JSON.stringify(base);
      const result = applyRoundSettlement(freeze(base), { ...receipt(base), damageDealt });
      expect(result).toEqual({ ok: false, state: base, reason: 'invalid-receipt' });
      expect(result.state).toBe(base);
      expect(JSON.stringify(base)).toBe(before);
    },
  );

  it('keeps solo/PvE history and legacy direct receipts free of the optional key', () => {
    for (const row of base.roundResults) expect(Object.hasOwn(row, 'damageDealt')).toBe(false);
    for (const row of toSeatPrivateView(base).roundResults) expect(Object.hasOwn(row, 'damageDealt')).toBe(false);
    const { damageDealt: _, ...legacy } = receipt(base);
    const result = applyRoundSettlement(base, legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.reason);
    expect(Object.hasOwn(result.state.roundResults.at(-1)!, 'damageDealt')).toBe(false);
    expect(Object.hasOwn(result.state.multiplayer!.receipts.at(-1)!, 'damageDealt')).toBe(false);
  });

  it('reads actual clipped HP loss without mutating state or consuming RNG', () => {
    const low = freeze({ ...base, playerHp: 2 });
    const before = JSON.stringify(low);
    expect(pvpSettlementHpLost(low, { damage: 9 })).toBe(2);
    expect(pvpSettlementHpLost(low, { damage: 0 })).toBe(0);
    expect(JSON.stringify(low)).toBe(before);
    for (const damage of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => pvpSettlementHpLost(low, { damage })).toThrow(RangeError);
  });
});
