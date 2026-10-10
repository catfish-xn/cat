import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { buyUnit, createMatch, type MatchState } from '../src/simulation/match';
import type { UnitAcquisitionSource } from '../src/simulation/resource-provenance';
import type { ItemInstance } from '../src/simulation/strategy-types';
import { planUnitAcquisition, type UnitAcquisitionInput } from '../src/simulation/unit-acquisition';
import type { StarLevel, Unit, UnitLocation } from '../src/simulation/unit-types';
import { planPurchase, transferUpgradeResources } from '../src/simulation/upgrades';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const bench = (slot: number): UnitLocation => ({ kind: 'bench', slot });
const board = (col: number): UnitLocation => ({ kind: 'board', cell: { col, row: 4 } });
const unit = (id: string, location: UnitLocation, starLevel: StarLevel = 1): Unit =>
  ({ id, definitionId: 'tristana', team: 'player', starLevel, location });
const item = (id: string, unitId: string, slot: number): ItemInstance =>
  ({ id, definitionId: 'sword', location: { kind: 'unit', unitId, slot } });
const input = (units: readonly Unit[] = [], benchSize = 9): UnitAcquisitionInput => ({
  preparation: { board: DEFAULT_BOARD, benchSize, units }, nextUnitSerial: 5, items: [], anomalyBinding: null,
});
const shop: UnitAcquisitionSource = { kind: 'shop', generation: 7, slotIndex: 2, definitionId: 'tristana' };
const loot: UnitAcquisitionSource = { kind: 'loot', receiptId: 'receipt-fixture' };

