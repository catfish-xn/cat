import { ITEM_DEFINITIONS } from './content/items';
import { checkEquipmentPlacement } from './equipment-policy';
import type { GameState } from './game';
import type { CombinePreview, EquipPreview, EquipmentFailure } from './m8/ui-contracts';
import type { ItemInstance, StrategyEvent } from './strategy-types';

export type CombinePlanResult = {
  readonly ok: true;
  readonly items: readonly ItemInstance[];
  readonly nextItemSerial: number;
  readonly events: readonly StrategyEvent[];
} | { readonly ok: false; readonly reason: EquipmentFailure };

export type EquipPlanResult = {
  readonly ok: true;
  readonly items: readonly ItemInstance[];
  readonly events: readonly StrategyEvent[];
} | { readonly ok: false; readonly reason: EquipmentFailure };

const compareIds = (a: ItemInstance, b: ItemInstance) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Validation only: no ID allocation, event construction or random draws. */
export function validateCombine(items: readonly ItemInstance[], aId: string, bId: string): CombinePreview {
  const a = items.find(item => item.id === aId), b = items.find(item => item.id === bId);
  if (!a || !b) return { allowed: false, reason: 'unknown-item' };
  if (aId === bId) return { allowed: false, reason: 'same-item' };
  if (a.location.kind !== 'inventory' || b.location.kind !== 'inventory') {
    return { allowed: false, reason: 'item-not-inventory' };
  }
  const aDefinition = ITEM_DEFINITIONS[a.definitionId], bDefinition = ITEM_DEFINITIONS[b.definitionId];
  if (!aDefinition || !bDefinition) throw new RangeError('Unknown item definition');
  if (aDefinition.kind !== 'component' || bDefinition.kind !== 'component') return { allowed: false, reason: 'invalid-recipe' };
  const result = Object.values(ITEM_DEFINITIONS).find(definition => definition.kind === 'completed' && definition.recipe && (
    definition.recipe[0] === a.definitionId && definition.recipe[1] === b.definitionId
    || definition.recipe[0] === b.definitionId && definition.recipe[1] === a.definitionId
  ));
  if (!result) return { allowed: false, reason: 'invalid-recipe' };
  return { allowed: true, reason: null, resultDefinitionId: result.id,
    consumedItemIds: aId < bId ? [aId, bId] : [bId, aId] };
}

/** Only inventory components combine. Match commits this complete plan once. */
export function planCombine(
  items: readonly ItemInstance[], nextItemSerial: number, aId: string, bId: string,
): CombinePlanResult {
  const preview = validateCombine(items, aId, bId);
  if (!preview.allowed) return { ok: false, reason: preview.reason };
  if (!Number.isSafeInteger(nextItemSerial) || nextItemSerial < 1 || nextItemSerial === Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Invalid next item serial');
  }
  const itemId = `item-${nextItemSerial}`;
  if (items.some(item => item.id === itemId)) throw new Error(`Duplicate item ID: ${itemId}`);
  const created: ItemInstance = { id: itemId, definitionId: preview.resultDefinitionId, location: { kind: 'inventory' } };
  return {
    ok: true,
    items: [...items.filter(item => item.id !== aId && item.id !== bId), created].sort(compareIds),
    nextItemSerial: nextItemSerial + 1,
    events: [{ type: 'itemCombined', consumedIds: preview.consumedItemIds, itemId, definitionId: preview.resultDefinitionId }],
  };
}

/** Identity checks precede placement; the public phase guard lives in item-selectors. */
export function validateEquip(
  items: readonly ItemInstance[], preparation: GameState, itemId: string, unitId: string, slot: number,
): EquipPreview {
  const item = items.find(candidate => candidate.id === itemId);
  if (!item) return { allowed: false, reason: 'unknown-item', conflictingItemIds: [] };
  const unit = preparation.units.find(candidate => candidate.id === unitId);
  if (!unit || unit.team !== 'player') return { allowed: false, reason: 'unknown-unit', conflictingItemIds: [] };
  if (item.location.kind !== 'inventory') return { allowed: false, reason: 'item-not-inventory', conflictingItemIds: [] };
  return checkEquipmentPlacement(items, item, unitId, slot);
}

/** No replacement or unequip is implicit. */
export function planEquip(
  items: readonly ItemInstance[], preparation: GameState, itemId: string, unitId: string, slot: number,
): EquipPlanResult {
  const placement = validateEquip(items, preparation, itemId, unitId, slot);
  if (!placement.allowed) return { ok: false, reason: placement.reason };
  // Three-slot parents always occupy slot 0; slots 1/2 are reserved for children.
  slot = placement.occupiedSlots[0];
  return {
    ok: true,
    items: items.map(candidate => candidate.id === itemId
      ? { ...candidate, location: { kind: 'unit' as const, unitId, slot } } : candidate).sort(compareIds),
    events: [{ type: 'itemEquipped', itemId, unitId, slot }],
  };
}

/** Inventory has no capacity limit, so a valid sale can always return every item. */
export function returnUnitItems(
  items: readonly ItemInstance[], unitId: string,
): { readonly items: readonly ItemInstance[]; readonly events: readonly StrategyEvent[] } {
  const itemIds = items.filter(item => item.location.kind === 'unit' && item.location.unitId === unitId)
    .map(item => item.id).sort();
  return {
    items: items.map(item => item.location.kind === 'unit' && item.location.unitId === unitId
      ? { ...item, location: { kind: 'inventory' as const } } : item).sort(compareIds),
    events: itemIds.length ? [{ type: 'itemsReturned', itemIds, unitId }] : [],
  };
}
