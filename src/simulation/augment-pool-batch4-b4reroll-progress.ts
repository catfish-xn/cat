import type { MatchState } from './match-types';
import { AUGMENT_BATCH4_B4REROLL } from './content/augment-pool-batch4-b4reroll';
import { getMultiplayerRoundById } from './multiplayer-round';

/** The existing settlement balance plus deferred income, reconstructed from immutable receipts.
 * Entry samples before carousel/opening/round-entry grants; acquisition gold is already in the prior bank. */
export function batch4RerollEntryGold(state:MatchState,round:number):number {
 const previous=state.roundResults.find(r=>r.round===round-1);
 if(!previous)throw new RangeError('Missing batch4 reroll entry history');
 const grants=(state.seatMechanics?.receipts??[]).slice(previous.mechanicReceiptPrefixLength).filter(r=>r.round===previous.round)
  .reduce((n,r)=>n+(r.kind==='gold'?r.amount:r.kind==='unit'?r.gold:r.kind==='choice'?-r.price:0),0);
 const sales=state.resourceProvenance.entries.reduce((n,e)=>n+(e.roundId===previous.roundId&&e.kind==='unit-sold'&&e.context==='settlement-capacity'?e.goldGranted:0),0);
 return previous.goldAfter+grants+sales;
}
/** No new save field: purchases, settlement banks and free-reroll spends already have authoritative histories.
 * P-B4R: first credit is on the round after selection; all round kinds count and unused credits carry over. */
export function batch4RerollsGranted(state:MatchState):number {
 let credits=0;
 for(const a of state.augments){
  const row=AUGMENT_BATCH4_B4REROLL[a.definitionId as keyof typeof AUGMENT_BATCH4_B4REROLL];if(!row)continue;
  for(let round=a.acquiredRound+1;round<=state.round;round++){
   if('FreeRerolls' in row.source.values){
    const bought=state.resourceProvenance.entries.some(e=>e.kind==='unit-acquired'&&e.source.kind==='shop'&&getMultiplayerRoundById(e.roundId).ordinal===round-1);
    if(!bought)credits+=row.source.values.FreeRerolls;
   }else{
    const v=row.source.values,gold=batch4RerollEntryGold(state,round);
    credits+=Math.floor(Math.max(0,Math.min(gold,v.MaxGold)-v.GoldThreshold)/v.GoldPerReroll);
   }
  }
 }
 return credits;
}
