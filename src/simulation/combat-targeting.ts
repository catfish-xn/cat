import { isSelectable } from './anomalies/availability';
import { getNeighbors, hexDistance, type Board, type HexCell } from './board';
import { range, type S13Unit } from './combat-s13-state';
import { p2Target } from './s13-augments-p2-combat';
import { canMove } from './combat-movement';

export const combatCellKey = (cell: HexCell): string => `${cell.col}:${cell.row}`;
export interface CombatTargetDecision { readonly target: S13Unit | undefined; readonly engaged: boolean }

/** Selectable enemies at the minimum hex distance, code-point ID order.
 * Sorting is only the candidate index; it is not the tie winner. */
export function ordinaryNearestTies(unit: S13Unit, units: readonly S13Unit[], tick: number): S13Unit[] {
  let distance = Infinity;
  const tied: S13Unit[] = [];
  for (const candidate of units) {
    if (candidate.team === unit.team || !isSelectable(candidate, tick)) continue;
    const next = hexDistance(unit.cell, candidate.cell);
    if (next < distance) { distance = next; tied.length = 0; tied.push(candidate); }
    else if (next === distance) tied.push(candidate);
  }
  if (tied.length > 1) tied.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return tied;
}

/** Uniform index on the combat lcg32 stream. Rejected words count as draws.
 * Size 2 never rejects because it divides 2^32. */
function uniformIndex(draw: () => number, size: number): number {
  if (!Number.isInteger(size) || size < 2 || size > 0x100000000) throw new RangeError('Invalid targeting tie');
  const limit = Math.floor(0x100000000 / size) * size;
  for (;;) {
    const word = draw() >>> 0;
    if (word < limit) return word % size;
  }
}

/** One draw only when the current target is absent from a real tie.
 * No draw callback keeps the lowest ID, for direct selector calls. */
function resolveDistanceTie(tied: readonly S13Unit[], draw: (() => number) | undefined, preferId: string | null | undefined): S13Unit | undefined {
  if (tied.length === 0) return undefined;
  if (!draw || tied.length === 1) return tied[0];
  if (preferId) {
    const preferred = tied.find(candidate => candidate.id === preferId);
    if (preferred) return preferred;
  }
  return tied[uniformIndex(draw, tied.length)];
}

/** Ordinary movement's existing neighbour order; bodies at the barrier remain obstacles.
 * Reservations/cooldowns do not participate in this feasibility query. Losing a
 * reservation still waits, without inventing a second route or a new target. */
export function chaseStep(board: Board, unit: S13Unit, target: S13Unit, occupied: ReadonlySet<string>): HexCell | undefined {
  const attackRange = range(unit);
  return getNeighbors(board, unit.cell).find(cell => !occupied.has(combatCellKey(cell)) && hexDistance(cell, target.cell) <= attackRange);
}

/** S13 ordinary target: retain an in-range target, chase an engaged target one
 * legal step, otherwise take the nearest enemy. Equal distance uses the combat
 * lcg32 stream once, unless the current target is already in that tie.
 * Hard control freezes the ordinary target; taunt, Betrayal and Cull still run.
 * The release tick passes hardControlled false and uses this same retention. */
export function decideCombatTarget(board: Board, unit: S13Unit, units: readonly S13Unit[], tick: number,
  occupied: ReadonlySet<string>, reselect: boolean, previous?: CombatTargetDecision,
  hardControlled = false, draw?: () => number): CombatTargetDecision {
  const currentId = previous ? previous.target?.id : unit.targetId;
  const current = units.find(candidate => candidate.id === currentId);
  const wasEngaged = previous ? previous.engaged : unit.targetEngaged === true;
  if (hardControlled) {
    const target = p2Target(unit, units, tick, () => current);
    const kept = !!target && target.id === current?.id;
    return { target, engaged: !!target && (hexDistance(unit.cell, target.cell) <= range(unit) || kept && wasEngaged) };
  }
  let retained = false, usedNearest = false;
  const selected = p2Target(unit, units, tick, nearest => {
    if (!reselect && current && current.team !== unit.team && isSelectable(current, tick)
      && (hexDistance(unit.cell, current.cell) <= range(unit) || wasEngaged && canMove(unit, tick) && chaseStep(board, unit, current, occupied))) {
      retained = true;
      return current;
    }
    usedNearest = true;
    return nearest;
  });
  const target = usedNearest ? resolveDistanceTie(ordinaryNearestTies(unit, units, tick), draw, currentId) : selected;
  return { target, engaged: !!target && (hexDistance(unit.cell, target.cell) <= range(unit) || retained && wasEngaged) };
}
