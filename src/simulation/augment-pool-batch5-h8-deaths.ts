import type { MatchState } from './match-types';
import { requireAugmentFacts, historySeatId } from './augment-history';
import { grantMechanicGold } from './seat-mechanics/grants';
import { AUGMENT_BATCH5_H8 } from './content/augment-pool-batch5-h8';
export const SOURCE='augment-batch5-h8-monetization';
export function plan(state:MatchState) {
 return state.augments.filter(a=>a.definitionId==='mirrored-monetization').flatMap(a=>
  state.roundResults.filter(r=>r.round>=a.acquiredRound&&r.round<a.acquiredRound+AUGMENT_BATCH5_H8['mirrored-monetization'].source.values.rounds&&r.roundKind!=='supply').flatMap(r=>{
   const rows=requireAugmentFacts(state,'deaths',r.round),own=historySeatId(state);
   const deaths=rows.flatMap(f=>f.deaths).filter(d=>d.ordinaryHero&&(state.multiplayer&&r.roundKind==='pvp'?d.ownerSeatId!==own:d.team==='enemy'));
   const amount=deaths.length*AUGMENT_BATCH5_H8['mirrored-monetization'].source.values.PercCost;
   return amount?[{receiptId:JSON.stringify([SOURCE,a.choiceId,r.round]),source:SOURCE,amount,round:r.round}]:[];
  }));
}
export function drainBatch5H8Deaths(initial:MatchState):MatchState {
 let state=initial;
 for(const p of plan(state))if(!state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId)){
  const result=grantMechanicGold(state,p);if(!result.ok)throw new RangeError(result.reason);state=result.state;
 }
 return state;
}

