import { describe, expect, it } from 'vitest';
import { augmentStripLayout, placeAugmentStrip } from '../../src/presentation/augment-hud';

describe('augment strip rail size', () => {
  it('keeps four owned icons at 44px with a 4px gap', () => {
    expect(augmentStripLayout({ count: 4, narrow: false })).toEqual({ size: 44, gap: 4, columns: 4, width: 188, height: 44 });
  });

  it('wraps the 3D portrait rail into two 44px columns', () => {
    expect(augmentStripLayout({ count: 4, narrow: true })).toEqual({ size: 44, gap: 4, columns: 2, width: 92, height: 92 });
  });

  it('does not shrink three icons when the board-side gap is narrower than the row', () => {
    // board.left 800 and rail.right 732 leave 64px. A 20px size fitted that gap on paper
    // and then overflowed, because the rail CSS keeps min-width 44px. Width stays 3*44+2*4.
    const layout = augmentStripLayout({ count: 3, narrow: false });
    expect(layout.size).toBe(44);
    expect(layout.gap).toBe(4);
    expect(layout.width).toBe(140);
    expect(layout.width).toBeGreaterThan(64);
  });

  it('does not write viewport left, top, or a custom icon size', () => {
    const strip = {
      childElementCount: 4,
      dataset: {} as DOMStringMap,
      get style(): never { throw new Error('layout-must-not-write-style'); },
    };
    expect(() => placeAugmentStrip(strip as unknown as HTMLElement)).not.toThrow();
    expect(strip.dataset.placed).toBe('rail');
    strip.childElementCount = 0;
    placeAugmentStrip(strip as unknown as HTMLElement);
    expect(strip.dataset.placed).toBeUndefined();
  });
});
