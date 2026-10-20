import { expect, it } from 'vitest';
import { abilityDisplayValues, ultimateHeroAbilityDisplayValues } from '../src/simulation/ability-display';
import { D14_FOURTH_ABILITY } from '../src/simulation/d14-anomalies/fourth-ability';
import { abilityText } from '../src/presentation/ability-text';

it('uses the certified fourth rank and 14.24b override, with ordinary third rank unchanged', () => {
  expect(ultimateHeroAbilityDisplayValues('lux')).toMatchObject({ ModifiedDamage: 1260, ModifiedShield: 300 });
  expect(ultimateHeroAbilityDisplayValues('lux', { abilityPower: 150 })).toMatchObject({ ModifiedDamage: 1890, ModifiedShield: 450 });
  expect(ultimateHeroAbilityDisplayValues('singed').ModifiedDurability).toBe(60);
  expect(ultimateHeroAbilityDisplayValues('maddie', { attackDamage: 200, abilityPower: 150 }).TotalDamage).toBe(332);
  expect(ultimateHeroAbilityDisplayValues('irelia')).toMatchObject({ ModifiedShield: 675, ModifiedBaseStrikeDamage: 200, 'PercentShieldDamage*100': 30 });
  expect(abilityDisplayValues('lux', 3).ModifiedDamage).toBe(900);
  expect(() => ultimateHeroAbilityDisplayValues('leona')).toThrow(RangeError);
  expect(() => ultimateHeroAbilityDisplayValues('missing')).toThrow(RangeError);
});

it.each(Object.keys(D14_FOURTH_ABILITY))('%s: substitutes every fourth-rank tooltip token without UI arithmetic', id => {
  const text = abilityText(id, 4);
  expect(text).not.toBeNull();
  expect(text!.unknown).toEqual([]);
  expect(text!.text).not.toContain('@');
  expect(Object.isFrozen(ultimateHeroAbilityDisplayValues(id))).toBe(true);
});
