import { expect, it } from 'vitest';
import { createMatch, rerollAugment, selectChoice, nextRound, startMatchCombat } from '../src/simulation/match';
import { augmentCandidates, augmentRerollLimit, deriveAugmentTier } from '../src/simulation/augment-offers';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { nextRandom } from '../src/simulation/rng';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, reachRound, resolveM5Choices, freeze } from './match-helpers';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { openingEncounter } from './fixtures/m5/oracle.g2.cjs';

it('single-player nodes choose a deterministic shared tier without consuming choice-stream words', () => {
  const seen = new Set<string>();
  // v23 fmix32 openings: tier-overriding openings (Golden Gala, Prismatic *) and Trainer Golems (unbenchable,
  // blocks reachRound's empty board) are skipped; nine ordinary-opening seeds are still checked.
  const skipped = ['golden-gala','prismatic-party','prismatic-prelude','prismatic-finale','trainer-golems'];
  const seeds = Array.from({length:60},(_,i)=>i).filter(seed=>!skipped.includes(openingEncounter(seed))).slice(0,9);
  expect(seeds).toHaveLength(9);
  for (const seed of seeds) {
    const state = reachRound('2-1', false, seed), c = state.pendingChoice!;
    const tier = deriveAugmentTier(seed, c.choiceId); seen.add(tier);
    expect(c.augmentTier).toBe(tier);
    expect(c.offers).toHaveLength(3);
    expect(c.offers.every(id => AUGMENT_TIERS[id] === tier)).toBe(true);
    let rng = (seed ^ 0x9e3779b9) >>> 0;
    for (let word = 0; word < 3; word++) rng = nextRandom(rng).state;
    expect(state.choiceRngState).toBe(rng);
    expect(state.augmentOffers).toEqual([{choiceId:c.choiceId,tier,rerollCount:0,rerolledIndices:[],fieldedTraits:[],externalBlocks:[[]]}]);
    expect(state.removedAugmentIds).toEqual(c.offers); // v22: shown once, never offered again
    expect(c.rerollsRemaining).toBe(3);
    expect(c.rerolledSlots).toEqual([false,false,false]);
  }
  expect(seen.size).toBe(3);
});

it('free reroll replaces one card, locks tier, consumes one word and exhausts that slot once', () => {
  const before = freeze(reachRound('2-1', false)), c = before.pendingChoice!;
  const result = rerollAugment(before, c.choiceId, c.generation, 1);
  const after = accepted(result), next = after.pendingChoice!;
  expect(next.offers[0]).toBe(c.offers[0]); expect(next.offers[2]).toBe(c.offers[2]);
  expect(c.offers).not.toContain(next.offers[1]);
  expect(next.offers.every(id => AUGMENT_TIERS[id] === c.augmentTier)).toBe(true);
  expect(next).toMatchObject({augmentTier:c.augmentTier,generation:1,rerollCount:1,rerollsRemaining:2,rerolledSlots:[false,true,false]});
  expect(after.removedAugmentIds).toEqual([...c.offers,next.offers[1]]); // v22: every shown card
  expect(after.gold).toBe(before.gold);
  const rng = nextRandom(before.choiceRngState).state;
  expect(after.choiceRngState).toBe(rng);
  expect(result.ok && result.events).toMatchObject([{type:'choiceOpened',choice:next}]);
  const exhausted = rerollAugment(after, next.choiceId, 1, 1);
  expect(exhausted).toEqual({ok:false,state:after,reason:'augment-rerolls-exhausted'});
  expect(exhausted.state).toBe(after); expect('events' in exhausted).toBe(false);
  expect(toPrivateSeatView(after).pendingChoice).toMatchObject({augmentTier:next.augmentTier,rerollsRemaining:2,
    augmentOptions:next.offers.map((definitionId,optionIndex)=>({definitionId,optionIndex,rerollAvailable:optionIndex!==1}))});
});

it('wrong phase, wrong node and stale generation fail with original state, no events and no RNG use', () => {
  const states = [createMatch(42), reachRound('2-1', false)];
  for (const [state,id,generation,reason] of [
    [states[0], 'none', 0, 'wrong-phase'],
    [states[1], 'wrong', 0, 'stale-choice'],
    [states[1], states[1].pendingChoice!.choiceId, 99, 'stale-choice'],
  ] as const) {
    freeze(state); const snapshot = JSON.stringify(state);
    const result = rerollAugment(state,id,generation,0);
    expect(result).toEqual({ok:false,state,reason});
    expect(result.state).toBe(state); expect('events' in result).toBe(false);
    expect(JSON.stringify(state)).toBe(snapshot);
  }
});

