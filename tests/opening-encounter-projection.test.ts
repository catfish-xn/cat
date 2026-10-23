import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from '../src/simulation/match';
import { OPENING_ENCOUNTERS, createOpeningEncounter, openingEncounterId, readOpeningEncounterView,
  readOpeningMelProgress, readOpeningForgeProgress, pendingOpeningForges, validateOpeningEncounterState,
  type OpeningEncounterReadState } from '../src/simulation/opening-encounter';
import { openingRewardAtoms, openingRewardOrbs, subscriptionReceipts } from '../src/simulation/opening-batch-rewards';
import { createSharedPool, initializeSharedSeat } from '../src/simulation/shared-pool';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { readLootView } from '../src/simulation/loot-view';
import { toDisplayMatch } from '../src/rendering/online/seat-view-adapter';

const seeds = new Map<string, number>();
for (let seed = 0; seeds.size < OPENING_ENCOUNTERS.length && seed < 20000; seed++) {
  const id = createOpeningEncounter(seed).selection.encounterId;
  if (!seeds.has(id)) seeds.set(id, seed);
}
function sharedSeat(seed: number): MatchState {
  const pool = createSharedPool('projection-regression', seed);
  const result = initializeSharedSeat(pool, createMatch(100, {mode: 'shared-deferred'}), 'seat-0', 0);
  if (!result.ok) throw Error(result.reason);
  return result.state;
}
function assertNoDerivedRewards(state: MatchState) {
  expect(subscriptionReceipts(state)).toEqual([]);
  expect(openingRewardAtoms(state)).toEqual([]);
  expect(openingRewardOrbs(state)).toEqual([]);
  expect(pendingOpeningForges(state)).toEqual([]);
  expect(readOpeningMelProgress(state)).toBeNull();
  expect(readOpeningForgeProgress(state)).toBeNull();
}

describe('opening readers accept authority and client projections without inventing authority data', () => {
  it.each(OPENING_ENCOUNTERS.map(entry => entry.id))('%s: solo/shared identity survives private, public and display views', id => {
    const seed = seeds.get(id)!;
    for (const state of [createMatch(seed), sharedSeat(seed)]) {
      const before = JSON.stringify(state);
      const publicView = readOpeningEncounterView(state)!;
      expect(publicView.encounterId).toBe(id);
      expect(openingEncounterId(state)).toBe(id);
      const privateView = JSON.parse(JSON.stringify(toPrivateSeatView(state))) as ReturnType<typeof toPrivateSeatView>;
      expect(readOpeningEncounterView(privateView)).toEqual(publicView);
      expect(openingEncounterId(privateView)).toBe(id);
      expect(readOpeningMelProgress(privateView)).toBeNull();
      expect(readOpeningEncounterView({openingEncounter: publicView})).toEqual(publicView);
      const display = toDisplayMatch(privateView);
      expect(readOpeningEncounterView(display)).toEqual(publicView);
      expect(openingEncounterId(display)).toBe(id);
      assertNoDerivedRewards(display);
      // This is the board's loot-reader path that previously reached o.selection.encounterId.
      expect(() => readLootView(display)).not.toThrow();
      expect(JSON.stringify(state)).toBe(before);
      expect(publicView).not.toHaveProperty('selection');
      expect(publicView).not.toHaveProperty('receipts');
      expect(publicView).not.toHaveProperty('seed');
    }
  });

  it('deferred, absent and incomplete display data return unavailable identity/progress', () => {
    const base = createMatch(42, {mode: 'shared-deferred'});
    const inputs: OpeningEncounterReadState[] = [base, {}, {openingEncounter: null},
      // Runtime client data can be incomplete despite the authoritative MatchState type.
      {openingEncounter: {mode: 'shared'} as MatchState['openingEncounter']},
      {openingEncounter: {mode: 'solo'} as MatchState['openingEncounter']},
      {openingEncounter: {mode: 'solo', context: {}} as MatchState['openingEncounter']}];
    for (const input of inputs) {
      expect(openingEncounterId(input)).toBeNull();
      expect(readOpeningEncounterView(input)).toBeNull();
      const display = {...base, openingEncounter: input.openingEncounter} as MatchState;
      assertNoDerivedRewards(display);
      expect(() => readLootView(display)).not.toThrow();
    }
    expect(readOpeningEncounterView(toPrivateSeatView(base))).toBeNull();
    // Tolerant reads do not relax authority validation or fill missing selection from the seed.
    for (const input of inputs.slice(1)) {
      expect(() => validateOpeningEncounterState({...base, openingEncounter: input.openingEncounter} as MatchState)).toThrow();
    }
  });

  it('preserves only already revealed monkey outcomes when reading a public projection', () => {
    const state = createMatch(seeds.get('wind-up-monkey')!);
    const view = {...readOpeningEncounterView(state)!, revealedFacts: [{nodeId: '3-5', outcome: 'gold' as const}]};
    const input = {openingEncounter: {...view, seed: 123, receipts: [{secret: true}]}};
    const before = JSON.stringify(input);
    expect(readOpeningEncounterView(input)).toEqual(view);
    expect(JSON.stringify(input)).toBe(before);
    const {revealedFacts: _facts, ...unrevealed} = input.openingEncounter;
    expect(readOpeningEncounterView({openingEncounter: unrevealed})?.revealedFacts).toEqual([]);
  });
});
