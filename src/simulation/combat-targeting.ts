import { isSelectable } from './anomalies/availability';
import { getNeighbors, hexDistance, type Board, type HexCell } from './board';
import { range, type S13Unit } from './combat-s13-state';
import { p2Target } from './s13-augments-p2-combat';
import { canMove } from './combat-movement';

export const combatCellKey = (cell: HexCell): string => `${cell.col}:${cell.row}`;
export interface CombatTargetDecision { readonly target: S13Unit | undefined; readonly engaged: boolean }

/** Ordinary movement's existing neighbour order; bodies at the barrier remain obstacles.
 * Reservations/cooldowns do not participate in this feasibility query. Losing a
 * reservation still waits, without inventing a second route or a new target. */
export function chaseStep(board: Board, unit: S13Unit, target: S13Unit, occupied: ReadonlySet<string>): HexCell | undefined {
  const attackRange = range(unit);
  return getNeighbors(board, unit.cell).find(cell => !occupied.has(combatCellKey(cell)) && hexDistance(cell, target.cell) <= attackRange);
}

/** S13 P0 only: retain in-range targets and chase an engaged target by one legal
 * step before falling back to the existing nearest/dictionary-ID selector.
 * Initial approach still uses the old selector/BFS. Explicit overrides retain
 * their existing priority, including Cull's own between-pulse retention. */
export function decideCombatTarget(board: Board, unit: S13Unit, units: readonly S13Unit[], tick: number,
  occupied: ReadonlySet<string>, reselect: boolean, previous?: CombatTargetDecision): CombatTargetDecision {
  const currentId = previous ? previous.target?.id : unit.targetId;
  const current = units.find(candidate => candidate.id === currentId);
  const wasEngaged = previous ? previous.engaged : unit.targetEngaged === true;
  let retained = false;
  const target = p2Target(unit, units, tick, nearest => {
    if (!reselect && current && current.team !== unit.team && isSelectable(current, tick)
      && (hexDistance(unit.cell, current.cell) <= range(unit) || wasEngaged && canMove(unit, tick) && chaseStep(board, unit, current, occupied))) {
      retained = true;
      return current;
    }
    return nearest;
  });
  return { target, engaged: !!target && (hexDistance(unit.cell, target.cell) <= range(unit) || retained && wasEngaged) };
}
