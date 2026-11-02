import { describe, expect, it } from 'vitest';
import { equipItem, restoreMatch, serializeMatch, type MatchState } from '../src/server-entry';
import { previewEquip } from '../src/simulation/item-selectors';
import { allowedPreviewText } from '../src/presentation/equipment-feedback';
import { accepted, bench, hero, prepared } from './t10-helpers';

const stock = (id: string, definitionId: string) => ({ id, definitionId, location: { kind: 'inventory' as const } });
const held = (id: string, definitionId: string, unitId = 'unit-1', slot = 0) =>
  ({ id, definitionId, location: { kind: 'unit' as const, unitId, slot } });
const FAMILY_EMBLEM = 'TFT13_Item_FamilyEmblemItem';
const withFamily = (state: MatchState): MatchState => ({ ...state,
  preparation: { ...state.preparation, units: [...state.preparation.units, hero('unit-9', bench(5), 'powder')] } });

// 14.24: crafting on a unit is never refused because the finished item cannot stay there.
describe('crafting on a unit returns what the finished item cannot keep', () => {
  it('an own-trait emblem is crafted and returns to the inventory', () => {
    const base = withFamily(prepared());
    const state = { ...base, nextItemSerial: 5, items: [stock('item-1', 'spatula'), held('item-2', 'tear', 'unit-9', 1), held('item-3', 'deathblade', 'unit-9', 0)] };
    const preview = previewEquip(state, 'item-1', 'unit-9', 1);
    expect(preview).toEqual({ allowed: true, reason: null, occupiedSlots: [], conflictingItemIds: [],
      combination: { resultDefinitionId: FAMILY_EMBLEM, consumedItemIds: ['item-1', 'item-2'], resultReturned: true } });
    if (preview.allowed) expect(allowedPreviewText(preview, 1, id => id)).toBe(`将合成 ${FAMILY_EMBLEM} · 弹回装备栏`);
    const result = equipItem(state, 'item-1', 'unit-9', 1);
    const next = accepted(result);
    expect(next.items).toEqual([held('item-3', 'deathblade', 'unit-9', 0), stock('item-5', FAMILY_EMBLEM)]);
    expect(result.ok && result.events.some(e => e.type === 'itemEquipped')).toBe(false);
    // A finished emblem still cannot be put on directly.
    expect(previewEquip(next, 'item-5', 'unit-9', 1)).toMatchObject({ allowed: false, reason: 'item-restricted' });
  });
  it('the same emblem on a unit without the trait is worn as before', () => {
    const state = { ...prepared(), nextItemSerial: 5, items: [stock('item-1', 'spatula'), held('item-2', 'tear')] };
    expect(accepted(equipItem(state, 'item-1', 'unit-1', 0)).items).toEqual([held('item-5', FAMILY_EMBLEM)]);
  });
  it.each([0, 1, 2])("Thief's Gloves crafted beside a finished item in slot %s returns every other worn item", other => {
    const glove = other === 0 ? 1 : 0, third = [0, 1, 2].find(s => s !== other && s !== glove)!;
    const state = { ...prepared(), nextItemSerial: 6, items: [stock('item-1', 'gloves'), held('item-2', 'gloves', 'unit-1', glove),
      held('item-3', 'deathblade', 'unit-1', other), held('item-4', 'sword', 'unit-1', third)] };
    expect(previewEquip(state, 'item-1', 'unit-1', other)).toEqual({ allowed: true, reason: null, occupiedSlots: [0, 1, 2], conflictingItemIds: [],
      combination: { resultDefinitionId: 'thiefs-gloves', consumedItemIds: ['item-1', 'item-2'], returnedItemIds: ['item-3', 'item-4'] } });
    const result = equipItem(state, 'item-1', 'unit-1', other);
    const next = accepted(result);
    expect(next.items.filter(i => i.location.kind === 'unit' && i.location.unitId === 'unit-1'))
      .toEqual([held('item-6', 'thiefs-gloves', 'unit-1', 0)]);
    expect(next.items.filter(i => i.location.kind === 'inventory').map(i => i.id).sort()).toEqual(['item-3', 'item-4']);
    expect(result.ok && result.events.find(e => e.type === 'itemsReturned')).toMatchObject({ type: 'itemsReturned', itemIds: ['item-3', 'item-4'], unitId: 'unit-1' });
  });
});
