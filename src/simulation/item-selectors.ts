import { ITEM_DEFINITIONS } from './content/items';
import { validateCombine, validateEquip } from './inventory';
import type { MatchState } from './match-types';
import type { CombinePreview, EquipPreview, UnitEquipmentView } from './m8/ui-contracts';
import { getRoundEnemyItems } from './round-enemies';
import type { ItemInstance } from './strategy-types';

export { readItemCatalog } from './item-catalog';

/** These are the public command validators; a preview never allocates an instance. */
export function previewCombine(state: Readonly<MatchState>, aId: string, bId: string): CombinePreview {
  if (state.phase !== 'preparation') return { allowed: false, reason: 'wrong-phase' };
  return validateCombine(state.items, aId, bId);
}

export function previewEquip(state: Readonly<MatchState>, itemId: string, unitId: string, slot: number): EquipPreview {
  if (state.phase !== 'preparation') return { allowed: false, reason: 'wrong-phase', conflictingItemIds: [] };
  return validateEquip(state.items, state.preparation, itemId, unitId, slot);
}

/** Detached projection in every phase; reading never repairs or generates equipment. */
export function readUnitEquipment(state: Readonly<MatchState>, unitId: string): UnitEquipmentView | null {
  const unit = state.preparation.units.find(unit => unit.id === unitId);
  if (!unit) return null;
  const items: readonly ItemInstance[] = unit.team === 'player' ? state.items : getRoundEnemyItems(state.round).map(item => ({
    id: `enemy:${state.round}:${item.unitId}:${item.slot}`, definitionId: item.definitionId,
    location: { kind: 'unit', unitId: item.unitId, slot: item.slot },
  }));
  const held = items.filter(item => item.location.kind === 'unit' && item.location.unitId === unitId);
  const exclusive = held.find(item => ITEM_DEFINITIONS[item.definitionId].slotCost === 3);
  return {
    unitId,
    slots: ([0, 1, 2] as const).map(slot => ({
      slot,
      itemInstanceId: held.find(item => item.location.kind === 'unit' && item.location.slot === slot)?.id ?? null,
      reservedByItemInstanceId: exclusive && slot !== 0 ? exclusive.id : null,
    })),
    temporaryItems: [],
  };
}
