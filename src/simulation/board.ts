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
/** Nearest cube cell to a fractional cube point (the component with the largest rounding error is recomputed). */
function roundCube(x: number, y: number, z: number): HexCell {
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return { col: rx + Math.floor(ry / 2), row: ry };
}
/**
 * The cells of a straight line through `from` toward `to`, sampled one hex step at a time (cube interpolation, the same steps as
 * hexDistance): `back` steps behind `from` and max(`front`, distance to `to`) steps ahead, so `to` is always on it. A sample that
 * falls exactly between two cells takes both (self-chosen, keeps the line mirror-symmetric). Off-board cells are dropped; `from`
 * itself is not listed. Each cell carries its step (negative behind). Not original data: the decided Malzahar line (11-19).
 */
export function hexLine(board: Board, from: HexCell, to: HexCell, back: number, front: number): { cell: HexCell; step: number }[] {
  const n = hexDistance(from, to);
  if (n === 0) return [];
  const a = toCube(from), b = toCube(to), out: { cell: HexCell; step: number }[] = [];
  for (let step = -back; step <= Math.max(front, n); step++) {
    if (step === 0) continue;
    const p = [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * step / n);
    const cells: HexCell[] = [];
    for (const e of [[1e-6, 2e-6, -3e-6], [-1e-6, -2e-6, 3e-6]]) {
      const cell = roundCube(p[0] + e[0], p[1] + e[1], p[2] + e[2]);
      if (!cells.some(c => sameCell(c, cell))) cells.push(cell);
    }
    for (const cell of cells.sort((x, y) => x.row - y.row || x.col - y.col)) if (contains(board, cell)) out.push({ cell, step });
  }
  return out;
}
