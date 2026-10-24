import type { MatchState } from './match-types';
import { getCatalogRoundById } from './round-selectors';
import { batch2Values } from './content/augment-pool-batch2';
import { settlementLevelUpHealth, preparationLevelUpHealth } from './augment-xp';
/** Market choices are already authenticated against the economy journal. Only choices after acquisition heal. */
function healBetween(state:MatchState,hp:number,from:number,to:number):number {
 const a=state.augments.find(a=>a.definitionId==='crimson-pact');if(!a)return hp;
 for(const r of (state.seatMechanics?.receipts??[]).slice(from,to))if(r.kind==='choice'&&r.choiceKind==='blackMarket'&&r.source==='black-market'&&r.skipped&&r.round>=a.acquiredRound)
  hp=Math.min(100,hp+batch2Values(a.definitionId).Heal);
 return hp;
}
export function batch2HpAfterSettlement(state:MatchState,round:number,hp:number):number {
 const result=state.roundResults.find(r=>r.round===round);if(!result)return hp;
 const receipts=state.seatMechanics?.receipts??[];
 const end=receipts.findIndex(r=>r.round>round);
 return settlementLevelUpHealth(state,round,healBetween(state,hp,result.mechanicReceiptPrefixLength??0,end<0?receipts.length:end));
}
export function batch2HpBeforeBattle(state:MatchState,roundId:string,hp:number):number {
 const round=getCatalogRoundById(roundId).ordinal,result=state.roundResults.find(r=>r.round===round),receipts=state.seatMechanics?.receipts??[];
 const from=receipts.findIndex(r=>r.round>=round);
 return preparationLevelUpHealth(state,round,from<0?hp:healBetween(state,hp,from,result?.mechanicReceiptPrefixLength??receipts.length));
}
