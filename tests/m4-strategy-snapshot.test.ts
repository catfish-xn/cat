import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import type { GameState } from '../src/simulation/game';
import { createMatch } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { buildStrategySnapshot, type StrategyCatalog } from '../src/simulation/strategy-snapshot';
import type { ItemInstance } from '../src/simulation/strategy-types';
import type { Unit } from '../src/simulation/unit-types';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../src/simulation/content/anomalies';

function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function boardUnit(id: string, definitionId: string, team: Unit['team'] = 'player', starLevel: Unit['starLevel'] = 1): Unit {
  return { id, definitionId, team, starLevel, location: { kind: 'board', cell: { row: team === 'player' ? 5 : 0, col: 0 } } };
}
function preparation(units: readonly Unit[]): GameState { return { board: DEFAULT_BOARD, benchSize: 7, units }; }
function snapshotState(units: readonly Unit[], patch: Partial<MatchState> = {}): MatchState {
  return { ...createMatch(12345), preparation: preparation(units), ...patch } as MatchState;
}
const equipped = (id: string, definitionId: string, unitId: string, slot: number): ItemInstance =>
  ({ id, definitionId, location: { kind: 'unit', unitId, slot } });
const catalog: StrategyCatalog = { traits: TRAIT_DEFINITIONS, items: ITEM_DEFINITIONS, augments: AUGMENT_DEFINITIONS, anomalies: ANOMALY_DEFINITIONS };
const reverse = <T>(value: Readonly<Record<string, T>>): Record<string, T> => Object.fromEntries(Object.entries(value).reverse());

describe('trait activation boundary', () => {
  it('counts distinct board definitions regardless of star level, duplicate copies, bench or the other team', () => {
    const units = [boardUnit('a', 'sentinel', 'player', 3), boardUnit('b', 'sentinel'), boardUnit('c', 'squire'),
      { ...boardUnit('bench', 'bulwark'), location: { kind: 'bench' as const, slot: 0 } }, boardUnit('enemy', 'beacon', 'enemy')];
    const state = frozen(preparation(units));
    const traits = deriveTraits(state, 'player');
    expect(traits.find(trait => trait.traitId === 'bulwark')).toEqual({
      team: 'player', traitId: 'bulwark', count: 2, tier: 2,
      memberDefinitionIds: ['sentinel', 'squire'], targetUnitIds: ['a', 'b', 'c'],
    });
    expect(traits.find(trait => trait.traitId === 'conduit')).toMatchObject({ count: 1, tier: 0, targetUnitIds: [] });
    expect(deriveTraits(preparation([...units].reverse()), 'player', reverse(TRAIT_DEFINITIONS))).toEqual(traits);
    expect(deriveTraits(state, 'enemy').find(trait => trait.traitId === 'bulwark')).toMatchObject({ count: 1, tier: 0 });
  });

  it('replaces the lower tier at 4 and expands team traits to nonmembers', () => {
    const state = snapshotState([
      boardUnit('a', 'sentinel'), boardUnit('b', 'squire'), boardUnit('c', 'bulwark'),
      boardUnit('d', 'beacon'), boardUnit('e', 'ranger'),
    ]);
    const snapshot = buildStrategySnapshot(state);
    expect(snapshot.traits.find(trait => trait.team === 'player' && trait.traitId === 'bulwark')).toMatchObject({ count: 4, tier: 4 });
    const sentinel = snapshot.units.find(unit => unit.unitId === 'a')!;
    expect(sentinel.stats.armor).toBe(70);
    expect(sentinel.stats.magicResist).toBe(60);
    expect(sentinel.stats.attack).toBe(53);
    const forge = snapshot.traits.find(trait => trait.team === 'player' && trait.traitId === 'forge')!;
    expect(forge.memberDefinitionIds).toEqual(['bulwark', 'ranger']);
    expect(forge.targetUnitIds).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(sentinel.sources.filter(source => source.source.sourceDefinitionId === 'bulwark')).toHaveLength(2);
  });

  it('recomputes only at the next snapshot and excludes inactive sources', () => {
    const first = snapshotState([boardUnit('a', 'sentinel'), boardUnit('b', 'squire')]);
    const old = buildStrategySnapshot(first);
    const next = buildStrategySnapshot({ ...first, preparation: preparation([boardUnit('a', 'sentinel')]) });
    expect(old.units[0].stats.armor).toBe(55);
    expect(next.units[0].stats.armor).toBe(40);
    expect(next.units[0].sources).toEqual([]);
    expect(old.traits.find(trait => trait.team === 'player' && trait.traitId === 'bulwark')?.tier).toBe(2);
  });
});

