/**
 * Malzahar's 3-star cast on the board (presentation only; the rules' gate still strikes its target's row ±2, docs/S13_RULES_GAP.md):
 * ice-blue walls rise along both side edges, row after row from the bottom up, and blue swirls on the ground run
 * from the top corners in toward the middle, so the edges and the swirls read as an "M". Fable 11-17 kept it to a budget:
 * a wall on every other row (four a side) and five swirls, all of them one cast's fan-out (runtime OFF_SLOT_MAX).
 * Places and delays are fitted to the footage, not original data.
 */
import type { BoardSpot, WorldPoint } from './timeline';

/** When the bottom wall rises after the cast, and how much later each next wall up does (seconds, fitted). */
export const MALZAHAR_EDGE_TIMING = { wallFirst: 0.35, wallStep: 0.15, swirlFirst: 0.55, swirlStep: 0.1 } as const;
/** The swirls' cells as [row, column from the left edge] on a 7-wide board, top corners in to the middle (fitted). */
const SWIRL_CELLS: readonly (readonly [number, number])[] = [[1, 1], [3, 2], [1, 5], [3, 4], [5, 3]];

export interface EdgeGrid { readonly rows: number; readonly columns: number }
/**
 * The board spots of one 3-star cast: `wall` on both side columns of every other row from the bottom row up, `swirl` on
 * SWIRL_CELLS (columns scaled to the board's width). Rows count from the top (the far side); the bottom row is the
 * player's back row. `center` gives a cell's world point on the board.
 */
export function malzaharEdgeSpots(grid: EdgeGrid, center: (cell: { row: number; col: number }) => WorldPoint): BoardSpot[] {
  const { rows, columns } = grid, spots: BoardSpot[] = [];
  if (!(rows >= 2 && columns >= 3)) return spots;
  const t = MALZAHAR_EDGE_TIMING;
  for (let k = 0, row = rows - 1; row >= 0; k++, row -= 2) {
    const delay = t.wallFirst + k * t.wallStep;
    spots.push({ point: center({ row, col: 0 }), delay, group: 'wall' }, { point: center({ row, col: columns - 1 }), delay, group: 'wall' });
  }
  const scale = (columns - 1) / 6, bottom = Math.max(...SWIRL_CELLS.map(([row]) => row));
  for (const [row, col] of SWIRL_CELLS) {
    if (row >= rows) continue;
    spots.push({ point: center({ row, col: Math.round(col * scale) }), delay: t.swirlFirst + ((bottom - row) / 2) * t.swirlStep, group: 'swirl' });
  }
  return spots;
}
