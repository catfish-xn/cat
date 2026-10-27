import { XP_TO_NEXT_LEVEL } from './match-rules';
import { grantXp } from './progression';
import type { MatchState } from './match-types';
import { AUGMENT_BATCH5_S1B } from './content/augment-pool-batch5-s1b';

/** Only completed later choices earn credits. Records capture each successful reroll exactly once. */
export function rerollTransferCredits(state: MatchState): number {
  const owner = state.augments.find(a => a.definitionId === 'reroll-transfer');
  if (!owner) return 0;
  const values = AUGMENT_BATCH5_S1B['reroll-transfer'].source.values;
  return state.augmentOffers.reduce((sum, offer) => {
    const receipt = state.scheduleReceipts.find(r => r.kind === 'augment' && r.eventId === offer.choiceId);
    return receipt && receipt.round > owner.acquiredRound && receipt.round <= state.round
      ? sum + Math.floor((3 - offer.rerollCount) / values.AugmentRerollTracked) * values.ShopRerollToGrant : sum;
  }, 0);
}

/** XP needed to reach level six without losing existing progress, then the source's four XP. */
export function atWhatCostGrant(level: number, xp: number): number {
  grantXp(level, xp, 0);
  const target = AUGMENT_BATCH5_S1B['at-what-cost'].source.values.Level;
  let needed = 0;
  for (let l = level; l < target; l++) needed += XP_TO_NEXT_LEVEL[l];
  return Math.max(0, needed - (level < target ? xp : 0)) + AUGMENT_BATCH5_S1B['at-what-cost'].source.values.XP;
}
/** First-node-only card: the existing shop history starts immediately before its acquisition. */
export function atWhatCostHistoricalXp(state: MatchState, round: number): number {
  const a = state.augments.find(a => a.definitionId === 'at-what-cost' && a.acquiredRound === round);
  if (!a) return 0;
  const h = state.shopHistory;
  if (!h || h.entries[0]?.kind !== 'acquire' || h.entries[0].choiceId !== a.choiceId) throw new RangeError('Missing At What Cost acquisition history');
  return atWhatCostGrant(h.initial.level, h.initial.xp);
}
export function skipsFutureAugment(state: Pick<MatchState, 'augments'>, round: number): boolean {
  return state.augments.some(a => a.definitionId === 'at-what-cost' && a.acquiredRound < round);
}
