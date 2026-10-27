/** Combat-side readers of augment-history evidence. No second mutable counter:
 * openingDeaths is the replay-authenticated prefix; live samples are the same
 * death objects that recordAugmentTransition / the room publish into v1. */
import type { CombatState, CombatUnit } from './combat-types';
import { isAugmentOrdinaryHero } from './augment-death-samples';
import { historyRoster } from './augment-history';
export { isAugmentOrdinaryHero, readAugmentFirstHeroDeaths } from './augment-death-samples';
/** Permanent opening equipment, before this tick's temporary grants or movement. */
export function readAugmentCombatEquipment(state: CombatState) {
  return state.units.filter(isAugmentOrdinaryHero).map(u => ({ id: u.id, team: u.team,
    cell: { ...(u.startingCell ?? u.cell) }, equipment: structuredClone((u.equipment ?? []).filter(i => !i.temporary)) }));
}

/** Freeze item identities/slots before Scrap conversions and opening effects.
 * Existing CombatUnit.equipment was previously filled only by battle-time equips;
 * H11 needs the opening slots too. Conditional strategy evidence preserves every
 * non-holder's previous snapshot bytes. */
export function compileH11HistoryEquipment(state: Pick<import('./combat-input').CombatStrategyInputs, 'preparation' | 'augments' | 'items' | 'temporaryEquipment'>,
  unit: import('./unit-types').Unit, enemyItems: readonly import('./round-enemies').EnemyItem[]): CombatUnit['equipment'] {
  if (!state.augments.some(a => a.definitionId === 'scavenger' || a.definitionId === 'sponging')) return undefined;
  return unit.team === 'player' ? [
    ...historyRoster(state).items.flatMap(i => i.location.kind === 'unit' && i.location.unitId === unit.id ? [{ definitionId: i.definitionId, slot: i.location.slot, temporary: false }] : []),
    ...state.temporaryEquipment.filter(i => i.holderId === unit.id).map(i => ({ definitionId: i.definitionId, slot: i.slot, temporary: true })),
  ].sort((a, b) => a.slot - b.slot) : enemyItems.filter(i => i.unitId === unit.id).map(i => ({ definitionId: i.definitionId, slot: i.slot, temporary: false }));
}
