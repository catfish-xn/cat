import { afterEach, expect, it, vi } from 'vitest';
import { advanceAugmentPreparationTime } from '../src/simulation/augment-history';
import * as matchCommands from '../src/simulation/match';
import { createMatch, nextRound, resolveAugmentTier, sellUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { accepted, fieldBench, reachRound, resolveM5Choices } from './match-helpers';

// The shared replay cache keeps eight short proofs. A longer same-origin save
// then lives only in the single oversized slot, and the two fork slots keep the
// newest linear extensions. A sibling that diverges at the oversized branch
// used to miss that branch and replay the whole combat. This case fills the
// eight slots itself, so the result does not depend on which file ran first.
const releaseOffers = { current: undefined as (() => void) | undefined };
afterEach(() => releaseOffers.current?.());

function silverSeeds(count: number): number[] {
  const seeds: number[] = [];
  for (let seed = 0; seeds.length < count && seed < 500; seed++) {
    if (resolveAugmentTier(createMatch(seed), 'round:2-1:augment') === 'silver') seeds.push(seed);
  }
  expect(seeds.length).toBe(count);
  return seeds;
}

it('resumes a crowded sibling from the displaced branch instead of replaying combat', () => {
  const seeds = silverSeeds(8);
  releaseOffers.current = installB1Offers(['over-encumbered']);
  const acquired = seeds.map(seed => {
    let state = reachRound('2-1', false, seed);
    const choice = state.pendingChoice!;
    expect(choice.offers).toContain('over-encumbered');
    state = accepted(matchCommands.selectChoice(state, choice.choiceId, choice.generation, 'over-encumbered'));
    expect(state.augmentHistory).toBeTruthy();
    return state;
  });
  // Seven other origins occupy the shared budget, and this origin's short
  // acquire proof takes the eighth slot.
  for (const state of acquired.slice(0, 7)) expect(restoreMatch(state)).toEqual(state);
  const branchRoot = acquired[7];
  expect(restoreMatch(branchRoot)).toEqual(branchRoot);

  let fought = fieldBench(branchRoot);
  const started = startMatchCombat(fought);
  expect(started.ok).toBe(true);
  if (!started.ok) throw new Error(started.reason);
  fought = started.state;
  let ticks = 0;
  while (fought.phase === 'combat') { fought = stepMatch(fought).state; ticks++; }
  expect(ticks).toBeGreaterThan(10);
  fought = resolveM5Choices(fought);
  const branch = accepted(nextRound(fought, fought.round));
  expect(restoreMatch(branch)).toEqual(branch);

  let extended = branch;
  for (const elapsedMs of [1000, 2000, 3000]) {
    extended = advanceAugmentPreparationTime(extended, elapsedMs);
    expect(restoreMatch(extended)).toEqual(extended);
  }

  const unit = branch.preparation.units.find(candidate => candidate.team === 'player');
  expect(unit).toBeTruthy();
  const sibling = accepted(sellUnit(branch, unit!.id));
  const spy = vi.spyOn(matchCommands, 'stepMatch');
  const before = spy.mock.calls.length;
  try {
    expect(restoreMatch(sibling)).toEqual(sibling);
    // The displaced 2-1 branch is the combat prefix. Replaying it calls stepMatch
    // once per tick (the old eviction did). Resuming at the branch calls none.
    expect(spy.mock.calls.length - before).toBe(0);
    const forged = { ...structuredClone(sibling), playerHp: sibling.playerHp + 1 };
    expect(() => restoreMatch(forged)).toThrow();
  } finally { spy.mockRestore(); }
});
