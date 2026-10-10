import { describe, expect, it } from 'vitest';
import { combineItems, equipItem, startMatchCombat } from '../src/simulation/match';
import { previewCombine, previewEquip, readUnitEquipment, readItemCatalog } from '../src/simulation/item-selectors';
import type { MatchState } from '../src/simulation/match-types';
import type { ItemInstance } from '../src/simulation/strategy-types';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { planTemporaryEquipment } from '../src/simulation/temporary-equipment';
import { accepted, freeze, purchasedThreeHeroMatch, reachRound } from './match-helpers';
import { publicInventory } from './fixtures/b8-public-acquisition';

const item = (n: number, definitionId: string, unitId?: string, slot = 0): ItemInstance => ({
  id: `item-${n}`, definitionId, location: unitId ? { kind: 'unit', unitId, slot } : { kind: 'inventory' },
});
// The full independent query/conflict matrix is a mechanism fixture; its fake
// inventory is explicitly rejected below, alongside provenance-complete controls.
function fixture(): MatchState {
  const state = purchasedThreeHeroMatch();
  return freeze(planTemporaryEquipment({ ...state, nextItemSerial: 40, items: [...state.items,
    item(20, 'sword'), item(21, 'rod'), item(22, 'blue-buff'), item(23, 'blue-buff', 'unit-1'),
    item(24, 'thiefs-gloves'), item(25, 'thiefs-gloves', 'unit-2'), item(26, 'vest', 'unit-1', 2),
  ] }).state);
}

