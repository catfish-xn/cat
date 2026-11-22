/** Odd-row offset coordinates. No pixels or Phaser objects enter simulation. */
export interface HexCell { readonly col: number; readonly row: number }
export type Team = 'player' | 'enemy';
export interface DeploymentZone { readonly firstRow: number; readonly lastRow: number }
export interface Board {
  readonly columns: number;
  readonly rows: number;
  readonly deploymentZones: Readonly<Record<Team, DeploymentZone>>;
}
export const DEFAULT_BOARD: Board = {
  columns: 7,
  rows: 8,
  deploymentZones: {
    enemy: { firstRow: 0, lastRow: 3 },
    player: { firstRow: 4, lastRow: 7 },
  },
};
export function contains(board: Board, cell: HexCell): boolean {
  return Number.isInteger(cell.col) && Number.isInteger(cell.row) && cell.col >= 0 && cell.col < board.columns && cell.row >= 0 && cell.row < board.rows;
}
export function sameCell(a: HexCell, b: HexCell): boolean { return a.col === b.col && a.row === b.row; }
export function isDeploymentCell(board: Board, team: Team, cell: HexCell): boolean {
  const zone = board.deploymentZones[team];
  return contains(board, cell) && cell.row >= zone.firstRow && cell.row <= zone.lastRow;
}

/** Clockwise order: E, SE, SW, W, NW, NE. Invalid source cells have no neighbors. */
export function getNeighbors(board: Board, cell: HexCell): HexCell[] {
  if (!contains(board, cell)) return [];
  const offset = cell.row % 2;
  const deltas = [[1, 0], [offset, 1], [offset - 1, 1], [-1, 0], [offset - 1, -1], [offset, -1]];
  return deltas.map(([col, row]) => ({ col: cell.col + col, row: cell.row + row })).filter(neighbor => contains(board, neighbor));
}

/** Minimum adjacent steps on an unobstructed hex grid, independent of teams. */
export function hexDistance(a: HexCell, b: HexCell): number {
  const aq = a.col - Math.floor(a.row / 2);
  const bq = b.col - Math.floor(b.row / 2);
  const dq = aq - bq, dr = a.row - b.row;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/** Cube coordinates of an odd-row offset cell (the same axial q as hexDistance). */
const toCube = (cell: HexCell) => { const q = cell.col - Math.floor(cell.row / 2); return [q, cell.row, -q - cell.row] as const; };
/** The three hex axes as cube steps, in tie-break order: the row, then the axis rising to the right, then the other. */
const HEX_AXES = [[1, 0, -1], [0, 1, -1], [-1, 1, 0]] as const;
/** Board-plane position of a cube offset (a cell's width 1; rows sqrt(3)/2 apart). */
const plane = (q: number, r: number) => [q + r / 2, r * Math.sqrt(3) / 2] as const;
/**
 * A line across `to`, square to the line from `from` to `to` as near as the hex grid allows: of the three hex axes, the one most
 * nearly perpendicular to from -> to on the board plane (an exact tie: the row first, then the axis rising to the right;
 * self-chosen, not original data; both sides alike under the board's half turn). Lists `to` and `half` cells either way along
 * that axis, off-board cells dropped; each cell carries its signed step from `to`.
 */
export function hexCrossLine(board: Board, from: HexCell, to: HexCell, half: number): { cell: HexCell; step: number }[] {
  const a = toCube(from), b = toCube(to), [vx, vy] = plane(b[0] - a[0], b[1] - a[1]), length = Math.hypot(vx, vy);
  if (length === 0) return [];
  let best: readonly [number, number, number] = HEX_AXES[0], bestDot = Infinity;
  for (const axis of HEX_AXES) {
    const [ax, ay] = plane(axis[0], axis[1]), dot = Math.abs(ax * vx + ay * vy) / (Math.hypot(ax, ay) * length);
    if (dot < bestDot - 1e-9) { best = axis; bestDot = dot; }
  }
  const out: { cell: HexCell; step: number }[] = [];
  for (let step = -half; step <= half; step++) {
    const q = b[0] + best[0] * step, r = b[1] + best[1] * step, cell = { col: q + Math.floor(r / 2), row: r };
    if (contains(board, cell)) out.push({ cell, step });
  }
  return out;
}
