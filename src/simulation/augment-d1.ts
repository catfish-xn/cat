import type { MatchState } from './match-types';
import { WHAT_YOU_REALLY_ARE as RULE } from './content/augment-d1';
import { planAugmentGifts } from './augment-gift-plan';
import { MAX_SUPPORTED_PLAYER_HP } from './augment-pool-batch5-h7-health';

/** Derived from committed D0 records, including the acquisition round. No saved counter. */
export function whatYouReallyAreProgress(state: MatchState): { count: number; completedRound?: number } {
  const owner = state.augments.find(a => a.definitionId === RULE.id);
  if (!owner || !state.multiplayer) return { count: 0 };
  let count = 0;
  for (const r of state.roundResults) {
    if (r.round < owner.acquiredRound || r.roundKind !== 'pvp') continue;
    const receipt = state.multiplayer.receipts.find(p => p.settlementId === r.settlementId);
    const damage = r.damageDealt;
    if (damage === undefined || !Number.isSafeInteger(damage) || damage < 0 || damage > MAX_SUPPORTED_PLAYER_HP
      || !receipt || receipt.damageDealt !== damage) throw new RangeError('Invalid D1 damageDealt authority');
    count += damage;
    if (count >= RULE.source.values.PlayerDamage)
      return { count: RULE.source.values.PlayerDamage, ...(r.hpAfter > 0 ? { completedRound: r.round } : {}) };
  }
  return {count};
}

/** Existing grant receipts/orbs handle dedupe, bench capacity and shared-pool exhaustion. */
export function whatYouReallyAreGiftPlan(state: MatchState) {
  const owner = state.augments.find(a => a.definitionId === RULE.id);
  if (!owner) return [];
  const round = whatYouReallyAreProgress(state).completedRound;
  return [...planAugmentGifts(state, owner, RULE.gifts), ...(round === undefined ? [] :
    planAugmentGifts(state, { ...owner, choiceId: JSON.stringify([owner.choiceId, RULE.id, 'completed']), acquiredRound: round }, RULE.rewards))];
}
