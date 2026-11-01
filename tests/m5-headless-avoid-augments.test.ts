import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { AUGMENT_HISTORY_OWNERS } from '../src/simulation/augment-history-owners';

const { chooseAugmentOffer } = createRequire(import.meta.url)('../scripts/generate-m5-route.cjs');
const avoid = Object.keys(AUGMENT_HISTORY_OWNERS);
const order = ['pumping-up-ii', 'built-different'];
const fresh = [false, false, false];
const spent = [true, true, true];

it('keeps the historical first-priority pick when nothing is avoided', () => {
  expect(chooseAugmentOffer(['snipers-nest', 'pumping-up-ii'], order, [], fresh)).toEqual({ id: 'pumping-up-ii', reroll: false });
  expect(chooseAugmentOffer(['snipers-nest', 'reunion'], order, [], spent)).toEqual({ id: 'snipers-nest', reroll: false });
});

it('replaces a history owner with another offered card before spending a reroll', () => {
  expect(avoid).toEqual(expect.arrayContaining(['snipers-nest', 'rebel-resurgence', 'over-encumbered']));
  expect(chooseAugmentOffer(['snipers-nest', 'reunion', 'overheal'], order, avoid, fresh)).toEqual({ id: 'reunion', reroll: false });
  expect(chooseAugmentOffer(['snipers-nest', 'built-different', 'reunion'], order, avoid, fresh)).toEqual({ id: 'built-different', reroll: false });
});

it('rerolls one unused slot only when every offer is a history owner', () => {
  expect(chooseAugmentOffer(['snipers-nest', 'rebel-resurgence', 'over-encumbered'], order, avoid, [true, false, true])).toEqual({ id: null, reroll: true });
  expect(chooseAugmentOffer(['snipers-nest', 'rebel-resurgence', 'over-encumbered'], order, avoid, spent)).toEqual({ id: 'snipers-nest', reroll: false });
});
