import { skipsFutureAugment } from './augment-pool-batch5-s1b';
import { WARWICK_EXCLUDED_AUGMENTS } from './content/opening-batch-b';
import { openingEncounterId } from './opening-encounter';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { AUGMENT_OFFER_POLICY, AUGMENT_TIERS } from './content/augment-policy';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from './content/augment-offer-rules';
import { TRAIT_DEFINITIONS } from './content/traits';
import { deriveTraits } from './trait-snapshot';
import { generateChoices } from './choices';
import { nextRandom } from './rng';
import { getRoundSchedule, FINAL_ROUND } from './round-schedule';
import { isCombatRosterLocked } from './operation-policy';
import type { MatchState } from './match-types';
import type { OwnedAugment } from './strategy-types';

export type AugmentTier = 'silver' | 'gold' | 'prismatic';
/** Retained after selection so restore can reconstruct every offer and consumed word. */
export interface AugmentOfferRecord {
  readonly choiceId: string;
  readonly tier: AugmentTier;
  readonly rerollCount: number;
  /** Successful slot indices in command order; sufficient to replay the private RNG. */
  readonly rerolledIndices: readonly number[];
  /** v22: fielded player trait ids when the node opened (3-2/4-2 only, sorted; [] where the offer is not tailored).
   * The node's rerolls reuse this snapshot, so restore replays the same candidate pools. */
  readonly fieldedTraits: readonly string[];
  /** v22: ids blocked by other live players for each draw: [initial, ...one per successful reroll], each sorted. */
  readonly externalBlocks: readonly (readonly string[])[];
}
/** Everything an offer needs beyond the seat's own augments and seen cards (see AUGMENT_OFFER_RULES). */
export interface AugmentOfferFilter {
  readonly node: string | null;
  readonly fieldedTraits: readonly string[];
  readonly blocked: readonly string[];
}

/** One match-level draw: FNV-1a UTF-16 stream name, seed xor namespace, one private LCG word.
 * Recomputed from the immutable root on reads/restore, never advanced per node or per seat. */
export function deriveAugmentTierSequence(seed: number): readonly [AugmentTier, AugmentTier, AugmentTier] {
  const policy = AUGMENT_OFFER_POLICY;
  let hash = 0x811c9dc5;
  for (let i = 0; i < policy.tierStream.length; i++) hash = Math.imul(hash ^ policy.tierStream.charCodeAt(i), 0x01000193) >>> 0;
  const word = nextRandom((seed ^ policy.tierSeedXor ^ hash) >>> 0).word;
  let ticket = word % policy.tierWeightTotal;
  for (const row of policy.tierCombinations) {
    if (ticket < row.weight) return row.tiers;
    ticket -= row.weight;
  }
  throw new Error('Invalid augment tier combination weights');
}

/** Scheduled nodes index the same match-level sample, independent of call order. */
export function deriveAugmentTier(seed: number, choiceId: string): AugmentTier {
  const index = ['round:2-1:augment', 'round:3-2:augment', 'round:4-2:augment'].indexOf(choiceId);
  if (index < 0) throw new Error('Unknown augment tier node');
  return deriveAugmentTierSequence(seed)[index];
}

/** One resolver for initial offers, rerolls, projection and restore. Encounters override only their specified positions. */
export function resolveAugmentTier(state: Pick<MatchState, 'openingEncounter' | 'augmentTierSeed'>, choiceId: string): AugmentTier {
  const id = openingEncounterId(state);
  const node = /^round:(2-1|3-2|4-2):augment$/.exec(choiceId)?.[1];
  if (node) {
    if (id === 'golden-gala') return 'gold';
    if (id === 'prismatic-party' || id === 'prismatic-prelude' && node === '2-1'
      || id === 'prismatic-finale' && node === '4-2') return 'prismatic';
  }
  return deriveAugmentTier(state.augmentTierSeed, choiceId);
}

/** One use per slot per node. ExtraRolls is not admitted by the current card-reroll rule. */
export function augmentRerollLimit(_augments: readonly OwnedAugment[]): number {
  return 1;
}

export function augmentCandidates(tier: AugmentTier, owned: readonly OwnedAugment[], excluded: readonly string[] = [], encounterId?:string|null, filter?: AugmentOfferFilter): string[] {
  return Object.keys(AUGMENT_DEFINITIONS).filter(id => !(encounterId==='warwicks-hunger' && WARWICK_EXCLUDED_AUGMENTS.some(api=>id===api || (AUGMENT_DEFINITIONS[id] as {apiName?:string}).apiName===api)) && AUGMENT_TIERS[id] === tier
    && !owned.some(a => a.definitionId === id) && !excluded.includes(id) && augmentOfferAllowed(id, owned, filter));
}

/* ---------------- v22 offer rules (content/augment-offer-rules.ts) ---------------- */

