/**
 * Malzahar's 3-star cast on the board (presentation only; the rules' gate still strikes its target's row ±2, docs/S13_RULES_GAP.md):
 * ice-blue walls rise along both side edges in clusters, the bottom one first and each next one up a little later, and a
 * blue ring on the ground starts with each of the lower clusters, nearer the middle the lower it is, so the edges and
 * the rings read as an "M". Fable 11-17 kept it to a budget: five clusters and four rings a side, all of them one
 * cast's fan-out (runtime OFF_SLOT_MAX). Places and delays are fitted, not original data.
 */
import type { BoardSpot, WorldPoint } from './timeline';

/**
 * Seconds after the cast: when the bottom cluster rises and when the top one does (the rest evenly between, so the top
 * one is the last to end, about 1.8 s after the cast). Fitted, not original data.
 */
export const MALZAHAR_EDGE_TIMING = { first: 0.35, last: 1.05 } as const;
/** Clusters on each side edge, and rings on each side (on the lowest clusters' rows). Fable 11-17's budget. */
export const MALZAHAR_EDGE_COUNTS = { walls: 5, rings: 4 } as const;

export interface EdgeGrid { readonly rows: number; readonly columns: number }
/**
 * The board spots of one 3-star cast: `wall` evenly along both side edges from the bottom row's centre to the top row's,
 * `swirl` (the rings) at the height of the lowest clusters, from half a cell off the middle at the bottom out toward the
 * edge column's neighbour higher up. Rows count from the top (the far side); the bottom row is the player's back row.
 * `center` gives a cell's world point on the board.
 */
export function malzaharEdgeSpots(grid: EdgeGrid, center: (cell: { row: number; col: number }) => WorldPoint): BoardSpot[] {
  const { rows, columns } = grid, spots: BoardSpot[] = [];
  if (!(rows >= 2 && columns >= 3)) return spots;
  const { first, last } = MALZAHAR_EDGE_TIMING, { walls, rings } = MALZAHAR_EDGE_COUNTS;
  const lerp = (a: WorldPoint, b: WorldPoint, t: number): WorldPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const middle = (columns - 1) / 2;
  for (const side of [0, columns - 1]) {
    // The edge column zigzags by half a cell between rows: its line runs through the outer of each pair.
    const outer = (row: number) => { const p = center({ row, col: side }), q = center({ row: row ^ 1, col: side }); return side === 0 ? (p[0] < q[0] ? p : [q[0], p[1], p[2]] as const) : (p[0] > q[0] ? p : [q[0], p[1], p[2]] as const); };
    const bottom = outer(rows - 1), top = outer(0), inner = side === 0 ? 1 : columns - 2;
    for (let k = 0; k < walls; k++) {
      const t = walls > 1 ? k / (walls - 1) : 0, delay = first + (last - first) * t, at = lerp(bottom, top, t);
      spots.push({ point: at, delay, group: 'wall' });
      if (k >= rings) continue;
      // The ring of this cluster's row: from half a cell off the middle on its side (bottom) out toward the edge's neighbour (higher).
      const start = middle + (side === 0 ? -0.5 : 0.5), share = rings > 1 ? k / (rings - 1) : 0, col = start + (inner - start) * share;
      const left = center({ row: 0, col: Math.floor(col) }), right = center({ row: 0, col: Math.ceil(col) }), across = col - Math.floor(col);
      spots.push({ point: [left[0] + (right[0] - left[0]) * across, at[1], at[2]], delay, group: 'swirl' });
    }
  }
  return spots;
}
