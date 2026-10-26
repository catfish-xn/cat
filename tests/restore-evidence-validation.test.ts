import { expect, it } from 'vitest';
import { assertCanonicalContent, canonicalContent } from '../src/simulation/content';

function outcome(run: () => unknown) {
  try { run(); return 'accepted'; } catch (error) {
    if (!(error instanceof Error)) throw error;
    return { name: error.name, message: error.message };
  }
}
it('validates every canonical evidence value without building text or weakening finite/plain/dense checks', () => {
  const sparse = new Array(2); sparse[1] = 1;
  const inherited = Object.assign(Object.create({ missing: 1 }), { field: 1 });
  const extra = [0]; Object.assign(extra, { ignored: undefined });
  const values = [null, true, false, '', '嵌套', 0, -0, 1.25, Number.MAX_VALUE,
    {}, [], { z: [{ x: 1 }], a: 'a' }, extra,
    undefined, NaN, Infinity, -Infinity, new Date(0), new Map(), inherited,
    sparse, [undefined], { a: undefined }, { b: [1, { c: Infinity }] },
    { a: () => 1 }, { a: Symbol('invalid') }, new Uint8Array([1])];
  for (const value of values) {
    expect(outcome(() => assertCanonicalContent(value)))
      .toEqual(outcome(() => canonicalContent(value)));
    expect(outcome(() => assertCanonicalContent({ nested: [value] })))
      .toEqual(outcome(() => canonicalContent({ nested: [value] })));
  }
});
it('retains custom-array fallback and canonical property read order', () => {
  const custom = [1, 2]; Object.assign(custom, { map: () => ['custom'] });
  expect(canonicalContent(custom)).toBe('[custom]');
  expect(outcome(() => assertCanonicalContent(custom))).toBe('accepted');
  const ownConstructor = [1]; Object.assign(ownConstructor, { constructor: Array });
  expect(outcome(() => assertCanonicalContent(ownConstructor))).toEqual(outcome(() => canonicalContent(ownConstructor)));
  const reads: string[] = [];
  const value = { get z() { reads.push('z'); return [2]; }, get a() { reads.push('a'); return 1; } };
  canonicalContent(value); const expected = [...reads]; reads.length = 0;
  assertCanonicalContent(value); expect(reads).toEqual(expected);
});
