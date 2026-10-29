import { deepStrictEqual } from 'node:assert';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const { observedEqual } = createRequire(import.meta.url)('./fixtures/m5/observed-equal.cjs');
const accepted = (compare: () => void) => { try { compare(); return true; } catch { return false; } };

it('agrees with Node deepStrictEqual for plain and exotic observations, including rejected edge cases', () => {
  const symbol = Symbol('field'), cycle: { self?: unknown } = {}; cycle.self = cycle;
  const values: unknown[] = [null, undefined, 0, -0, NaN, Infinity, 1, '1', true, 1n, symbol,
    {}, { a: undefined }, [], Array(1), [undefined], { a: 1, b: [2, 3] }, { b: [2, 3], a: 1 },
    Object.assign([], { extra: 1 }), Object.assign({}, { [symbol]: 1 }), Object.create(null),
    Object.setPrototypeOf(new Date(0), Object.prototype), Object.setPrototypeOf([1], Object.prototype), new Date(0), new Date(1), new Map([['a', 1]]), new Set([1]), new Uint8Array([1]), /a/g, cycle];
  for (const a of values) for (const b of values) {
    expect(accepted(() => observedEqual(a, b)), `pair ${values.indexOf(a)} / ${values.indexOf(b)}`).toBe(accepted(() => deepStrictEqual(a, b)));
  }
  for (const value of values) if (typeof value !== 'symbol') {
    const copy = structuredClone(value);
    expect(accepted(() => observedEqual(value, copy))).toBe(accepted(() => deepStrictEqual(value, copy)));
  }
});

it('compares all appended and retained facts and preserves the original assertion failure label', () => {
  const a = Array.from({ length: 200 }, (_, sequence) => ({ sequence, deaths: [], roster: { items: [{ id: `item-${sequence}`, quantity: 1 }] } }));
  const b = structuredClone(a);
  expect(() => observedEqual(a, b, 'H3 retained facts')).not.toThrow();
  b[0].roster.items[0].quantity++;
  expect(() => observedEqual(a, b, 'H3 retained facts')).toThrow('H3 retained facts');
  b[0].roster.items[0].quantity--;
  b.at(-1)!.roster.items[0].quantity++;
  expect(() => observedEqual(a, b, 'H3 retained facts')).toThrow('H3 retained facts');
});

it('does not reuse equality for a shallow-frozen wrapper or a frozen accessor with changing output', () => {
  const actual = Object.freeze({ child: { value: 1 } }), expected = Object.freeze({ child: { value: 1 } });
  observedEqual(actual, expected, 'retained checkpoint');
  actual.child.value++;
  expect(() => observedEqual(actual, expected, 'retained checkpoint')).toThrow('retained checkpoint');

  const { freezeObservation } = createRequire(import.meta.url)('./fixtures/m5/observed-equal.cjs');
  let value = 1;
  const getter = { get value() { return value; } }, snapshot = { value: 1 };
  freezeObservation(getter); freezeObservation(snapshot);
  observedEqual(getter, snapshot, 'retained getter');
  value++;
  expect(() => observedEqual(getter, snapshot, 'retained getter')).toThrow('retained getter');
});

it('checks replaced rows in a growing journal after earlier successful comparisons', () => {
  const { freezeObservation } = createRequire(import.meta.url)('./fixtures/m5/observed-equal.cjs');
  const actual = Array.from({ length: 200 }, (_, sequence) => ({ sequence, value: sequence }));
  const expected = structuredClone(actual);
  freezeObservation(actual); freezeObservation(expected);
  observedEqual(actual, expected, 'retained journal');
  actual[0] = { ...actual[0], value: -1 };
  expect(() => observedEqual(actual, expected, 'retained journal')).toThrow('retained journal');
});

