import { expect, it } from 'vitest';
import { clonePlainData } from '../src/simulation/plain-clone';

const outcome = (run: () => unknown) => {
  try { return { value: run() }; } catch (e) { return { error: e instanceof Error ? e.name : String(e) }; }
};
it('detaches plain data exactly like structuredClone: values, aliases, cycles and holes', () => {
  const shared = { n: 1, list: [1, 'a', null, false, { deep: [[]] }] };
  const cyclic: Record<string, unknown> = { shared, again: shared, ['__proto__']: { own: true } };
  cyclic.self = cyclic;
  const sparse = [1, , 3] as unknown[];
  for (const value of [0, -0, 1e21, 'x', null, true, undefined, [], {}, shared, cyclic, sparse, [sparse, sparse]]) {
    const native = structuredClone(value), copy = clonePlainData(value);
    expect(copy).toEqual(native);
    if (value !== cyclic) expect(JSON.stringify(copy)).toBe(JSON.stringify(native));
    if (value !== null && typeof value === 'object') expect(copy).not.toBe(value);
  }
  const copy = clonePlainData(cyclic) as typeof cyclic;
  expect(copy.self).toBe(copy);
  expect(copy.shared).toBe(copy.again);
  expect(copy.shared).not.toBe(shared);
  expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
  expect(Object.getOwnPropertyDescriptor(copy, '__proto__')?.value).toEqual({ own: true });
  expect(Object.isFrozen(copy)).toBe(false);
  expect(Object.isFrozen(copy.shared)).toBe(false);
});
it('hands exotic graphs to the native boundary, including its errors', () => {
  const exotic: unknown[] = [new Date(0), new Map([[1, 2]]), new Set([1]), Object.create(null), { d: new Date(0) },
    () => 1, { f: () => 1 }, [Symbol('s')], { get a() { return 1; } }, Object.assign([1], { map: () => [] }), 1n, { big: 1n }];
  for (const value of exotic) expect(outcome(() => clonePlainData(value))).toEqual(outcome(() => structuredClone(value)));
  const date = clonePlainData({ d: new Date(5) });
  expect(date.d).toBeInstanceOf(Date);
  expect(date.d.getTime()).toBe(5);
});
