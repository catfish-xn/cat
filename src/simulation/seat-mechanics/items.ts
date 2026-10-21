import { ITEM_DEFINITIONS } from '../content/g2-3-item-registry';
import { UNIT_DEFINITIONS } from '../units';
import type { ItemRestriction } from './types';

/** ItemDefinition.restriction check, shared by equip validation and UI previews. No restriction: anyone may hold it. */
export function itemRestrictionAllows(restriction: ItemRestriction | undefined, unitDefinitionId: string): boolean {
  if (!restriction) return true;
  const native = UNIT_DEFINITIONS[unitDefinitionId]?.traits.includes(restriction.traitId) ?? false;
  return restriction.kind === 'exclude-trait' ? !native : restriction.kind === 'trait' && native;
}

/** Radiant item whose `radiantOf` is this completed item, or null. G2-3 adds the definitions; none exist before it. */
export function radiantVersionOf(completedId: string): string | null {
  return Object.values(ITEM_DEFINITIONS).find(definition => definition.kind === 'radiant' && definition.radiantOf === completedId)?.id ?? null;
}
export const isRadiantItem = (definitionId: string): boolean => ITEM_DEFINITIONS[definitionId]?.kind === 'radiant';
