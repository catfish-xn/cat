import { describe, expect, it } from 'vitest';
import { ABILITY_DEFINITIONS, resolveAbility, validateAbilityDefinitions } from '../src/simulation/combat-abilities';
import type { AbilityDefinition } from '../src/simulation/ability-types';
import { stepCombat, type CombatEvent, type CombatState } from '../src/simulation/combat';
import { battle, freeze, unit } from './combat-helpers';

describe('resolved ability content', () => {
  it('provides all eleven explicitly scaled abilities and resolves fresh JSON snapshots', () => {
    expect(Object.keys(ABILITY_DEFINITIONS)).toHaveLength(11);
    expect(() => validateAbilityDefinitions()).not.toThrow();
    expect(resolveAbility('oracle-burst', 3)).toEqual({ id: 'oracle-burst', kind: 'damage', damageType: 'magic', radius: 1, amount: 1361 });
    expect(resolveAbility('sentinel-guard', 2)).toEqual({ id: 'sentinel-guard', kind: 'selfShield', durationTicks: 60, amount: 400 });
    expect(resolveAbility('sentinel-guard', 2)).not.toBe(resolveAbility('sentinel-guard', 2));
    expect(() => resolveAbility('missing', 1)).toThrow('Unknown ability');
    expect(Object.isFrozen(ABILITY_DEFINITIONS['sentinel-guard'].amountByStar)).toBe(true);
  });

  it.each([
    { id: 'bad', kind: 'selfShield', durationTicks: 0, amountByStar: [1, 2, 3] },
    { id: 'bad', kind: 'selfShield', durationTicks: 1, amountByStar: [1, NaN, 3] },
    { id: 'bad', kind: 'damage', damageType: 'physical', radius: 0, amountByStar: [1, -2, 3] },
    { id: 'bad', kind: 'damage', damageType: 'physical', radius: 0, amountByStar: [1, 2] },
    { id: 'bad', kind: 'damage', damageType: 'physical', radius: 0, amountByStar: [1, , 3] },
    { id: 'bad', kind: 'damage', damageType: 'true', radius: 0, amountByStar: [1, 2, 3] },
  ])('rejects invalid ability data %#', invalid => {
    expect(() => validateAbilityDefinitions({ bad: invalid as unknown as AbilityDefinition })).toThrow();
  });
});

