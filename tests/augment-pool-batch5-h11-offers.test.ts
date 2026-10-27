import { expect, it } from 'vitest';
import { offerFor } from './augment-stage-helpers';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { validateContent } from '../src/simulation/validate-content';
it('H11 pins the verified public 3-2 route without scanning seeds', () => {
  const s = offerFor('sponging');
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
