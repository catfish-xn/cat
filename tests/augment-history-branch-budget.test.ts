import { afterAll, expect, it, vi } from 'vitest';
import { canonicalContent } from '../src/simulation/content';
import { DISPLACED_BRANCH_BYTE_CAP, admitDisplacedBranch, displacedBranchRetention, releaseDisplacedBranches } from '../src/simulation/augment-history-restore';
import * as matchCommands from '../src/simulation/match';
import { createMatch, resolveAugmentTier, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { accepted, fieldBench, reachRound } from './match-helpers';

const MB = 1024 * 1024;
const PREFIX = '\u0000branch-budget:';
afterAll(() => releaseDisplacedBranches(PREFIX));

function checkpoint(origin: string, steps: number, bytes: number, frozenBytes: number) {
  return { origin, commands: [{ name: 'stepMatch', args: '[]', count: steps }] as const, bytes, frozenBytes };
}

// d1164309 rejects an exact command boundary when the fact list has the same
// length but different content, and does not replay that combat. A legal save
// with the same origin, the same boundary, and the same fact length and content
// still has to hit that cached entry and restore.
it('restores a legal save from the exact cached command boundary', () => {
  let seed = -1;
  for (let candidate = 0; seed < 0 && candidate < 500; candidate++) {
    if (resolveAugmentTier(createMatch(candidate), 'round:2-1:augment') === 'silver') seed = candidate;
  }
  expect(seed).toBeGreaterThanOrEqual(0);
  const releaseOffers = installB1Offers(['over-encumbered']);
  try {
    let state = reachRound('2-1', false, seed);
    const choice = state.pendingChoice!;
    expect(choice.offers).toContain('over-encumbered');
    state = accepted(selectChoice(state, choice.choiceId, choice.generation, 'over-encumbered'));
    state = accepted(startMatchCombat(fieldBench(state)));
    state = stepMatch(state).state;
    const history = state.augmentHistory;
    expect(history?.proof.kind).toBe('solo');
    if (history?.proof.kind !== 'solo') throw new Error('expected a solo proof');
    expect(history.facts.length).toBeGreaterThan(0);
    expect(history.proof.commands.some(command => command.name === 'stepMatch' && command.count >= 1)).toBe(true);
    expect(restoreMatch(state)).toEqual(state);
    const text = serializeMatch(state);
    const parsed = JSON.parse(text) as typeof state;
    const parsedHistory = parsed.augmentHistory;
    expect(parsedHistory?.proof.kind).toBe('solo');
    if (parsedHistory?.proof.kind !== 'solo') throw new Error('expected a solo proof');
    expect(parsedHistory.facts.length).toBe(history.facts.length);
    expect(canonicalContent(parsedHistory.facts)).toBe(canonicalContent(history.facts));
    expect(canonicalContent(parsedHistory.proof.origin)).toBe(canonicalContent(history.proof.origin));
    expect(canonicalContent(parsedHistory.proof.commands)).toBe(canonicalContent(history.proof.commands));
    const spy = vi.spyOn(matchCommands, 'stepMatch');
    const before = spy.mock.calls.length;
    try {
      expect(restoreMatch(text)).toEqual(state);
      expect(spy.mock.calls.length - before).toBe(0);
    } finally { spy.mockRestore(); }
  } finally { releaseOffers(); }
});

it('caps anchor and fork slots at 64MB and evicts the oldest billed checkpoints', () => {
  expect(DISPLACED_BRANCH_BYTE_CAP).toBe(64 * MB);
  const before = displacedBranchRetention();
  expect(admitDisplacedBranch('anchor', checkpoint(`${PREFIX}huge-bytes`, 1, DISPLACED_BRANCH_BYTE_CAP + 1, 0))).toBe(false);
  expect(admitDisplacedBranch('fork', checkpoint(`${PREFIX}huge-frozen`, 1, 40 * MB, 30 * MB))).toBe(false);
  expect(displacedBranchRetention()).toEqual(before);

  const admitted = [
    ['anchor', `${PREFIX}a0`, 1],
    ['anchor', `${PREFIX}a1`, 2],
    ['fork', `${PREFIX}f0`, 3],
    ['anchor', `${PREFIX}a2`, 4],
    ['fork', `${PREFIX}f1`, 5],
  ] as const;
  for (const [slot, origin, steps] of admitted) {
    expect(admitDisplacedBranch(slot, checkpoint(origin, steps, 18 * MB, 0))).toBe(true);
  }
  const capped = displacedBranchRetention();
  expect(capped.bytes).toBeLessThanOrEqual(DISPLACED_BRANCH_BYTE_CAP);
  expect(capped.bytes).toBe(54 * MB);
  expect(capped.entries.map(entry => [entry.origin, entry.steps])).toEqual([
    [`${PREFIX}f0`, 3],
    [`${PREFIX}a2`, 4],
    [`${PREFIX}f1`, 5],
  ]);

  releaseDisplacedBranches(PREFIX);
  expect(displacedBranchRetention().bytes).toBe(0);
  const origin = `${PREFIX}frozen`;
  expect(admitDisplacedBranch('anchor', checkpoint(origin, 1, 20 * MB, 20 * MB))).toBe(true);
  expect(admitDisplacedBranch('fork', checkpoint(origin, 2, 20 * MB, 20 * MB))).toBe(true);
  const shared = displacedBranchRetention();
  expect(shared.bytes).toBeLessThanOrEqual(DISPLACED_BRANCH_BYTE_CAP);
  expect(shared.bytes).toBe(60 * MB);
  expect(shared.entries).toEqual([
    { origin, steps: 1, bytes: 20 * MB, frozenBytes: 20 * MB },
    { origin, steps: 2, bytes: 20 * MB, frozenBytes: 20 * MB },
  ]);
  releaseDisplacedBranches(PREFIX);
});
