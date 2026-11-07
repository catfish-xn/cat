import { describe, expect, it } from 'vitest';
import { augmentStripLayout, clearAugmentStrip } from '../../src/presentation/augment-hud';

// S13 places the owned row at the board's upper-left corner (docs/V26_AUGMENT_ICONS_LAYOUT.md), not in the trait rail.
const board = { left: 540, top: 70, right: 1190, bottom: 750 };
const rail = { left: 92, top: 10, right: 452, bottom: 890 };

describe('owned augment row at the board corner', () => {
  it('2D: right-aligns the row against the board edge, a fifth of the way down, wrapping instead of covering hexes', () => {
    // 540 - 6 - (452 + 6) = 76px of room: one 44px column, never a shrunk icon.
    const narrow = augmentStripLayout({ viewportWidth: 1600, viewportHeight: 900, count: 3, threeD: false, board, left: [rail] });
    expect(narrow).toEqual({ left: 490, top: 70 + 136 - 70, columns: 1, width: 44, height: 140 });
    expect(narrow.left + narrow.width).toBeLessThanOrEqual(board.left);
    expect(narrow.left).toBeGreaterThanOrEqual(rail.right);
    // A wider gap holds the whole row.
    const wide = augmentStripLayout({ viewportWidth: 1920, viewportHeight: 1080, count: 4, threeD: false, board: { ...board, left: 700 }, left: [rail] });
    expect(wide).toMatchObject({ columns: 4, width: 188, height: 44, left: 700 - 6 - 188 });
  });

  it('2D: with no gap at all the row sits inside the board corner', () => {
    const layout = augmentStripLayout({ viewportWidth: 1000, viewportHeight: 800, count: 2, threeD: false, board: { ...board, left: 470 }, left: [rail] });
    expect(layout).toMatchObject({ left: 476, columns: 2, width: 92 });
  });

  it('3D: centres on the S13 anchor (26.7vw, 23.8vh) and moves right of an open left drawer', () => {
    const free = augmentStripLayout({ viewportWidth: 1600, viewportHeight: 900, count: 3, threeD: true, board: { left: 240, top: 60, right: 1360, bottom: 760 }, left: [{ left: 0, top: 0, right: 260, bottom: 700 }] });
    expect(free).toEqual({ left: Math.round(1600 * 0.267 - 70), top: Math.round(900 * 0.238 - 22), columns: 3, width: 140, height: 44 });
    const drawer = augmentStripLayout({ viewportWidth: 1366, viewportHeight: 768, count: 3, threeD: true, board: { left: 200, top: 60, right: 1160, bottom: 660 }, left: [{ left: 0, top: 40, right: 368, bottom: 700 }] });
    expect(drawer.left).toBe(374);
  });

  it('ignores right-hand boxes and stays inside the viewport', () => {
    const layout = augmentStripLayout({ viewportWidth: 1280, viewportHeight: 720, count: 4, threeD: true, board: { left: 200, top: 40, right: 1080, bottom: 600 }, left: [{ left: 1100, top: 0, right: 1280, bottom: 720 }] });
    expect(layout.left).toBe(Math.round(1280 * 0.267 - 94));
    expect(layout.left + layout.width).toBeLessThanOrEqual(1280);
  });

  it('keeps 44px targets: the box is whole icons plus 4px gaps', () => {
    for (const count of [1, 2, 3, 4]) {
      const layout = augmentStripLayout({ viewportWidth: 1920, viewportHeight: 1080, count, threeD: true, board, left: [] });
      expect(layout.width).toBe(count * 44 + (count - 1) * 4);
      expect(layout.height).toBe(44);
    }
    expect(augmentStripLayout({ viewportWidth: 1920, viewportHeight: 1080, count: 0, threeD: true, board, left: [] }).width).toBe(0);
  });

  it('slides down past HUD boxes it would cover on narrow screens, and stays put when nothing is covered', () => {
    const layout = { left: 68, top: 179, columns: 4, width: 188, height: 44 };
    const seat = { left: 198, top: 124, right: 284, bottom: 182 }, traits = { left: 64, top: 169, right: 260, bottom: 299 };
    expect(clearAugmentStrip(layout, [seat, traits], 844)).toEqual({ ...layout, top: 303 });
    expect(clearAugmentStrip(layout, [{ left: 300, top: 0, right: 390, bottom: 844 }], 844)).toEqual(layout);
    // No clear spot above the bottom edge: keep the anchor rather than leave the screen.
    expect(clearAugmentStrip(layout, [{ left: 0, top: 150, right: 390, bottom: 830 }], 844)).toEqual(layout);
  });
});
