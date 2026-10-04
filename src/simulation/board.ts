/** Odd-row offset coordinates. No pixels or Phaser objects enter simulation. */
export interface HexCell { readonly col: number; readonly row: number }
export interface Board { readonly columns: number; readonly rows: number }
export const DEFAULT_BOARD: Board = { columns: 7, rows: 6 };
export function contains(board: Board, cell: HexCell): boolean {
  return Number.isInteger(cell.col) && Number.isInteger(cell.row) && cell.col >= 0 && cell.col < board.columns && cell.row >= 0 && cell.row < board.rows;
}
export function sameCell(a: HexCell, b: HexCell): boolean { return a.col === b.col && a.row === b.row; }
