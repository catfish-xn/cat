import { expect, it } from 'vitest';
import { createImmutableJsonChecker, isImmutableJson } from '../src/simulation/immutable-json';
import { freezeTransientContent } from '../src/simulation/content/freeze';

it('scoped proofs retain every finite plain-data and deep-freeze check', () => {
  const check = createImmutableJsonChecker();
  const mutable = { n: 1 }, shallow = Object.freeze({ mutable });
  expect(check(shallow)).toBe(false);
  mutable.n = 2;
  const inputs = [freezeTransientContent({ a: [{ n: 1 }], b: null }), shallow,
    Object.freeze({ n: -0 }), Object.freeze({ n: NaN }), Object.freeze([1, , 3]),
    Object.freeze(Object.create(null)), Object.freeze({ get n() { throw Error('must not read'); } }),
    Object.freeze(new Date(0)), Object.freeze({ [Symbol('extra')]: 1 }), Object.freeze({ n: undefined })];
  const cyclic: { self?: object } = {}; cyclic.self = cyclic; Object.freeze(cyclic); inputs.push(cyclic);
  for (let pass = 0; pass < 2; pass++) for (const value of inputs) expect(check(value)).toBe(isImmutableJson(value));
  Object.freeze(mutable);
  expect(check(shallow)).toBe(true);
  expect(createImmutableJsonChecker()(shallow)).toBe(true);
});

it('synchronous freezing preserves cooperative property-read order and scheduling work', async () => {
  const { freezeContent, freezeContentSteps, isFrozenContent } = await import('../src/simulation/content/freeze');
  const { drainSetup } = await import('../src/simulation/setup-work');
  const fixture = () => {
    const reads: string[] = [];
    const child = { get n() { reads.push('n'); return 1; } };
    const value = { get a() { reads.push('a'); return child; }, get b() { reads.push('b'); return [];  } };
    return { value, child, reads };
  };
  const a = fixture(), b = fixture();
  expect(freezeContent(a.value)).toBe(a.value);
  expect(drainSetup(freezeContentSteps(b.value))).toBe(b.value);
  expect(a.reads).toEqual(b.reads);
  expect(a.reads).toEqual(['a', 'b', 'n']);
  expect(isFrozenContent(a.child)).toBe(true);
  const large = Array.from({ length: 200 }, () => ({ a: [] }));
  const chunks = () => [...freezeContentSteps(large)].length;
  const before = chunks(); freezeContent(large);
  expect(before).toBeGreaterThan(0);
  expect(chunks()).toBe(before);
});
