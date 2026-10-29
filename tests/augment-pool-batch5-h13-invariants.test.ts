import { expect, it } from 'vitest';
import { firstNodeSeed } from './augment-stage-helpers';
import { reachRound } from './match-helpers';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_BATCH5_H13 } from '../src/simulation/content/augment-pool-batch5-h13';
import { validateContent } from '../src/simulation/validate-content';

it('H13 registers exactly the three requested augments and keeps a bounded real Pandora offer route', () => {
  expect(Object.keys(AUGMENT_BATCH5_H13).sort()).toEqual(['artifactory', 'pandoras-items-iii', 'salvage-bin-plus']);
  for (const id of Object.keys(AUGMENT_BATCH5_H13)) expect(AUGMENT_DEFINITIONS[id].id).toBe(id);
  const seed = firstNodeSeed('pandoras-items-iii', 10000);
  expect(reachRound('2-1', false, seed).pendingChoice!.offers).toContain('pandoras-items-iii');
  expect(() => validateContent()).not.toThrow();
});
