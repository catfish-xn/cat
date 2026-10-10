import { describe, expect, it } from 'vitest';
import { copyPlainRecord } from '../src/simulation/plain-clone';

const SHARED = new Set(['mechanismState']);
/** The tick's original detach: structuredClone with shared keys blanked, then the references restored. */
function original(value: Record<string, unknown>) {
  const copy = structuredClone({ ...value, ...(value.mechanismState ? { mechanismState: undefined } : {}) });
  return { ...copy, ...(value.mechanismState ? { mechanismState: value.mechanismState } : {}) };
}

describe('tick plain-data detach is equivalent to the structuredClone path', () => {
  it('matches key order, values, undefined members, -0 and shared references', () => {
    const shared = { statuses: [] };
    const input = { b: 1, a: { z: [1, { y: -0 }], x: undefined }, mechanismState: shared, n: null, s: 'text', t: true, big: 10n, list: [undefined, 2] };
    const copy = copyPlainRecord(input, SHARED)!;
    expect(JSON.stringify(Object.keys(copy))).toBe(JSON.stringify(Object.keys(original(input))));
    expect(copy).toStrictEqual(original(input));
    expect(Object.is((copy.a as any).z[1].y, -0)).toBe(true);
    expect('x' in (copy.a as object)).toBe(true);
    expect(copy.mechanismState).toBe(shared);
    expect(copy.a).not.toBe(input.a);
    expect((copy.a as any).z).not.toBe(input.a.z);
  });
  it('preserves aliasing and cycles across fields, like one structuredClone call', () => {
    const cell = { col: 1, row: 2 }, ring: any = { name: 'ring' }; ring.self = ring;
    const input = { cell, startingCell: cell, nested: { cell }, ring };
    const copy = copyPlainRecord(input, SHARED) as any, expected = original(input) as any;
    expect(copy.cell).toBe(copy.startingCell);
    expect(copy.nested.cell).toBe(copy.cell);
    expect(copy.ring.self).toBe(copy.ring);
    expect(copy.cell).not.toBe(cell);
    expect(expected.cell).toBe(expected.startingCell);
  });
  it('a falsy shared field is copied exactly as structuredClone would', () => {
    for (const value of [undefined, null, 0, '']) {
      const input = { mechanismState: value, hp: 1 };
      expect(copyPlainRecord(input, SHARED)).toStrictEqual(original(input));
    }
  });
  it.each([
    ['Map', { m: new Map([[1, 2]]) }],
    ['Date', { d: new Date(0) }],
    ['class instance', { c: new (class Point { x = 1; })() }],
    ['sparse array', { a: [1, , 3] }],
    ['decorated array', { a: Object.assign([1], { extra: true }) }],
    ['null prototype', { o: Object.assign(Object.create(null), { k: 1 }) }],
    ['__proto__ key', JSON.parse('{"__proto__":{"polluted":true},"hp":1}')],
    ['nested __proto__ key', { n: JSON.parse('{"__proto__":{"polluted":true}}') }],
    ['function', { f: () => 1 }],
    ['symbol', { s: Symbol('s') }],
  ])('%s values defer to structuredClone instead of being approximated', (_label, input) => {
    const copy = copyPlainRecord(input as Record<string, unknown>, SHARED);
    const proto = Object.getPrototypeOf((input as any).o ?? {});
    if (proto === null) {
      // Null-prototype objects are plain data: structuredClone also yields an ordinary object.
      expect(copy).toStrictEqual(original(input as Record<string, unknown>));
      return;
    }
    expect(copy).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
  });
});
