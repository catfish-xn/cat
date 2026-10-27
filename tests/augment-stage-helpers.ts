import { expect } from 'vitest';
import { createMatch, nextRound, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { accepted, fieldBench, reachRound, resolveM5Choices } from './match-helpers';

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
 * Re-searched (first seed from 0 whose route reaches the node and offers the card) after the v23 integration
 * (fmix32 openings, Blood Brothers, Form Swapper) merged with the batch-3/XP/stage-ban line.
 * Call to Chaos was re-searched after batch 4 level rewards expanded the pool to 213 (seed 74, same fielded route).
 * Re-searched after the v24 shop / batch-5 merge (235 cards, P 2026-10-27), retaining the same routes and first-seed rule.
 * Call to Chaos additionally requires the XP outcome exercised by its suite.
 */
export const STAGE_SEEDS: Readonly<Record<string, { readonly node: '3-2' | '4-2'; readonly seed: number; readonly fielded?: true }>> = {
  "diversified-portfolio-plus":{node:'3-2',seed:17},
  'contested':{node:'3-2',seed:18},
  "backup":{node:'3-2',seed:9},
  "bad-luck-protection":{node:'3-2',seed:8},
  "belt-overflow":{node:'3-2',seed:21},
  "betrayal":{node:'3-2',seed:27,fielded:true},
  "big-grab-bag":{node:'3-2',seed:26},
  "black-rose-crest":{node:'3-2',seed:74,fielded:true},
  "black-rose-crown":{node:'3-2',seed:106,fielded:true},
  "blazing-soul-i":{node:'3-2',seed:20},
  "blazing-soul-ii":{node:'3-2',seed:89},
  "blinding-speed":{node:'3-2',seed:35},
  "bronze-for-life-i":{node:'3-2',seed:50},
  "bronze-for-life-ii":{node:'3-2',seed:0},
  "bulky-buddies-ii":{node:'3-2',seed:43},
  "bulky-buddies-iii":{node:'3-2',seed:114},
  "calculated-enhancement":{node:'3-2',seed:89},
  "call-to-chaos":{node:'4-2',seed:576,fielded:true},
  "climb-the-ladder-i":{node:'3-2',seed:17},
  "climb-the-ladder-ii":{node:'3-2',seed:41},
  "coronation":{node:'3-2',seed:29},
  "corrosion":{node:'3-2',seed:79},
  "dark-alley-dealings":{node:'3-2',seed:5},
  "defense-call":{node:'3-2',seed:39},
  "dummify":{node:'3-2',seed:56},
  "duo-queue":{node:'4-2',seed:78,fielded:true},
  "epoch-plus":{node:'3-2',seed:10},
  "eye-for-an-eye-plus":{node:'3-2',seed:17},
  "final-polish":{node:'4-2',seed:2,fielded:true},
  "find-your-center":{node:'3-2',seed:56},
  "geniuses":{node:'4-2',seed:16,fielded:true},
  "golemify":{node:'3-2',seed:18},
  "item-collector-i":{node:'3-2',seed:25},
  "item-collector-ii":{node:'3-2',seed:3},
  "lineup":{node:'3-2',seed:6},
  "little-buddies":{node:'3-2',seed:4},
  "magic-roll":{node:'3-2',seed:51},
  "manaflow-i":{node:'3-2',seed:46},
  "manaflow-ii":{node:'3-2',seed:15},
  "menaces":{node:'3-2',seed:84,fielded:true},
  "mentorship":{node:'4-2',seed:10,fielded:true},
  "missed-connections":{node:'3-2',seed:38},
  "noble-sacrifice":{node:'3-2',seed:27},
  "one-buff-two-buff":{node:'3-2',seed:5},
  "one-two-five":{node:'4-2',seed:59,fielded:true},
  "pair-of-fours":{node:'4-2',seed:24,fielded:true},
  "phreaky-friday-plus":{node:'3-2',seed:28},
  "piercing-lotus-i":{node:'3-2',seed:4},
  "piercing-lotus-ii":{node:'3-2',seed:0},
  "placebo-plus":{node:'3-2',seed:24},
  "radiant-refactor":{node:'3-2',seed:13},
  "raining-gold-plus":{node:'3-2',seed:23},
  "reunion":{node:'4-2',seed:21,fielded:true},
  "rocket-collection-plus":{node:'3-2',seed:155,fielded:true},
  "rolling-for-days-i":{node:'3-2',seed:9},
  "savage-revenge":{node:'3-2',seed:82,fielded:true},
  "sisters":{node:'4-2',seed:30,fielded:true},
  "support-mining-plus":{node:'3-2',seed:25},
  "sword-overflow":{node:'3-2',seed:7},
  "teaming-up-i":{node:'3-2',seed:1},
  "teaming-up-ii":{node:'4-2',seed:13,fielded:true},
  "the-golden-egg":{node:'4-2',seed:99,fielded:true},
  "trifecta-i":{node:'3-2',seed:18},
  "trifecta-ii":{node:'3-2',seed:59},
  "unlikely-duo":{node:'4-2',seed:3,fielded:true},
  "wand-overflow":{node:'3-2',seed:13},
  "wealthy-rehab-i":{node:'3-2',seed:38},
  "wealthy-rehab-ii":{node:'3-2',seed:15},
};
/**
 * reachRoundFielded's route (match-helpers.ts), step for step, cached per seed and resumable: every round entry it
 * passes is kept, so a long 4-2 route can be played in legs over several cases (FIELDED_LEGS) and a later case
 * reuses it instead of replaying the whole match. Returns the same state reachRoundFielded(roundId, seed) does.
 */
export const FIELDED_LEGS = ['2-2', '2-5', '2-7', '3-2', '3-3', '3-4', '3-6', '4-1', '4-2'] as const;
/** [seed, leg] cases of `id`'s fielded STAGE_SEEDS route, up to and including its offering node. */
export function fieldedLegCases(id: string): (readonly [number, string])[] {
  const at = STAGE_SEEDS[id];
  if (!at?.fielded) throw new Error(`${id} has no fielded stage route`);
  return FIELDED_LEGS.slice(0, FIELDED_LEGS.indexOf(at.node) + 1).map(leg => [at.seed, leg] as const);
}
const fieldedRoutes = new Map<number, { entries: Map<string, MatchState>; last: MatchState }>();
export function fieldedRoute(seed: number, roundId: string): MatchState {
  let route = fieldedRoutes.get(seed);
  if (!route) fieldedRoutes.set(seed, route = { entries: new Map(), last: createMatch(seed) });
  route.entries.set(route.last.roundDefinitionId, route.last);
  let state = route.entries.get(roundId) ?? route.last;
  while (state.roundDefinitionId !== roundId) {
    state = resolveM5Choices(state);
    if (state.phase === 'preparation') { state = accepted(startMatchCombat(fieldBench(state))); while (state.phase === 'combat') state = stepMatch(state).state; }
    state = resolveM5Choices(state);
    if (state.phase !== 'settlement') throw new Error(`Cannot reach ${roundId} from ${state.roundDefinitionId}/${state.phase}`);
    state = accepted(nextRound(state, state.round));
    route.entries.set(state.roundDefinitionId, state); route.last = state;
  }
  return state;
}
/** The augment round state offering `id` before selection: 2-1 when the card is offered there, else its STAGE_SEEDS node. */
export function offerFor(id: string): MatchState {
  if (offeredAt(id, '2-1')) return reachRound('2-1', false, firstNodeSeed(id));
  const at = STAGE_SEEDS[id];
  if (!at) throw new Error(`No stage seed for ${id}; re-run the stage seed search`);
  const state = at.fielded ? fieldedRoute(at.seed, at.node) : reachRound(at.node, false, at.seed);
  expect(state.roundDefinitionId).toBe(at.node);
  expect(state.pendingChoice?.kind).toBe('augment');
  expect(state.pendingChoice?.offers, `${id} at ${at.node} seed ${at.seed}`).toContain(id);
  return state;
}
/** Public selection of `id` at its first offering round. */
export function acquireAugment(id: string): MatchState {
  const state = offerFor(id), choice = state.pendingChoice!;
  return accepted(selectChoice(state, choice.choiceId, choice.generation, id));
}
