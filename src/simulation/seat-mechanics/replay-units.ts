import type { CombatViewEvent, CombatViewUnit } from '../combat-replay-view';

/**
 * Replay state events for mid-combat membership (MATCH_CONTRACT「G2-3 机制通用接口」). unitEntered carries the complete unit view, so a
 * client never waits for the next keyframe; unitLeft removes it. Both come from the per-tick view diff, not from the
 * ledger, so they cannot be forgotten by a mechanic; the ledger's unitSpawned/unitRemoved are the animation facts.
 */
export type ReplayMembershipEvent =
  | { readonly type: 'unitEntered'; readonly unit: CombatViewUnit }
  | { readonly type: 'unitLeft'; readonly unitId: string };

/**
 * Aligns the previous tick's units to the current ones and appends unitLeft/unitEntered to `events`. Survivors must keep
 * their order and new units must come after them (spawnCombatUnit appends), so the reducer's order equals the state's.
 * Returns, per current unit, its previous view or undefined when it just entered.
 */
export function alignReplayUnits(previous: readonly CombatViewUnit[], current: readonly CombatViewUnit[], events: CombatViewEvent[]): readonly (CombatViewUnit | undefined)[] {
  const currentIds = new Set(current.map(unit => unit.id)), byId = new Map(previous.map(unit => [unit.id, unit]));
  const survivors = previous.filter(unit => currentIds.has(unit.id));
  if (current.length !== new Set(currentIds).size || survivors.some((unit, i) => current[i]?.id !== unit.id)
    || current.slice(survivors.length).some(unit => byId.has(unit.id))) throw new RangeError('replay-divergence');
  for (const unit of previous) if (!currentIds.has(unit.id)) events.push({ type: 'unitLeft', unitId: unit.id });
  return current.map(unit => {
    const before = byId.get(unit.id);
    if (!before) events.push({ type: 'unitEntered', unit });
    return before;
  });
}

/** Display reducer step for one membership event; idempotent for a repeated frame. */
export function applyReplayMembership(units: CombatViewUnit[], event: ReplayMembershipEvent): CombatViewUnit[] {
  if (event.type === 'unitLeft') return units.filter(unit => unit.id !== event.unitId);
  return units.some(unit => unit.id === event.unit.id) ? units : [...units, event.unit];
}
