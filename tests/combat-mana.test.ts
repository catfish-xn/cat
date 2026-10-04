import { describe, expect, it } from 'vitest';
import { stepCombat } from '../src/simulation/combat';
import { battle, freeze, unit } from './combat-helpers';

describe('Mana gain, spending and fixed-tick cast priority', () => {
  it('gains attack Mana now and casts only on the next tick, even during attack cooldown', () => {
    const initial = battle([
      unit('p', 'player', 0, 0, { mana: 50, maxMana: 60 }),
      unit('e', 'enemy', 1, 0, { hp: 1000, maxHp: 1000, cooldownTicks: 100 }),
    ]);
    const first = stepCombat(freeze(initial));
    expect(first.events.some(event => event.type === 'cast')).toBe(false);
    expect(first.state.units.find(other => other.id === 'p')).toMatchObject({ mana: 60, cooldownTicks: 20 });
    const second = stepCombat(freeze(first.state));
    expect(second.events.find(event => event.type === 'cast')).toEqual({ type: 'cast', tick: 2, sourceId: 'p', abilityId: 'test-bolt', targetIds: ['e'], manaSpent: 60 });
    expect(second.events.some(event => event.type === 'attack' && event.attackerId === 'p')).toBe(false);
    expect(second.state.units.find(other => other.id === 'p')).toMatchObject({ mana: 0, cooldownTicks: 20 });
    expect(second.events.find(event => event.type === 'manaChanged' && event.unitId === 'p')).toEqual({ type: 'manaChanged', tick: 2,
      unitId: 'p', before: 60, spent: 60, attackGain: 0, damageGain: 0, overflow: 0, after: 0 });
  });

  it('calculates damage Mana once from aggregate actual HP loss, not per hit', () => {
    const initial = battle([
      unit('p', 'player', 1, 1, { hp: 1000, maxHp: 1000, cooldownTicks: 100 }),
      unit('e1', 'enemy', 0, 1, { attackDamage: 7 }),
      unit('e2', 'enemy', 2, 1, { attackDamage: 7 }),
    ]);
    const result = stepCombat(initial);
    expect(result.state.units.find(other => other.id === 'p')).toMatchObject({ hp: 986, mana: 1 });
    expect(result.events.filter(event => event.type === 'manaChanged' && event.unitId === 'p')).toEqual([
      { type: 'manaChanged', tick: 1, unitId: 'p', before: 0, spent: 0, attackGain: 0, damageGain: 1, overflow: 0, after: 1 },
    ]);
  });

  it('caps incoming damage Mana at 20 and records overflow above maxMana', () => {
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { hp: 1000, maxHp: 1000, mana: 45, maxMana: 50, cooldownTicks: 100 }),
      unit('e', 'enemy', 1, 0, { attackDamage: 500 }),
    ]));
    expect(result.events.find(event => event.type === 'manaChanged' && event.unitId === 'p')).toEqual({ type: 'manaChanged', tick: 1,
      unitId: 'p', before: 45, spent: 0, attackGain: 0, damageGain: 20, overflow: 15, after: 50 });
  });

  it('grants attacker Mana on a fully absorbed attack but no damage Mana to its victim', () => {
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { attackDamage: 100 }),
      unit('e', 'enemy', 1, 0, { shield: 200, shieldExpiresAtTick: 50, cooldownTicks: 100 }),
    ]));
    expect(result.state.units.find(other => other.id === 'p')?.mana).toBe(10);
    expect(result.state.units.find(other => other.id === 'e')).toMatchObject({ mana: 0, hp: 100, shield: 100 });
    expect(result.events.filter(event => event.type === 'manaChanged').map(event => event.unitId)).toEqual(['p']);
  });

  it('permits same-tick received Mana after spending, without granting cast attack Mana', () => {
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { hp: 1000, maxHp: 1000, mana: 50, maxMana: 50 }),
      unit('e', 'enemy', 1, 0, { hp: 1000, maxHp: 1000, attackDamage: 100 }),
    ]));
    expect(result.events.find(event => event.type === 'manaChanged' && event.unitId === 'p')).toEqual({ type: 'manaChanged', tick: 1,
      unitId: 'p', before: 50, spent: 50, attackGain: 0, damageGain: 10, overflow: 0, after: 10 });
    expect(result.events.filter(event => event.type === 'cast')).toHaveLength(1);
  });

  it('does not grant Mana to a dying attacker and clears its transient fields', () => {
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { hp: 1, mana: 40, maxMana: 50, shield: 3, shieldExpiresAtTick: 20 }),
      unit('e', 'enemy', 1, 0, { hp: 1000, maxHp: 1000, attackDamage: 500 }),
    ]));
    expect(result.events.some(event => event.type === 'attack' && event.attackerId === 'p')).toBe(true);
    expect(result.events.some(event => event.type === 'manaChanged' && event.unitId === 'p')).toBe(false);
    expect(result.state.units.find(other => other.id === 'p')).toMatchObject({ alive: false, hp: 0, mana: 0, shield: 0,
      shieldExpiresAtTick: null, cooldownTicks: 0, moveCooldownTicks: 0, targetId: null });
  });

  it('retains full Mana when no damage target is in range', () => {
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { mana: 50, maxMana: 50, moveCooldownTicks: 100 }),
      unit('e', 'enemy', 6, 7, { cooldownTicks: 100, moveCooldownTicks: 100 }),
    ]));
    expect(result.events).toEqual([]);
    expect(result.state.units.find(other => other.id === 'p')?.mana).toBe(50);
  });
});
