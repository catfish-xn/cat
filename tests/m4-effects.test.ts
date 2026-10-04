import { describe, expect, it } from 'vitest';
import { resolveAbility } from '../src/simulation/combat-abilities';
import {
  cloneEffect, collectTriggers, compareEffectSources, effectKey, initializeEffectRuntime,
  makeSourcedEffects, resolveEffects,
} from '../src/simulation/effects';
import type { Effect, EffectSource, SourceKind } from '../src/simulation/strategy-types';
import { getUnitStats } from '../src/simulation/unit-stats';

function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
const ranger = getUnitStats('ranger', 2);
const ability = resolveAbility(ranger.abilityId, 2);
const sourced = (kind: SourceKind, id: string, effects: readonly Effect[], owner = 'unit-1') =>
  makeSourcedEffects(owner, kind, id, id, effects);

describe('finite strategy effect compilation', () => {
  it('matches the independent 172 AD / 16 tick arithmetic example and leaves skill damage independent of AD', () => {
    const effects = [
      ...sourced('anomaly', 'ad-percent', [{ kind: 'statPercentBps', stat: 'attackDamage', bps: 2000 }]),
      ...sourced('item', 'blade', [{ kind: 'statFlat', stat: 'attackDamage', amount: 10 }]),
      ...sourced('trait', 'forge', [{ kind: 'statFlat', stat: 'attackDamage', amount: 8 }]),
      ...sourced('augment', 'speed', [{ kind: 'attackSpeedBps', bps: 2500 }]),
    ];
    const result = resolveEffects(frozen(ranger), frozen(ability), frozen(effects));
    expect(result.stats.attack).toBe(172);
    expect(result.stats.attackIntervalTicks).toBe(16);
    expect(result.ability.amount).toBe(270);
    expect(resolveEffects(ranger, ability, [...effects].reverse())).toEqual(result);
    expect(result.sources.map(source => source.source.sourceKind)).toEqual(['trait', 'item', 'augment', 'anomaly']);
  });

  it('sums percentages before applying one floor, uses ceil for attack interval, and caps starting Mana', () => {
    const result = resolveEffects(ranger, ability, sourced('item', 'custom', [
      { kind: 'statFlat', stat: 'abilityAmount', amount: 11 },
      { kind: 'statPercentBps', stat: 'abilityAmount', bps: 3333 },
      { kind: 'statPercentBps', stat: 'abilityAmount', bps: 1667 },
      { kind: 'statFlat', stat: 'initialMana', amount: 999 },
      { kind: 'attackSpeedBps', bps: 1500 },
    ]));
    expect(result.ability.amount).toBe(421);
    expect(result.stats.attackIntervalTicks).toBe(18);
    expect(result.stats.initialMana).toBe(60);
  });

  it('modifies self-shield skill amount without scaling fixed hook amounts or its duration', () => {
    const stats = getUnitStats('sentinel', 2);
    const result = resolveEffects(stats, resolveAbility(stats.abilityId, 2), sourced('item', 'test', [
      { kind: 'statFlat', stat: 'abilityAmount', amount: 20 },
      { kind: 'statPercentBps', stat: 'abilityAmount', bps: 5000 },
      { kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'grantShield', amount: 120, durationTicks: 60 } },
    ]));
    expect(result.ability).toEqual({ id: 'sentinel-guard', kind: 'selfShield', amount: 630, durationTicks: 60 });
    expect(result.triggers[0].action).toEqual({ kind: 'grantShield', amount: 120, durationTicks: 60 });
  });

  it('preserves every M3 resolved field without modifiers and makes isolated result objects', () => {
    const result = resolveEffects(ranger, ability, []);
    expect(result.stats).toEqual(ranger);
    expect(result.ability).toEqual(ability);
    expect(result.stats).not.toBe(ranger);
    expect(result.ability).not.toBe(ability);
    expect(result.sources).toEqual([]);
    expect(result.triggers).toEqual([]);
  });

  it('rejects aggregate limits and unsafe intermediate products without order-dependent truncation', () => {
    for (const effects of [
      [{ kind: 'statPercentBps', stat: 'attackDamage', bps: 40000 }, { kind: 'statPercentBps', stat: 'attackDamage', bps: 1 }],
      [{ kind: 'attackSpeedBps', bps: 15000 }, { kind: 'attackSpeedBps', bps: 5001 }],
      [{ kind: 'statFlat', stat: 'maxHp', amount: Number.MAX_SAFE_INTEGER }],
      [{ kind: 'statFlat', stat: 'maxHp', amount: Math.floor(Number.MAX_SAFE_INTEGER / 10000) }],
    ] as const) {
      expect(() => resolveEffects(ranger, ability, sourced('item', 'invalid', effects))).toThrow(RangeError);
      expect(() => resolveEffects(ranger, ability, sourced('item', 'invalid', [...effects].reverse()))).toThrow(RangeError);
    }
    expect(resolveEffects(ranger, ability, sourced('item', 'max', [
      { kind: 'statPercentBps', stat: 'attackDamage', bps: 40000 }, { kind: 'attackSpeedBps', bps: 20000 },
    ])).stats).toMatchObject({ attack: 630, attackIntervalTicks: 7 });
  });

  it.each([
    { kind: 'heal', amount: 10 },
    { kind: 'statFlat', stat: 'maxMana', amount: 10 },
    { kind: 'statFlat', stat: 'maxHp', amount: -1 },
    { kind: 'statFlat', stat: 'maxHp', amount: 1.5 },
    { kind: 'statFlat', stat: 'maxHp', amount: Infinity },
    { kind: 'statPercentBps', stat: 'initialMana', bps: 1000 },
    { kind: 'trigger', hook: 'onDamage', everyN: 1, action: { kind: 'gainMana', amount: 1 } },
    { kind: 'trigger', hook: 'onAttack', everyN: 0, action: { kind: 'gainMana', amount: 1 } },
    { kind: 'trigger', hook: 'combatStart', everyN: 2, action: { kind: 'gainMana', amount: 1 } },
    { kind: 'trigger', hook: 'combatStart', everyN: 1, action: { kind: 'dealDamage', amount: 1, damageType: 'magic' } },
    { kind: 'trigger', hook: 'onHpLoss', everyN: 1, action: { kind: 'grantShield', amount: 1, durationTicks: 10 } },
    { kind: 'trigger', hook: 'onHpLoss', everyN: 1, action: { kind: 'dealDamage', amount: 1, damageType: 'physical' } },
  ])('rejects unsupported primitive/hook configuration %j', invalid => {
    expect(() => cloneEffect(invalid as Effect)).toThrow(RangeError);
  });

  it('orders all owners before kind, then definition/instance/index using ASCII', () => {
    const sources = [
      ...sourced('trait', 'a', [{ kind: 'statFlat', stat: 'armor', amount: 1 }], 'unit-2'),
      ...sourced('anomaly', 'a', [{ kind: 'statFlat', stat: 'armor', amount: 1 }], 'unit-1'),
      ...sourced('item', 'z', [{ kind: 'statFlat', stat: 'armor', amount: 1 }], 'unit-1'),
      ...sourced('item', 'a', [{ kind: 'statFlat', stat: 'armor', amount: 1 }], 'unit-1'),
    ];
    expect(sources.map(source => source.source).sort(compareEffectSources).map(source =>
      [source.ownerId, source.sourceKind, source.sourceDefinitionId])).toEqual([
      ['unit-1', 'item', 'a'], ['unit-1', 'item', 'z'], ['unit-1', 'anomaly', 'a'], ['unit-2', 'trait', 'a'],
    ]);
    const a: EffectSource = { ownerId: 'a:b', sourceKind: 'item', sourceDefinitionId: 'c', sourceInstanceId: 'd', effectIndex: 0 };
    expect(effectKey(a)).not.toBe(effectKey({ ...a, ownerId: 'a', sourceDefinitionId: 'b:c' }));
  });
});

