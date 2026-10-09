import { ITEM_DEFINITIONS } from './content/items';
import type { EquipPreview } from './m8/ui-contracts';
import type { ItemInstance } from './strategy-types';

/** Development rule revision; included in the content digest, not a save-format switch. */
export const EQUIPMENT_RULES_VERSION = 'm8-b5-instances-v1';

/** Shared by equip, upgrade transfer and restore; callers validate identity/location first. */
export function checkEquipmentPlacement(
  items: readonly ItemInstance[], item: ItemInstance, unitId: string, slot: number,
): EquipPreview {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) {
    return { allowed: false, reason: 'invalid-slot', conflictingItemIds: [] };
  }
  const definition = ITEM_DEFINITIONS[item.definitionId];
  if (!definition) throw new RangeError('Unknown item definition');
  const held = items.filter(other => other.id !== item.id && other.location.kind === 'unit' && other.location.unitId === unitId);
  const duplicates = held.filter(other => {
    const otherDefinition = ITEM_DEFINITIONS[other.definitionId];
    return (definition.unique || otherDefinition.unique)
      && (definition.apiName ?? definition.id) === (otherDefinition.apiName ?? otherDefinition.id);
  });
  if (duplicates.length) return { allowed: false, reason: 'unique-conflict', conflictingItemIds: duplicates.map(i => i.id).sort() };
  const exclusive = held.filter(other => definition.slotCost === 3 || ITEM_DEFINITIONS[other.definitionId].slotCost === 3);
  if (exclusive.length) return { allowed: false, reason: 'exclusive-slots', conflictingItemIds: exclusive.map(i => i.id).sort() };
  const occupied = held.filter(other => other.location.kind === 'unit' && other.location.slot === slot);
  if (occupied.length) return { allowed: false, reason: 'item-slot-occupied', conflictingItemIds: occupied.map(i => i.id).sort() };
  return { allowed: true, reason: null, occupiedSlots: definition.slotCost === 3 ? [0, 1, 2] : [slot as 0 | 1 | 2], conflictingItemIds: [] };
}
