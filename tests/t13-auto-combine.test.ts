import { describe, expect, it } from 'vitest';
import { equipItem, type MatchState } from '../src/simulation/match';
import { previewEquip } from '../src/simulation/item-selectors';
import { prepared, accepted } from './t10-helpers';
import { freeze } from './combat-helpers';

const held = (id: string, definitionId: string, slot: number) =>
  ({ id, definitionId, location: { kind: 'unit' as const, unitId: 'unit-1', slot } });
const stock = (id: string, definitionId: string) => ({ id, definitionId, location: { kind: 'inventory' as const } });

describe('T13-A unit-wide ordinary component combination', () => {
  for (const phase of ['preparation', 'combat', 'choice', 'settlement'] as const)
    for (const [name, slot] of [['empty', 0], ['component', 1], ['completed', 2]] as const)
      it(`${phase}: requested ${name} slot combines at existing slot 1`, () => {
        const state = freeze({ ...prepared(), phase, nextItemSerial: 4,
          items: [stock('item-1', 'sword'), held('item-2', 'bow', 1), held('item-3', 'deathcap', 2)] } as MatchState);
        const before = JSON.stringify(state);
        expect(previewEquip(state, 'item-1', 'unit-1', slot)).toEqual({ allowed: true, reason: null,
          occupiedSlots: [1], conflictingItemIds: [],
          combination: { resultDefinitionId: 'giant-slayer', consumedItemIds: ['item-1', 'item-2'] } });
        expect(JSON.stringify(state)).toBe(before);
        const result = equipItem(state, 'item-1', 'unit-1', slot), next = accepted(result);
        expect(next.items).toEqual([held('item-3', 'deathcap', 2), held('item-4', 'giant-slayer', 1)]);
        expect(next.nextItemSerial).toBe(5);
        expect(next.combat).toBe(state.combat); expect(next.combatInputBasis).toBe(state.combatInputBasis);
        expect(next.pendingChoice).toBe(state.pendingChoice); expect(next.equipmentState).toBe(state.equipmentState);
        expect(next.rngState).toBe(state.rngState); expect(next.m8.loot).toBe(state.m8.loot);
        expect(next.resourceProvenance.entries.at(-1)).toMatchObject({ kind: 'item-combined',
          event: { consumedIds: ['item-1', 'item-2'], itemId: 'item-4', definitionId: 'giant-slayer' } });
        expect(result.ok && result.events.map(e => e.type)).toEqual(['itemCombined', 'itemEquipped']);
      });
  it('legacy multiple components use ascending slot order, independent of item array and requested slot', () => {
    const state = { ...prepared(), nextItemSerial: 4,
      items: [held('item-1', 'rod', 2), stock('item-3', 'sword'), held('item-2', 'bow', 0)] };
    for (const slot of [0, 1, 2]) {
      const next = accepted(equipItem(state, 'item-3', 'unit-1', slot));
      expect(next.items).toEqual([held('item-1', 'rod', 2), held('item-4', 'giant-slayer', 0)]);
    }
  });
  it('final placement conflict rejects atomically even when requested slot is empty', () => {
    const state = freeze({ ...prepared(), nextItemSerial: 4,
      items: [stock('item-1', 'tear'), held('item-2', 'tear', 1), held('item-3', 'blue-buff', 2)] });
    const bytes = JSON.stringify(state), result = equipItem(state, 'item-1', 'unit-1', 0);
    expect(previewEquip(state, 'item-1', 'unit-1', 0)).toEqual({allowed:false,reason:'unique-conflict',conflictingItemIds:['item-3']});
    expect(result).toEqual({ok:false,state,reason:'unique-conflict'}); expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(bytes);
  });
});