describe('same-tick abilities and shield ordering', () => {
  it.each(Object.keys(ABILITY_DEFINITIONS))('executes authored ability %s through the real tick pipeline', abilityId => {
    const ability = resolveAbility(abilityId, 1);
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { mana: 50, maxMana: 50, ability }),
      unit('e', 'enemy', 1, 0, { hp: 5000, maxHp: 5000, cooldownTicks: 100 }),
    ]));
    expect(result.events.find(event => event.type === 'cast')).toMatchObject({ sourceId: 'p', abilityId, manaSpent: 50 });
    if (ability.kind === 'selfShield') {
      expect(result.state.units.find(other => other.id === 'p')?.shield).toBe(ability.amount);
    } else {
      expect(result.events.find(event => event.type === 'damage')).toMatchObject({ unitId: 'e', amount: ability.amount,
        physicalAmount: ability.damageType === 'physical' ? ability.amount : 0,
        magicAmount: ability.damageType === 'magic' ? ability.amount : 0 });
    }
  });

  it('casts a physical spell after moving into range and mitigates it with armor', () => {
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { mana: 50, maxMana: 50, ability: resolveAbility('ranger-shot', 1) }),
      unit('e', 'enemy', 2, 0, { armor: 100, cooldownTicks: 100, moveCooldownTicks: 100 }),
    ]));
    expect(result.events.slice(0, 2).map(event => event.type)).toEqual(['movement', 'cast']);
    expect(result.events.find(event => event.type === 'damage')).toMatchObject({ amount: 75, physicalAmount: 75, magicAmount: 0 });
    expect(result.state.units.find(other => other.id === 'p')?.cell).toEqual({ col: 1, row: 0 });
  });

  it('applies a newly cast shield before all damage regardless of caster ID', () => {
    const initial = battle([
      unit('z', 'player', 0, 0, { mana: 50, maxMana: 50, ability: { id: 'guard', kind: 'selfShield', amount: 60, durationTicks: 60 } }),
      unit('a', 'enemy', 1, 0, { attackDamage: 100 }),
    ]);
    const result = stepCombat(freeze(initial));
    expect(result.state.units.find(other => other.id === 'z')).toMatchObject({ hp: 60, shield: 0, shieldExpiresAtTick: null, mana: 4 });
    expect(result.events.map(event => event.type)).toEqual(['attack', 'cast', 'shieldChanged', 'damage', 'manaChanged', 'manaChanged']);
    expect(result.events.find(event => event.type === 'damage')).toMatchObject({ unitId: 'z', amount: 100, absorbed: 60, hpDamage: 40 });
    expect(stepCombat({ ...initial, units: [...initial.units].reverse() })).toEqual(result);
  });

  it('expires shields at the beginning of the exact expiration tick', () => {
    const initial = battle([
      unit('p', 'player', 0, 0, { shield: 70, shieldExpiresAtTick: 2, cooldownTicks: 100 }),
      unit('e', 'enemy', 1, 0, { attackDamage: 40, attackIntervalTicks: 1 }),
    ]);
    const first = stepCombat(initial);
    expect(first.state.units.find(other => other.id === 'p')).toMatchObject({ hp: 100, shield: 30, shieldExpiresAtTick: 2 });
    const second = stepCombat(first.state);
    expect(second.events[0]).toEqual({ type: 'shieldChanged', tick: 2, unitId: 'p', reason: 'expired', before: 30, after: 0, expiresAtTick: null });
    expect(second.state.units.find(other => other.id === 'p')).toMatchObject({ hp: 60, shield: 0, shieldExpiresAtTick: null });
  });

  it('refreshes duration without additive stacking and permits self-shield out of attack range', () => {
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { mana: 50, maxMana: 50, shield: 70, shieldExpiresAtTick: 2,
        ability: { id: 'guard', kind: 'selfShield', amount: 60, durationTicks: 60 }, moveCooldownTicks: 100 }),
      unit('e', 'enemy', 6, 7, { cooldownTicks: 100, moveCooldownTicks: 100 }),
    ]));
    expect(result.state.units.find(other => other.id === 'p')).toMatchObject({ shield: 70, shieldExpiresAtTick: 61, mana: 0 });
    expect(result.events.find(event => event.type === 'cast')).toMatchObject({ targetIds: ['p'] });
    expect(result.events.find(event => event.type === 'shieldChanged')).toMatchObject({ before: 70, after: 70, expiresAtTick: 61 });
  });

  it('expires an old shield before refreshing it on the same tick', () => {
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { mana: 50, maxMana: 50, shield: 200, shieldExpiresAtTick: 1,
        ability: { id: 'guard', kind: 'selfShield', amount: 60, durationTicks: 60 } }),
      unit('e', 'enemy', 1, 0, { cooldownTicks: 100 }),
    ]));
    expect(result.events.filter(event => event.type === 'shieldChanged').map(event => [event.reason, event.before, event.after])).toEqual([
      ['expired', 200, 0], ['granted', 0, 60],
    ]);
  });

  it('consumes Mana for a zero-amount shield without emitting a fake shield change', () => {
    const result = stepCombat(battle([
      unit('p', 'player', 0, 0, { mana: 50, maxMana: 50,
        ability: { id: 'zero-guard', kind: 'selfShield', amount: 0, durationTicks: 60 } }),
      unit('e', 'enemy', 1, 0, { cooldownTicks: 100 }),
    ]));
    expect(result.events.map(event => event.type)).toEqual(['cast', 'manaChanged']);
    expect(result.state.units.find(other => other.id === 'p')).toMatchObject({ shield: 0, shieldExpiresAtTick: null, mana: 0 });
  });

  it('commits both lethal casts before deaths and gives elimination priority over timeout', () => {
    const initial = battle([
      unit('p', 'player', 0, 0, { hp: 50, mana: 50, maxMana: 50 }),
      unit('e', 'enemy', 1, 0, { hp: 50, mana: 50, maxMana: 50 }),
    ], { maxTicks: 1 });
    const result = stepCombat(initial);
    expect(result.events.map(event => event.type)).toEqual(['cast', 'cast', 'damage', 'damage', 'death', 'death', 'combatFinished']);
    expect(result.events.at(-1)).toEqual({ type: 'combatFinished', tick: 1, result: 'draw', reason: 'elimination' });
    expect(result.state.units.every(other => !other.alive && other.mana === 0)).toBe(true);
    expect(stepCombat(result.state)).toEqual({ state: result.state, events: [] });
    expect(stepCombat({ ...initial, units: [...initial.units].reverse() })).toEqual(result);
  });

  it('captures sorted radius-one enemies around the selected target, excluding allies and distant/dead units', () => {
    const initial = battle([
      unit('p', 'player', 0, 0, { mana: 50, maxMana: 50, attackRange: 3, moveCooldownTicks: 100,
        ability: { id: 'burst', kind: 'damage', damageType: 'magic', amount: 10, radius: 1 } }),
      unit('friend', 'player', 2, 1, { cooldownTicks: 100, moveCooldownTicks: 100 }),
      unit('A', 'enemy', 2, 0, { cooldownTicks: 100, moveCooldownTicks: 100 }),
      unit('z', 'enemy', 3, 0, { cooldownTicks: 100, moveCooldownTicks: 100 }),
      unit('far', 'enemy', 5, 0, { cooldownTicks: 100, moveCooldownTicks: 100 }),
      unit('dead', 'enemy', 1, 0, { alive: false, hp: 0 }),
    ]);
    const result = stepCombat(initial);
    expect(result.events.find(event => event.type === 'cast')).toMatchObject({ targetIds: ['A', 'z'] });
    expect(result.events.filter(event => event.type === 'damage').map(event => event.unitId)).toEqual(['A', 'z']);
    expect(stepCombat({ ...initial, units: [...initial.units].reverse() })).toEqual(result);
  });
});

