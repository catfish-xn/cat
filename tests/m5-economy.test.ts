import { describe, expect, it } from 'vitest';
import { planRoundEconomy, type RoundEconomyInput } from '../src/simulation/economy';
import { getShopOdds, getXpToNextLevel, grantXp } from '../src/simulation/progression';
import { generateShop } from '../src/simulation/shop';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';

const input = (overrides: Partial<RoundEconomyInput> = {}): RoundEconomyInput => ({
  stage: 2, roundKind: 'pvp', result: 'playerWin', gold: 49,
  streak: { kind: null, count: 0 }, level: 3, xp: 0, hp: 100, enemySurvivors: 0, ...overrides,
});

describe('M5 independent economic answers', () => {
  it.each([
    { name: '49G first win', value: input(), gold: 60, basis: 50, parts: { base: 5, win: 1, interest: 5, streak: 0 } },
    { name: '49G first loss', value: input({ result: 'enemyWin' }), gold: 58, basis: 49, parts: { base: 5, win: 0, interest: 4, streak: 0 } },
    { name: '9G second win', value: input({ gold: 9, streak: { kind: 'win', count: 1 } }), gold: 17, basis: 10, parts: { base: 5, win: 1, interest: 1, streak: 1 } },
    { name: '50G sixth loss', value: input({ gold: 50, result: 'enemyWin', streak: { kind: 'loss', count: 5 } }), gold: 63, basis: 50, parts: { base: 5, win: 0, interest: 5, streak: 3 } },
  ])('$name uses handwritten income, not a production oracle', ({ value, gold, basis, parts }) => {
    const plan = planRoundEconomy(value);
    expect(plan.goldAfter).toBe(gold);
    expect(plan.interestBasis).toBe(basis);
    expect(plan.incomeBreakdown).toEqual(parts);
    expect(plan.income).toBe(gold - value.gold);
    expect(plan.progression).toEqual({ level: 3, xp: 2, xpRequested: 2, xpApplied: 2, levelsGained: 0 });
  });

  it.each([[0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3]] as const)(
    'win/loss streak length %i advances with payout %i', (before, payout) => {
      for (const kind of ['win', 'loss'] as const) {
        const plan = planRoundEconomy(input({ result: kind === 'win' ? 'playerWin' : 'enemyWin',
          streak: { kind: before === 0 ? null : kind, count: before } }));
        expect(plan.streakAfter).toEqual({ kind, count: before + 1 });
        expect(plan.incomeBreakdown.streak).toBe(payout);
      }
    });

  it('resets opposite streaks and treats a draw as a loss', () => {
    expect(planRoundEconomy(input({ streak: { kind: 'loss', count: 8 } })).streakAfter).toEqual({ kind: 'win', count: 1 });
    const draw = planRoundEconomy(input({ result: 'draw', streak: { kind: 'win', count: 8 }, enemySurvivors: 3 }));
    expect(draw.streakAfter).toEqual({ kind: 'loss', count: 1 });
    expect(draw.playerDamage).toBe(5);
    expect(draw.incomeBreakdown).toEqual({ base: 5, win: 0, interest: 4, streak: 0 });
  });

  it.each(['pve', 'supply'] as const)('%s preserves streak and pays only base and interest', roundKind => {
    const plan = planRoundEconomy(input({ roundKind, result: roundKind === 'supply' ? null : 'playerWin',
      gold: 50, streak: { kind: 'win', count: 3 } }));
    expect(plan.streakAfter).toEqual({ kind: 'win', count: 3 });
    expect(plan.incomeBreakdown).toEqual({ base: 5, win: 0, interest: 5, streak: 0 });
    expect(plan.goldAfter).toBe(60);
    expect(plan.playerDamage).toBe(0);
  });

  it.each([[2, 2], [3, 5], [4, 8], [5, 10], [6, 12]] as const)(
    'stage %i has base damage %i and counts surviving enemy heroes once', (stage, base) => {
      const plan = planRoundEconomy(input({ stage, result: 'enemyWin', enemySurvivors: 4 }));
      expect([plan.baseDamage, plan.playerDamage, plan.hpLost, plan.hpAfter]).toEqual([base, base + 4, base + 4, 96 - base]);
    });

  it('PvE loss and draw deal exactly three regardless of survivors; fatal HP is clamped', () => {
    for (const result of ['enemyWin', 'draw'] as const) {
      const plan = planRoundEconomy(input({ roundKind: 'pve', result, hp: 2, enemySurvivors: 8 }));
      expect([plan.baseDamage, plan.playerDamage, plan.hpLost, plan.hpAfter]).toEqual([3, 3, 2, 0]);
      expect(plan.streakAfter).toEqual({ kind: null, count: 0 });
    }
  });

  it('caps interest, advances XP across a boundary and records cap overflow', () => {
    const plan = planRoundEconomy(input({ gold: 500, level: 7, xp: 47 }));
    expect(plan.incomeBreakdown.interest).toBe(5);
    expect(plan.progression).toEqual({ level: 8, xp: 1, xpRequested: 2, xpApplied: 2, levelsGained: 1 });
    expect(planRoundEconomy(input({ level: 8, xp: 75 })).progression).toEqual({ level: 9, xp: 0, xpRequested: 2, xpApplied: 1, levelsGained: 1 });
    expect(planRoundEconomy(input({ level: 9, xp: 0 })).progression).toEqual({ level: 9, xp: 0, xpRequested: 2, xpApplied: 0, levelsGained: 0 });
  });

  it('is a pure planner, preserving the caller even on rejection', () => {
    const value = input(); Object.freeze(value.streak); Object.freeze(value);
    const before = structuredClone(value);
    const first = planRoundEconomy(value);
    expect(planRoundEconomy(value)).toEqual(first);
    expect(value).toEqual(before);
    expect(first.streakAfter).not.toBe(value.streak);
  });

  it.each([
    { gold: -1 }, { gold: Number.MAX_SAFE_INTEGER }, { hp: 101 }, { hp: -1 }, { stage: 1 }, { stage: 7 },
    { enemySurvivors: 0.5 }, { level: 7, xp: 48 }, { level: 9, xp: 1 }, { result: null },
    { streak: { kind: null, count: 1 } }, { streak: { kind: 'win', count: 0 } },
    { streak: { kind: 'win', count: Number.MAX_SAFE_INTEGER } },
    { roundKind: 'supply', result: 'draw' }, { roundKind: 'supply', result: null, enemySurvivors: 1 },
  ] satisfies Partial<RoundEconomyInput>[])('rejects invalid input without producing a plan: %j', overrides => {
    const value = input(overrides), before = structuredClone(value);
    expect(() => planRoundEconomy(value)).toThrow(RangeError);
    expect(value).toEqual(before);
  });
});

