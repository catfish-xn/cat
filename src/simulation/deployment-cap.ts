import { G23_SPECIAL_ITEM_SOURCE } from './content/g2-3-special-item-source';
import type { ItemInstance } from './strategy-types';
import type { Unit } from './unit-types';
export const TACTICIANS_CROWN_ID = 'TFT_Item_ForceOfNature';
const CROWN_TEAM_SIZE = G23_SPECIAL_ITEM_SOURCE.TFT_Item_ForceOfNature.values.MaxArmySizeIncrease;
/** Source: +MaxArmySizeIncrease per crown. 约定值 (user 2026-10-17): a crown held by a bench unit counts too; inventory crowns do not. */
export function crownTeamSizeBonus(units: readonly Unit[], items: readonly ItemInstance[]): number {
  const players = new Set(units.filter(unit => unit.team === 'player').map(unit => unit.id));
  return items.filter(item => item.definitionId === TACTICIANS_CROWN_ID && item.location.kind === 'unit' && players.has(item.location.unitId)).length * CROWN_TEAM_SIZE;
}
export function deploymentCapFor(level: number, units: readonly Unit[], items: readonly ItemInstance[]): number {
  return level + crownTeamSizeBonus(units, items);
}
