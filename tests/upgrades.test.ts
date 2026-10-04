import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import type { GameState } from '../src/simulation/game';
import { planPurchase } from '../src/simulation/upgrades';
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
