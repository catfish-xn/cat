import { expect, it } from 'vitest';
import { canonicalContent, canonicalContentSteps } from '../src/simulation/content';
import { freezeContent, freezeContentSteps } from '../src/simulation/content/freeze';

function observe<T>(work: Generator<void, T, void>): { value: T; pauses: number } {
  let pauses = 0;
  for (;;) {
    const next = work.next();
    if (next.done) return { value: next.value, pauses };
    pauses++;
  }
}
const data = () => Array.from({ length: 160 }, (_, i) => ({ id: i, values: [i, { amount: i * 2 }] }));

it('keeps canonical setup pauses identical before and after the synchronous text cache is warmed', () => {
  const value = freezeContent(data());
  const cold = observe(canonicalContentSteps(value));
  expect(cold.pauses).toBeGreaterThan(0);
  expect(canonicalContent(value)).toBe(cold.value);
  expect(observe(canonicalContentSteps(value))).toEqual(cold);
  expect(observe(canonicalContentSteps(structuredClone(value)))).toEqual(cold);
});

it('keeps freezing pauses identical for fresh, previously frozen and shared subtrees', () => {
  const child = data();
  const value = { left: child, right: child };
  const cold = observe(freezeContentSteps(value));
  expect(cold.pauses).toBeGreaterThan(0);
  expect(observe(freezeContentSteps(value))).toEqual(cold);
  const fresh = { left: data(), right: data() };
  freezeContent(fresh.left);
  expect(observe(freezeContentSteps(fresh))).toEqual(cold);
  expect(Object.isFrozen(value.left[0]!.values[1])).toBe(true);
});
