import { expect, it } from 'vitest';
import { encodePrimitiveTuple } from '../src/simulation/primitive-tuple';

it('memoizes only primitive encoding and preserves native bytes across arena eviction', () => {
  const tuples: readonly unknown[][] = [[], [null, undefined, true, false, -0, NaN, Infinity],
    ['0', 0, '\ud800', '汉字\\"\n', '__proto__'], Array(15).fill('large'),
    [{ toJSON: () => 'native' }], [Symbol('native-null')], [() => 1]];
  for (let pass = 0; pass < 3; pass++) {
    for (const tuple of tuples) expect(encodePrimitiveTuple(tuple)).toBe(JSON.stringify(tuple));
    for (let i = 0; i < 5000; i++) expect(encodePrimitiveTuple(['evict', i, pass])).toBe(JSON.stringify(['evict', i, pass]));
  }
  expect(() => encodePrimitiveTuple([1n])).toThrow(TypeError);
  const original = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON');
  try {
    Object.defineProperty(Array.prototype, 'toJSON', { configurable: true, value: () => 'hook' });
    expect(encodePrimitiveTuple(['evict', 4999, 2])).toBe('"hook"');
  } finally {
    if (original) Object.defineProperty(Array.prototype, 'toJSON', original);
    else Reflect.deleteProperty(Array.prototype, 'toJSON');
  }
  expect(encodePrimitiveTuple(['evict', 4999, 2])).toBe('["evict",4999,2]');
});
