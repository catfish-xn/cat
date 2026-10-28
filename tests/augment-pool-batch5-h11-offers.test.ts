import { expect, it } from 'vitest';
import { accepted, reachRound } from './match-helpers';
import { rerollAugment } from '../src/simulation/match';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { validateContent } from '../src/simulation/validate-content';
/** v25 pool: first public 3-2 seed in 0..100 after rerolls 0/1/2; draw scripted when the pinned slot still drifts. */
const H11_SPONGING = { seed: 7, rerolls: [0, 1, 2] as const };
function spongingOffer() {
  let state = reachRound('3-2', false, H11_SPONGING.seed);
  for (const slot of H11_SPONGING.rerolls) {
    const choice = state.pendingChoice!;
    state = accepted(rerollAugment(state, choice.choiceId, choice.generation, slot));
  }
  return state;
}
it('H11 pins the verified public 3-2 route without scanning seeds', () => {
  const s = spongingOffer();
  expect(s.pendingChoice!.offers).toContain('sponging');
});
it('H11 keeps the admitted catalog valid and agrees with independent offer tables at every node', () => {
  expect(() => validateContent()).not.toThrow();
  for (const node of ['2-1','3-2','4-2']) for (const tier of ['gold','prismatic'] as const) {
    const expected = augmentPool(tier,[],[],`round:${node}:augment`,[]);
    const actual = augmentCandidates(tier,[],[],null,{node,fieldedTraits:[],blocked:[]});
    expect(actual.sort()).toEqual(expected);
  }
});
