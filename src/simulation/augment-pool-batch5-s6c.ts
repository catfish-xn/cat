import type { MatchState } from './match-types';
import { maximumPlayerHp } from './augment-pool-batch5-h7-health';
import { AUGMENT_BATCH5_S6C } from './content/augment-pool-batch5-s6c';
import { grantMechanicGold } from './seat-mechanics/grants';

export const BATCH5_S6C_SOURCE='augment-pool-batch5-s6c';
const rows:Readonly<Record<string,{readonly source:{readonly values:{readonly Gold:number;readonly Heal:number}}}>>=AUGMENT_BATCH5_S6C;
/** Only a real, eligible multiplayer settlement, after survival is decided. */
function owners(state:MatchState,round:number) {
 const result=state.roundResults.find(r=>r.round===round);
 const receipt=state.multiplayer?.receipts.find(r=>r.round===round&&r.settlementEligible&&r.settlementId===result?.settlementId);
 return result?.roundKind==='pvp'&&result.hpAfter>0&&receipt
  ?state.augments.filter(a=>Object.hasOwn(rows,a.definitionId)&&a.acquiredRound<=round):[];
}
export function batch5S6cSettlementHealth(state:MatchState,round:number,hp:number):number {
 const amount=owners(state,round).reduce((n,a)=>n+rows[a.definitionId].source.values.Heal,0);
 return hp>0&&amount>0?Math.min(maximumPlayerHp(state.augments,round),hp+amount):hp;
}
export function goldPlan(state:MatchState) {
 return state.roundResults.flatMap(r=>owners(state,r.round).map(a=>({receiptId:JSON.stringify([BATCH5_S6C_SOURCE,a.choiceId,r.round]),
  source:BATCH5_S6C_SOURCE,round:r.round,roundId:r.roundId,amount:rows[a.definitionId].source.values.Gold})));
}
export function drainBatch5S6cGold(initial:MatchState):MatchState {
 let state=initial;
 for(const p of goldPlan(state))if(!state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId)){
  if(p.round!==state.round)throw new RangeError('Missing prior S6C receipt');
  const granted=grantMechanicGold(state,p);if(!granted.ok)throw new RangeError(granted.reason);state=granted.state;
 }
 return state;
}

