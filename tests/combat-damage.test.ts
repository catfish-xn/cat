import { describe, expect, it } from 'vitest';
import { aggregateDamagePackets, mitigateDamage } from '../src/simulation/combat-damage';
import type { DamagePacket } from '../src/simulation/ability-types';
import { stepCombat } from '../src/simulation/combat';
import { battle, freeze, unit } from './combat-helpers';

describe('physical / magic mitigation and aggregate damage', () => {
  it.each([[0, 100, 0], [100, 0, 100], [100, 100, 50], [100, 40, 71], [1, 9999, 1]])(
    'mitigates raw %s with resistance %s to %s', (raw, resistance, expected) => {
      expect(mitigateDamage(raw, resistance)).toBe(expected);
    });

  it.each([NaN, Infinity, -1, 0.5])('rejects invalid damage or resistance %s', value => {
    expect(() => mitigateDamage(value, 0)).toThrow(RangeError);
    expect(() => mitigateDamage(100, value)).toThrow(RangeError);
  });

  it('reads independent defenses, rounds each packet, and is invariant to packet order', () => {
    const victim = unit('victim', 'enemy', 0, 0, { armor: 100, magicResist: 0 });
    const packets: DamagePacket[] = [
      { sourceId: 'p2', targetId: 'victim', damageType: 'physical', rawAmount: 3, sourceKind: 'attack', effectIndex: 0 },
      { sourceId: 'p1', targetId: 'victim', damageType: 'physical', rawAmount: 3, sourceKind: 'attack', effectIndex: 0 },
      { sourceId: 'p3', targetId: 'victim', damageType: 'magic', rawAmount: 100, sourceKind: 'ability', abilityId: 'bolt', effectIndex: 0 },
    ];
    const actual = aggregateDamagePackets(freeze(packets), [freeze(victim)]);
    expect(actual.get('victim')).toEqual({ physicalAmount: 2, magicAmount: 100, amount: 102 });
    expect(aggregateDamagePackets([...packets].reverse(), [victim])).toEqual(actual);
  });

  it('combines simultaneous magic and physical damage after mitigation, before shield and HP', () => {
    const initial = battle([
      unit('p1', 'player', 0, 0, { attackDamage: 100 }),
      unit('p2', 'player', 1, 1, { mana: 50, maxMana: 50,
        ability: { id: 'bolt', kind: 'damage', amount: 100, damageType: 'magic', radius: 0 } }),
      unit('e', 'enemy', 1, 0, { armor: 100, hp: 80, shield: 60, shieldExpiresAtTick: 50, cooldownTicks: 100 }),
    ]);
    const result = stepCombat(freeze(initial));
    expect(result.events.filter(event => event.type === 'damage')).toEqual([
      { type: 'damage', tick: 1, unitId: 'e', amount: 150, physicalAmount: 50, magicAmount: 100,
        absorbed: 60, hpDamage: 80, hp: 0, shield: 0 },
    ]);
    expect(result.state.units.find(other => other.id === 'e')).toMatchObject({ alive: false, hp: 0, shield: 0, shieldExpiresAtTick: null, mana: 0 });
    expect(result.events.some(event => event.type === 'manaChanged' && event.unitId === 'e')).toBe(false);
    expect(stepCombat({ ...initial, units: [...initial.units].reverse() })).toEqual(result);
  });

  it('uses MR for magical damage rather than armor', () => {
    const initial = battle([
      unit('p', 'player', 0, 0, { mana: 50, maxMana: 50,
        ability: { id: 'bolt', kind: 'damage', amount: 100, damageType: 'magic', radius: 0 } }),
      unit('e', 'enemy', 1, 0, { armor: 0, magicResist: 100, cooldownTicks: 100 }),
    ]);
    expect(stepCombat(initial).events.find(event => event.type === 'damage')).toMatchObject({ amount: 50, magicAmount: 50, physicalAmount: 0, hp: 50 });
  });
});
