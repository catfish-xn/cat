import type { HexCell } from './board';

// Doubled odd-row centers: (2*col + row%2, sqrt(3)*row).
// Squared integer comparisons avoid angle/rounding ties; width is full width.
export function lineContains(from: HexCell, toward: HexCell, cell: HexCell, width: number, length?: number): boolean {
  const dx=2*(toward.col-from.col)+(toward.row&1)-(from.row&1),dy=toward.row-from.row;
  const px=2*(cell.col-from.col)+(cell.row&1)-(from.row&1),py=cell.row-from.row;
  const norm=dx*dx+3*dy*dy,dot=dx*px+3*dy*py,cross=dx*py-dy*px;
  return norm>0 && dot>=0 && (length===undefined?dot<=norm:dot*dot<=4*length*length*norm) && 3*cross*cross<=width*width*norm;
}

/** E, SE, SW, W, NW, NE, including directions off the board at an edge. */
export function lineDirections(from: HexCell): HexCell[] {
  const o=from.row%2;
  return [[1,0],[o,1],[o-1,1],[-1,0],[o-1,-1],[o,-1]].map(([col,row])=>({col:from.col+col,row:from.row+row}));
}