export function augmentApiName(id: string): string {
  return AUGMENT_POOL_API_NAMES[id] ?? (AUGMENT_DEFINITIONS[id] as {apiName?:string} | undefined)?.apiName ?? id;
}
function mutuallyExclusive(a: string, b: string): boolean {
  return (AUGMENT_OFFER_RULES.mutuallyExclusive[a]?.includes(b) ?? false) || (AUGMENT_OFFER_RULES.mutuallyExclusive[b]?.includes(a) ?? false);
}
/** 'round:3-2:augment' → '3-2'; null for any other node. */
export function augmentNodeOf(choiceId: string): string | null {
  return /^round:(2-1|3-2|4-2):augment$/.exec(choiceId)?.[1] ?? null;
}
export function isTraitTailoredNode(node: string | null): boolean {
  return node !== null && (AUGMENT_OFFER_RULES.traitFilterNodes as readonly string[]).includes(node);
}
/** Own-augment exclusions always apply; node, trait and cross-player rules apply when the offer's filter is given. */
export function augmentOfferAllowed(id: string, owned: readonly OwnedAugment[], filter?: AugmentOfferFilter): boolean {
  const api = augmentApiName(id);
  if (owned.some(a => mutuallyExclusive(api, augmentApiName(a.definitionId)))) return false;
  if (!filter) return true;
  if (filter.blocked.includes(id)) return false;
  const bans = (AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string, readonly string[]>>)[api];
  if (filter.node !== null && bans?.includes(filter.node)) return false;
  const traits = AUGMENT_OFFER_RULES.associatedTraits[api];
  if (isTraitTailoredNode(filter.node) && traits?.length && !traits.some(trait => filter.fieldedTraits.includes(trait))) return false;
  return true;
}
/** Trait ids with at least one fielded player unit (board only, emblems included), sorted. */
export function fieldedTraitSnapshot(state: Pick<MatchState, 'preparation' | 'items'>): string[] {
  return [...new Set(deriveTraits(state.preparation, 'player', undefined, undefined, state.items)
    .filter(trait => trait.count > 0).map(trait => trait.traitId))].sort();
}
/** Pool ids an external rule can block; any other id in a recorded block list is invalid. */
export function externallyBlockableAugments(): string[] {
  const apis = new Set<string>([...AUGMENT_OFFER_RULES.crossPlayerExclusive.flat(), ...AUGMENT_OFFER_RULES.onePerMatch]);
  return Object.keys(AUGMENT_DEFINITIONS).filter(id => apis.has(augmentApiName(id))).sort();
}
function seatIdOf(state: MatchState): string | undefined {
  return state.sharedPool?.seatId ?? state.multiplayer?.seatId;
}
/**
 * Ids other live seats block for `selfSeatId` right now: the other members of a cross-player group one of them owns,
 * and one-per-match augments already shown to one of them (seen cards, owned, the open offer). Sorted, pool ids only.
 */
export function externalAugmentBlocks(selfSeatId: string, states: readonly MatchState[]): string[] {
  const blocked = new Set<string>();
  for (const other of states) {
    if (seatIdOf(other) === selfSeatId || other.multiplayer?.status === 'eliminated') continue;
    const owned = new Set(other.augments.map(a => augmentApiName(a.definitionId)));
    const shown = new Set([...owned, ...other.removedAugmentIds.map(augmentApiName),
      ...(other.pendingChoice?.kind === 'augment' ? other.pendingChoice.offers.map(augmentApiName) : [])]);
    for (const group of AUGMENT_OFFER_RULES.crossPlayerExclusive)
      for (const api of group) if (group.some(member => member !== api && owned.has(member))) blocked.add(api);
    for (const api of AUGMENT_OFFER_RULES.onePerMatch) if (shown.has(api)) blocked.add(api);
  }
  return Object.keys(AUGMENT_DEFINITIONS).filter(id => blocked.has(augmentApiName(id))).sort();
}
/** The filter of a recorded node for its draw `drawIndex` (0 = initial three). */
export function recordedOfferFilter(record: AugmentOfferRecord, drawIndex: number): AugmentOfferFilter {
  return { node: augmentNodeOf(record.choiceId), fieldedTraits: record.fieldedTraits, blocked: record.externalBlocks[drawIndex] ?? [] };
}

/** One LCG word, sorted IDs, modulo selection. Caller validates nonempty before drawing. */
export function drawAugmentCard(candidates: readonly string[], rng: number): { definitionId: string; choiceRngState: number } {
  if (!candidates.length) throw new Error('Empty augment card pool');
  const pool = [...candidates].sort(), draw = nextRandom(rng);
  return { definitionId: pool[draw.word % pool.length], choiceRngState: draw.state };
}

