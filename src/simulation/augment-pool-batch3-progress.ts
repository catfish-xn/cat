import type { MatchState } from './match-types';
import type { AugmentGift } from './augment-gift-plan';
import { planAugmentGifts } from './augment-gift-plan';
import { readG23Progress } from './g2-3-state';
import { AUGMENT_BATCH3, batch3Count } from './content/augment-pool-batch3';
import { grantMechanicGold } from './seat-mechanics/grants';
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
   for(const r of battles){
    if(r.kind!=='battle'||r.facts.round<augment.acquiredRound)continue;
    if(schedule.counter==='allied-deaths')count+=r.facts.alliedDeaths;
    else if(r.facts.roundKind==='pvp'&&(schedule.counter==='pvp-combat'||r.facts.result==='loss'))count++;
    else continue;
    const due=Math.min(schedule.repeat?Math.floor(count/every):count>=every?1:0,max);
    while(events.length<due)events.push({augment,schedule:index,ordinal:events.length,round:r.facts.round});
   }
   return events;
  });
 });
}
export function batch3RewardPlan(state:MatchState):AugmentGift[] {
 return batch3Events(state).flatMap(e=>planAugmentGifts(state,{...e.augment,choiceId:JSON.stringify([e.augment.choiceId,'batch3',e.schedule,e.ordinal]),acquiredRound:e.round},
  AUGMENT_BATCH3[e.augment.definitionId].schedules[e.schedule].gifts));
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
