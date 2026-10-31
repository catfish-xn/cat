import { isAttackProxy, occupiesCell } from './anomalies/availability';
import { getNeighbors, hexDistance, type Board, type HexCell } from './board';
import { g23Bound } from './combat-g2-3-summons';
import { active, range, type S13Unit } from './combat-s13-state';
import { g23Anomaly } from './g2-3-combat';
import { hasEffectiveStatus } from './m8/status';
import { uniformIndex } from './combat-targeting';

/** Sample existing control at the current tick, before movement/action planning. */
export function isControlled(unit: S13Unit, tick: number): boolean {
  return active(unit, tick, 'stun').length > 0
    || hasEffectiveStatus(unit.mechanismState?.statuses ?? [], 'stun', tick);
}

/** Units that never leave their cell: attack proxies, the Hextech Forge and a still-bound Sion. */
export function neverMoves(unit: S13Unit): boolean {
  return isAttackProxy(unit) || unit.definitionId === 'g23-forge' || unit.definitionId === 'training-dummy' || unit.definitionId === 'forming-dummy' || unit.definitionId === 'tower-dummy' || g23Bound(unit);
}

/** Shared eligibility for ordinary movement and trait dashes; cooldown/range are caller-specific. */
export function canMove(unit: S13Unit, tick: number): boolean {
  return unit.alive && unit.hp > 0 && !neverMoves(unit) && !(isControlled(unit, tick) && !unit.sixCost?.permanentFrenzy)
    && active(unit, tick, 'channel').length === 0 && !g23Anomaly(unit, 'deep-roots');
}

export interface MeleeApproachClaim { readonly targetId: string; readonly cell: HexCell }
export interface MeleeApproachPlan { readonly step?: HexCell; readonly claim?: MeleeApproachClaim }

const cellKey = (cell: HexCell): string => `${cell.col}:${cell.row}`;

function route(board: Board, from: HexCell, goal: HexCell, blocked: ReadonlySet<string>): { readonly length: number; readonly first: HexCell } | undefined {
  const seen = new Set([cellKey(from)]);
  const queue: { cell: HexCell; first?: HexCell; length: number }[] = [{ cell: from, length: 0 }];
  for (let i = 0; i < queue.length; i++) for (const cell of getNeighbors(board, queue[i].cell)) {
    const key = cellKey(cell);
    if (seen.has(key) || blocked.has(key)) continue;
    seen.add(key);
    const first = queue[i].first ?? cell;
    const length = queue[i].length + 1;
    if (cell.col === goal.col && cell.row === goal.row) return { length, first };
    queue.push({ cell, first, length });
  }
  return undefined;
}

/** A body that has stopped on the hex. A traveler on cooldown, or anyone leaving, is not settled. */
function standsStill(board: Board, body: S13Unit, units: readonly S13Unit[], tick: number, occupied: ReadonlySet<string>): boolean {
  if (neverMoves(body) || !canMove(body, tick)) return true;
  const quarry = units.find(other => other.id === body.targetId);
  if (!quarry || !quarry.alive || quarry.hp <= 0) return true;
  if (hexDistance(body.cell, quarry.cell) <= range(body)) return true;
  const paused = body.mechanics?.some(mechanic => mechanic.mechanic === 'quickstriker')
    ? body.moveCooldownTicks > 5 || (body.v20Traits?.moveTenths ?? 0) < 10
    : body.moveCooldownTicks > 0;
  if (paused) return false;
  return !getNeighbors(board, body.cell).some(cell => !occupied.has(cellKey(cell)));
}

/**
 * Range-1 approach. Attack hexes are the target's on-board neighbors.
 * A committed hex is kept unless a unit has settled on it, the target changed,
 * an earlier unit won that hex, or stationary bodies make it unreachable.
 * A body that is only passing through does not drop the claim and does not make
 * this unit step backward.
 * Fresh choices use the shortest unoccupied path. Equal lengths draw `draw` once
 * (neighbor order is only the index). Same-tick losers, in caller order, take the
 * next hex. When every attack hex is occupied the unit waits.
 */
export function planMeleeApproach(board: Board, unit: S13Unit, target: S13Unit, units: readonly S13Unit[], tick: number,
  occupied: ReadonlySet<string>, reservedSteps: ReadonlySet<string>, blockedGoals: ReadonlySet<string>, draw: () => number): MeleeApproachPlan {
  const hexes = getNeighbors(board, target.cell);
  const order = new Map(hexes.map((cell, index) => [cellKey(cell), index]));
  const occupant = (cell: HexCell) => units.find(other => other.id !== unit.id && occupiesCell(other, tick)
    && other.cell.col === cell.col && other.cell.row === cell.row);
  const same = (a: HexCell, b: HexCell) => a.col === b.col && a.row === b.row;
  const held = unit.meleeApproach?.targetId === target.id
    ? hexes.find(cell => same(cell, unit.meleeApproach!.cell)) : undefined;
  const heldBody = held ? occupant(held) : undefined;
  let heldValid = !!held && !blockedGoals.has(cellKey(held)) && !(heldBody && standsStill(board, heldBody, units, tick, occupied));
  if (heldValid) {
    // Travelers can temporarily block the route without invalidating the claim.
    // Only bodies that have stopped can make the held attack hex unreachable.
    const walls = new Set(units.filter(body => body.id !== unit.id && occupiesCell(body, tick)
      && occupied.has(cellKey(body.cell)) && !same(body.cell, held!)
      && standsStill(board, body, units, tick, occupied)).map(body => cellKey(body.cell)));
    if (!route(board, unit.cell, held!, walls)) heldValid = false;
  }
  const ranked = hexes
    .filter(cell => !occupant(cell) && !blockedGoals.has(cellKey(cell)))
    .flatMap(cell => {
      const path = route(board, unit.cell, cell, occupied);
      return path ? [{ cell, path }] : [];
    })
    .sort((a, b) => a.path.length - b.path.length || order.get(cellKey(a.cell))! - order.get(cellKey(b.cell))!);
  const claim = (cell: HexCell): MeleeApproachClaim => ({ targetId: target.id, cell: { col: cell.col, row: cell.row } });
  if (hexes.length > 0 && hexes.every(cell => occupant(cell))) return heldValid ? { claim: claim(held!) } : {};
  const stepFree = (cell: HexCell) => !reservedSteps.has(cellKey(cell)) && !occupied.has(cellKey(cell));
  if (heldValid) {
    const path = route(board, unit.cell, held!, occupied);
    const goalContested = !!path && same(path.first, held!) && reservedSteps.has(cellKey(path.first));
    if (!goalContested) return path && stepFree(path.first) ? { step: path.first, claim: claim(held!) } : { claim: claim(held!) };
  }
  const pool = ranked.filter(entry => !held || !heldValid || !same(entry.cell, held));
  if (!pool.length) return {};
  const best = pool[0].path.length;
  const tied = pool.filter(entry => entry.path.length === best);
  const start = tied.length > 1 ? uniformIndex(draw, tied.length) : 0;
  const ordered = [...tied.slice(start), ...tied.slice(0, start), ...pool.filter(entry => entry.path.length !== best)];
  for (const entry of ordered) if (stepFree(entry.path.first)) return { step: entry.path.first, claim: claim(entry.cell) };
  return { claim: claim(ordered[0].cell) };
}
