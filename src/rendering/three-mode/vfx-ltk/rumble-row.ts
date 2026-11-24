import type { HexCell, HexGrid } from '../../../rendering3d/picking';

/** Rumble's cast drops this many missiles on his target's row (his ability's NumMissile at every star). */
export const RUMBLE_STRIKES = 5;

/** The hex a world point (x, z) stands in, the inverse of picking.ts hexCenter (odd rows shifted half a cell right). */
export function cellAt(x: number, z: number, grid: HexGrid): HexCell {
  const radius = grid.radius ?? 36, origin = grid.origin ?? { x: 242, y: 146 };
  const row = Math.round((z - origin.y) / (radius * 1.5));
  const col = Math.round((x - origin.x) / (Math.sqrt(3) * radius) - (((row % 2) + 2) % 2) / 2);
  return { col: col || 0, row: row || 0 };
}

/**
 * Where Rumble's explosions show (display only, fitted, not original data): one for every damage packet his cast dealt, at
 * the struck unit's cell (a unit struck several times, as a lone enemy takes every missile, gets one each), then the cells
 * of his primary target's row nearest that target that no packet struck, until `total` (his missiles that hit no one fall
 * on the row too, as his ability text says), within the board's columns. Packets are kept in the order they came.
 */
export function rowStrikeCells(hits: readonly HexCell[], primary: HexCell, columns: number, total = RUMBLE_STRIKES): HexCell[] {
  const out = hits.slice(0, total), struck = (cell: HexCell) => out.some(c => c.col === cell.col && c.row === cell.row);
  const spare = Array.from({ length: columns }, (_, col) => ({ col, row: primary.row }))
    .sort((a, b) => Math.abs(a.col - primary.col) - Math.abs(b.col - primary.col) || a.col - b.col);
  for (const cell of spare) if (out.length < total && !struck(cell)) out.push(cell);
  return out;
}
