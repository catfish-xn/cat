import { describe, expect, it } from 'vitest';
import { MATCH_RULES, SHOP_CATALOG } from '../src/simulation/match-rules';
import { generateShop } from '../src/simulation/shop';

// Reference shops use exact integer word * 3 / 2**32 arithmetic, not this module's
// floating-point sampling expression. Each rngState is the fifth generated word.
const SEED_42_SHOPS = [
  { names: ['sentinel', 'sentinel', 'ranger', 'sentinel', 'ranger'], rngState: 1613448261 },
  { names: ['sentinel', 'ranger', 'sentinel', 'mystic', 'mystic'], rngState: 4271921684 },
  { names: ['mystic', 'ranger', 'ranger', 'mystic', 'ranger'], rngState: 2561818183 },
  { names: ['sentinel', 'sentinel', 'mystic', 'mystic', 'mystic'], rngState: 3820240078 },
] as const;

const available = (names: readonly string[]) => names.map(definitionId => ({ status: 'available', definitionId }));

describe('deterministic five-slot shop generation', () => {
  it('fixes the three-definition catalog order and five-slot size', () => {
    expect(SHOP_CATALOG).toEqual(['sentinel', 'ranger', 'mystic']);
    expect(MATCH_RULES.shopSize).toBe(5);
  });

  it('generates the known four-shop sequence, consuming exactly five words per shop', () => {
    let rngState = 42;
    for (const [index, expected] of SEED_42_SHOPS.entries()) {
      const generated = generateShop(rngState, index + 1);
      expect(generated).toEqual({
        shop: { generation: index + 1, slots: available(expected.names) },
        rngState: expected.rngState,
      });
      rngState = generated.rngState;
    }
  });

  it.each([
    { seed: 0, names: ['sentinel', 'sentinel', 'mystic', 'mystic', 'ranger'], rngState: 1649599747 },
    { seed: 4294967295, names: ['sentinel', 'sentinel', 'sentinel', 'ranger', 'mystic'], rngState: 3082116262 },
  ])('supports the uint32 boundary seed $seed', ({ seed, names, rngState }) => {
    expect(generateShop(seed, 1)).toEqual({ shop: { generation: 1, slots: available(names) }, rngState });
  });

  // Seeds are precomputed inverses of the LCG step for words at each catalog
  // threshold, including 0 and 2**32 - 1. This catches signed or off-by-one mapping.
  it.each([
    { seed: 634785765, name: 'sentinel' }, // word 0
    { seed: 641069646, name: 'sentinel' }, // word 1431655765
    { seed: 622218003, name: 'ranger' },   // word 1431655766
    { seed: 647353527, name: 'ranger' },   // word 2863311530
    { seed: 628501884, name: 'mystic' },   // word 2863311531
    { seed: 653637408, name: 'mystic' },   // word 4294967295
  ])('maps the threshold word from seed $seed to $name', ({ seed, name }) => {
    expect(generateShop(seed, 1).shop.slots[0]).toEqual({ status: 'available', definitionId: name });
  });

  it('allows all five slots to offer the same definition without extra sampling', () => {
    expect(generateShop(1649599747, 2)).toEqual({
      shop: { generation: 2, slots: available(['ranger', 'ranger', 'ranger', 'ranger', 'ranger']) },
      rngState: 2498801434,
    });
  });

  it('allows identical consecutive shops while advancing the RNG by five words', () => {
    const first = generateShop(161, 1);
    const second = generateShop(first.rngState, 2);
    expect(first.shop.slots).toEqual(available(['sentinel', 'mystic', 'sentinel', 'ranger', 'mystic']));
    expect(second.shop.slots).toEqual(first.shop.slots);
    expect(first.rngState).toBe(2942674816);
    expect(second.rngState).toBe(3569139331);
    expect(second.shop.generation).toBe(2);
  });

  it('does not mutate previous output or keep RNG state outside its arguments', () => {
    const first = generateShop(42, 1);
    for (const slot of first.shop.slots) Object.freeze(slot);
    Object.freeze(first.shop.slots);
    Object.freeze(first.shop);
    Object.freeze(first);
    const before = JSON.stringify(first);

    const second = generateShop(first.rngState, 2);
    generateShop(0, 500);
    expect(generateShop(42, 1)).toEqual(first);
    expect(generateShop(JSON.parse(before).rngState, 2)).toEqual(second);
    expect(JSON.stringify(first)).toBe(before);
  });

  it('treats generation as metadata and never mixes it into the RNG stream', () => {
    const original = generateShop(42, 1);
    const later = generateShop(42, 20);
    expect(later).toEqual({ ...original, shop: { ...original.shop, generation: 20 } });
  });
});
