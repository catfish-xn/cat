import { expect } from 'vitest';
import { createMatch, nextRound, rerollAugment, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, drawAugmentCard, resolveAugmentTier } from '../src/simulation/augment-offers';
import { accepted, fieldBench, reachRound, reachRoundFielded, resolveM5Choices } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { needsAugmentHistory } from '../src/simulation/augment-history';
import { needsCrownHistory } from '../src/simulation/crown-history';
import { b1OfferCacheKey } from './fixtures/b1-offer-cache-key';

/** H12's public fielded 4-2 route, with a validated checkpoint at 4-1.
 * Seed 16's opening is prismatic-party and it picks im-the-carry-now. That golem cannot be
 * benched or sold, so the empty-board concession throws invalid-location. Seed 1 reaches 4-2
 * as gold, and Max Cap is prismatic and node-banned off 2-1/3-2, so it is not a candidate.
 * Seed 4 is prismatic with no golem, but the fielded route arrives at 13 HP and an empty
 * stage-4 loss is 14, so the concession ends the match and nextRound is wrong-phase.
 * Seed 8 (opening wind-up-monkey) is prismatic on the same worth-the-wait-ii /
 * clockwork-accelerator priorities: level 5, 167 gold, 16 HP (4-1 has 154 gold and 14 XP),
 * six benchable units and no golem. The same empty loss leaves 2 HP. 5→8 is 90 XP
 * (23 purchases, 92 gold). */
export const H12_MAX_CAP_SEED = 8;

/** 14.24 stage tags (augment-stage-bans.ts): the augment rounds a card can be offered at. */
export function offeredAt(id: string, node: '2-1' | '3-2' | '4-2'): boolean {
  return !((AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string, readonly string[]>>)[AUGMENT_POOL_API_NAMES[id]] ?? []).includes(node);
}
/** First seed whose public 2-1 offer holds `id`, by the cheap first-node draw; bounded, never spins. */
export function firstNodeSeed(id: string, limit = 10000, from = 0, fielded = false): number {
  if (!offeredAt(id, '2-1')) throw new Error(`${id} is not offered at 2-1 (14.24 stage tags); use acquireAugment`);
  for (let seed = from; seed < from + limit; seed++) {
    const state = createMatch(seed);
    if (!generateChoices(augmentCandidates(resolveAugmentTier(state, 'round:2-1:augment'), [], [], null, { node: '2-1', fieldedTraits: [], blocked: [] }), state.choiceRngState).offers.includes(id)) continue;
    // Openings can constrain the real offer or leave an unbenchable trainer.
    // Validate the public route as well as the cheap candidate draw.
    if (state.preparation.units.some(unit => unit.definitionId === 'trainer-golem')) continue;
    const actual=fielded?reachRoundFielded('2-1',seed):reachRound('2-1',false,seed);
    if (actual.pendingChoice?.offers.includes(id)) return seed;
  }
  throw new Error(`No 2-1 offer seed for ${id} in [${from}, ${from + limit})`);
}
/**
 * Seeds whose first allowed augment round offers the card (sequential search). Plain entries reach the node through
 * reachRound's empty boards; `fielded` entries through reachRoundFielded (4-2, and trait-tailored 3-2 cards).
 * Re-searched (first seed from 0 whose route reaches the node and offers the card) after the v23 integration
 * (fmix32 openings, Blood Brothers, Form Swapper) merged with the batch-3/XP/stage-ban line.
 * Call to Chaos was re-searched after batch 4 level rewards expanded the pool to 213 (seed 74, same fielded route).
 * v25 drift-13: fielded route seed 576 retained; batch3 scripts the 4-2 draw and expects XP outcome under that route.
 * Re-searched after the v24 shop / batch-5 merge (235 cards, P 2026-10-27), retaining the same routes and first-seed rule.
 * v25 integration B refreshes the exercised B5A routes for 250 cards; other entries retain their earlier fixture scope.
 * v25 final integration: non-fielded 3-2 routes re-searched on 285 admitted cards,
 * ascending seeds 0..299, then public slot rerolls 0/1/2, without editing state.
 * v25 drift-3 (batch-5 pool expansion): coronation, belt-overflow, calculated-enhancement,
 * sword-overflow, trifecta-ii, wand-overflow, geniuses, pair-of-fours re-searched on the same 0..299 rule.
 * Call to Chaos additionally requires the XP outcome exercised by its suite.
 */
