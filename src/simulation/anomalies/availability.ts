import type { CombatUnit } from '../combat-types';
import { effectiveStatuses } from '../m8/status';
export const isAttackProxy = (unit: Pick<CombatUnit, 'anomalySummon'|'definitionId'>): boolean =>
  unit.definitionId==='v20-silco-minion' || unit.anomalySummon?.kind === 'wolf' || unit.anomalySummon?.kind === 'mini';

/** Presence gates all action/area processing; invisibility only gates selection.
 * An absent living roster unit still prevents elimination. */
export function isPresent(unit: CombatUnit, tick: number): boolean {
  return unit.alive && unit.hp > 0 && !isAbsent(unit, tick);
}
/** Preserve legacy alive-based reservations, including pending revives and absences.
 * Attack agents share their owner's cell and never reserve a landing cell. */
export function occupiesCell(unit: CombatUnit, _tick: number): boolean {
  return unit.alive && !isAttackProxy(unit);
}
export function isAbsent(unit: CombatUnit, tick: number): boolean {
  return (unit.itemBanish?.untilTick ?? 0) > tick || (unit.anomalyState?.absentUntilTick ?? 0) > tick || (unit.g23Sion?.reviveAtTick ?? 0) > tick;
}
export function isSelectable(unit: CombatUnit, tick: number): boolean {
  return isPresent(unit, tick) && !isAttackProxy(unit)
    && (unit.anomalyState?.invisibleUntilTick ?? 0) <= tick
    && !effectiveStatuses(unit.mechanismState?.statuses ?? [], tick).some(g => g.kind === 'untargetable');
}
