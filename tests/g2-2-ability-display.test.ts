import { describe, expect, it } from 'vitest';
import { abilityDisplayName, abilityDisplayValues } from '../src/simulation/ability-display';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { getUnitStats } from '../src/simulation/unit-stats';
import type { StarLevel } from '../src/simulation/unit-types';
const original = 'irelia maddie darius lux zyra tristana urgot rell leona vander kogmaw scar ezreal loris nami corki garen zoe caitlyn'.split(' ');
describe('SR-G2-01 base display', () => {
  it.each(original)('%s resolves every original tooltip token at all three stars', id => {
    for (const star of [1, 2, 3] as StarLevel[]) {
      const values = abilityDisplayValues(id, star);
      const template = S13_ABILITY_DATA[`${id}-ability`].description;
      const rendered = template.replace(/@([^@]+)@/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
      expect(rendered).not.toMatch(/@[^@]+@/);
      expect(abilityDisplayName(id).length).toBeGreaterThan(0);
      expect(Object.isFrozen(values)).toBe(true);
    }
  });
  it('uses star AD, AP and per-projectile semantics rather than multiplying all hits', () => {
    expect(abilityDisplayName('maddie')).toBe('Fan the Hammer');
    expect(abilityDisplayValues('maddie', 1).TotalDamage).toBe(Math.floor(getUnitStats('maddie', 1).attack * 1.25 + 10));
    expect(abilityDisplayValues('maddie', 3, { attackDamage: 200, abilityPower: 150 }).TotalDamage).toBe(317);
    expect(abilityDisplayValues('irelia', 2, { abilityPower: 150 }).ModifiedShield).toBe(712);
  });
  it('floors only after combining AP and health scaling', () => {
    const hp = getUnitStats('garen', 2).health;
    expect(abilityDisplayValues('garen', 2, { abilityPower: 125 }).ModifiedShield).toBe(Math.floor(hp * .15 + 275));
    expect(abilityDisplayValues('corki', 1, { attackDamage: 101 }).ModifiedSpecialDamage).toBe(289);
  });
  it('rejects unknown definitions, invalid stars and invalid numeric inputs', () => {
    expect(() => abilityDisplayValues('__proto__', 1)).toThrow(RangeError);
    expect(() => abilityDisplayValues('swain', 1)).toThrow(RangeError);
    expect(() => abilityDisplayValues('lux', 4 as StarLevel)).toThrow(RangeError);
    for (const value of [NaN, Infinity, -1, 0.5, 1_000_001]) expect(() => abilityDisplayValues('lux', 1, { abilityPower: value })).toThrow(RangeError);
  });
  it('does not mutate source data or retain caller-owned mutable objects', () => {
    const before = JSON.stringify(S13_ABILITY_DATA), stats = { abilityPower: 200 };
    const result = abilityDisplayValues('lux', 1, stats);
    stats.abilityPower = 300;
    expect(result.ModifiedDamage).toBe(720);
    expect(abilityDisplayValues('lux', 1).ModifiedDamage).toBe(360);
    expect(JSON.stringify(S13_ABILITY_DATA)).toBe(before);
  });
});
