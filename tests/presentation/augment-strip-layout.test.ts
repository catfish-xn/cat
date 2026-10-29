import { describe, expect, it } from 'vitest';
import { augmentStripLayout, type AugmentStripRect } from '../../src/presentation/augment-hud';

const box = (left: number, top: number, width: number, height: number): AugmentStripRect =>
  ({ left, top, right: left + width, bottom: top + height, width, height });

describe('augment strip viewport placement', () => {
  it('centres the 3D row on the screenshot anchor without a frame offset', () => {
    const layout = augmentStripLayout({
      viewportWidth: 1280, viewportHeight: 720,
      board: box(80, 60, 700, 520), rail: null, shop: null, items: [], threeD: true, count: 3,
    });
    const width = layout.size * 3 + 2 * 2;
    expect(layout.left + width / 2).toBeCloseTo(1280 * 0.267, 5);
    expect(layout.top + layout.size / 2).toBeCloseTo(720 * 0.238, 5);
    // The old containing block sat about 8px inside the viewport. That bias must not come back.
    expect(Math.abs(layout.left + width / 2 - 1280 * 0.267)).toBeLessThan(0.001);
    expect(Math.abs(layout.top + layout.size / 2 - 720 * 0.238)).toBeLessThan(0.001);
  });

  it('keeps a wide 2D row inside the gap between the left column and the board', () => {
    const board = box(800, 100, 688, 700);
    const rail = box(12, 12, 720, 860);
    const layout = augmentStripLayout({
      viewportWidth: 1920, viewportHeight: 1080, board, rail, shop: null, items: [], threeD: false, count: 3,
    });
    const width = layout.size * 3 + 4;
    expect(layout.size).toBeLessThan(24);
    expect(layout.left).toBeGreaterThanOrEqual(rail.right + 4);
    expect(layout.left + width).toBeLessThanOrEqual(board.left - 4);
    expect(layout.top).toBeGreaterThanOrEqual(4);
  });

  it('moves the 2D row when the board anchor moves', () => {
    const rail = box(12, 12, 200, 600);
    const first = augmentStripLayout({
      viewportWidth: 1280, viewportHeight: 720, board: box(400, 80, 500, 520), rail, shop: null, items: [], threeD: false, count: 3,
    });
    const second = augmentStripLayout({
      viewportWidth: 1280, viewportHeight: 720, board: box(520, 80, 500, 520), rail, shop: null, items: [], threeD: false, count: 3,
    });
    expect(second.left).toBeGreaterThan(first.left);
  });

  it('lifts the 2D row above item cards and the shop', () => {
    const board = box(400, 100, 500, 500);
    const rail = box(8, 8, 300, 700);
    const item = box(340, 160, 44, 80);
    const shop = box(400, 620, 500, 120);
    const layout = augmentStripLayout({
      viewportWidth: 1280, viewportHeight: 800, board, rail, shop, items: [item], threeD: false, count: 3,
    });
    expect(layout.top + layout.size).toBeLessThanOrEqual(item.top - 4);
    expect(layout.top + layout.size).toBeLessThanOrEqual(shop.top - 4);
    expect(layout.left + layout.size * 3 + 4).toBeLessThanOrEqual(board.left - 4);
  });

  it('ignores a rail that sits below the board', () => {
    const board = box(40, 40, 600, 400);
    const below = box(0, 500, 900, 200);
    const layout = augmentStripLayout({
      viewportWidth: 1000, viewportHeight: 800, board, rail: below, shop: null, items: [], threeD: false, count: 3,
    });
    const width = layout.size * 3 + 4;
    expect(layout.left + width).toBeCloseTo(board.left - 4, 5);
  });
});
