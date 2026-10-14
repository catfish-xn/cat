import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import type { GameState } from '../src/simulation/game';
import { planPurchase, transferUpgradeResources } from '../src/simulation/upgrades';
import type { AnomalyBinding, ItemInstance } from '../src/simulation/strategy-types';
import { getUnitSellPrice } from '../src/simulation/unit-stats';
import type { StarLevel, Unit, UnitLocation } from '../src/simulation/units';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const bench = (slot: number): UnitLocation => ({ kind: 'bench', slot });
const board = (col: number, row = 4): UnitLocation => ({ kind: 'board', cell: { col, row } });
const unit = (id: string, location: UnitLocation, starLevel: StarLevel = 1, definitionId = 'sentinel', team: Unit['team'] = 'player'): Unit =>
  ({ id, location, starLevel, definitionId, team });
const game = (units: readonly Unit[], benchSize = 7): GameState => ({ board: DEFAULT_BOARD, units, benchSize });
function purchase(state: GameState, definitionId = 'sentinel', candidateId = 'unit-99') {
  const result = planPurchase(state, definitionId, candidateId);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result;
}
const mass = (state: GameState, definitionId: string) => state.units.filter(unit => unit.team === 'player' && unit.definitionId === definitionId)
  .reduce((sum, unit) => sum + 3 ** (unit.starLevel - 1), 0);

