import { expect, it } from 'vitest';
import { canonicalContent, canonicalContentSteps, equalValidatedContent, withSynchronousRestoreEncoding } from '../src/simulation/content';
import { drainSetup } from '../src/simulation/setup-work';

const result = (run: () => unknown) => {
  try { return { value: run() }; } catch (e) {
    if (e instanceof Error) return { name: e.name, message: e.message };
    throw e;
  }
};
it('synchronous restore encoding retains canonical bytes and every data rejection', () => {
  const values: unknown[] = [null, true, -0, 1e21, '\ud800', undefined, Infinity, NaN, 1n,
    { z: [1, { a: -0, b: '\\"' }], a: false }, { '10': 1, '2': 2, '0x': 3, '__proto__': null },
    [1, , 3], { a: Infinity, b: [] }, { a: [], b: undefined }, new Map(), new Date(0),
    Object.assign(Object.create(null), { a: 1 })];
  for (let i = 0; i < 100; i++) values.push({ z: Array.from({ length: i % 7 }, (_, n) => ({ n, text: `line\n${i}`, a: [false, null, -0] })), a: i });
  for (const value of values) {
    const expected = result(() => canonicalContent(value));
    expect(withSynchronousRestoreEncoding(true, () => result(() => canonicalContent(value)))).toEqual(expected);
    expect(withSynchronousRestoreEncoding(true, () => result(() => drainSetup(canonicalContentSteps(value))))).toEqual(expected);
  }
});
it('retains array map fallback and property read order; nested failures restore cooperative mode', () => {
  function fixture() {
    const reads: string[] = [];
    const value = { get a() { reads.push('a'); return 1; }, get b() { reads.push('b'); return [2, { get c() { reads.push('c'); return 3; } }]; } };
    return { reads, value };
  }
  const a = fixture(), b = fixture();
  expect(withSynchronousRestoreEncoding(true, () => canonicalContent(b.value))).toBe(canonicalContent(a.value));
  expect(b.reads).toEqual(a.reads);
  const array = Object.assign([1, 2], { map: () => ['native-fallback'] });
  expect(withSynchronousRestoreEncoding(true, () => canonicalContent(array))).toBe(canonicalContent(array));
  const chunks = () => [...canonicalContentSteps(Array.from({ length: 200 }, () => ({ a: [] })))].length;
  expect(chunks()).toBeGreaterThan(0);
  withSynchronousRestoreEncoding(true, () => {
    expect(chunks()).toBe(0);
    expect(() => withSynchronousRestoreEncoding(false, () => { expect(chunks()).toBeGreaterThan(0); throw Error('nested'); })).toThrow('nested');
    expect(chunks()).toBe(0);
  });
  expect(chunks()).toBeGreaterThan(0);
});
it('iterative equality retains dense and sparse array semantics and full object keys', () => {
  const pairs: [unknown, unknown][] = [[-0, 0], [undefined, undefined], [[1, , 3], [1, 2, 3]],
    [{ a: 1 }, { a: 1, b: 2 }], [{ a: [1, 2] }, { a: [2, 1] }], [{ b: 2, a: 1 }, { a: 1, b: 2 }]];
  function legacy(a: any, b: any): boolean {
    if (a === b) return a !== undefined;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => legacy(v, b[i]));
    if (Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && legacy(a[k], b[k]));
  }
  for (const [a, b] of pairs) {
    expect(equalValidatedContent(a, b)).toBe(legacy(a, b));
    expect(withSynchronousRestoreEncoding(true, () => equalValidatedContent(a, b))).toBe(legacy(a, b));
  }
});
