import { describe, expect, it } from 'vitest';
import { nextRandom, validateSeed } from '../src/simulation/rng';

// Fixed lcg32-v1 reference values computed with exact integer modular arithmetic,
// independently of the JavaScript implementation and its Math.imul conversion.
const VECTORS = [
  { seed: 0, words: [1013904223, 1196435762, 3519870697, 2868466484, 1649599747] },
  { seed: 42, words: [1083814273, 378494188, 2479403867, 955863294, 1613448261] },
  { seed: 2147483648, words: [3161387871, 3343919410, 1372387049, 720982836, 3797083395] },
  { seed: 4294967295, words: [1012239698, 806866057, 579071060, 2709482403, 3082116262] },
] as const;

describe('lcg32-v1 seeded RNG', () => {
  it.each(VECTORS)('matches the independent vector for seed $seed', ({ seed, words }) => {
    let state: number = seed;
    for (const word of words) {
      const next = nextRandom(state);
      expect(next).toEqual({ word, state: word });
      state = next.state;
    }
  });

  it.each([0, 1, 42, 2147483648, 4294967295])('accepts uint32 seed %s', seed => {
    expect(() => validateSeed(seed)).not.toThrow();
  });

  it.each([-1, -4294967296, 0.5, 42.25, 4294967296, Number.MAX_SAFE_INTEGER, NaN, Infinity, -Infinity])(
    'rejects invalid seed %s without normalizing it', seed => {
      expect(() => validateSeed(seed)).toThrow(RangeError);
    },
  );

  it('branches and resumes using only the explicitly returned state', () => {
    const checkpoint = Object.freeze(nextRandom(42));
    const before = JSON.stringify(checkpoint);
    const expected = { word: 378494188, state: 378494188 };

    expect(nextRandom(checkpoint.state)).toEqual(expected);
    nextRandom(0);
    nextRandom(4294967295);
    expect(nextRandom(checkpoint.state)).toEqual(expected);
    expect(nextRandom(JSON.parse(before).state)).toEqual(expected);
    expect(JSON.stringify(checkpoint)).toBe(before);
  });
});
