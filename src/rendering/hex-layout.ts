import type { Board, HexCell } from '../simulation/board';
export interface Point { x: number; y: number }
export class HexLayout {
  constructor(readonly board: Board, readonly radius = 36, readonly origin: Point = { x: 242, y: 146 }) {}
  center(cell: HexCell): Point { return { x: this.origin.x + Math.sqrt(3) * this.radius * (cell.col + (cell.row % 2) / 2), y: this.origin.y + this.radius * 1.5 * cell.row }; }
  corners(cell: HexCell): Point[] {
    const center = this.center(cell);
    return Array.from({ length: 6 }, (_, i) => { const angle = (60 * i - 30) * Math.PI / 180; return { x: center.x + this.radius * Math.cos(angle), y: center.y + this.radius * Math.sin(angle) }; });
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