describe('B8 shared pure unit acquisition', () => {
  it.each([shop, loot])('binds the $kind candidate birth and real upgrade events to one immutable plan', source => {
    const state = freeze({ ...input([unit('unit-1', board(3)), unit('unit-2', bench(0)),
      unit('unit-3', board(1), 2), unit('unit-4', bench(1), 2)]),
      items: [item('item-1', 'unit-3', 2), item('item-2', 'unit-4', 0), item('item-3', 'unit-1', 0), item('item-4', 'unit-2', 0)],
      anomalyBinding: { definitionId: 'bulwark', unitId: 'unit-2', choiceId: 'fixture', boundRound: 15 },
    });
    const before = structuredClone(state), result = planUnitAcquisition(state, 'tristana', source, 17);
    expect(state).toEqual(before);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    const purchase = planPurchase(state.preparation, 'tristana', 'unit-5');
    if (!purchase.ok) throw new Error(purchase.reason);
    const resources = transferUpgradeResources(state.items, state.anomalyBinding, purchase.events);
    expect(result.preparation).toEqual(purchase.preparation);
    expect(result.items).toEqual(resources.items);
    expect(result.anomalyBinding).toEqual(resources.anomalyBinding);
    expect(result.events).toEqual([...purchase.events, ...resources.events]);
    expect(result.upgradeEvents).toEqual([
      { type: 'unitUpgraded', survivorId: 'unit-1', consumedIds: ['unit-2', 'unit-5'], definitionId: 'tristana', fromStar: 1, toStar: 2, location: board(3) },
      { type: 'unitUpgraded', survivorId: 'unit-3', consumedIds: ['unit-1', 'unit-4'], definitionId: 'tristana', fromStar: 2, toStar: 3, location: board(1) },
    ]);
    expect(result.facts).toEqual([
      { kind: 'unit-acquired', unitId: 'unit-5', source },
      ...result.upgradeEvents.map(event => ({ kind: 'unit-upgraded', acquisitionSequence: 17, event })),
    ]);
    expect(result.unitId).toBe('unit-5'); expect(result.nextUnitSerial).toBe(6);
    expect(result.preparation.units).toEqual([unit('unit-3', board(1), 3)]);
    expect(result.events.filter(event => event.type === 'anomalyTransferred')).toEqual([
      { type: 'anomalyTransferred', fromId: 'unit-2', toId: 'unit-1' },
      { type: 'anomalyTransferred', fromId: 'unit-1', toId: 'unit-3' },
    ]);
    expect(result.items.find(value => value.id === 'item-2')?.location).toEqual({ kind: 'inventory' });
    expect(Object.keys(result).sort()).toEqual(['anomalyBinding', 'events', 'facts', 'items', 'nextUnitSerial', 'ok', 'preparation', 'unitId', 'upgradeEvents']);
  });

  it('places an unmerged birth in the first free slot without upgrade facts or events', () => {
    const state = freeze(input([unit('unit-1', bench(1))]));
    const result = planUnitAcquisition(state, 'tristana', loot, 8);
    expect(result).toEqual({ ...state, ok: true, unitId: 'unit-5', nextUnitSerial: 6,
      preparation: { ...state.preparation, units: [unit('unit-1', bench(1)), unit('unit-5', bench(0))] },
      upgradeEvents: [], events: [], facts: [{ kind: 'unit-acquired', unitId: 'unit-5', source: loot }],
    });
  });

  it('discards even a tentative merge when the incoming candidate still cannot fit', () => {
    const state = freeze({ ...input([unit('unit-1', board(1)), unit('unit-2', board(2)), unit('unit-3', board(3)),
      { ...unit('unit-4', bench(0)), definitionId: 'irelia' }], 1), items: [item('item-1', 'unit-2', 0)],
      anomalyBinding: { definitionId: 'bulwark', unitId: 'unit-2', choiceId: 'fixture', boundRound: 15 },
    });
    const before = structuredClone(state);
    expect(planUnitAcquisition(state, 'tristana', loot, 9)).toEqual({ ok: false, reason: 'bench-full' });
    expect(state).toEqual(before);
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])('rejects invalid or overflowing candidate serial %s atomically', nextUnitSerial => {
    const state = freeze({ ...input(), nextUnitSerial });
    expect(() => planUnitAcquisition(state, 'tristana', loot, 0)).toThrow(RangeError);
    expect(state.preparation.units).toEqual([]); expect(state.items).toEqual([]);
    expect(state.nextUnitSerial).toBe(nextUnitSerial);
  });

  it('retains duplicate-ID, definition, roster and equipment validation before committing anything', () => {
    expect(() => planUnitAcquisition(freeze(input([unit('unit-5', bench(0))])), 'tristana', shop, 1)).toThrow('Duplicate unit ID');
    expect(() => planUnitAcquisition(freeze(input()), 'unknown', loot, 1)).toThrow('Unknown unit definition');
    expect(() => planUnitAcquisition(freeze(input([unit('unit-1', bench(0)), unit('unit-2', bench(0))])), 'tristana', loot, 1)).toThrow('Invalid preparation roster');
    const state = freeze({ ...input([unit('unit-1', board(1)), unit('unit-2', bench(0))]),
      items: [{ ...item('item-1', 'unit-2', 0), definitionId: 'unknown' }],
    });
    const before = structuredClone(state);
    expect(() => planUnitAcquisition(state, 'tristana', loot, 1)).toThrow('Unknown item definition');
    expect(state).toEqual(before);
  });

  it('commits the same shop facts and keeps a full-bench buy entirely unchanged', () => {
    const base = createMatch(5);
    const state: MatchState = freeze({ ...base, phase: 'preparation', combat: null, gold: 10,
      shop: { generation: 7, slots: [{ status: 'available', definitionId: 'tristana' }] },
    });
    const plan = planUnitAcquisition(state, 'tristana', { ...shop, slotIndex: 0 }, state.resourceProvenance.entries.length);
    const result = buyUnit(state, 0, 7);
    if (!plan.ok || !result.ok) throw new Error('Expected shop acquisition');
    expect(result.state.preparation).toEqual(plan.preparation);
    expect(result.state.nextUnitSerial).toBe(plan.nextUnitSerial);
    expect(result.state.resourceProvenance.entries.slice(-plan.facts.length)).toEqual(plan.facts.map((fact, index) => ({
      ...fact, sequence: state.resourceProvenance.entries.length + index, roundId: state.roundDefinitionId,
    })));
    const full: MatchState = freeze({ ...state, preparation: { ...state.preparation, benchSize: 0 } });
    const failed = buyUnit(full, 0, 7);
    expect(failed).toEqual({ ok: false, state: full, reason: 'bench-full' }); expect(failed.state).toBe(full);
  });
});