describe('M5 frozen XP and shop', () => {
  it('uses the complete frozen level 3–9 table', () => {
    expect([3, 4, 5, 6, 7, 8, 9].map(getXpToNextLevel)).toEqual([6, 10, 20, 36, 48, 76, null]);
    expect([3, 4, 5, 6, 7, 8, 9].map(getShopOdds)).toEqual([
      [75,25,0,0,0], [55,30,15,0,0], [45,33,20,2,0], [30,40,25,5,0],
      [19,30,40,10,1], [18,25,32,22,3], [15,20,25,30,10],
    ]);
    expect(grantXp(7, 47, 4)).toEqual({ level: 8, xp: 3, xpRequested: 4, xpApplied: 4, levelsGained: 1 });
    expect(grantXp(8, 75, 4)).toEqual({ level: 9, xp: 0, xpRequested: 4, xpApplied: 1, levelsGained: 1 });
  });

  it('has exactly the 19 selectable heroes in stable code-point order', () => {
    expect(SHOP_CATALOG_BY_COST).toEqual({
      1: ['darius','irelia','lux','maddie','zyra'], 2: ['leona','rell','tristana','urgot','vander'],
      3: ['ezreal','kogmaw','loris','nami','scar'], 4: ['corki','garen','zoe'], 5: ['caitlyn'],
    });
  });

  it.each([
    { level: 3, definitions: ['darius', 'irelia', 'darius', 'darius', 'vander'] },
    { level: 9, definitions: ['leona', 'kogmaw', 'ezreal', 'ezreal', 'zoe'] },
  ])('seed 42 level $level uses independently tabulated 10-word shop', ({ level, definitions }) => {
    // Independent BigInt LCG tabulation: words 1/3/5/7/9 map to percentiles 25/57/37/44/87;
    // words 2/4/6/8/10 map within each bucket to 8/22/2/11/99 percentiles.
    expect(generateShop(42, 8, level)).toEqual({
      rngState: 4271921684,
      shop: { generation: 8, locked: false, slots: definitions.map(definitionId => ({ status: 'available', definitionId })) },
    });
  });

  it('keeps RNG consumption independent of level and allows seed zero', () => {
    expect([3,4,5,6,7,8,9].map(level => generateShop(42, 1, level).rngState)).toEqual(Array(7).fill(4271921684));
    expect(generateShop(0, 1, 3).shop.slots).toHaveLength(5);
    expect(() => generateShop(42, 0, 3)).toThrow(RangeError);
    expect(() => generateShop(42, 1, 10)).toThrow(RangeError);
  });
});
