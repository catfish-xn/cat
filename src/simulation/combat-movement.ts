import { isAttackProxy } from './anomalies/availability';
import { g23Bound } from './combat-g2-3-summons';
import { active, type S13Unit } from './combat-s13-state';
import { g23Anomaly } from './g2-3-combat';
import { effectiveStatuses } from './m8/status';

/** Sample existing control at the current tick, before movement/action planning. */
export function isControlled(unit: S13Unit, tick: number): boolean {
  return active(unit, tick, 'stun').length > 0
    || effectiveStatuses(unit.mechanismState?.statuses ?? [], tick).some(g => g.kind === 'stun');
}

/** Shared eligibility for ordinary movement and trait dashes; cooldown/range are caller-specific. */
export function canMove(unit: S13Unit, tick: number): boolean {
  return unit.alive && unit.hp > 0 && !isAttackProxy(unit) && unit.definitionId !== 'g23-forge' && unit.definitionId !== 'training-dummy'
    && !g23Bound(unit) && !(isControlled(unit, tick) && !unit.sixCost?.permanentFrenzy)
    && active(unit, tick, 'channel').length === 0 && !g23Anomaly(unit, 'deep-roots');
}