/** P2 Trifecta→Nami review: 0..100 内首份礼物只有 loris 和 kogmaw，没有 Nami；256 的首礼是 Nami，但 3-2 候选里没有 trifecta-ii；257 是第一个两条都满足的种子。 */
export const TRIFECTA_NAMI_REVIEW_SEED = 257 as const;

export const STAGE_SEEDS: Readonly<Record<string, { readonly node: '3-2' | '4-2'; readonly seed: number; readonly fielded?: true; readonly rerolls?: number | readonly number[]; readonly rerollSlots?: readonly number[] }>> = {
  'all-that-shimmers-plus':{node:'3-2',seed:3},
  'roll-the-dice':{node:'3-2',seed:7,rerolls:[0]},
  'diversified-portfolio-plus':{node:'3-2',seed:6},
  'contested':{node:'3-2',seed:12},
  'tiniest-titan-plus':{node:'3-2',seed:5},
  // v25 integrated catalog: verified public routes; rerolls are existing per-slot commands.
  'glorious-evolution':{node:'4-2',seed:86,fielded:true},
  // T5: re-searched public fielded routes in 0..100; seed 63 offers Moonlight after rerolling slot 0.
  'moonlight':{node:'4-2',seed:63,fielded:true,rerolls:[0]},
  'greater-moonlight':{node:'4-2',seed:16,fielded:true,rerolls:[0,1]},
  'forward-thinking':{node:'3-2',seed:15,fielded:true,rerollSlots:[0,1,2]},
  'mirrored-monetization':{node:'4-2',seed:37,fielded:true,rerolls:[0]},
  'dhampyr':{node:'3-2',seed:14},
  'trait-tracker':{node:'3-2',seed:20,rerolls:[0,1]},
  'sponging':{node:'3-2',seed:16,rerolls:[0,1,2]},
  'artifactory':{node:'3-2',seed:13,rerolls:[0,1,2]},
  // D5 310-card pool: seed 3 after rerolls 0/1/2 offered clockwork-accelerator, contested, bad-luck-protection.
  // First seed in 0..120 whose reachRound('3-2') offer contains salvage-bin-plus within those slot rerolls is 27, after rerolling slot 0.
  'salvage-bin-plus':{node:'3-2',seed:27,rerolls:[0]},
  'a-golden-find':{node:'4-2',seed:11,fielded:true,rerolls:[0,1,2]},
  'backup':{node:'3-2',seed:1},
  'bad-luck-protection':{node:'3-2',seed:15,rerolls:[0]},
  'belt-overflow':{node:'3-2',seed:29},
  'big-grab-bag':{node:'3-2',seed:12,rerolls:[0]},
  'blazing-soul-i':{node:'3-2',seed:4},
  'blazing-soul-ii':{node:'3-2',seed:0,rerolls:[0]},
  'blinding-speed':{node:'3-2',seed:47},
  'bronze-for-life-i':{node:'3-2',seed:30},
  'bronze-for-life-ii':{node:'3-2',seed:16},
  'bulky-buddies-ii':{node:'3-2',seed:52,rerolls:[0,1]},
  'bulky-buddies-iii':{node:'3-2',seed:21},
  'calculated-enhancement':{node:'3-2',seed:5},
  "call-to-chaos":{node:'4-2',seed:576,fielded:true},
  'climb-the-ladder-i':{node:'3-2',seed:76},
  'climb-the-ladder-ii':{node:'3-2',seed:15,rerolls:[0,1]},
  'coronation':{node:'3-2',seed:5,rerolls:2},
  'corrosion':{node:'3-2',seed:25},
  'dark-alley-dealings':{node:'3-2',seed:13,rerolls:[0]},
  'defense-call':{node:'3-2',seed:3,rerolls:[0,1]},
  'dummify':{node:'3-2',seed:25,rerolls:[0,1,2]},
  'duo-queue':{node:'4-2',seed:24,fielded:true,rerolls:[0,1,2]},
  'epoch-plus':{node:'3-2',seed:11},
  'eye-for-an-eye-plus':{node:'3-2',seed:17,rerolls:[0]},
  'find-your-center':{node:'3-2',seed:1,rerolls:[0]},
  'geniuses':{node:'4-2',seed:16,fielded:true,rerolls:3},
  'golemify':{node:'3-2',seed:18,rerolls:[0]},
  'item-collector-i':{node:'3-2',seed:40},
  'item-collector-ii':{node:'3-2',seed:4},
  'lineup':{node:'3-2',seed:32,rerolls:[0]},
  'little-buddies':{node:'3-2',seed:10,rerolls:[0,1,2]},
  'magic-roll':{node:'3-2',seed:4,rerolls:[0,1]},
  'manaflow-i':{node:'3-2',seed:9},
  'manaflow-ii':{node:'3-2',seed:20,rerolls:[0]},
  'menaces':{node:'3-2',seed:42,fielded:true,rerolls:[0,1]},
  'mentorship':{node:'4-2',seed:11,fielded:true,rerolls:[0,1]},
  'missed-connections':{node:'3-2',seed:71,rerolls:[0]},
  'noble-sacrifice':{node:'3-2',seed:31,rerolls:[0,1,2]},
  'one-buff-two-buff':{node:'3-2',seed:16,rerolls:[0,1]},
  'one-two-five':{node:'4-2',seed:59,fielded:true},
  'pair-of-fours':{node:'4-2',seed:63,fielded:true},
  'phreaky-friday-plus':{node:'3-2',seed:44,rerolls:[0,1]},
  'piercing-lotus-i':{node:'3-2',seed:15},
  'piercing-lotus-ii':{node:'3-2',seed:0,rerolls:[0,1,2]},
  'placebo-plus':{node:'3-2',seed:56,rerolls:[0,1,2]},
  'radiant-refactor':{node:'3-2',seed:21,rerolls:[0,1,2]},
  'reunion':{node:'4-2',seed:21,fielded:true,rerolls:[0,1,2]},
  'rolling-for-days-i':{node:'3-2',seed:17,rerolls:[0,1]},
  'savage-revenge':{node:'3-2',seed:62,fielded:true,rerolls:[0,1]},
  'sisters':{node:'4-2',seed:3,fielded:true},
  'support-mining-plus':{node:'3-2',seed:1},
  'sword-overflow':{node:'3-2',seed:16,rerolls:3},
  'teaming-up-i':{node:'3-2',seed:6,rerolls:[0,1,2]},
  'teaming-up-ii':{node:'4-2',seed:60,fielded:true,rerolls:[0,1,2]},
  'the-golden-egg':{node:'4-2',seed:27,fielded:true,rerolls:[0]},
  'trifecta-i':{node:'3-2',seed:39},
  'trifecta-ii':{node:'3-2',seed:57,rerolls:3},
  'unlikely-duo':{node:'4-2',seed:1,fielded:true,rerolls:[0]},
  'wand-overflow':{node:'3-2',seed:0},
  'wealthy-rehab-i':{node:'3-2',seed:6},
  'wealthy-rehab-ii':{node:'3-2',seed:18,rerolls:[0,1,2]},
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
const fieldedRoutes = new Map<string, { entries: Map<string, MatchState>; last: MatchState }>();
/** Test-only: rebuild fielded routes after scripted-offer installs change generateChoices. */
export function resetFieldedRouteCache(): void { fieldedRoutes.clear(); }
export function fieldedRoute(seed: number, roundId: string): MatchState {
  // The draw policy is an input even when the explicit seed/node are unchanged.
  const key = JSON.stringify([seed, b1OfferCacheKey()]);
  let route = fieldedRoutes.get(key);
  if (!route) fieldedRoutes.set(key, route = { entries: new Map(), last: createMatch(seed) });
  route.entries.set(route.last.roundDefinitionId, route.last);
  let state = route.entries.get(roundId) ?? route.last;
  while (state.roundDefinitionId !== roundId) {
    state = resolveM5Choices(state);
    if (state.phase === 'preparation') { state = accepted(startMatchCombat(fieldBench(state))); while (state.phase === 'combat') state = stepMatch(state).state; }
    state = resolveM5Choices(state);
    if (state.phase !== 'settlement') throw new Error(`Cannot reach ${roundId} from ${state.roundDefinitionId}/${state.phase}`);
    state = accepted(nextRound(state, state.round));
    if(state.roundDefinitionId==='4-1'&&!needsAugmentHistory(state)&&!needsCrownHistory(state))
      state=restoreMatch(serializeMatch(state));
    route.entries.set(state.roundDefinitionId, state); route.last = state;
  }
  return state;
}
/** The augment round state offering `id` before selection: 2-1 when the card is offered there, else its STAGE_SEEDS node. */
export function offerFor(id: string): MatchState {
  if (offeredAt(id, '2-1')) return reachRound('2-1', false, firstNodeSeed(id));
  const at = STAGE_SEEDS[id];
  if (!at) throw new Error(`No stage seed for ${id}; re-run the stage seed search`);
  let state = at.fielded ? fieldedRoute(at.seed, at.node) : reachRound(at.node, false, at.seed);
  const slots = typeof at.rerolls === 'number' ? Array.from({length:at.rerolls},(_,slot)=>slot) : at.rerolls ?? [];
  for (const slot of slots) { const choice=state.pendingChoice!; state=accepted(rerollAugment(state,choice.choiceId,choice.generation,slot)); }
  for (const slot of at.rerollSlots ?? []) {
    const choice=state.pendingChoice!;if(choice.offers.includes(id))break;
    state=accepted(rerollAugment(state,choice.choiceId,choice.generation,slot));
  }
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

/** Bounded feature route, including the three existing public slot rerolls. No scan beyond 0..100. */
export function boundedFirstNodeOffer(id:string,fielded=false):MatchState {
 const filter={node:'2-1',fieldedTraits:[],blocked:[]};
 for(let seed=0;seed<=100;seed++){
  const initial=createMatch(seed),tier=resolveAugmentTier(initial,'round:2-1:augment');
  const generated=generateChoices(augmentCandidates(tier,[],[],null,filter),initial.choiceRngState);
  let offers=generated.offers,rng=generated.choiceRngState;const seen=[...offers];
  for(let rolls=0;rolls<=3;rolls++){
   if(offers.includes(id)){
    let state=fielded?reachRoundFielded('2-1',seed):reachRound('2-1',false,seed);
    for(let slot=0;slot<rolls;slot++){const c=state.pendingChoice!;state=accepted(rerollAugment(state,c.choiceId,c.generation,slot));}
    expect(state.pendingChoice!.offers).toContain(id);return state;
   }
   if(rolls===3)break;
   const draw=drawAugmentCard(augmentCandidates(tier,[],seen,null,filter),rng);rng=draw.choiceRngState;seen.push(draw.definitionId);offers=[...offers];offers[rolls]=draw.definitionId;
  }
 }
 throw new Error(`No bounded first-node route for ${id}; candidate=${augmentCandidates('silver',[],[],null,filter).includes(id)}, pool=${augmentCandidates('silver',[],[],null,filter).length}`);
}
/** Search actual first-node offers after catalog expansion; fail explicitly if no route exists. */
export const batch5S3bSeed=(id:string):number=>firstNodeSeed(id,10000);
/** Fixed real-room routes for history augments; no seed scan in regression tests. */
export const HISTORY_AUGMENT_ROOM_ROUTES = {
  'a-golden-find': { seed: 3, seatId: 's0', node: '4-2' },
  // v26 D5 pool (7953c99a): seed 3 s1 now auto-takes the history augment scoreboard-scrapper at 2-1, so its
  // history (and restore replay) starts before Cabal; s2 auto-takes clear-mind (no history). Was seatId 's1'.
  'forbidden-magic': { seed: 3, seatId: 's2', node: '3-2' },
} as const;