describe('ability snapshot replay', () => {
  function replay(initial: CombatState, serialize: boolean) {
    let state = initial;
    const history: CombatState[] = [], events: CombatEvent[] = [];
    while (state.status === 'running') {
      const next = stepCombat(freeze(serialize ? JSON.parse(JSON.stringify(state)) as CombatState : state));
      state = next.state;
      history.push(state); events.push(...next.events);
    }
    return { state, history, events };
  }
  it('restores every tick through damage, shield expiration, Mana refill, casts and death', () => {
    const initial = battle([
      unit('p', 'player', 0, 0, { hp: 500, maxHp: 500, mana: 30, maxMana: 30, attackIntervalTicks: 2,
        ability: { id: 'guard', kind: 'selfShield', amount: 100, durationTicks: 3 } }),
      unit('e', 'enemy', 1, 0, { hp: 500, maxHp: 500, maxMana: 30, attackIntervalTicks: 2 }),
    ]);
    const expected = replay(initial, false);
    expect(expected.events.map(event => event.type)).toEqual(expect.arrayContaining(['cast', 'shieldChanged', 'damage', 'manaChanged', 'death']));
    expect(expected.events.some(event => event.type === 'shieldChanged' && event.reason === 'expired')).toBe(true);
    expect(replay(initial, true)).toEqual(expected);
    expect(replay({ ...initial, units: [...initial.units].reverse() }, true)).toEqual(expected);
  });
});
