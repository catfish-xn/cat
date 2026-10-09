import { ITEM_DEFINITIONS } from './content/items';
import { checkEquipmentPlacement } from './equipment-policy';
import type { GameState } from './game';
import type { MatchFailure } from './match-types';
import type { ItemInstance, StrategyEvent } from './strategy-types';

export type CombinePlanResult = {
  readonly ok: true;
  readonly items: readonly ItemInstance[];
  readonly nextItemSerial: number;
  readonly events: readonly StrategyEvent[];
} | { readonly ok: false; readonly reason: 'unknown-item' | 'same-item' | 'invalid-recipe' | 'item-not-inventory' };

export type EquipPlanResult = {
  readonly ok: true;
  readonly items: readonly ItemInstance[];
  readonly events: readonly StrategyEvent[];
} | { readonly ok: false; readonly reason: MatchFailure };

const compareIds = (a: ItemInstance, b: ItemInstance) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Only inventory components combine. Match commits this complete plan once. */
export function planCombine(
  items: readonly ItemInstance[], nextItemSerial: number, aId: string, bId: string,
): CombinePlanResult {
  const a = items.find(item => item.id === aId), b = items.find(item => item.id === bId);
  if (!a || !b) return { ok: false, reason: 'unknown-item' };
  if (aId === bId) return { ok: false, reason: 'same-item' };
  if (a.location.kind !== 'inventory' || b.location.kind !== 'inventory') {
    return { ok: false, reason: 'item-not-inventory' };
  }
  const aDefinition = ITEM_DEFINITIONS[a.definitionId], bDefinition = ITEM_DEFINITIONS[b.definitionId];
  if (!aDefinition || !bDefinition) throw new RangeError('Unknown item definition');
  if (aDefinition.kind !== 'component' || bDefinition.kind !== 'component') return { ok: false, reason: 'invalid-recipe' };
  const result = Object.values(ITEM_DEFINITIONS).find(definition => definition.kind === 'completed' && definition.recipe && (
    definition.recipe[0] === a.definitionId && definition.recipe[1] === b.definitionId
    || definition.recipe[0] === b.definitionId && definition.recipe[1] === a.definitionId
  ));
  if (!result) return { ok: false, reason: 'invalid-recipe' };
  if (!Number.isSafeInteger(nextItemSerial) || nextItemSerial < 1 || nextItemSerial === Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Invalid next item serial');
  }
  const itemId = `item-${nextItemSerial}`;
  if (items.some(item => item.id === itemId)) throw new Error(`Duplicate item ID: ${itemId}`);
  const created: ItemInstance = { id: itemId, definitionId: result.id, location: { kind: 'inventory' } };
  return {
    ok: true,
    items: [...items.filter(item => item.id !== aId && item.id !== bId), created].sort(compareIds),
    nextItemSerial: nextItemSerial + 1,
    events: [{ type: 'itemCombined', consumedIds: [aId, bId].sort(), itemId, definitionId: result.id }],
  };
}

/** Phase and command-shape guards belong to Match; no replacement or unequip is implicit. */
export function planEquip(
  items: readonly ItemInstance[], preparation: GameState, itemId: string, unitId: string, slot: number,
): EquipPlanResult {
  const item = items.find(candidate => candidate.id === itemId);
  if (!item) return { ok: false, reason: 'unknown-item' };
  const unit = preparation.units.find(candidate => candidate.id === unitId);
  if (!unit || unit.team !== 'player') return { ok: false, reason: 'unknown-unit' };
  if (item.location.kind !== 'inventory') return { ok: false, reason: 'item-not-inventory' };
  const placement = checkEquipmentPlacement(items, item, unitId, slot);
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
