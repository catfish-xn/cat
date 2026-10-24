import { describe, expect, it } from 'vitest';
import { getUnitStats, resolveUnitStats } from '../src/simulation/unit-stats';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { abilityDisplayValues } from '../src/simulation/ability-display';
import { familyCombatBase } from '../src/simulation/family-reunion';
import { d14UnitBase } from '../src/simulation/d14-anomalies/projection';

describe('2026-10-23 approved ordinary AD star correction', () => {
  // Independently hand-calculated from one-star source stats. Do not import the
  // production multiplier table: odd AD values exercise the final floor.
  it.each([
    ['darius', [600, 1080, 1944], [55, 82, 123]],
    ['maddie', [500, 900, 1620], [50, 75, 112]],
    ['renata', [600, 1080, 1944], [35, 52, 78]],
    ['loris', [850, 1530, 2754], [50, 75, 112]],
    ['sentinel', [800, 1440, 2592], [45, 67, 101]],
  ] as const)('%s: literal HP and AD at ranks 1/2/3', (id, hp, ad) => {
    for (const star of [1, 2, 3] as const) {
      const expected = { health: hp[star - 1], attack: ad[star - 1] };
      expect(getUnitStats(id, star)).toMatchObject(expected);
      expect(resolveUnitStats(UNIT_DEFINITIONS[id], star)).toMatchObject(expected);
      expect(familyCombatBase({ definitionId: id, starLevel: star }, star).base).toMatchObject(expected);
    }
  });

  it('publishes distinct HP and AD coefficients for rule metadata consumers', () => {
    expect(S13_COMBAT_RULES.starHealthPercent).toEqual({ 1: 100, 2: 180, 3: 324 });
    expect(S13_COMBAT_RULES.starAttackPercent).toEqual({ 1: 100, 2: 150, 3: 225 });
    expect(S13_COMBAT_RULES.sixCostStarPercent).toEqual({ 1: 100, 2: 180, 3: 360 });
  });

  it('uses corrected AD in default skill display, retaining explicit AD overrides', () => {
    // Maddie: floor(AD * [1.25,1.25,1.4] + [10,15,25]) at 100 AP.
    expect([1, 2, 3].map(star => abilityDisplayValues('maddie', star as 1 | 2 | 3).TotalDamage))
      .toEqual([72, 108, 181]);
    expect(abilityDisplayValues('maddie', 3, { attackDamage: 200 }).TotalDamage).toBe(305);
    expect(d14UnitBase({ definitionId: 'maddie', starLevel: 3 }, false).base.attack).toBe(112);
  });

  it.each([
    ['warwick', [2100, 3780, 7560], [110, 165, 248]],
    ['viktor', [1600, 2880, 5760], [100, 150, 225]],
    ['mel', [1800, 3240, 6480], [80, 120, 180]],
  ] as const)('applies approved six-cost AD, preserving HP: %s', (id, hp, ad) => {
    for (const star of [1, 2, 3] as const) {
      const expected = { health: hp[star - 1], attack: ad[star - 1] };
      expect(getUnitStats(id, star)).toMatchObject(expected);
      expect(resolveUnitStats(UNIT_DEFINITIONS[id], star)).toMatchObject(expected);
      expect(familyCombatBase({ definitionId: id, starLevel: star }, star).base).toMatchObject(expected);
    }
  });

  it('retains trainer centi-AD and other fixed-star summons', () => {
    for (const [star, health, attack, attackRemainderCenti] of [
      [1, 600, 55, 0], [2, 1080, 82, 50], [3, 1944, 123, 75],
    ] as const) expect(getUnitStats('trainer-golem', star)).toMatchObject({ health, attack, attackRemainderCenti });
    const fixed = { ...UNIT_DEFINITIONS.maddie,
      summon: { sellable: false, countsTowardPopulation: false, fixedStarStats: true as const } };
    for (const star of [1, 2, 3] as const)
      expect(resolveUnitStats(fixed, star)).toMatchObject({ health: 500, attack: 50 });
  });

  it('keeps previously approved special fourth-rank HP/AD values', () => {
    expect(d14UnitBase({ definitionId: 'maddie', starLevel: 3 }, true).base)
      .toMatchObject({ health: 2916, attack: 291 });
    expect(familyCombatBase({ definitionId: 'warwick', starLevel: 3 }, 4).base)
      .toMatchObject({ health: 13608, attack: 712 });
  });
});
