import { expect } from 'vitest';
import { createMatch, selectChoice, type MatchState } from '../src/simulation/match';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { accepted, reachRound, reachRoundFielded } from './match-helpers';

/** 14.24 stage tags (augment-stage-bans.ts): the augment rounds a card can be offered at. */
export function offeredAt(id: string, node: '2-1' | '3-2' | '4-2'): boolean {
  return !((AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string, readonly string[]>>)[AUGMENT_POOL_API_NAMES[id]] ?? []).includes(node);
}
/** First seed whose public 2-1 offer holds `id`, by the cheap first-node draw; bounded, never spins. */
export function firstNodeSeed(id: string, limit = 20000, from = 0): number {
  if (!offeredAt(id, '2-1')) throw new Error(`${id} is not offered at 2-1 (14.24 stage tags); use acquireAugment`);
  for (let seed = from; seed < from + limit; seed++) {
    const state = createMatch(seed);
    if (generateChoices(augmentCandidates(resolveAugmentTier(state, 'round:2-1:augment'), [], [], null, { node: '2-1', fieldedTraits: [], blocked: [] }), state.choiceRngState).offers.includes(id)) return seed;
  }
  throw new Error(`No 2-1 offer seed for ${id} in [${from}, ${from + limit})`);
}
/**
 * Seeds whose first allowed augment round offers the card (sequential search). Plain entries reach the node through
 * reachRound's empty boards; `fielded` entries through reachRoundFielded (4-2, and trait-tailored 3-2 cards).
 */
export const STAGE_SEEDS: Readonly<Record<string, { readonly node: '3-2' | '4-2'; readonly seed: number; readonly fielded?: true }>> = {
  "backup":{node:'3-2',seed:1},
  "bad-luck-protection":{node:'3-2',seed:20},
  "belt-overflow":{node:'3-2',seed:5},
  "betrayal":{node:'3-2',seed:43,fielded:true},
  "big-grab-bag":{node:'3-2',seed:26},
  "black-rose-crest":{node:'3-2',seed:14,fielded:true},
  "black-rose-crown":{node:'3-2',seed:28,fielded:true},
  "blazing-soul-i":{node:'3-2',seed:18},
  "blazing-soul-ii":{node:'3-2',seed:13},
  "blinding-speed":{node:'3-2',seed:5},
  "bronze-for-life-i":{node:'3-2',seed:42},
  "bronze-for-life-ii":{node:'3-2',seed:52},
  "bulky-buddies-ii":{node:'3-2',seed:57},
  "bulky-buddies-iii":{node:'3-2',seed:36},
  "calculated-enhancement":{node:'3-2',seed:21},
  "call-to-chaos":{node:'4-2',seed:333,fielded:true},
  "climb-the-ladder-i":{node:'3-2',seed:17},
  "climb-the-ladder-ii":{node:'3-2',seed:10},
  "coronation":{node:'3-2',seed:106},
  "corrosion":{node:'3-2',seed:1},
  "dark-alley-dealings":{node:'3-2',seed:28},
  "defense-call":{node:'3-2',seed:0},
  "dummify":{node:'3-2',seed:6},
  "duo-queue":{node:'4-2',seed:48,fielded:true},
  "epoch-plus":{node:'3-2',seed:8},
  "eye-for-an-eye-plus":{node:'3-2',seed:6},
  "final-polish":{node:'4-2',seed:38,fielded:true},
  "find-your-center":{node:'3-2',seed:24},
  "geniuses":{node:'4-2',seed:38,fielded:true},
  "golemify":{node:'3-2',seed:0},
  "item-collector-i":{node:'3-2',seed:2},
  "item-collector-ii":{node:'3-2',seed:10},
  "lineup":{node:'3-2',seed:24},
  "little-buddies":{node:'3-2',seed:8},
  "magic-roll":{node:'3-2',seed:3},
  "manaflow-i":{node:'3-2',seed:25},
  "manaflow-ii":{node:'3-2',seed:3},
  "menaces":{node:'3-2',seed:79,fielded:true},
  "mentorship":{node:'4-2',seed:50,fielded:true},
  "missed-connections":{node:'3-2',seed:22},
  "noble-sacrifice":{node:'3-2',seed:31},
  "one-buff-two-buff":{node:'3-2',seed:36},
  "one-two-five":{node:'4-2',seed:59,fielded:true},
  "pair-of-fours":{node:'4-2',seed:73,fielded:true},
  "phreaky-friday-plus":{node:'3-2',seed:13},
  "piercing-lotus-i":{node:'3-2',seed:23},
  "piercing-lotus-ii":{node:'3-2',seed:21},
  "placebo-plus":{node:'3-2',seed:100},
  "radiant-refactor":{node:'3-2',seed:5},
  "raining-gold-plus":{node:'3-2',seed:0},
  "reunion":{node:'4-2',seed:3,fielded:true},
  "rocket-collection-plus":{node:'3-2',seed:92,fielded:true},
  "rolling-for-days-i":{node:'3-2',seed:7},
  "savage-revenge":{node:'3-2',seed:142,fielded:true},
  "sisters":{node:'4-2',seed:9,fielded:true},
  "support-mining-plus":{node:'3-2',seed:100},
  "sword-overflow":{node:'3-2',seed:60},
  "teaming-up-i":{node:'3-2',seed:6},
  "teaming-up-ii":{node:'4-2',seed:10,fielded:true},
  "the-golden-egg":{node:'4-2',seed:4,fielded:true},
  "trifecta-i":{node:'3-2',seed:54},
  "trifecta-ii":{node:'3-2',seed:36},
  "unlikely-duo":{node:'4-2',seed:11,fielded:true},
  "wand-overflow":{node:'3-2',seed:114},
  "wealthy-rehab-i":{node:'3-2',seed:2},
  "wealthy-rehab-ii":{node:'3-2',seed:10},
};
/** The augment round state offering `id` before selection: 2-1 when the card is offered there, else its STAGE_SEEDS node. */
export function offerFor(id: string): MatchState {
  if (offeredAt(id, '2-1')) return reachRound('2-1', false, firstNodeSeed(id));
  const at = STAGE_SEEDS[id];
  if (!at) throw new Error(`No stage seed for ${id}; re-run the stage seed search`);
  const state = at.fielded ? reachRoundFielded(at.node, at.seed) : reachRound(at.node, false, at.seed);
  expect(state.pendingChoice?.offers, `${id} at ${at.node} seed ${at.seed}`).toContain(id);
  return state;
}
/** Public selection of `id` at its first offering round. */
export function acquireAugment(id: string): MatchState {
  const state = offerFor(id), choice = state.pendingChoice!;
  return accepted(selectChoice(state, choice.choiceId, choice.generation, id));
}
