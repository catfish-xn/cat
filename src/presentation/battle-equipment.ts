/** Client targeting and display only. Slots, recipes and stats remain domain decisions. */
import type { MatchState } from '../simulation/match-types';
import type { CombatViewState, CombatViewUnit } from './combat-display';
import type { GearExtras } from './equipment-feedback';

/** Resolve only a permanent owned piece; a PvP mapping is supplied by the stream, never parsed from IDs. */
export function equipmentTargetId(state: MatchState, combat: CombatViewState | null, id: string,
  unitIds: ReadonlyMap<string, string> = new Map(), readonly = false): string | undefined {
  if (readonly) return undefined;
  const original = unitIds.get(id) ?? id;
  const owned = state.preparation.units.find(unit => unit.id === original && unit.team === 'player');
  if (!owned) return undefined;
  if (!combat || combat.status === 'finished' || owned.location.kind === 'bench') return original;
  const instance = combat.units.find(unit => unit.id === id)
    ?? combat.units.find(unit => (unitIds.get(unit.id) ?? unit.id) === original);
  return instance?.team === 'player' ? original : undefined;
}

/** An explicit empty frame loadout clears icons too. Never read live inventory to predict a battle change. */
export function combatEquipmentDisplay(equipment: CombatViewUnit['equipment'], opening: readonly string[], extras: GearExtras) {
  if (equipment === undefined) return { equipped: opening, extras };
  const slots = [...equipment].sort((a, b) => a.slot - b.slot);
  return { equipped: slots.filter(item => !item.temporary).map(item => item.definitionId),
    extras: { reserved: 0, temporary: slots.filter(item => item.temporary).map(item => item.definitionId) } };
}

/** One badge per matching worn icon, in worn/temporary slot order; no client counter or cap inference. */
export function combatItemStackBadges(ids: readonly string[], stacks: CombatViewUnit['itemStacks']) {
  const remaining = [...stacks ?? []].sort((a, b) => Number(a.temporary === true) - Number(b.temporary === true) || (a.slot ?? 99) - (b.slot ?? 99));
  return ids.map(id => {
    const index = remaining.findIndex(row => row.definitionId === id);
    if (index < 0) return undefined;
    const row = remaining.splice(index, 1)[0];
    return { stacks: row.stacks, maxStacks: row.maxStacks };
  });
}
export function itemStackBadgeText(row: { readonly stacks: number; readonly maxStacks: number }): string {
  return `${row.stacks}${row.stacks >= row.maxStacks ? '满' : ''}`;
}