it('the next node resets its free allowance and its generation after an earlier reroll', () => {
  let state = reachRound('2-1', false), c = state.pendingChoice!;
  state = accepted(rerollAugment(state,c.choiceId,0,0));
  const removed = [...state.removedAugmentIds];
  state = restoreMatch(serializeMatch(state));
  state = resolveM5Choices(state);
  while (state.roundDefinitionId !== '3-2') {
    state = resolveM5Choices(state);
    if (state.phase === 'preparation') state = accepted(startMatchCombat(emptyBoard(state)));
    state = resolveM5Choices(state);
    state = accepted(nextRound(state,state.round));
  }
  c = state.pendingChoice!;
  expect(c).toMatchObject({kind:'augment',rerollCount:0,rerollsRemaining:3,generation:0,rerolledSlots:[false,false,false]});
  expect(c.offers.every(id => AUGMENT_TIERS[id] === c.augmentTier)).toBe(true);
  expect(c.offers.every(id => !removed.includes(id))).toBe(true);
  expect(state.removedAugmentIds).toEqual([...removed, ...c.offers]);
  expect(state.augmentOffers.map(r => r.rerollCount)).toEqual([1,0]);
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
});

it('restores rerolled offers and rejects forged tier, candidates, counters, seed and history', () => {
  const initial = reachRound('2-1',false), c = initial.pendingChoice!;
  const state = accepted(rerollAugment(initial,c.choiceId,0,0));
  const serialized = serializeMatch(state);
  expect(restoreMatch(serialized)).toEqual(state);
  expect(restoreMatch(JSON.parse(serialized))).toEqual(state);
  const mutate = (change: (value: any) => void) => {
    const value = JSON.parse(serialized); change(value); expect(() => restoreMatch(value)).toThrow();
  };
  mutate(s => { s.pendingChoice.augmentTier = s.pendingChoice.augmentTier === 'gold' ? 'silver' : 'gold'; });
  mutate(s => { s.pendingChoice.offers[0] = augmentCandidates(s.pendingChoice.augmentTier,[],s.pendingChoice.offers)[0]; });
  mutate(s => { s.pendingChoice.rerollCount = 0; });
  mutate(s => { s.pendingChoice.rerollsRemaining = 1; });
  mutate(s => { s.pendingChoice.generation = 2; });
  mutate(s => { s.augmentTierSeed ^= 1; });
  mutate(s => { s.augmentOffers[0].rerollCount = 0; });
  mutate(s => { s.augmentOffers[0].tier = 'invalid'; });
  mutate(s => { s.augmentOffers[0].rerolledIndices = [1]; });
  mutate(s => { s.augmentOffers[0].rerolledIndices = [0,0]; s.augmentOffers[0].rerollCount = 2; });
  mutate(s => { s.augmentOffers[0].rerolledIndices = [3]; });
  mutate(s => { s.pendingChoice.rerolledSlots[0] = false; });
  mutate(s => { s.removedAugmentIds = []; });
  mutate(s => { s.removedAugmentIds.push(c.offers[0]); });
  mutate(s => { s.removedAugmentIds = [s.pendingChoice.offers[0]]; });
  mutate(s => { delete s.removedAugmentIds; });
  mutate(s => { s.choiceRngState ^= 1; });
  const selected = accepted(selectChoice(state,c.choiceId,1,state.pendingChoice!.offers[0]));
  expect(restoreMatch(serializeMatch(selected))).toEqual(selected);
  const forged = structuredClone(selected);
  Object.assign(forged.augments[0],{definitionId:c.offers[0]});
  Object.assign(forged.scheduleReceipts.find(r => r.eventId === c.choiceId)!,{definitionId:c.offers[0]});
  expect(() => restoreMatch(forged)).toThrow();
});

it('registered tier pools support all three card rerolls at all nodes even at the smallest tier', () => {
  for (const tier of ['silver','gold','prismatic'] as const) {
    const ids = augmentCandidates(tier,[]);
    expect(ids.length).toBeGreaterThanOrEqual(8);
    const owned = ids.slice(0,2).map(definitionId => ({definitionId,choiceId:'previous',acquiredRound:1}));
    // Third node: six removed earlier, two owned, three current, two removed here.
    expect(augmentCandidates(tier,owned,ids.slice(2,13)).length).toBeGreaterThanOrEqual(1);
  }
  expect(Object.keys(AUGMENT_DEFINITIONS).every(id => AUGMENT_TIERS[id] !== undefined)).toBe(true);
  expect(augmentRerollLimit([])).toBe(1);
  expect(Object.values(AUGMENT_DEFINITIONS).some(d => d.effects.some(e => e.kind === 'mechanic' && e.mechanic === 'augmentRerolls'))).toBe(false);
});

it('a depleted same-tier pool refuses atomically instead of repeating or crossing tiers', () => {
  const state = reachRound('2-1',false), c = state.pendingChoice!;
  // Isolated future-content shortage vector; current admitted pools cannot naturally exhaust this way.
  // Exhaust the shown-card list without inventing owners whose mechanics require acquisition/history.
  const removedAugmentIds = [...state.removedAugmentIds, ...augmentCandidates(c.augmentTier!,[],c.offers)];
  const before = freeze({...state,removedAugmentIds});
  const result = rerollAugment(before,c.choiceId,c.generation,0);
  expect(result).toEqual({ok:false,state:before,reason:'augment-pool-too-small'});
  expect(result.state).toBe(before); expect('events' in result).toBe(false);
  expect(toPrivateSeatView(before).pendingChoice!.augmentOptions!.every(o=>!o.rerollAvailable)).toBe(true);
});
