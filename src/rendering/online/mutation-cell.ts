import type { HexCell } from '../../simulation/board';

/** Only the server's owner-only coordinate is displayed; no augment or board rules are inferred here. */
export function mutationCellForBoard(view: { readonly mutationSacrificeCell?: HexCell }, visible: boolean): HexCell | null {
  return visible && view.mutationSacrificeCell ? { ...view.mutationSacrificeCell } : null;
}

export const MUTATION_CELL_COLOR = '#c47cff';

/** Draw only coordinates on this board, using the same paint operation as other special cells. */
export function drawMutationCell(cell: HexCell | null, board: { readonly columns: number; readonly rows: number },
  paint: (cell: HexCell, color: string) => void): void {
  if (cell && cell.col >= 0 && cell.row >= 0 && cell.col < board.columns && cell.row < board.rows) paint(cell, MUTATION_CELL_COLOR);
}

/** The 3D tile receives the same marker only on the owner's board. */
export function isMutationCell(cell: HexCell, marker: HexCell | null | undefined, ownBoard: boolean): boolean {
  return ownBoard && !!marker && cell.col === marker.col && cell.row === marker.row;
}
