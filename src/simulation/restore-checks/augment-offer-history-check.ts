import { validateAnomalyOfferHistory } from './anomaly-offer-history-check';
// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { augmentCandidates, augmentNodeOf, drawAugmentCard, externallyBlockableAugments, isTraitTailoredNode, recordedOfferFilter, resolveAugmentTier } from '../augment-offers';
import { augmentExtraRerolls, canRerollAugmentSlot } from '../augment-pool-batch5-s1a';
import { skipsFutureAugment } from '../augment-pool-batch5-s1b';
import { generateChoices } from '../choices';
import { TRAIT_DEFINITIONS } from '../content/traits';
import type { MatchState } from '../match-types';
import { openingEncounterId } from '../opening-encounter';
import { FINAL_ROUND, getRoundSchedule } from '../round-schedule';
import type { OwnedAugment } from '../strategy-types';

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
    const tier = resolveAugmentTier({...state, augments: owned}, node.id);
    check(!!record && record.choiceId === node.id && record.tier === tier
      && Number.isSafeInteger(record.rerollCount) && record.rerollCount >= 0 && record.rerollCount <= 3 + augmentExtraRerolls(owned, node.id)
      && Array.isArray(record.rerolledIndices) && record.rerolledIndices.length === record.rerollCount);
    const sortedUnique = (list: unknown) => Array.isArray(list) && list.every((value, i) => typeof value === 'string' && (i === 0 || list[i - 1] < value));
    check(sortedUnique(record.fieldedTraits) && record.fieldedTraits.every(trait => Object.hasOwn(TRAIT_DEFINITIONS, trait))
      && (isTraitTailoredNode(augmentNodeOf(node.id)) || record.fieldedTraits.length === 0));
    check(Array.isArray(record.externalBlocks) && record.externalBlocks.length === record.rerollCount + 1
      && record.externalBlocks.every(list => sortedUnique(list) && list.every((id: string) => blockable.includes(id))));
    const initial = generateChoices(augmentCandidates(tier, owned, removed,openingEncounterId(state), recordedOfferFilter(record, 0, state)), rng);
    const offers = [...initial.offers], rerolledSlots = [false, false, false];
    removed.push(...offers);
    rng = initial.choiceRngState;
    record.rerolledIndices.forEach((slot, rerollIndex) => {
      check(Number.isSafeInteger(slot) && slot >= 0 && slot < 3
        && canRerollAugmentSlot(owned, node.id, record.rerolledIndices.slice(0, rerollIndex), slot));
      const draw = drawAugmentCard(augmentCandidates(tier, owned, [...removed, ...offers],openingEncounterId(state), recordedOfferFilter(record, rerollIndex + 1, state)), rng);
      offers[slot] = draw.definitionId; removed.push(draw.definitionId);
      rng = draw.choiceRngState; rerolledSlots[slot] = true;
    });
    if (pending) check(pending.augmentTier === tier && pending.rerollCount === record.rerollCount
      && pending.generation === record.rerollCount && pending.rerollsRemaining === 3 + augmentExtraRerolls(owned, node.id) - record.rerollCount
      && JSON.stringify(pending.rerolledSlots) === JSON.stringify(rerolledSlots)
      && JSON.stringify(pending.offers) === JSON.stringify(offers));
    if (selected) { check(selected.acquiredRound === round && offers.includes(selected.definitionId)); owned.push(selected); }
  }
  check(index === state.augmentOffers.length && owned.length === state.augments.length);
  check(JSON.stringify(state.removedAugmentIds) === JSON.stringify(removed));
  validateAnomalyOfferHistory(state, rng);
}
