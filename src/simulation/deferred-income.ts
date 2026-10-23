import type { MatchState, RoundResult } from './match-types';
import { readAugmentIncome } from './augment-income';

/** Victory gold is immediate. The frozen base/interest/streak entitlement is paid at the next round entry. */
export function deferredRoundIncome(result: Pick<RoundResult, 'income' | 'incomeBreakdown'>): number {
  return result.income - result.incomeBreakdown.win;
}

/** Internal transition hook; callers must validate the unique settled round before calling. No new receipt/state field. */
export function payPreviousRoundIncome(state: MatchState): MatchState {
  const result = state.roundResults.at(-1);
  if (!result || result.round !== state.round) throw new RangeError('Missing settled income');
  const gold = state.gold + deferredRoundIncome(result);
  const investmentHp = state.augmentProgress.investmentHp + result.incomeBreakdown.interest *
    readAugmentIncome(state.augments.filter(a => a.acquiredRound <= result.round)).healthPerInterest;
  if (!Number.isSafeInteger(gold) || !Number.isSafeInteger(investmentHp)) throw new RangeError('Invalid round income');
  return { ...state, gold, augmentProgress: { ...state.augmentProgress, investmentHp } };
}
