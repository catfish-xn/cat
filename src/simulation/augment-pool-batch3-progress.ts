import type { MatchState } from './match-types';
import type { AugmentGift } from './augment-gift-plan';
import { planAugmentGifts } from './augment-gift-plan';
import { readG23Progress } from './g2-3-state';
import { AUGMENT_BATCH3, batch3Count } from './content/augment-pool-batch3';
import { grantMechanicGold, grantMechanicItem, grantMechanicUnit, grantMechanicConsumable } from './seat-mechanics/grants';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { AUGMENT_GIFT_SOURCE } from './augment-gift-plan';
import type { UnitLootPolicy } from './loot-runtime';
export const AUGMENT_BATCH3_SOURCE='augment-pool-batch3';
interface Batch3Event {readonly augment:MatchState['augments'][number];readonly schedule:number;readonly ordinal:number;readonly round:number}
/** Every threshold crossing is derived from immutable battle receipts, never from a client counter.
 * Counting starts with the acquisition round's own battle; draws are not losses. Allied deaths count every
 * combat (PvE included) and carry their remainder; one battle may cross several thresholds. */
function batch3Events(state:MatchState):Batch3Event[] {
 const battles=readG23Progress(state)?.economyReceipts.filter(r=>r.kind==='battle')??[];
 return state.augments.flatMap(augment=>{
  const row=AUGMENT_BATCH3[augment.definitionId];if(!row)return [];
  return row.schedules.flatMap((schedule,index)=>{
   const every=batch3Count(row,schedule.every),max=schedule.max===undefined?Infinity:batch3Count(row,schedule.max),events:Batch3Event[]=[];let count=0;
   if(schedule.counter==='round-start'||schedule.counter==='stage-start'){
    // Round entries strictly after acquisition; the acquisition round's own share is an immediate gift.
    const from=schedule.from===undefined?1:batch3Count(row,schedule.from);
    for(let round=augment.acquiredRound+1;round<=state.round&&events.length<max;round++){
     if(schedule.counter==='round-start'?round-augment.acquiredRound>=from:getMultiplayerRoundByOrdinal(round).subround===1)
      events.push({augment,schedule:index,ordinal:events.length,round});
    }
    return events;
   }
   for(const r of battles){
    if(r.kind!=='battle'||r.facts.round<augment.acquiredRound)continue;
    if(schedule.counter==='allied-deaths')count+=r.facts.alliedDeaths;
    else if(r.facts.roundKind==='pvp'&&(schedule.counter==='pvp-combat'||r.facts.result===(schedule.counter==='pvp-win'?'win':'loss')))count++;
    else continue;
    const due=Math.min(schedule.repeat?Math.floor(count/every):count>=every?1:0,max);
    while(events.length<due)events.push({augment,schedule:index,ordinal:events.length,round:r.facts.round});
   }
   return events;
  });
 });
}
function eventGifts(state:MatchState,e:Batch3Event):AugmentGift[] {
 const row=AUGMENT_BATCH3[e.augment.definitionId],schedule=row.schedules[e.schedule];
 // A copy repeats the champion drawn by the acquisition gift at that index (Worth the Wait).
 const gifts=schedule.copyOf===undefined?schedule.gifts:[{kind:'unit' as const,definitionId:planAugmentGifts(state,e.augment,row.gifts)[schedule.copyOf].definitionId}];
 return planAugmentGifts(state,{...e.augment,choiceId:JSON.stringify([e.augment.choiceId,'batch3',e.schedule,e.ordinal]),acquiredRound:e.round},gifts);
}
export function batch3RewardPlan(state:MatchState):AugmentGift[] {
 return batch3Events(state).flatMap(e=>eventGifts(state,e));
}
/** Round entry: grant this round's round/stage-start gifts at once, so item receipts carry the entry round.
 * A unit refused for a full bench stays in the shared batch-1 plan and is retried by its later drains. */
export function drainBatch3RoundEntry(initial:MatchState,policy?:UnitLootPolicy):MatchState {
 let state=initial;
 for(const e of batch3Events(state)){
  const counter=AUGMENT_BATCH3[e.augment.definitionId].schedules[e.schedule].counter;
  if(e.round!==state.round||counter!=='round-start'&&counter!=='stage-start')continue;
  for(const gift of eventGifts(state,e)){
   if(state.seatMechanics?.receipts.some(r=>r.receiptId===gift.receiptId))continue;
   const request={...gift,source:AUGMENT_GIFT_SOURCE};
   const result=gift.kind==='unit'?grantMechanicUnit(state,request,policy):gift.kind==='item'?grantMechanicItem(state,request):grantMechanicConsumable(state,request);
   if(result.ok)state=result.state;
   else if(result.reason!=='bench-full')throw new RangeError(`Augment batch3 round grant: ${result.reason} (${gift.definitionId})`);
  }
 }
 return state;
}
function goldPlan(state:MatchState){
 return batch3Events(state).flatMap(e=>{
  const row=AUGMENT_BATCH3[e.augment.definitionId],key=row.schedules[e.schedule].gold;
  return key?[{receiptId:JSON.stringify([AUGMENT_BATCH3_SOURCE,e.augment.choiceId,e.schedule,e.ordinal]),source:AUGMENT_BATCH3_SOURCE,amount:batch3Count(row,key),round:e.round}]:[];
 });
}
export function drainBatch3Gold(initial:MatchState):MatchState {
 let state=initial;for(const p of goldPlan(state)){
  if(state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId))continue;
  const result=grantMechanicGold(state,p);if(!result.ok)throw new RangeError(result.reason);state=result.state;
 }return state;
}
export function validateBatch3Gold(state:MatchState):void {
 const plan=goldPlan(state),receipts=state.seatMechanics?.receipts??[];
 for(const r of receipts.filter(r=>r.source===AUGMENT_BATCH3_SOURCE||r.receiptId.startsWith(`["${AUGMENT_BATCH3_SOURCE}",`))){
  const p=plan.find(p=>p.receiptId===r.receiptId);
  if(!p||r.kind!=='gold'||r.source!==p.source||r.amount!==p.amount||r.round!==p.round)throw new RangeError('Invalid batch3 gold authority');
 }
 for(const p of plan)if(!receipts.some(r=>r.receiptId===p.receiptId))throw new RangeError('Missing batch3 gold receipt');
}