describe('non-recursive trigger collection', () => {
  it('counts duplicate item instances independently and emits only on each third primary attack', () => {
    const effects: readonly Effect[] = [
      { kind: 'trigger', hook: 'onAttack', everyN: 3, action: { kind: 'dealDamage', amount: 25, damageType: 'physical' } },
      { kind: 'trigger', hook: 'onCast', everyN: 1, action: { kind: 'gainMana', amount: 10 } },
    ];
    const inputs = [
      ...makeSourcedEffects('unit-1', 'item', 'same', 'item-2', effects),
      ...makeSourcedEffects('unit-1', 'item', 'same', 'item-1', effects),
    ];
    const { triggers } = resolveEffects(ranger, ability, frozen(inputs));
    let runtime = initializeEffectRuntime(triggers);
    for (let attack = 1; attack <= 6; attack++) {
      const before = JSON.stringify(runtime);
      const next = collectTriggers(frozen(triggers), frozen(runtime), 'onAttack', 'unit-1', 'enemy-1');
      expect(JSON.stringify(runtime)).toBe(before);
      expect(next.invocations).toHaveLength(attack % 3 === 0 ? 2 : 0);
      expect(next.runtime.map(counter => counter.count).sort((a, b) => a - b)).toEqual([0, 0, attack, attack]);
      if (next.invocations.length) {
        expect(next.invocations.map(invocation => invocation.trigger.source.sourceInstanceId)).toEqual(['item-1', 'item-2']);
        expect(next.invocations.every(invocation => invocation.targetId === 'enemy-1')).toBe(true);
        expect(next.invocations[0].action).not.toBe(triggers[0].action);
      }
      runtime = [...next.runtime];
    }
    const cast = collectTriggers(triggers, runtime, 'onCast', 'unit-1', 'enemy-1');
    expect(cast.invocations.map(invocation => invocation.targetId)).toEqual(['unit-1', 'unit-1']);
    expect(cast.runtime.map(counter => counter.count).sort((a, b) => a - b)).toEqual([1, 1, 6, 6]);
  });

  it('does not collect another owner, recurse into actions, or invent a damage target', () => {
    const { triggers } = resolveEffects(ranger, ability, sourced('anomaly', 'proc', [
      { kind: 'trigger', hook: 'onAttack', everyN: 1, action: { kind: 'dealDamage', amount: 70, damageType: 'magic' } },
    ]));
    const runtime = initializeEffectRuntime(triggers);
    expect(collectTriggers(triggers, runtime, 'onAttack', 'unit-2', 'enemy-1')).toEqual({ runtime, invocations: [] });
    const fired = collectTriggers(triggers, runtime, 'onAttack', 'unit-1', 'enemy-1');
    expect(fired.invocations).toHaveLength(1);
    expect(fired.runtime[0].count).toBe(1);
    const noTarget = collectTriggers(triggers, runtime, 'onAttack', 'unit-1', null);
    expect(noTarget.invocations).toEqual([]);
    expect(noTarget.runtime[0].count).toBe(1);
  });

  it('roundtrips counters and resumes the same every-N cadence', () => {
    const { triggers } = resolveEffects(ranger, ability, sourced('augment', 'proc', [
      { kind: 'trigger', hook: 'onCast', everyN: 2, action: { kind: 'dealDamage', amount: 60, damageType: 'magic' } },
    ]));
    const first = collectTriggers(triggers, initializeEffectRuntime(triggers), 'onCast', 'unit-1', 'enemy-1');
    expect(first.invocations).toEqual([]);
    const second = collectTriggers(triggers, JSON.parse(JSON.stringify(first.runtime)), 'onCast', 'unit-1', 'enemy-1');
    expect(second.invocations).toHaveLength(1);
    expect(second.runtime[0].count).toBe(2);
  });
});