describe('atomic purchase and automatic upgrades', () => {
  it('places a nonmerging purchase in the first free slot and sorts the complete roster by code-point ID', () => {
    const state = freeze(game([unit('unit-2', bench(2), 1, 'mystic'), unit('unit-10', bench(0), 1, 'ranger')]));
    const before = structuredClone(state), result = purchase(state);
    expect(result.events).toEqual([]);
    expect(result.preparation.units.map(unit => unit.id)).toEqual(['unit-10', 'unit-2', 'unit-99']);
    expect(result.preparation.units.at(-1)).toEqual(unit('unit-99', bench(1)));
    expect(state).toEqual(before);
  });

  it('upgrades the third one-star and retains the lowest bench slot even when its ID sorts last', () => {
    const state = freeze(game([unit('unit-1', bench(3)), unit('unit-9', bench(1))]));
    const result = purchase(state);
    expect(result.preparation.units).toEqual([unit('unit-9', bench(1), 2)]);
    expect(result.events).toEqual([{ type: 'unitUpgraded', survivorId: 'unit-9', consumedIds: ['unit-1', 'unit-99'],
      definitionId: 'sentinel', fromStar: 1, toStar: 2, location: bench(1) }]);
    expect(result.events[0].location).not.toBe(state.units[1].location);
    expect(mass(result.preparation, 'sentinel')).toBe(3);
  });

  it('keeps board position before bench and orders board survivors by row then column', () => {
    for (const units of [
      [unit('unit-1', bench(0)), unit('unit-9', board(6))],
      [unit('unit-1', board(0, 5)), unit('unit-9', board(6))],
      [unit('unit-1', board(6)), unit('unit-9', board(2))],
    ]) {
      const result = purchase(freeze(game(units)));
      expect(result.preparation.units).toEqual([{ ...units[1], starLevel: 2 }]);
      expect(result.events[0].survivorId).toBe('unit-9');
    }
  });

  it('chains eight represented cards plus the purchase into one three-star with ordered independent events', () => {
    const state = freeze(game([unit('unit-20', board(2), 2), unit('unit-10', bench(0), 2),
      unit('unit-4', bench(2)), unit('unit-3', bench(1))]));
    const result = purchase(state);
    expect(result.preparation.units).toEqual([unit('unit-20', board(2), 3)]);
    expect(result.events).toEqual([
      { type: 'unitUpgraded', survivorId: 'unit-3', consumedIds: ['unit-4', 'unit-99'], definitionId: 'sentinel', fromStar: 1, toStar: 2, location: bench(1) },
      { type: 'unitUpgraded', survivorId: 'unit-20', consumedIds: ['unit-10', 'unit-3'], definitionId: 'sentinel', fromStar: 2, toStar: 3, location: board(2) },
    ]);
    expect(mass(result.preparation, 'sentinel')).toBe(mass(state, 'sentinel') + 1);
    expect(getUnitSellPrice(result.preparation.units[0])).toBe(9);
    expect(result.events[0].location).not.toBe(result.events[1].location);
  });

  it('produces identical complete output for every input rotation and reverse ordering', () => {
    const units = [unit('unit-20', board(2), 2), unit('unit-10', bench(0), 2), unit('unit-4', bench(2)),
      unit('unit-3', bench(1)), unit('enemy', board(3, 1), 1, 'sentinel', 'enemy'), unit('ranger', bench(6), 1, 'ranger')];
    const expected = purchase(game(units));
    for (let i = 0; i < units.length; i++) {
      const rotated = [...units.slice(i), ...units.slice(0, i)];
      expect(purchase(freeze(game(rotated)))).toEqual(expected);
      expect(purchase(freeze(game([...rotated].reverse())))).toEqual(expected);
    }
  });

  it('never mixes definitions, star levels or enemy teams and never creates four-star units', () => {
    const units = [unit('s1', bench(0)), unit('s2', bench(1), 2), unit('s3a', bench(2), 3),
      unit('s3b', bench(3), 3), unit('s3c', bench(4), 3), unit('ranger', bench(5), 1, 'ranger'),
      unit('enemy', board(2, 1), 1, 'sentinel', 'enemy')];
    const result = purchase(freeze(game(units)));
    expect(result.events).toEqual([]);
    expect(result.preparation.units).toHaveLength(8);
    expect(result.preparation.units.find(unit => unit.id === 'unit-99')?.location).toEqual(bench(6));
    expect(result.preparation.units.filter(unit => unit.starLevel === 3)).toHaveLength(3);
  });

  it('rejects a full nonmerging bench with no partial roster or events and no mutation', () => {
    const state = freeze(game([unit('only-one', bench(0)), unit('other', bench(1), 1, 'ranger')], 2));
    const before = JSON.stringify(state);
    expect(planPurchase(state, 'sentinel', 'unit-99')).toEqual({ ok: false, reason: 'bench-full' });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('accepts a full bench when the third card merges with bench, board or mixed copies', () => {
    const fixtures = [
      game([unit('a', bench(0)), unit('b', bench(1))], 2),
      game([unit('a', board(1)), unit('b', board(2)), unit('ranger', bench(0), 1, 'ranger')], 1),
      game([unit('a', board(1)), unit('b', bench(0))], 1),
    ];
    for (const state of fixtures) {
      const result = purchase(freeze(state));
      expect(result.events).toHaveLength(1);
      expect(result.preparation.units.some(unit => unit.id === 'unit-99')).toBe(false);
      expect(mass(result.preparation, 'sentinel')).toBe(3);
      expect(result.preparation.units.filter(unit => unit.location.kind === 'bench').length).toBeLessThanOrEqual(state.benchSize);
    }
  });

  it('preserves unrelated units and never autodeploys a bench survivor', () => {
    const unrelated = unit('other', board(6), 3, 'oracle');
    const state = freeze(game([unit('a', bench(0)), unit('b', bench(1)), unrelated]));
    const result = purchase(state);
    expect(result.preparation.units.find(unit => unit.id === 'a')).toEqual(unit('a', bench(0), 2));
    expect(result.preparation.units.find(unit => unit.id === 'other')).toEqual(unrelated);
    expect(result.preparation.units.filter(unit => unit.location.kind === 'board')).toHaveLength(1);
  });

  it('survives JSON restoration and maintains card/value conservation across 27 successive purchases', () => {
    let state = game([]);
    const consumedIds = new Set<string>();
    for (let number = 1; number <= 27; number++) {
      const result = purchase(freeze(state), 'sentinel', `unit-${number}`);
      for (const event of result.events) for (const id of event.consumedIds) consumedIds.add(id);
      state = JSON.parse(JSON.stringify(result.preparation)) as GameState;
      expect(mass(state, 'sentinel')).toBe(number);
      expect(state.units.reduce((sum, unit) => sum + getUnitSellPrice(unit), 0)).toBe(number);
      expect(state.units.every(unit => !consumedIds.has(unit.id))).toBe(true);
      for (const star of [1, 2]) expect(state.units.filter(unit => unit.starLevel === star).length).toBeLessThan(3);
    }
    expect(state.units.map(unit => unit.starLevel)).toEqual([3, 3, 3]);
  });

  it('rejects invalid configuration before making a purchase plan', () => {
    const state = game([unit('a', bench(0))]);
    expect(() => planPurchase(state, 'unknown', 'new')).toThrow(RangeError);
    expect(() => planPurchase(state, 'sentinel', 'a')).toThrow('Duplicate unit ID');
    expect(() => planPurchase(game([unit('a', bench(0)), unit('b', bench(0))]), 'sentinel', 'new')).toThrow('Invalid preparation roster');
  });
});

const item = (id: string, unitId?: string, slot = 0, definitionId = 'sword'): ItemInstance => ({
  id, definitionId, location: unitId === undefined ? { kind: 'inventory' } : { kind: 'unit', unitId, slot },
});
const anomaly = (unitId: string): AnomalyBinding => ({
  definitionId: 'colossus', unitId, choiceId: 'anomaly-r7', boundRound: 7,
});

describe('upgrade item and anomaly resource plans', () => {
  it('preserves survivor slots and fills gaps by consumed unit ID then original slot, returning overflow', () => {
    const roster = freeze(game([unit('survivor', board(2)), unit('unit-9', bench(0)), unit('unit-10', bench(1))]));
    // A legal planner input with an existing triple makes the nonmerging incoming card remain on the bench.
    const upgraded = purchase(roster);
    expect(upgraded.events[0].consumedIds).toEqual(['unit-10', 'unit-9']);
    const items = freeze([
      item('item-1', 'survivor', 1), item('item-2', 'unit-9', 0), item('item-3', 'unit-10', 2),
      item('item-4', 'unit-10', 0), item('item-5', 'unit-10', 1), item('item-6'),
    ]);
    const binding = freeze(anomaly('unit-10')), before = JSON.stringify({ items, binding });
    const transferred = transferUpgradeResources(items, binding, freeze(upgraded.events));
    expect(transferred.items).toEqual([
      item('item-1', 'survivor', 1), item('item-2'), item('item-3'),
      item('item-4', 'survivor', 0), item('item-5', 'survivor', 2), item('item-6'),
    ]);
    expect(transferred.events).toEqual([
      { type: 'itemEquipped', itemId: 'item-4', unitId: 'survivor', slot: 0 },
      { type: 'itemEquipped', itemId: 'item-5', unitId: 'survivor', slot: 2 },
      { type: 'itemsReturned', itemIds: ['item-3'], unitId: 'unit-10' },
      { type: 'itemsReturned', itemIds: ['item-2'], unitId: 'unit-9' },
      { type: 'anomalyTransferred', fromId: 'unit-10', toId: 'survivor' },
    ]);
    expect(transferred.anomalyBinding).toEqual(anomaly('survivor'));
    expect(JSON.stringify({ items, binding })).toBe(before);
    expect(transferUpgradeResources([...items].reverse(), binding, upgraded.events)).toEqual(transferred);
    expect(transferUpgradeResources(items, binding, upgraded.events.map(event => ({ ...event, consumedIds: [...event.consumedIds].reverse() }))))
      .toEqual(transferred);
  });

  it('moves resources at each stage of a one-to-two-to-three-star chain without changing survivor selection', () => {
    const roster = freeze(game([unit('unit-20', board(2), 2), unit('unit-10', bench(0), 2),
      unit('unit-4', bench(2)), unit('unit-3', bench(1))]));
    const upgraded = purchase(roster);
    const items = freeze([
      item('item-1', 'unit-20', 2), item('item-2', 'unit-10', 1), item('item-3', 'unit-3', 2),
      item('item-4', 'unit-4', 0), item('item-5', 'unit-4', 1), item('item-6', undefined, 0, 'rod'),
    ]);
    const transferred = transferUpgradeResources(items, freeze(anomaly('unit-4')), upgraded.events);
    expect(upgraded.preparation.units).toEqual([unit('unit-20', board(2), 3)]);
    expect(transferred.items).toEqual([
      item('item-1', 'unit-20', 2), item('item-2', 'unit-20', 0), item('item-3'),
      item('item-4', 'unit-20', 1), item('item-5'), item('item-6', undefined, 0, 'rod'),
    ]);
    expect(transferred.events.filter(event => event.type === 'anomalyTransferred')).toEqual([
      { type: 'anomalyTransferred', fromId: 'unit-4', toId: 'unit-3' },
      { type: 'anomalyTransferred', fromId: 'unit-3', toId: 'unit-20' },
    ]);
    expect(transferred.anomalyBinding).toEqual(anomaly('unit-20'));
    expect(transferred.items.map(value => [value.id, value.definitionId])).toEqual(items.map(value => [value.id, value.definitionId]));
    const owned = new Set(upgraded.preparation.units.map(value => value.id));
    expect(transferred.items.every(value => value.location.kind === 'inventory' || owned.has(value.location.unitId))).toBe(true);
    const restored = JSON.parse(JSON.stringify({ items, binding: anomaly('unit-4'), events: upgraded.events }));
    expect(transferUpgradeResources(restored.items, restored.binding, restored.events)).toEqual(transferred);
  });

  it('retains an existing survivor or unrelated binding and does not turn identical components into a completed item', () => {
    const upgraded = purchase(freeze(game([unit('survivor', board(1)), unit('consumed', bench(0))])));
    const items = freeze([item('item-1', 'survivor', 2), item('item-2', 'consumed', 1)]);
    for (const binding of [anomaly('survivor'), anomaly('unrelated'), null]) {
      const transferred = transferUpgradeResources(items, freeze(binding), upgraded.events);
      expect(transferred.items).toEqual([item('item-1', 'survivor', 2), item('item-2', 'survivor', 0)]);
      expect(transferred.anomalyBinding).toEqual(binding);
      expect(transferred.events).toEqual([{ type: 'itemEquipped', itemId: 'item-2', unitId: 'survivor', slot: 0 }]);
    }
  });

  it('transfers a full-bench successful purchase and returns no partial plan for a final bench failure', () => {
    const roster = freeze(game([unit('a', bench(0)), unit('b', bench(1))], 2));
    const items = freeze([item('item-1', 'a', 0), item('item-2', 'b', 2)]), binding = freeze(anomaly('b'));
    const success = purchase(roster);
    expect(transferUpgradeResources(items, binding, success.events)).toEqual({
      items: [item('item-1', 'a', 0), item('item-2', 'a', 1)], anomalyBinding: anomaly('a'),
      events: [{ type: 'itemEquipped', itemId: 'item-2', unitId: 'a', slot: 1 },
        { type: 'anomalyTransferred', fromId: 'b', toId: 'a' }],
    });
    const unmergeable = freeze(game([unit('a', board(1)), unit('b', board(2)), unit('c', board(3)),
      unit('other', bench(0), 1, 'ranger')], 1));
    const before = JSON.stringify({ unmergeable, items, binding });
    // The three board copies can merge in the temporary plan, but the incoming fourth card cannot fit.
    expect(planPurchase(unmergeable, 'sentinel', 'unit-99')).toEqual({ ok: false, reason: 'bench-full' });
    expect(JSON.stringify({ unmergeable, items, binding })).toBe(before);
  });

  it('conserves every item through successive purchases and returns all overflow to inventory', () => {
    let roster = game([]), items: readonly ItemInstance[] = [], binding: AnomalyBinding | null = null;
    const created = new Map<string, string>();
    for (let serial = 1; serial <= 27; serial++) {
      const upgraded = purchase(freeze(roster), 'sentinel', `unit-${serial}`);
      const transferred = transferUpgradeResources(freeze(items), freeze(binding), upgraded.events);
      roster = upgraded.preparation;
      items = transferred.items;
      binding = transferred.anomalyBinding;
      const target = roster.units.find(value => value.id === `unit-${serial}`);
      if (target) {
        const itemId = `item-${serial}`;
        items = [...items, item(itemId, target.id, 0, 'rod')];
        created.set(itemId, 'rod');
        if (serial === 2) binding = anomaly(target.id);
      }
      expect(items).toHaveLength(created.size);
      expect(new Set(items.map(value => value.id)).size).toBe(created.size);
      for (const value of items) {
        expect(value.definitionId).toBe(created.get(value.id));
        if (value.location.kind === 'unit') {
          expect(roster.units.some(unit => value.location.kind === 'unit' && unit.id === value.location.unitId)).toBe(true);
        }
      }
      for (const value of roster.units) {
        const equipped = items.filter(item => item.location.kind === 'unit' && item.location.unitId === value.id);
        expect(equipped.length).toBeLessThanOrEqual(3);
        expect(new Set(equipped.map(item => item.location.kind === 'unit' ? item.location.slot : -1)).size).toBe(equipped.length);
      }
      if (binding) expect(roster.units.some(unit => unit.id === binding?.unitId)).toBe(true);
    }
    expect(roster.units.map(value => value.starLevel)).toEqual([3, 3, 3]);
    expect(items.some(value => value.location.kind === 'inventory')).toBe(true);
    expect(binding?.choiceId).toBe('anomaly-r7');
  });
});
