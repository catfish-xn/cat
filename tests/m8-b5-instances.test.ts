import { describe, expect, it } from 'vitest';
import { combineItems, equipItem } from '../src/simulation/match';
import type { MatchCommandResult, MatchState } from '../src/simulation/match-types';
import type { ItemInstance } from '../src/simulation/strategy-types';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { transferUpgradeResources } from '../src/simulation/upgrades';
import { accepted, freeze, purchasedThreeHeroMatch, reachRound } from './match-helpers';

const item = (n: number, definitionId: string, unitId?: string, slot = 0): ItemInstance => ({
  id: `item-${n}`, definitionId, location: unitId ? { kind: 'unit', unitId, slot } : { kind: 'inventory' },
});
function stateWith(items: readonly ItemInstance[]): MatchState {
  const state = purchasedThreeHeroMatch();
  return { ...state, items: [...state.items, ...items], nextItemSerial: 100 };
}
function rejected(state: MatchState, run: (s: MatchState) => MatchCommandResult, reason: string) {
  const before = JSON.stringify(state), result = run(freeze(state));
  expect(result).toEqual({ ok: false, state, reason });
  expect(result.state).toBe(state);
  expect(JSON.stringify(state)).toBe(before);
}

describe('B5 permanent equipment constraints and atomic commands', () => {
  // Independent unique examples from signed B1 / GLOBAL-STACK-01.
  it.each(['blue-buff', 'last-whisper', 'quicksilver'])('%s is unique per holder, not per inventory or team', definitionId => {
    const state = stateWith([item(20, definitionId, 'unit-1'), item(21, definitionId)]);
    rejected(state, s => equipItem(s, 'item-21', 'unit-1', 1), 'unique-conflict');
    const next = accepted(equipItem(state, 'item-21', 'unit-2', 2));
    expect(restoreMatch(serializeMatch(next))).toEqual(next);
  });
  it('allows three nonunique copies but refuses a fourth without spending resources or event IDs', () => {
    let state = stateWith([20, 21, 22, 23].map(n => item(n, 'deathblade')));
    for (let slot = 0; slot < 3; slot++) state = accepted(equipItem(state, `item-${20 + slot}`, 'unit-1', slot));
    for (let slot = 0; slot < 3; slot++) rejected(state, s => equipItem(s, 'item-23', 'unit-1', slot), 'item-slot-occupied');
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it.each([0, 1, 2])('three-slot item requested at %s uses canonical parent slot 0 and reserves all slots', slot => {
    const state = stateWith([item(20, 'thiefs-gloves'), item(21, 'sword'), item(22, 'thiefs-gloves')]);
    const next = accepted(equipItem(state, 'item-20', 'unit-1', slot));
    expect(next.items.find(i => i.id === 'item-20')?.location).toEqual({ kind: 'unit', unitId: 'unit-1', slot: 0 });
    for (const targetSlot of [0, 1, 2]) {
      rejected(next, s => equipItem(s, 'item-21', 'unit-1', targetSlot), 'exclusive-slots');
      rejected(next, s => equipItem(s, 'item-22', 'unit-1', targetSlot), 'exclusive-slots');
    }
    expect(restoreMatch(serializeMatch(next))).toEqual(next);
  });
  it.each([0, 1, 2])('cannot equip an exclusive parent over an ordinary item in slot %s', occupied => {
    const state = stateWith([item(20, 'sword', 'unit-1', occupied), item(21, 'thiefs-gloves')]);
    for (const slot of [0, 1, 2]) rejected(state, s => equipItem(s, 'item-21', 'unit-1', slot), 'exclusive-slots');
  });
  it('phase then identity then input then conflicts; same item has the frozen reason', () => {
    rejected(reachRound('2-1',false), s => equipItem(s, 'missing', 'missing', -1), 'wrong-phase');
    rejected(reachRound('2-1',false), s => combineItems(s, 'missing', 'missing'), 'wrong-phase');
    const state = stateWith([item(20, 'sword'), item(21, 'sword', 'unit-1')]);
    rejected(state, s => equipItem(s, 'missing', 'unit-1', -1), 'unknown-item');
    rejected(state, s => equipItem(s, 'item-20', 'missing', -1), 'unknown-unit');
    rejected(state, s => equipItem(s, 'item-20', 'unit-1', -1), 'invalid-slot');
    rejected(state, s => combineItems(s, 'item-20', 'item-20'), 'same-item');
    rejected(state, s => combineItems(s, 'item-20', 'item-21'), 'item-not-inventory');
    rejected(state, s => combineItems(s, 'missing', 'item-20'), 'unknown-item');
  });
  it('successful combine consumes exactly two IDs and one serial; stale replay fails atomically', () => {
    const state = stateWith([item(20, 'gloves'), item(21, 'gloves')]);
    const next = accepted(combineItems(state, 'item-21', 'item-20'));
    expect(next.items.find(i => i.id === 'item-100')).toEqual(item(100, 'thiefs-gloves'));
    expect(next.nextItemSerial).toBe(101);
    expect(next.nextMatchEventSeq).toBe(state.nextMatchEventSeq + 1);
    expect(restoreMatch(serializeMatch(next))).toEqual(next);
    rejected(next, s => combineItems(s, 'item-20', 'item-21'), 'unknown-item');
  });
  it.each([
    [item(20, 'blue-buff', 'unit-1'), item(21, 'blue-buff', 'unit-1', 1)],
    [item(20, 'thiefs-gloves', 'unit-1'), item(21, 'sword', 'unit-1', 2)],
    [item(20, 'thiefs-gloves', 'unit-1', 1)],
  ])('restore rejects invalid unique, exclusive or parent-slot placements', (...items) => {
    expect(() => restoreMatch(JSON.stringify(stateWith(items)))).toThrow();
  });
  it.each([
    ['blue-buff', 'blue-buff'], ['thiefs-gloves', 'sword'], ['sword', 'thiefs-gloves'],
  ])('upgrade does not bypass %s / %s placement constraints', (retained, incoming) => {
    const items = freeze([item(20, retained, 'unit-1'), item(21, incoming, 'unit-2')]);
    const plan = transferUpgradeResources(items, null, [{ type: 'unitUpgraded', survivorId: 'unit-1', consumedIds: ['unit-2', 'unit-3'],
      definitionId: 'irelia', fromStar: 1, toStar: 2, location: { kind: 'board', cell: { col: 1, row: 4 } } }]);
    expect(plan.items).toEqual([items[0], item(21, incoming)]);
    expect(plan.events).toEqual([{ type: 'itemsReturned', itemIds: ['item-21'], unitId: 'unit-2' }]);
  });
});