/** Detached owner-visible buttons; an exhausted pool disables even an unused slot. */
export function augmentOptionViews(state: MatchState) {
  const choice = state.pendingChoice;
  if (choice?.kind !== 'augment') return [];
  const record = state.augmentOffers.find(candidate => candidate.choiceId === choice.choiceId);
  const candidates = augmentCandidates(resolveAugmentTier(state, choice.choiceId), state.augments, [...state.removedAugmentIds, ...choice.offers],openingEncounterId(state),
    record ? recordedOfferFilter(record, record.externalBlocks.length - 1) : undefined);
  return choice.offers.map((definitionId, optionIndex) => ({ definitionId, optionIndex,
    rerollAvailable: state.phase === 'choice' && choice.step === 'offer' && !isCombatRosterLocked(state)
      && state.multiplayer?.status !== 'eliminated'
      && choice.rerolledSlots?.[optionIndex] === false && candidates.length > 0 }));
}

/** Restore from seed and node history, never from saved candidate IDs or a saved RNG checkpoint.
 * v22: removedAugmentIds lists every card shown (initial three, then each reroll result) in draw order; the recorded
 * trait snapshot and external blocks are the only non-derivable inputs and are range-checked here.
 * Scheduled augment nodes precede the anomaly node in the admitted S13 schedule. */
export function validateAugmentOfferHistory(state: MatchState): void {
  const check = (condition: boolean) => { if (!condition) throw new Error('Invalid augment offer history'); };
  check(state.sharedPool ? state.openingEncounter.mode === 'shared' : state.augmentTierSeed === state.seed);
  check(Array.isArray(state.augmentOffers) && state.augmentOffers.length <= 3);
  let rng = (state.seed ^ 0x9e3779b9) >>> 0;
  const owned: OwnedAugment[] = [];
  const removed: string[] = [];
  check(Array.isArray(state.removedAugmentIds));
  const blockable = externallyBlockableAugments();
  let index = 0;
  for (let round = 1; round <= Math.min(state.round, FINAL_ROUND); round++) for (const node of getRoundSchedule(round)) {
    if (node.kind !== 'augment') continue;
    const selected = state.augments.find(a => a.choiceId === node.id);
    const pending = state.pendingChoice?.kind === 'augment' && state.pendingChoice.choiceId === node.id ? state.pendingChoice : null;
    if (skipsFutureAugment({augments:owned}, round)) { check(!selected && !pending); continue; }
    if (!selected && !pending) continue;
    const record = state.augmentOffers[index++];
    const tier = resolveAugmentTier(state, node.id);
    check(!!record && record.choiceId === node.id && record.tier === tier
      && Number.isSafeInteger(record.rerollCount) && record.rerollCount >= 0 && record.rerollCount <= 3
      && Array.isArray(record.rerolledIndices) && record.rerolledIndices.length === record.rerollCount
      && new Set(record.rerolledIndices).size === record.rerollCount);
    const sortedUnique = (list: unknown) => Array.isArray(list) && list.every((value, i) => typeof value === 'string' && (i === 0 || list[i - 1] < value));
    check(sortedUnique(record.fieldedTraits) && record.fieldedTraits.every(trait => Object.hasOwn(TRAIT_DEFINITIONS, trait))
      && (isTraitTailoredNode(augmentNodeOf(node.id)) || record.fieldedTraits.length === 0));
    check(Array.isArray(record.externalBlocks) && record.externalBlocks.length === record.rerollCount + 1
      && record.externalBlocks.every(list => sortedUnique(list) && list.every((id: string) => blockable.includes(id))));
    const initial = generateChoices(augmentCandidates(tier, owned, removed,openingEncounterId(state), recordedOfferFilter(record, 0)), rng);
    const offers = [...initial.offers], rerolledSlots = [false, false, false];
    removed.push(...offers);
    rng = initial.choiceRngState;
    record.rerolledIndices.forEach((slot, rerollIndex) => {
      check(Number.isSafeInteger(slot) && slot >= 0 && slot < 3);
      const draw = drawAugmentCard(augmentCandidates(tier, owned, [...removed, ...offers],openingEncounterId(state), recordedOfferFilter(record, rerollIndex + 1)), rng);
      offers[slot] = draw.definitionId; removed.push(draw.definitionId);
      rng = draw.choiceRngState; rerolledSlots[slot] = true;
    });
    if (pending) check(pending.augmentTier === tier && pending.rerollCount === record.rerollCount
      && pending.generation === record.rerollCount && pending.rerollsRemaining === 3 - record.rerollCount
      && JSON.stringify(pending.rerolledSlots) === JSON.stringify(rerolledSlots)
      && JSON.stringify(pending.offers) === JSON.stringify(offers));
    if (selected) { check(selected.acquiredRound === round && offers.includes(selected.definitionId)); owned.push(selected); }
  }
  check(index === state.augmentOffers.length && owned.length === state.augments.length);
  check(JSON.stringify(state.removedAugmentIds) === JSON.stringify(removed));
  // No other consumer of this stream exists until the later anomaly target/offer.
  // Selling the bound target removes anomalyBinding but retains its schedule receipt and consumed words.
  const anomalyDrawn = state.scheduleReceipts.some(receipt => receipt.kind === 'anomaly')
    || state.pendingChoice?.kind === 'anomaly' && state.pendingChoice.generation > 0;
  if (!anomalyDrawn) check(state.choiceRngState === rng);
}
