import { AUGMENT_BATCH5_G1 } from './content/augment-pool-batch5-g1';
import { planAugmentGifts } from './augment-gift-plan';
import type { MatchState } from './match-types';

export function luckyGlovesRewardPlan(state: MatchState) {
  return state.augments.flatMap(a => {
    if (a.definitionId !== 'lucky-gloves') return [];
    const due = a.acquiredRound + AUGMENT_BATCH5_G1['lucky-gloves'].source.values.NumRounds;
    return state.round < due ? [] : planAugmentGifts(state,
      {...a,choiceId:JSON.stringify([a.choiceId,'lucky-gloves-delayed']),acquiredRound:due},
      [{kind:'item',definitionId:'gloves'}]);
  });
}