describe('B5 shared command previews and read-only equipment', () => {
  it('combine returns a definition and sorted consumed IDs without allocating an ID', () => {
    const state = fixture(), before = JSON.stringify(state);
    expect(previewCombine(state, 'item-21', 'item-20')).toEqual({ allowed: true, reason: null,
      resultDefinitionId: 'gunblade', consumedItemIds: ['item-20', 'item-21'] });
    expect(previewCombine({ ...state, nextItemSerial: Number.MAX_SAFE_INTEGER }, 'item-21', 'item-20').allowed).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    const next = accepted(combineItems(state, 'item-21', 'item-20'));
    expect(next.items.find(item => item.id === 'item-40')?.definitionId).toBe('gunblade');
  });
  it('equip returns exact occupied slots or the complete sorted conflicting permanent IDs', () => {
    const state = fixture();
    expect(previewEquip(state, 'item-24', 'unit-3', 2)).toEqual({ allowed: true, reason: null,
      occupiedSlots: [0, 1, 2], conflictingItemIds: [] });
    expect(previewEquip(state, 'item-20', 'unit-3', 2)).toEqual({ allowed: true, reason: null,
      occupiedSlots: [2], conflictingItemIds: [] });
    expect(previewEquip(state, 'item-22', 'unit-1', 2)).toEqual({ allowed: false, reason: 'unique-conflict', conflictingItemIds: ['item-23'] });
    expect(previewEquip(state, 'item-24', 'unit-1', 1)).toEqual({ allowed: false, reason: 'exclusive-slots', conflictingItemIds: ['item-23', 'item-26'] });
    expect(previewEquip(state, 'item-20', 'unit-2', 2)).toEqual({ allowed: false, reason: 'exclusive-slots', conflictingItemIds: ['item-25'] });
    expect(previewEquip(state, 'item-20', 'unit-1', 2)).toEqual({ allowed: false, reason: 'item-slot-occupied', conflictingItemIds: ['item-26'] });
  });
  it('preview and command agree over identities, locations, recipes, slots, conflicts and phase', () => {
    const base = fixture();
    const phases = [base, reachRound('2-1',false), accepted(startMatchCombat(base)), { ...base, phase: 'settlement' as const, combat: null }, { ...base, phase: 'gameOver' as const, combat: null }];
    for (const state of phases) {
      const before = JSON.stringify(state);
      for (const a of ['missing', 'item-20', 'item-21', 'item-23', 'item-24']) {
        for (const b of ['missing', 'item-20', 'item-21', 'item-23', 'item-24']) {
          const preview = previewCombine(state, a, b), actual = combineItems(state, a, b);
          expect(preview.allowed).toBe(actual.ok);
          if (!preview.allowed && !actual.ok) { expect(preview.reason).toBe(actual.reason); expect(actual.state).toBe(state); }
        }
        for (const unitId of ['missing', 'unit-1', 'unit-2', 'unit-3', base.preparation.units.find(u => u.team === 'enemy')!.id]) {
          for (const slot of [-1, 0, 1, 2, 3, 0.5, NaN]) {
            const preview = previewEquip(state, a, unitId, slot), actual = equipItem(state, a, unitId, slot);
            expect(preview.allowed).toBe(actual.ok);
            if (!preview.allowed && !actual.ok) { expect(preview.reason).toBe(actual.reason); expect(actual.state).toBe(state); }
          }
        }
      }
      expect(JSON.stringify(state)).toBe(before);
    }
  });
  it('a previous successful preview never authorizes a stale command', () => {
    const state = fixture();
    expect(previewEquip(state, 'item-20', 'unit-3', 0).allowed).toBe(true);
    const changed = accepted(equipItem(state, 'item-21', 'unit-3', 0));
    expect(equipItem(changed, 'item-20', 'unit-3', 0)).toEqual({ ok: false, state: changed, reason: 'item-slot-occupied' });
    expect(previewCombine(state, 'item-20', 'item-21').allowed).toBe(true);
    const combined = accepted(combineItems(state, 'item-20', 'item-21'));
    expect(combineItems(combined, 'item-20', 'item-21')).toEqual({ ok: false, state: combined, reason: 'unknown-item' });
  });
  it('known units have three slots, reserved slots have no fake permanent IDs; unknown returns null', () => {
    const state = fixture(), before = JSON.stringify(state);
    expect(readUnitEquipment(state, 'missing')).toBeNull();
    expect(readUnitEquipment(state, 'unit-2')).toEqual({ unitId: 'unit-2', slots: [
      { slot: 0, itemInstanceId: 'item-25', reservedByItemInstanceId: null },
      { slot: 1, itemInstanceId: null, reservedByItemInstanceId: 'item-25' },
      { slot: 2, itemInstanceId: null, reservedByItemInstanceId: 'item-25' },
    ], temporaryItems: state.temporaryEquipment.filter(item => item.holderId === 'unit-2') });
    const view = readUnitEquipment(state, 'unit-1')!;
    expect(view.slots.map(s => s.itemInstanceId)).toEqual(['item-23', null, 'item-26']);
    Object.assign(view.slots[0], { itemInstanceId: 'tampered' });
    expect(readUnitEquipment(state, 'unit-1')!.slots[0].itemInstanceId).toBe('item-23');
    expect(() => restoreMatch(serializeMatch(state))).toThrow('Invalid B8 Match: current resource fold');
    // Recreate the exact TG reserved-slot view with real choices and combine.
    // Keep the full seven-item matrix above; split its independent ordinary and
    // exclusive holder views so no artificial component supply is introduced.
    const tg = publicInventory(['thiefs-gloves', 'sword']);
    const tgState = freeze(accepted(equipItem(tg.state, tg.itemIds[0], 'unit-2', 2))), tgBefore = JSON.stringify(tgState);
    expect(readUnitEquipment(tgState, 'missing')).toBeNull();
    expect(readUnitEquipment(tgState, 'unit-2')).toEqual({ unitId: 'unit-2', slots: [
      { slot: 0, itemInstanceId: tg.itemIds[0], reservedByItemInstanceId: null },
      { slot: 1, itemInstanceId: null, reservedByItemInstanceId: tg.itemIds[0] },
      { slot: 2, itemInstanceId: null, reservedByItemInstanceId: tg.itemIds[0] },
    ], temporaryItems: tgState.temporaryEquipment.filter(item => item.holderId === 'unit-2') });
    const restored = restoreMatch(serializeMatch(tgState));
    expect(readUnitEquipment(restored, 'unit-2')).toEqual(readUnitEquipment(tgState, 'unit-2'));
    const temporaryView = readUnitEquipment(tgState, 'unit-2')!;
    Object.assign(temporaryView.slots[1], { reservedByItemInstanceId: 'tampered' });
    Object.assign(temporaryView.temporaryItems[0], { definitionId: 'tampered' });
    for (let i = 0; i < 10; i++) { readItemCatalog(); readUnitEquipment(tgState, 'unit-2'); previewEquip(tgState, tg.itemIds[1], 'unit-3', 0); }
    expect(JSON.stringify(tgState)).toBe(tgBefore);
    const ordinary = publicInventory(['blue-buff', 'vest']);
    let ordinaryState = accepted(equipItem(ordinary.state, ordinary.itemIds[0], 'unit-1', 0));
    ordinaryState = freeze(accepted(equipItem(ordinaryState, ordinary.itemIds[1], 'unit-1', 2)));
    const ordinaryBefore = JSON.stringify(ordinaryState), ordinaryView = readUnitEquipment(ordinaryState, 'unit-1')!;
    expect(ordinaryView.slots.map(slot => slot.itemInstanceId)).toEqual([ordinary.itemIds[0], null, ordinary.itemIds[1]]);
    Object.assign(ordinaryView.slots[0], { itemInstanceId: 'tampered' });
    expect(readUnitEquipment(ordinaryState, 'unit-1')!.slots[0].itemInstanceId).toBe(ordinary.itemIds[0]);
    expect(readUnitEquipment(restoreMatch(serializeMatch(ordinaryState)), 'unit-1')).toEqual(readUnitEquipment(ordinaryState, 'unit-1'));
    expect(JSON.stringify(ordinaryState)).toBe(ordinaryBefore);
    for (let i = 0; i < 10; i++) { readItemCatalog(); readUnitEquipment(state, 'unit-2'); previewEquip(state, 'item-24', 'unit-3', 0); }
    expect(JSON.stringify(state)).toBe(before);
  });
});
