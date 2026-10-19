import { AUGMENT_DEFINITIONS } from './content/augments';
import { AUGMENT_OFFER_POLICY, AUGMENT_TIERS } from './content/augment-policy';
import { generateChoices } from './choices';
import { nextRandom } from './rng';
import { getRoundSchedule } from './round-schedule';
import type { MatchState } from './match-types';
import type { OwnedAugment } from './strategy-types';

export type AugmentTier = 'silver' | 'gold' | 'prismatic';
/** Retained after selection so restore can reconstruct every offer and consumed word. */
export interface AugmentOfferRecord {
  readonly choiceId: string;
  readonly tier: AugmentTier;
  readonly rerollCount: number;
}

/** User convention 2026-10-19: FNV-1a UTF-16 node ID, seed xor namespace, one private LCG word. */
export function deriveAugmentTier(seed: number, choiceId: string): AugmentTier {
  let hash = 0x811c9dc5;
  for (let i = 0; i < choiceId.length; i++) hash = Math.imul(hash ^ choiceId.charCodeAt(i), 0x01000193) >>> 0;
  const word = nextRandom((seed ^ AUGMENT_OFFER_POLICY.tierSeedXor ^ hash) >>> 0).word;
  return AUGMENT_OFFER_POLICY.tiers[word % AUGMENT_OFFER_POLICY.tiers.length];
}

/** Extension point: only previously acquired definitions may grant future-node rerolls.
 * No ExtraRolls augment is registered in this release. Adding one requires normal content admission. */
export function augmentRerollLimit(augments: readonly OwnedAugment[]): number {
  return AUGMENT_OFFER_POLICY.freeRerolls + augments.reduce((sum, augment) => sum +
    AUGMENT_DEFINITIONS[augment.definitionId].effects.reduce((extra, effect) => extra +
      (effect.kind === 'mechanic' && effect.mechanic === 'augmentRerolls' ? effect.values.extraRolls : 0), 0), 0);
}

export function augmentCandidates(tier: AugmentTier, owned: readonly OwnedAugment[], excluded: readonly string[] = []): string[] {
  return Object.keys(AUGMENT_DEFINITIONS).filter(id => AUGMENT_TIERS[id] === tier
    && !owned.some(a => a.definitionId === id) && !excluded.includes(id));
}

/** Restore from seed and node history, never from saved candidate IDs or a saved RNG checkpoint.
 * Scheduled augment nodes precede the anomaly node in the admitted S13 schedule. */
export function validateAugmentOfferHistory(state: MatchState): void {
  const check = (condition: boolean) => { if (!condition) throw new Error('Invalid augment offer history'); };
  check(state.augmentTierSeed === state.seed);
  check(Array.isArray(state.augmentOffers) && state.augmentOffers.length <= 3);
  let rng = (state.seed ^ 0x9e3779b9) >>> 0;
  const owned: OwnedAugment[] = [];
  let index = 0;
  for (let round = 1; round <= state.round; round++) for (const node of getRoundSchedule(round)) {
    if (node.kind !== 'augment') continue;
    const selected = state.augments.find(a => a.choiceId === node.id);
    const pending = state.pendingChoice?.kind === 'augment' && state.pendingChoice.choiceId === node.id ? state.pendingChoice : null;
    if (!selected && !pending) continue;
    const record = state.augmentOffers[index++];
    const tier = deriveAugmentTier(state.seed, node.id), limit = augmentRerollLimit(owned);
    check(!!record && record.choiceId === node.id && record.tier === tier
      && Number.isSafeInteger(record.rerollCount) && record.rerollCount >= 0 && record.rerollCount <= limit);
    let offers: readonly string[] = [];
    for (let generation = 0; generation <= record.rerollCount; generation++) {
      const draw = generateChoices(augmentCandidates(tier, owned, offers), rng);
      offers = draw.offers; rng = draw.choiceRngState;
    }
    if (pending) check(pending.augmentTier === tier && pending.rerollCount === record.rerollCount
      && pending.generation === record.rerollCount && pending.rerollsRemaining === limit - record.rerollCount
      && JSON.stringify(pending.offers) === JSON.stringify(offers));
    if (selected) { check(selected.acquiredRound === round && offers.includes(selected.definitionId)); owned.push(selected); }
  }
  check(index === state.augmentOffers.length && owned.length === state.augments.length);
  // No other consumer of this stream exists until the later anomaly target/offer.
  // Selling the bound target removes anomalyBinding but retains its schedule receipt and consumed words.
  const anomalyDrawn = state.scheduleReceipts.some(receipt => receipt.kind === 'anomaly')
    || state.pendingChoice?.kind === 'anomaly' && state.pendingChoice.generation > 0;
  if (!anomalyDrawn) check(state.choiceRngState === rng);
}
