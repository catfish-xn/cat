import { describe, expect, it } from 'vitest';
import { evaluateAmount, resolveStat, attackInterval, changeMaxHp, type StatSample } from '../src/simulation/m8/stats';
import { amount, modifier } from './fixtures/m8-contract-cases';

// Answers are independently calculated here before the executor is implemented.
const sample: StatSample = { holder: { id: 'p', hp: 500, maxHp: 1000 }, target: { id: 'e', hp: 1000, maxHp: 1750 },
  counters: {}, enemiesTargetingHolder: ['a', 'b', 'c'], startingRows: 'front-two', positiveHpDamage: false };
describe('G01 hand-calculated execution vectors', () => {
  it('uses one original HP basis for Warmog and Sterak, never compounded HP', () => {
    const mods = [modifier('maxHp', 600), modifier('maxHp', 1200, { unit: 'bps' })];
    expect(resolveStat('maxHp', 1000, mods, sample)).toBe(1792); // (1000+600)*1.12
    expect(resolveStat('maxHp', 1000, [...mods, modifier('maxHp', 2500, { unit: 'bps' })], sample)).toBe(2192);
    expect(changeMaxHp(1792, 600, 2192)).toEqual({ beforeMax: 1792, afterMax: 2192, beforeHp: 600, afterHp: 1000, countsAsHeal: false });
  });
  it('adds AD before percentages and normalizes AS only at the final ceil', () => {
    expect(resolveStat('attackDamage', 80, [modifier('attackDamage', 20), modifier('attackDamage', 1500, { unit: 'bps' }),
      modifier('attackDamage', 2500, { unit: 'bps' })], sample)).toBe(140);
    expect(attackInterval(7000, 3500)).toBe(22); // 20/(.7*1.35)
    expect(attackInterval(10000, 1000000)).toBe(1);
  });
  it('samples strict Giant Slayer and HoJ conditions at each read', () => {
    const giant = modifier('damageAmp', 2500, { unit: 'bps', condition: { kind: 'target-max-hp', op: 'gt', hp: 1750 } });
    expect([1750, 1751].map(maxHp => resolveStat('damageAmp', 0, [giant], { ...sample, target: { ...sample.target!, maxHp } }))).toEqual([0, 2500]);
    const hoj = modifier('abilityPower', 15, { condition: { kind: 'hp-ratio', subject: 'holder', op: 'gt', thresholdBps: 5000 } });
    expect([501, 500, 499].map(hp => resolveStat('abilityPower', 115, [hoj], { ...sample, holder: { ...sample.holder, hp } }))).toEqual([130, 115, 115]);
  });
  it('scales distinct current targeting enemies; duplicate IDs never add count', () => {
    const dynamic = modifier('armor', 0, { value: { kind: 'unit-count', perUnit: 10, population: 'alive-enemies-targeting-holder', sample: 'current', distinctBy: 'unitId' } });
    expect([['a', 'b', 'c', 'a'], ['a', 'b'], []].map(enemiesTargetingHolder => resolveStat('armor', 25, [dynamic], { ...sample, enemiesTargetingHolder }))).toEqual([55, 45, 25]);
    expect(resolveStat('armor', 50, [dynamic, dynamic], sample)).toBe(110);
  });
  it('adds flat resistance, keeps the strongest percent reduction and clamps resistance at zero', () => {
    const mods = [modifier('armor', 20), modifier('armor', -3000, { unit: 'bps' }), modifier('armor', -5000, { unit: 'bps' })];
    expect(resolveStat('armor', 100, mods, sample)).toBe(60); // (100+20)*.5, not120*.2
    expect(resolveStat('armor', 20, [modifier('armor', -50)], sample)).toBe(0);
  });
  it('keeps same-named counters on independent item instances separate', () => {
    const titan = modifier('attackDamage', 0, { unit: 'bps', value: { kind: 'counter', counterId: 'stacks', perCount: 200 } });
    expect(resolveStat('attackDamage', 100, [{ modifier: titan, counters: { stacks: 24 } },
      { modifier: titan, counters: { stacks: 25 } }], sample)).toBe(198); // 100*(1+.48+.50)
  });
  it('combines coefficients before floor and requires bound result/receipt contexts', () => {
    const input = { holder: sample.holder, target: sample.target, attackDamage: 81, abilityPower: 121 };
    expect(evaluateAmount(amount(10, { attackDamageBps: 15000, abilityPowerBps: 20000, maxHpBps: 125 }), input)).toBe(386); // 10+121.5+242+12.5
    expect(() => evaluateAmount(amount(0, { actualManaSpentBps: 16000 }), input)).toThrow();
    expect(() => evaluateAmount(amount(0, { actualDamageBps: 2000 }), input)).toThrow();
    expect(resolveStat('critChance', 2500, [modifier('critChance', 9000, { unit: 'bps' })], sample)).toBe(10000);
    expect(() => resolveStat('maxHp', Number.MAX_SAFE_INTEGER, [modifier('maxHp', 1)], sample)).toThrow();
  });
});
