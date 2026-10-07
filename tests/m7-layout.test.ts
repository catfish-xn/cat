import { describe, expect, it } from 'vitest';
import { BOARD_LAYOUT, PIECE_EXTENT } from '../src/rendering/layout-config';
import { HexLayout } from '../src/rendering/hex-layout';
import { DEFAULT_BOARD } from '../src/simulation/board';

describe('M7 board geometry (audit F05)', () => {
  const board = DEFAULT_BOARD;
  const layout = new HexLayout(board, BOARD_LAYOUT.hexRadius, BOARD_LAYOUT.origin);
  it('keeps every board piece, including its HP bar, inside the canvas', () => {
    for (let row = 0; row < board.rows; row++) for (let col = 0; col < board.columns; col++) {
      const p = layout.center({ col, row });
      expect(p.y - PIECE_EXTENT.top, `${col},${row}`).toBeGreaterThanOrEqual(0);
      expect(p.x - BOARD_LAYOUT.tokenRadius).toBeGreaterThanOrEqual(0);
      expect(p.x + BOARD_LAYOUT.tokenRadius).toBeLessThanOrEqual(BOARD_LAYOUT.width);
    }
  });
  it('keeps the board above the bench', () => {
    const bottom = Math.max(...layout.corners({ col: 0, row: board.rows - 1 }).map(point => point.y));
    expect(bottom).toBeLessThan(BOARD_LAYOUT.benchY - 30);
    expect(BOARD_LAYOUT.benchY + 30).toBeLessThanOrEqual(BOARD_LAYOUT.height);
  });
});
