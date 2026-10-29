import type { MatchState } from './match-types';
import { requireAugmentFacts } from './augment-history';
import { AUGMENT_BATCH5_H8 } from './content/augment-pool-batch5-h8';
import { grantMechanicGold } from './seat-mechanics/grants';

export const SOURCE = 'augment-batch5-h8-forward-thinking';
export function forwardThinkingReceiptId(choiceId: string): string {
  return JSON.stringify([SOURCE, choiceId]);
}
/** Acquisition evidence was frozen before this one-time withdrawal. Later income remains spendable. */
export function applyBatch5H8Acquisition(state: MatchState, definitionId: string): MatchState {
  return definitionId === 'forward-thinking' ? { ...state, gold: 0 } : state;
}
/** Every counted combat has a recorded frozen roster, not a guessed schedule entry. */
export function plan(state: MatchState) {
  return state.augments.filter(a=>a.definitionId==='forward-thinking').flatMap(a=>{
    const acquired=requireAugmentFacts(state,'acquire',a.acquiredRound).find(f=>f.choiceId===a.choiceId);
    if(!acquired)throw new RangeError('Invalid forward thinking acquisition');
    const completed=state.roundResults.filter(r=>r.roundKind==='pvp'&&r.round>=a.acquiredRound);
    for(const result of completed) requireAugmentFacts(state,'pvp-roster',result.round);
    const due=completed[AUGMENT_BATCH5_H8['forward-thinking'].source.values.rounds-1];
    return due?[{receiptId:forwardThinkingReceiptId(a.choiceId),source:SOURCE,round:due.round,
      amount:acquired.goldBefore+AUGMENT_BATCH5_H8['forward-thinking'].source.values.BaseGold}]:[];
  });
}
export function drainBatch5H8Gold(initial:MatchState):MatchState {
  let state=initial;
  for(const p of plan(state)) if(!state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId)) {
    const result=grantMechanicGold(state,p);if(!result.ok)throw new RangeError(result.reason);state=result.state;
  }
  return state;
}

