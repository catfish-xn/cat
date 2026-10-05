import { describe, expect, it } from 'vitest';
import { InputRouter } from '../src/rendering/input-router';

describe('pointer gesture ownership', () => {
  it('prevents a second finger or unit drag from taking an item gesture', () => {
    const router = new InputRouter(), first = router.begin('item', 'item-1', 11)!;
    expect(router.begin('item', 'item-2', 12)).toBeNull();
    expect(router.begin('unit', 'unit-1', 2)).toBeNull();
    expect(router.release({ ...first, pointerId: 12 })).toBe(false);
    expect(router.current).toEqual(first); expect(router.release(first)).toBe(true);
    expect(router.release(first)).toBe(false);
  });
  it('invalidates delayed releases even when the same item is dragged again', () => {
    const router = new InputRouter(), old = router.begin('item', 'item-1', 11)!;
    router.cancel(); const current = router.begin('item', 'item-1', 11)!;
    expect(router.release(old)).toBe(false); expect(router.current).toEqual(current);
    expect(router.release(current)).toBe(true);
  });
  it('exposes observer copies and keeps unit and item identity separate', () => {
    const router = new InputRouter(), unit = router.begin('unit', 'same-id', 1)!;
    expect(router.owns({ ...unit, kind: 'item' })).toBe(false);
    expect(router.current).not.toBe(router.current);
    expect(router.owns(unit)).toBe(true); router.cancel(); expect(router.current).toBeNull();
  });
});
