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
