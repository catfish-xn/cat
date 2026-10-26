import { AUGMENT_DEFINITIONS } from './content/augments';
import type { OwnedAugment } from './strategy-types';
import { ECONOMY_RULES } from './match-rules';

/** One policy for settlement, preview and restore. No state, RNG or payment occurs here.
 * Raised caps combine by max; a no-interest effect wins over every raised cap. */
export function readAugmentIncome(augments: readonly OwnedAugment[] = []) {
  let interestCap: number = ECONOMY_RULES.interestCap, disabled = false, roundXp = 0, roundGold = 0, healthPerInterest = 0;
  for (const augment of augments) for (const effect of AUGMENT_DEFINITIONS[augment.definitionId]?.effects ?? []) {
    if (effect.kind !== 'mechanic') continue;
    if (effect.mechanic === 'incomePolicy') {
      interestCap = Math.max(interestCap, effect.values.interestCap ?? 0);
      disabled ||= effect.values.interestDisabled === 1;
      roundXp += effect.values.roundXp ?? 0;
      roundGold += effect.values.roundGold ?? 0;
    }
    if (effect.mechanic === 'investment') healthPerInterest += effect.values.healthPerInterest;
  }
  return {interestCap: disabled ? 0 : interestCap, roundXp, roundGold, healthPerInterest};
}
/** The only persisted growth aggregate is rebuilt from verified settlement interest. */
export function investmentGrowth(augments: readonly OwnedAugment[], history: readonly {readonly round:number;readonly incomeBreakdown:{readonly interest:number}}[]): number {
  return history.reduce((sum, result) => sum + result.incomeBreakdown.interest * readAugmentIncome(augments.filter(a => a.acquiredRound <= result.round)).healthPerInterest, 0);
}
