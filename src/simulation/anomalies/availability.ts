import type { CombatUnit } from '../combat-types';
import { effectiveStatuses } from '../m8/status';

/** Presence gates all action/area processing; invisibility only gates selection.
 * An absent living roster unit still prevents elimination. */
export function isPresent(unit: CombatUnit, tick: number): boolean {
  return unit.alive && unit.hp > 0 && !isAbsent(unit, tick);
}
export function isAbsent(unit: CombatUnit, tick: number): boolean {
  return (unit.itemBanish?.untilTick ?? 0) > tick || (unit.anomalyState?.absentUntilTick ?? 0) > tick;
}
export function isSelectable(unit: CombatUnit, tick: number): boolean {
  return isPresent(unit, tick) && !['wolf', 'mini'].includes(unit.anomalySummon?.kind ?? '')
    && (unit.anomalyState?.invisibleUntilTick ?? 0) <= tick
    && !effectiveStatuses(unit.mechanismState?.statuses ?? [], tick).some(g => g.kind === 'untargetable');
}