it('matches the full slice-prefix assertion for dense, sparse and exotic arrays', () => {
  const { freezeObservation, observedPrefixEqual } = createRequire(import.meta.url)('./fixtures/m5/observed-equal.cjs');
  const symbol = Symbol('extra');
  const vectors = [[], [1], [undefined], Array(1), [{ value: 1 }], [{ value: 2 }],
    Object.assign([1], { extra: 1 }), Object.assign([1], { [symbol]: 1 })];
  for (const freeze of [false, true]) for (const value of vectors) {
    const expected = structuredClone(value);
    // Symbols aren't preserved by structuredClone; preserve Node's expected
    // special-type path explicitly as well as the ordinary cloned vectors.
    if (Object.getOwnPropertySymbols(value).length) Object.assign(expected, { [symbol]: 1 });
    if (freeze) freezeObservation(expected, true);
    for (const next of vectors) {
      expect(accepted(() => observedPrefixEqual(next, expected, 'prefix')))
        .toBe(accepted(() => deepStrictEqual(next.slice(0, expected.length), expected)));
    }
  }
  const expected = Array.from({ length: 200 }, (_, i) => ({ i, nested: [i] }));
  freezeObservation(expected, true);
  const actual = structuredClone(expected);
  observedPrefixEqual(actual, expected);
  actual[0].nested[0]++;
  expect(() => observedPrefixEqual(actual, expected, 'retained facts')).toThrow('retained facts');
});

it('certifies only detached array data and fully immutable shallow nodes', () => {
  const { observedArray, freezeObservedNode } = createRequire(import.meta.url)('./fixtures/m5/observed-equal.cjs');
  const sparse = Object.assign(Array(3), { 1: 7 });
  expect(observedArray(sparse)).toEqual(sparse);
  expect(Object.hasOwn(observedArray(sparse), 0)).toBe(false);
  const a = freezeObservedNode({ child: { value: 1 } });
  const b = observedArray([{ child: { value: 1 } }]);
  observedEqual([a], b);
  a.child.value++;
  expect(() => observedEqual([a], b, 'mutable child')).toThrow('mutable child');
  let value = 1;
  const getter = freezeObservedNode({ get value() { return value; } });
  const expected = observedArray([{ value: 1 }]);
  observedEqual([getter], expected);
  value++;
  expect(() => observedEqual([getter], expected, 'mutable accessor')).toThrow('mutable accessor');
});

it('does not hide an extra array property behind a non-enumerable indexed field', () => {
  const { observedArray } = createRequire(import.meta.url)('./fixtures/m5/observed-equal.cjs');
  const expected = observedArray([1]);
  const actual = [1]; Object.defineProperty(actual, '0', { enumerable: false });
  Object.assign(actual, { extra: 1 });
  expect(() => observedEqual(actual, expected)).toThrow();
});

it('carries row certificates only for the same independently checked frozen expectation', () => {
  const { observedArray, freezeObservation, observedPrefixEqual } = createRequire(import.meta.url)('./fixtures/m5/observed-equal.cjs');
  const actual = Array.from({ length: 100 }, (_, i) => ({ i, nested: { value: i } }));
  freezeObservation(actual);
  const detached = structuredClone(actual); freezeObservation(detached, true);
  observedEqual(actual, detached);
  observedPrefixEqual(actual, detached);
  const carried = observedArray(detached, (v: unknown) => v, detached);
  observedEqual(actual, carried);
  actual[0] = { i: 0, nested: { value: -1 } };
  expect(() => observedEqual(actual, carried, 'replaced source')).toThrow('replaced source');
  expect(() => observedPrefixEqual(actual, carried, 'replaced prefix')).toThrow('replaced prefix');
  const forged = structuredClone(detached[1]); forged.nested.value++;
  freezeObservation(forged);
  const changed = observedArray(detached, (v: unknown, i: number) => i === 1 ? forged : v, detached);
  expect(() => observedEqual(detached, changed, 'changed expectation')).toThrow('changed expectation');
});

it('keeps Node cycle semantics for prefix rows outside immutable certification', () => {
  const { observedPrefixEqual } = createRequire(import.meta.url)('./fixtures/m5/observed-equal.cjs');
  const cycle: { self?: unknown } = {}; cycle.self = cycle;
  const expected = [cycle], actual = structuredClone(expected);
  expect(() => observedPrefixEqual(actual, expected)).not.toThrow();
});
