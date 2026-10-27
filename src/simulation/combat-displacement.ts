import { recordAerialMovement } from './augment-pool-batch5-g3-combat';
import { occupiesCell } from './anomalies/availability';
import { canDisplace } from './anomalies/shared';
import { neverMoves } from './combat-movement';
import { contains, getNeighbors, hexDistance, sameCell, type HexCell } from './board';
import type { AbilityContext } from './combat-s13-abilities';
import type { S13Unit } from './combat-s13-state';

/**
 * Forced displacement from enemy skills (pull / grab / knockback). Instant, same tick, no RNG.
 * Every move is an ordinary `movement` event with a reason, so ledger, replay and both PvP seats see it.
 */
export type DisplacementReason = 'mordekaiser-pull' | 'sett-grab' | 'sevika-knockback';

/** 14.24b map22 `HexToRangeMap` (raw units → hexes); see docs/evidence/five-cost-3star/source-excerpts.md. */
const HEX_TO_RANGE = [180, 420, 610, 890, 1130, 1370, 1610, 1850, 2090, 2330] as const;
/** Largest hex count whose mapped range does not exceed the raw distance (0 below one hex). */
export function rawRangeToHexes(raw: number): number {
  return HEX_TO_RANGE.filter(range => range <= raw).length;
}

/** P (docs/S13_RULES_GAP.md 位移类控制): parameters awaiting research C3; change values here, not the walkers. */
export const DISPLACEMENT_POLICY = Object.freeze({
  /** Mordekaiser `Displacement` 240 → 1 hex toward him; only the nearest enemies that the claw line hits. */
  mordekaiser: Object.freeze({ onlyLineHits: true }),
  /** Sett grabs the two nearest enemies onto free cells next to himself; the second lands beside the first when possible. */
  sett: Object.freeze({ targets: 2, secondBesideFirst: true }),
  /** Sevika Extendo-Punch `Spell2_HexKnockback` hexes straight away from her; always stops before a unit or the board edge. */
});

const key = (cell: HexCell): string => `${cell.col}:${cell.row}`;
const cellOrder = (a: HexCell, b: HexCell): number => a.row - b.row || a.col - b.col;
function blocked(ctx: AbilityContext, unit: S13Unit): Set<string> {
  return new Set([...ctx.movementReservations ?? [], ...ctx.units
    .filter(other => other.id !== unit.id && occupiesCell(other, ctx.tick)).map(other => key(other.cell))]);
}
function displace(ctx: AbilityContext, unit: S13Unit, to: HexCell, reason: DisplacementReason): void {
  if (sameCell(unit.cell, to)) return;
  ctx.events.push({ type: 'movement', tick: ctx.tick, unitId: unit.id, from: { ...unit.cell }, to: { ...to }, reason }); recordAerialMovement(ctx, unit, to);
  unit.cell = { ...to };
  (ctx.movementReservations ??= new Set()).add(key(to));
}
/** P: the barrel is a fixed object for displacement only; ordinary movement rules are unchanged. */
const movable = (ctx: AbilityContext, unit: S13Unit): boolean => unit.alive && unit.hp > 0 && !neverMoves(unit) && unit.definitionId !== 'g23-barrel' && canDisplace(unit, ctx.tick);

/** Step each target up to `hexes` cells closer to the puller, nearest target first; a blocked step ends that pull. */
export function pullToward(ctx: AbilityContext, puller: S13Unit, targets: readonly S13Unit[], hexes: number, reason: DisplacementReason): void {
  for (const target of targets) {
    if (!movable(ctx, target)) continue;
    let landing = target.cell;
    for (let step = 0; step < hexes && hexDistance(puller.cell, landing) > 1; step++) {
      const taken = blocked(ctx, target), from = landing;
      const next = getNeighbors(ctx.board, from).filter(c => hexDistance(puller.cell, c) === hexDistance(puller.cell, from) - 1 && !taken.has(key(c))).sort(cellOrder)[0];
      if (!next) break;
      landing = next;
    }
    displace(ctx, target, landing, reason);
  }
}

/** Grab targets onto free cells adjacent to the grabber; already-adjacent targets stay. */
export function grabAdjacent(ctx: AbilityContext, grabber: S13Unit, targets: readonly S13Unit[], reason: DisplacementReason): void {
  let first: HexCell | undefined;
  for (const target of targets) {
    if (movable(ctx, target) && hexDistance(grabber.cell, target.cell) > 1) {
      const taken = blocked(ctx, target);
      const ring = getNeighbors(ctx.board, grabber.cell).filter(c => !taken.has(key(c)));
      const beside = first && DISPLACEMENT_POLICY.sett.secondBesideFirst ? ring.filter(c => hexDistance(c, first!) === 1) : [];
      const landing = (beside.length ? beside : ring).sort((a, b) => hexDistance(target.cell, a) - hexDistance(target.cell, b) || cellOrder(a, b))[0];
      if (landing) displace(ctx, target, landing, reason);
    }
    first ??= target.cell;
  }
}

type Cube = { q: number; r: number; s: number };
const cube = (c: HexCell): Cube => { const q = c.col - Math.floor(c.row / 2); return { q, r: c.row, s: -q - c.row }; };
function roundCube(q: number, r: number, s: number): HexCell {
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s), dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return { col: rq + Math.floor(rr / 2), row: rr };
}

/** Push the target along the straight line from the source through it, one hex at a time. */
export function knockAway(ctx: AbilityContext, source: S13Unit, target: S13Unit, hexes: number, reason: DisplacementReason): void {
  if (!movable(ctx, target)) return;
  const a = cube(source.cell), b = cube(target.cell), n = hexDistance(source.cell, target.cell);
  if (n === 0) return;
  const taken = blocked(ctx, target);
  let landing = target.cell;
  for (let k = 1; k <= hexes; k++) {
    // Fixed nudge keeps exact half-way rounding deterministic and orientation-independent of iteration order.
    const t = (n + k) / n, next = roundCube(a.q + (b.q - a.q) * t + 1e-6, a.r + (b.r - a.r) * t + 2e-6, a.s + (b.s - a.s) * t - 3e-6);
    if (!contains(ctx.board, next) || hexDistance(landing, next) !== 1 || taken.has(key(next))) break;
    landing = next;
  }
  displace(ctx, target, landing, reason);
}
