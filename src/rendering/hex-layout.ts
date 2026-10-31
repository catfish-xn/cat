import type { Board, HexCell } from '../simulation/board';
export interface Point { x: number; y: number }
export class HexLayout {
  constructor(readonly board: Board, readonly radius = 36, readonly origin: Point = { x: 242, y: 146 }) {}
  center(cell: HexCell): Point { return { x: this.origin.x + Math.sqrt(3) * this.radius * (cell.col + (cell.row % 2) / 2), y: this.origin.y + this.radius * 1.5 * cell.row }; }
  /** Writes the centre into `out` (callers that keep the point use `center`). */
  centerInto(cell: HexCell, out: Point): Point {
    out.x = this.origin.x + Math.sqrt(3) * this.radius * (cell.col + (cell.row % 2) / 2);
    out.y = this.origin.y + this.radius * 1.5 * cell.row;
    return out;
  }
  corners(cell: HexCell): Point[] {
    const center = this.center(cell);
    return Array.from({ length: 6 }, (_, i) => { const angle = (60 * i - 30) * Math.PI / 180; return { x: center.x + this.radius * Math.cos(angle), y: center.y + this.radius * Math.sin(angle) }; });
  }
  /** Writes six corners into `out`. `out[6]` holds the centre and is not a corner. */
  cornersInto(cell: HexCell, out: Point[]): Point[] {
    const center = this.centerInto(cell, out[6] ??= { x: 0, y: 0 });
    for (let i = 0; i < 6; i++) {
      const point = out[i] ??= { x: 0, y: 0 };
      const angle = (60 * i - 30) * Math.PI / 180;
      point.x = center.x + this.radius * Math.cos(angle);
      point.y = center.y + this.radius * Math.sin(angle);
    }
    return out;
  }
  hitTest(point: Point): HexCell | undefined {
    for (let row = 0; row < this.board.rows; row++) for (let col = 0; col < this.board.columns; col++) {
      const cell = { col, row }, center = this.center(cell);
      const x = Math.abs(point.x - center.x), y = Math.abs(point.y - center.y);
      if (x <= Math.sqrt(3) * this.radius / 2 && y <= this.radius && y + x / Math.sqrt(3) <= this.radius) return cell;
    }
    return undefined;
  }
}
