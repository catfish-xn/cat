import { describe, expect, it } from 'vitest';
import { itemMatch } from './fixtures/m8-b4-match';
import { stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';

describe('B8 public equipment fixture provenance', () => {
  it('wins the real opening, receives both heroes and combines two selected loot components at 2-1', () => {
    const state = itemMatch('bloodthirster');
    expect(state.roundDefinitionId).toBe('2-1');
    expect(state.roundResults.map(result => [result.roundId, result.result])).toEqual([
      ['1-2', 'playerWin'], ['1-3', 'playerWin'], ['1-4', 'playerWin'],
    ]);
    expect(state.preparation.units.filter(unit => unit.team === 'player').map(unit => [unit.id, unit.definitionId, unit.starLevel])).toEqual([
      ['unit-1', 'irelia', 1], ['unit-2', 'maddie', 1], ['unit-3', 'lux', 1],
    ]);
    expect(state.resourceProvenance.entries.filter(entry => entry.kind === 'unit-acquired').map(entry => [entry.roundId, entry.unitId, entry.source.kind])).toEqual([
      ['1-2', 'unit-1', 'opening'], ['1-2', 'unit-2', 'loot'], ['1-3', 'unit-3', 'loot'],
    ]);
    expect(state.m8.loot.receipts.filter(receipt => receipt.payload.kind === 'item').map(receipt => [receipt.payload, receipt.grantedItemIds])).toEqual([
      [{ kind: 'item', definitionId: 'sword', quantity: 1 }, ['item-1']],
      [{ kind: 'item', definitionId: 'cloak', quantity: 1 }, ['item-2']],
    ]);
    expect(state.resourceProvenance.entries.filter(entry => entry.kind === 'item-combined').map(entry => entry.event)).toEqual([
      { type: 'itemCombined', consumedIds: ['item-1', 'item-2'], itemId: 'item-3', definitionId: 'bloodthirster' },
    ]);
    expect(state.items).toEqual([{ id: 'item-3', definitionId: 'bloodthirster', location: { kind: 'unit', unitId: 'unit-1', slot: 0 } }]);
    expect(state.combat!.units.filter(unit => unit.team === 'player').map(unit => [unit.id, unit.maxHp])).toEqual([['unit-1', 700]]);
    const restored = restoreMatch(serializeMatch(state));
    expect(restored).toEqual(state);
    expect(stepMatch(restored)).toEqual(stepMatch(state));
  });

  it('equips the actual dropped Lux while preserving the original Irelia on the bench', () => {
    const state = itemMatch('hand-of-justice', 'unit-3');
    expect(state.roundDefinitionId).toBe('2-1');
    expect(state.preparation.units.find(unit => unit.id === 'unit-1')).toMatchObject({ definitionId: 'irelia', location: { kind: 'bench' } });
    expect(state.preparation.units.find(unit => unit.id === 'unit-3')).toMatchObject({ definitionId: 'lux', location: { kind: 'board', cell: { col: 5, row: 4 } } });
    expect(state.combat!.units.filter(unit => unit.team === 'player').map(unit => unit.id)).toEqual(['unit-3']);
    expect(restoreMatch(state)).toEqual(state);
  });

  it('obtains components three and four from real scheduled choices and starts two Bloodthirsters at 3-5', () => {
    const state = itemMatch(['bloodthirster', 'bloodthirster']);
    expect(state.roundDefinitionId).toBe('3-5');
    expect(state.scheduleReceipts.filter(receipt => receipt.kind === 'component').map(receipt => [receipt.definitionId, receipt.itemIds])).toEqual([
      ['sword', ['item-3']], ['cloak', ['item-4']],
    ]);
    expect(state.resourceProvenance.entries.filter(entry => entry.kind === 'item-acquired').map(entry => [entry.roundId, entry.itemId, entry.source.kind])).toEqual([
      ['1-3', 'item-1', 'loot'], ['1-4', 'item-2', 'loot'], ['2-4', 'item-3', 'schedule'], ['3-4', 'item-4', 'schedule'],
    ]);
    expect(state.items.map(item => [item.id, item.definitionId])).toEqual([['item-5', 'bloodthirster'], ['item-6', 'bloodthirster']]);
    expect(state.augments.map(augment => augment.definitionId)).toEqual(['bulky-buddies-i', 'manaflow-i']);
    expect(state.combat!.units.filter(unit => unit.team === 'player').map(unit => [unit.id, unit.maxHp])).toEqual([['unit-1', 700]]);
    const restored = restoreMatch(serializeMatch(state));
    expect(restored).toEqual(state);
    expect(stepMatch(restored)).toEqual(stepMatch(state));
  });

  it('returns detached snapshots and does not reuse caller-mutated resources or provenance', () => {
    const first = itemMatch('bloodthirster'), original = serializeMatch(first);
    Object.assign(first.preparation.units.find(unit => unit.id === 'unit-1')!, { definitionId: 'garen' });
    Object.assign(first.items[0], { definitionId: 'warmog' });
    expect(() => Object.assign(first.resourceProvenance.entries[0], { unitId: 'forged' })).toThrow(TypeError);
    const second = itemMatch('bloodthirster');
    expect(second.resourceProvenance).not.toBe(first.resourceProvenance);
    expect(serializeMatch(second)).toBe(original);
    expect(restoreMatch(second)).toEqual(second);
  });
});
