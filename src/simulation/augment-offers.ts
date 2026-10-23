import { WARWICK_EXCLUDED_AUGMENTS } from './content/opening-batch-b';
import { openingEncounterId } from './opening-encounter';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { AUGMENT_OFFER_POLICY, AUGMENT_TIERS } from './content/augment-policy';
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

export function augmentCandidates(tier: AugmentTier, owned: readonly OwnedAugment[], excluded: readonly string[] = [], encounterId?:string|null): string[] {
  return Object.keys(AUGMENT_DEFINITIONS).filter(id => !(encounterId==='warwicks-hunger' && WARWICK_EXCLUDED_AUGMENTS.some(api=>id===api || (AUGMENT_DEFINITIONS[id] as {apiName?:string}).apiName===api)) && AUGMENT_TIERS[id] === tier
    && !owned.some(a => a.definitionId === id) && !excluded.includes(id));
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
  const candidates = augmentCandidates(resolveAugmentTier(state, choice.choiceId), state.augments, [...state.removedAugmentIds, ...choice.offers],openingEncounterId(state));
  return choice.offers.map((definitionId, optionIndex) => ({ definitionId, optionIndex,
    rerollAvailable: state.phase === 'choice' && choice.step === 'offer' && !isCombatRosterLocked(state)
      && state.multiplayer?.status !== 'eliminated'
      && choice.rerolledSlots?.[optionIndex] === false && candidates.length > 0 }));
}

/** Restore from seed and node history, never from saved candidate IDs or a saved RNG checkpoint.
 * Scheduled augment nodes precede the anomaly node in the admitted S13 schedule. */
export function validateAugmentOfferHistory(state: MatchState): void {
  const check = (condition: boolean) => { if (!condition) throw new Error('Invalid augment offer history'); };
  check(state.sharedPool ? state.openingEncounter.mode === 'shared' : state.augmentTierSeed === state.seed);
  check(Array.isArray(state.augmentOffers) && state.augmentOffers.length <= 3);
  let rng = (state.seed ^ 0x9e3779b9) >>> 0;
  const owned: OwnedAugment[] = [];
  const removed: string[] = [];
  check(Array.isArray(state.removedAugmentIds));
  let index = 0;
  for (let round = 1; round <= Math.min(state.round, FINAL_ROUND); round++) for (const node of getRoundSchedule(round)) {
    if (node.kind !== 'augment') continue;
    const selected = state.augments.find(a => a.choiceId === node.id);
    const pending = state.pendingChoice?.kind === 'augment' && state.pendingChoice.choiceId === node.id ? state.pendingChoice : null;
    if (!selected && !pending) continue;
    const record = state.augmentOffers[index++];
    const tier = resolveAugmentTier(state, node.id);
    check(!!record && record.choiceId === node.id && record.tier === tier
      && Number.isSafeInteger(record.rerollCount) && record.rerollCount >= 0 && record.rerollCount <= 3
      && Array.isArray(record.rerolledIndices) && record.rerolledIndices.length === record.rerollCount
      && new Set(record.rerolledIndices).size === record.rerollCount);
    const initial = generateChoices(augmentCandidates(tier, owned, removed,openingEncounterId(state)), rng);
    const offers = [...initial.offers], rerolledSlots = [false, false, false];
    rng = initial.choiceRngState;
    for (const slot of record.rerolledIndices) {
      check(Number.isSafeInteger(slot) && slot >= 0 && slot < 3);
      const draw = drawAugmentCard(augmentCandidates(tier, owned, [...removed, ...offers],openingEncounterId(state)), rng);
      removed.push(offers[slot]); offers[slot] = draw.definitionId;
      rng = draw.choiceRngState; rerolledSlots[slot] = true;
    }
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
