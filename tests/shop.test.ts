import { describe, expect, it } from 'vitest';
import { MATCH_RULES, SHOP_CATALOG, SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { generateShop } from '../src/simulation/shop';
import { UNIT_DEFINITIONS } from '../src/simulation/units';

const MODULUS = 4294967296n;
// Deliberately independent copies: this oracle never calls production RNG/odds/catalog helpers.
const CATALOG = [['darius', 'irelia', 'lux', 'maddie', 'zyra'], ['leona', 'rell', 'tristana', 'urgot', 'vander'], ['ezreal', 'kogmaw', 'loris', 'nami', 'scar'], ['corki', 'garen', 'zoe'], ['caitlyn']];
const ODDS = [[100, 0, 0, 0, 0], [100, 0, 0, 0, 0], [75, 25, 0, 0, 0], [55, 30, 15, 0, 0],
  [45, 33, 20, 2, 0], [30, 40, 25, 5, 0], [19, 30, 40, 10, 1], [18, 25, 32, 22, 3], [15, 20, 25, 30, 10]];
const word = (seed: bigint) => (seed * 1664525n + 1013904223n) % MODULUS;
const predecessor = (value: bigint) => ((value - 1013904223n) * 4276115653n % MODULUS + MODULUS) % MODULUS;
const available = (names: readonly string[]) => names.map(definitionId => ({ status: 'available', definitionId }));
function oracle(seed: number, generation: number, level: number) {
  let state = BigInt(seed);
  const names: string[] = [];
  for (let slot = 0; slot < 5; slot++) {
    state = word(state);
    const percentile = Number(state * 100n / MODULUS);
    let total = 0;
    const tier = ODDS[level - 1].findIndex(chance => { total += chance; return percentile < total; });
    state = word(state);
    names.push(CATALOG[tier][Number(state * BigInt(CATALOG[tier].length) / MODULUS)]);
  }
  return { shop: { generation, locked: false, slots: available(names) }, rngState: Number(state) };
}

describe('versioned level-dependent deterministic shop', () => {
  it('fixes five slots and the ordered nineteen-definition catalog', () => {
    expect(MATCH_RULES.shopSize).toBe(5);
    expect(SHOP_CATALOG).toEqual(CATALOG.flat());
    expect(Object.values(SHOP_CATALOG_BY_COST)).toEqual(CATALOG);
    for (const [tier, names] of CATALOG.entries()) {
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) expect(UNIT_DEFINITIONS[name].cost).toBe(tier + 1);
    }
  });

  it('locks the seed42 level3 golden sequence and consumes exactly ten words per generation', () => {
    const expected = [
      { names: ['darius', 'irelia', 'darius', 'darius', 'vander'], rngState: 4271921684 },
      { names: ['tristana', 'zyra', 'darius', 'zyra', 'vander'], rngState: 3820240078 },
      { names: ['darius', 'irelia', 'vander', 'zyra', 'darius'], rngState: 260725464 },
    ];
    let seed = 42;
    for (const [index, fixture] of expected.entries()) {
      const generated = generateShop(seed, index + 1, 3);
      expect(generated).toEqual({ shop: { generation: index + 1, locked: false, slots: available(fixture.names) }, rngState: fixture.rngState });
      let independent = BigInt(seed);
      for (let draw = 0; draw < 10; draw++) independent = word(independent);
      expect(generated.rngState).toBe(Number(independent));
      seed = generated.rngState;
    }
  });

  it.each([0, 42, 2147483648, 4294967295])('matches an independent BigInt oracle at every level from seed %s', seed => {
    for (let level = 1; level <= 9; level++) {
      let current = seed;
      for (let generation = 1; generation <= 4; generation++) {
        const actual = generateShop(current, generation, level);
        expect(actual).toEqual(oracle(current, generation, level));
        current = actual.rngState;
      }
    }
  });

  it('maps both sides of every cumulative tier threshold and skips zero-probability tiers', () => {
    for (let level = 1; level <= 9; level++) {
      let cumulative = 0;
      for (const [tier, chance] of ODDS[level - 1].entries()) {
        if (chance === 0) continue;
        const startWord = (BigInt(cumulative) * MODULUS + 99n) / 100n;
        cumulative += chance;
        const lastWord = (BigInt(cumulative) * MODULUS + 99n) / 100n - 1n;
        for (const chosenWord of [startWord, lastWord]) {
          const seed = Number(predecessor(chosenWord));
          const first = generateShop(seed, 1, level).shop.slots[0];
          expect(first.status).toBe('available');
          if (first.status === 'available') expect(UNIT_DEFINITIONS[first.definitionId].cost).toBe(tier + 1);
        }
      }
    }
  });

  it('maps exact second-draw catalog thresholds independently from the first cost draw', () => {
    const boundaries = [0n, 858993459n, 858993460n, 1717986918n, 1717986919n, 2576980377n, 2576980378n, 3435973836n, 3435973837n, MODULUS - 1n];
    const expected = ['darius', 'darius', 'irelia', 'irelia', 'lux', 'lux', 'maddie', 'maddie', 'zyra', 'zyra'];
    for (const [index, chosenWord] of boundaries.entries()) {
      const seed = Number(predecessor(predecessor(chosenWord)));
      expect(generateShop(seed, 1, 1).shop.slots[0]).toEqual({ status: 'available', definitionId: expected[index] });
    }
  });

  it('allows duplicate cards and identical consecutive shops without extra sampling', () => {
    expect(generateShop(100, 1, 1)).toEqual({ shop: { generation: 1, locked: false, slots: available(['irelia', 'irelia', 'irelia', 'irelia', 'irelia']) }, rngState: 1402937758 });
    const first = generateShop(8959, 1, 1), second = generateShop(first.rngState, 2, 1);
    expect(first.shop.slots).toEqual(available(['zyra', 'irelia', 'irelia', 'lux', 'irelia']));
    expect(second.shop.slots).toEqual(first.shop.slots);
    expect(first.rngState).toBe(1128937553);
    expect(second.rngState).toBe(1345267635);
    expect(second.shop.generation).toBe(2);
  });

  it('changes offers by level while keeping identical RNG consumption and generation metadata independent', () => {
    const low = generateShop(42, 1, 3), high = generateShop(42, 1, 9);
    expect(high.shop.slots).toEqual(available(['leona', 'kogmaw', 'ezreal', 'ezreal', 'zoe']));
    expect(high.shop.slots).not.toEqual(low.shop.slots);
    expect(high.rngState).toBe(low.rngState);
    expect(generateShop(42, 500, 3)).toEqual({ ...low, shop: { ...low.shop, generation: 500 } });
  });

  it('resumes from JSON with no hidden random state and never mutates previous shops', () => {
    const first = generateShop(42, 1, 3);
    for (const slot of first.shop.slots) Object.freeze(slot);
    Object.freeze(first.shop.slots); Object.freeze(first.shop); Object.freeze(first);
    const serialized = JSON.stringify(first), second = generateShop(first.rngState, 2, 4);
    generateShop(0, 250, 9);
    expect(generateShop(42, 1, 3)).toEqual(first);
    expect(generateShop(JSON.parse(serialized).rngState, 2, 4)).toEqual(second);
    expect(JSON.stringify(first)).toBe(serialized);
  });

  it.each([0, -1, 10, 3.5, NaN, Infinity])('rejects invalid level %s instead of falling back or resampling', level => {
    expect(() => generateShop(42, 1, level)).toThrow(RangeError);
  });
  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid shop generation %s', generation => {
    expect(() => generateShop(42, generation, 3)).toThrow(RangeError);
  });
});