describe('complete strategy snapshot', () => {
  it('applies four sources, stacks duplicate items by instance, and excludes bench binding/equipment', () => {
    const units = [boardUnit('ranger', 'ranger', 'player', 2), boardUnit('spark', 'spark'), boardUnit('archer', 'archer'),
      { ...boardUnit('bench', 'sentinel'), location: { kind: 'bench' as const, slot: 0 } }, boardUnit('enemy', 'ranger', 'enemy')];
    const state = snapshotState(units, {
      items: [equipped('item-1', 'blade', 'ranger', 0), equipped('item-2', 'blade', 'ranger', 1), equipped('item-3', 'giant-belt', 'bench', 0)],
      augments: [{ definitionId: 'heavy-hands', choiceId: 'augment-one', acquiredRound: 2 }],
      anomalyBinding: { definitionId: 'crushing-form', choiceId: 'anomaly-one', unitId: 'ranger', boundRound: 7 },
    });
    const snapshot = buildStrategySnapshot(frozen(state));
    const ranger = snapshot.units.find(unit => unit.unitId === 'ranger')!;
    // (126 from 2 stars + 8 Forge + 20 duplicate blades + 12 Augment) * 1.35 = 224.1.
    expect(ranger.stats.attack).toBe(224);
    expect(ranger.stats.attackIntervalTicks).toBe(18);
    expect(ranger.ability.amount).toBe(270);
    expect(ranger.sources.map(source => source.source.sourceKind)).toEqual(['trait', 'trait', 'item', 'item', 'augment', 'anomaly']);
    expect(snapshot.units.map(unit => unit.unitId)).toEqual(['archer', 'enemy', 'ranger', 'spark']);
    expect(snapshot.units.find(unit => unit.unitId === 'enemy')!.stats.attack).toBe(70);
    const onBench = buildStrategySnapshot({ ...state, anomalyBinding: { ...state.anomalyBinding!, unitId: 'bench' } });
    expect(onBench.units.some(unit => unit.sources.some(source => source.source.sourceKind === 'anomaly'))).toBe(false);
    expect(onBench.units.find(unit => unit.unitId === 'ranger')!.stats.attack).toBe(166);
  });

  it('canonicalizes input/catalog order and deep-copies definitions, effects, triggers and summaries', () => {
    const state = snapshotState([boardUnit('z', 'duelist'), boardUnit('a', 'squire'), boardUnit('e', 'sentinel', 'enemy')], {
      items: [equipped('item-2', 'echo-rod', 'z', 1), equipped('item-1', 'ward-rod', 'z', 0)],
      augments: [
        { definitionId: 'opening-guard', choiceId: 'b', acquiredRound: 2 },
        { definitionId: 'cast-echo', choiceId: 'a', acquiredRound: 5 },
      ],
      anomalyBinding: { definitionId: 'echo-core', unitId: 'z', choiceId: 'c', boundRound: 7 },
    });
    const original = JSON.stringify(state);
    const snapshot = buildStrategySnapshot(frozen(state));
    const permuted = buildStrategySnapshot({ ...state, items: [...state.items].reverse(), augments: [...state.augments].reverse(),
      preparation: { ...state.preparation, units: [...state.preparation.units].reverse() } }, {
      traits: reverse(catalog.traits), items: reverse(catalog.items), augments: reverse(catalog.augments), anomalies: reverse(catalog.anomalies),
    });
    expect(permuted).toEqual(snapshot);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    const unit = snapshot.units.find(unit => unit.unitId === 'z')!;
    const echo = unit.sources.find(source => source.source.sourceDefinitionId === 'echo-rod')!;
    const trigger = unit.triggers.find(trigger => trigger.source.sourceDefinitionId === 'echo-rod')!;
    expect(echo.effect).not.toBe(ITEM_DEFINITIONS['echo-rod'].effects[0]);
    expect(trigger.source).not.toBe(echo.source);
    if (echo.effect.kind !== 'trigger') throw new Error('Expected echo trigger');
    expect(trigger.action).not.toBe(echo.effect.action);
    (trigger.action as { amount: number }).amount = 999;
    expect(echo.effect.action.amount).toBe(70);
    expect(ITEM_DEFINITIONS['echo-rod'].effects[0]).toMatchObject({ action: { amount: 70 } });
    expect(JSON.stringify(state)).toBe(original);
    expect(buildStrategySnapshot(state)).toEqual(permuted);
  });

  it.each([[9, 800, 45], [10, 880, 49], [29, 2400, 135], [100, 2400, 135]])(
    'gives only enemies the documented round %i growth and caps it', (round, health, attack) => {
      const state = snapshotState([boardUnit('p', 'sentinel'), boardUnit('e', 'sentinel', 'enemy')], { round });
      const snapshot = buildStrategySnapshot(state);
      const enemy = snapshot.units.find(unit => unit.unitId === 'e')!;
      expect(enemy.stats).toMatchObject({ health, attack, attackIntervalTicks: 20 });
      expect(enemy.ability.amount).toBe(220);
      expect(enemy.sources.every(source => source.source.sourceKind === 'enemyGrowth')).toBe(true);
      expect(snapshot.units.find(unit => unit.unitId === 'p')!.stats).toMatchObject({ health: 800, attack: 45 });
    },
  );

  it('accepts a new primitive-only content record through the catalog boundary without an ID branch', () => {
    const state = snapshotState([boardUnit('p', 'ranger')], { items: [equipped('item-1', 'new-content', 'p', 0)] });
    const snapshot = buildStrategySnapshot(state, { ...catalog, items: {
      ...catalog.items, 'new-content': { id: 'new-content', name: 'test', kind: 'completed', recipe: ['blade', 'blade'], effects: [
        { kind: 'statFlat', stat: 'attackDamage', amount: 17 },
        { kind: 'trigger', hook: 'onAttack', everyN: 2, action: { kind: 'gainMana', amount: 9 } },
      ] },
    } });
    expect(snapshot.units[0].stats.attack).toBe(87);
    expect(snapshot.units[0].triggers[0]).toMatchObject({ everyN: 2, action: { kind: 'gainMana', amount: 9 } });
  });
});
