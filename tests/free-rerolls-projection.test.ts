import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { toSeatPrivateView } from '../src/server/room/projection';
import { readFreeRerollsAvailable, toDisplayMatch } from '../src/rendering/online/seat-view-adapter';

it('reads only the private count, and distinguishes a missing projection from zero', () => {
  const view = toSeatPrivateView(createMatch(7));
  expect(view.freeRerollsAvailable).toBe(0);
  const display = toDisplayMatch(JSON.parse(JSON.stringify(view)));
  expect(readFreeRerollsAvailable(display)).toBe(0);
  // An online placeholder/older view is unknown; never fall back to domain history or invent a zero.
  expect(readFreeRerollsAvailable(createMatch(7))).toBeNull();
  for (const count of [undefined, null, -1, 1.5, '2', NaN, Infinity]) {
    expect(readFreeRerollsAvailable({ ...display, freeRerollsAvailable: count } as never)).toBeNull();
  }
  const projected = { ...display, freeRerollsAvailable: 7 };
  Object.defineProperty(projected, 'augmentHistory', { get() { throw new Error('display must not read history'); } });
  expect(readFreeRerollsAvailable(projected)).toBe(7);
});
