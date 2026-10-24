import type { MatchState } from './match-types';
import type { AugmentGift } from './augment-gift-plan';
import { planAugmentGifts } from './augment-gift-plan';
import { readG23Progress } from './g2-3-state';
import { AUGMENT_BATCH3, batch3Count } from './content/augment-pool-batch3';
import { grantMechanicGold, grantMechanicItem, grantMechanicUnit, grantMechanicConsumable } from './seat-mechanics/grants';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { AUGMENT_GIFT_SOURCE } from './augment-gift-plan';
import { appendResourceProvenance } from './resource-provenance';
import { EMBLEM_ITEMS } from './content/emblems';
import { nextRandom } from './rng';
import type { UnitLootPolicy } from './loot-runtime';
export const AUGMENT_BATCH3_SOURCE='augment-pool-batch3';
const DUMMY_SOURCE='augment-pool-batch3-dummy';
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
    // P 2026-10-24: a champion is never born on a supply (carousel) round; that entry's copy waits for the next
    // non-supply round entry, keeping its own ordinal and receipt. Items still arrive on the supply round itself.
    const units=schedule.copyOf!==undefined||schedule.gifts.some(g=>g.kind==='unit'||g.kind==='random-unit'||g.kind==='random-unit-pool'||g.kind==='all-units');
    for(let round=augment.acquiredRound+1;round<=state.round&&events.length<max;round++){
     if(!(schedule.counter==='round-start'?round-augment.acquiredRound>=from:getMultiplayerRoundByOrdinal(round).subround===1))continue;
     let due=round;while(units&&getMultiplayerRoundByOrdinal(due).kind==='supply')due++;
     if(due<=state.round)events.push({augment,schedule:index,ordinal:events.length,round:due});
     else break;
    }
    return events;
   }
   const dummy=schedule.counter.startsWith('dummy-')?ownDummyId(state,augment):undefined;
   if(schedule.counter.startsWith('dummy-')&&schedule.counter!=='dummy-gold'&&!dummy)return events;
   for(const r of battles){
    if(r.kind!=='battle'||r.facts.round<augment.acquiredRound)continue;
    if(schedule.counter==='dummy-deaths')count+=r.facts.batch3Dummy?.deaths.includes(dummy!)?1:0;
    else if(schedule.counter==='dummy-first-death')count+=r.facts.roundKind==='pvp'&&r.facts.batch3Dummy?.first===dummy?1:0;
    else if(schedule.counter==='dummy-gold')count+=r.facts.batch3Dummy?.gold??0;
    else if(schedule.counter==='allied-deaths')count+=r.facts.alliedDeaths;
    else if(schedule.counter==='team-healing')count+=r.facts.batch3Healing??0;
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
/** The training dummy born from the augment's own acquisition gift (gift index 0), once its receipt exists. */
export function ownDummyId(state:MatchState,augment:MatchState['augments'][number]):string|undefined {
 const gift=planAugmentGifts(state,augment,AUGMENT_BATCH3[augment.definitionId]?.gifts??[]).find(g=>g.definitionId==='training-dummy');
 const r=gift&&state.seatMechanics?.receipts.find(r=>r.receiptId===gift.receiptId);
 return r?.kind==='unit'&&r.unitId?r.unitId:undefined;
}
const retireId=(augment:MatchState['augments'][number])=>JSON.stringify([AUGMENT_BATCH3_SOURCE,augment.choiceId,'retire-dummy']);
/** Distinct emblems (an emblem cannot be held twice), drawn by a partial shuffle of the sorted emblem pool on a
 * source/seat/choice-bound stream; P 2026-10-24. Own receipt namespace: never part of the batch-1 inventory plan. */
const emblemGifts=(state:MatchState,augment:MatchState['augments'][number])=>{
 const row=AUGMENT_BATCH3[augment.definitionId];if(!row?.dummyEmblems)return [];
 const namespace=JSON.stringify([DUMMY_SOURCE,state.multiplayer?.seatId??'solo',augment.choiceId,augment.definitionId]);
 let rng=0x811c9dc5;for(let i=0;i<namespace.length;i++)rng=Math.imul(rng^namespace.charCodeAt(i),0x01000193)>>>0;rng=(state.seed^rng)>>>0;
 const pool=Object.keys(EMBLEM_ITEMS).sort(),n=batch3Count(row,row.dummyEmblems);
 for(let i=0;i<n;i++){const draw=nextRandom(rng);rng=draw.state;const j=i+Math.floor(draw.word*(pool.length-i)/4294967296);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,n).map((definitionId,slot)=>({receiptId:JSON.stringify([DUMMY_SOURCE,augment.choiceId,slot]),definitionId}));
};
/** Wandering Trainer emblems go straight onto the augment's dummy (never inventory); Support Mining retires its dummy
 * when the death threshold fires. Both run only outside combat, after the dummy's birth receipt exists. */
export function drainBatch3Dummies(initial:MatchState):MatchState {
 let state=initial;if(state.phase==='combat')return state;
 for(const augment of state.augments){
  const unitId=ownDummyId(state,augment);if(!unitId)continue;
  for(const [slot,gift] of emblemGifts(state,augment).entries()){
   if(state.seatMechanics?.receipts.some(r=>r.receiptId===gift.receiptId))continue;
   const granted=grantMechanicItem(state,{receiptId:gift.receiptId,definitionId:gift.definitionId,source:DUMMY_SOURCE});
   if(!granted.ok||granted.receipt.kind!=='item')throw new RangeError(`Augment batch3 dummy emblem: ${granted.ok?'kind':granted.reason}`);
   const itemId=granted.receipt.itemId;
   state={...granted.state,items:granted.state.items.map(i=>i.id===itemId?{...i,location:{kind:'unit',unitId,slot}}:i),
    resourceProvenance:appendResourceProvenance(granted.state.resourceProvenance,state.roundDefinitionId,{kind:'item-equipped',itemId,unitId,slot})};
  }
  const retire=batch3Events(state).some(e=>e.augment===augment&&AUGMENT_BATCH3[augment.definitionId].schedules[e.schedule].retireDummy);
  if(retire&&state.preparation.units.some(u=>u.id===unitId))
   state={...state,preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.id!==unitId)},
    resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,{kind:'unit-removed',unitId,receiptId:retireId(augment)})};
 }
 return state;
}
export function validateBatch3Dummies(state:MatchState):void {
 const fail=(why:string)=>{throw new RangeError('Invalid batch3 dummy authority: '+why);};
 const removals=state.resourceProvenance.entries.filter(e=>e.kind==='unit-removed') as readonly Extract<(typeof state.resourceProvenance.entries)[number],{kind:'unit-removed'}>[];
 const expected=new Map<string,string>();
 for(const augment of state.augments){
  const unitId=ownDummyId(state,augment),row=AUGMENT_BATCH3[augment.definitionId];if(!row)continue;
  if(row.dummyEmblems&&unitId){
   const present=state.preparation.units.some(u=>u.id===unitId);
   for(const [slot,gift] of emblemGifts(state,augment).entries()){
    const r=state.seatMechanics?.receipts.find(r=>r.receiptId===gift.receiptId);
    if(!r){if(present&&state.phase!=='combat')fail('missing emblem');continue;}
    if(r.kind!=='item'||r.definitionId!==gift.definitionId||r.source!==DUMMY_SOURCE)fail('emblem receipt');
    if(r.kind==='item'&&present&&!state.items.some(i=>i.id===r.itemId&&i.location.kind==='unit'&&i.location.unitId===unitId&&i.location.slot===slot))fail('emblem detached');
   }
  }
  if(unitId&&batch3Events(state).some(e=>e.augment===augment&&row.schedules[e.schedule].retireDummy))expected.set(retireId(augment),unitId);
 }
 const emblems=new Set(state.augments.flatMap(a=>emblemGifts(state,a).map(g=>g.receiptId)));
 for(const r of state.seatMechanics?.receipts??[])if((r.source===DUMMY_SOURCE||r.receiptId.startsWith(`["${DUMMY_SOURCE}",`))&&!emblems.has(r.receiptId))fail('unexpected emblem');
 for(const e of removals)if(expected.get(e.receiptId)!==e.unitId)fail('unexpected removal');
 if(new Set(removals.map(e=>e.receiptId)).size!==removals.length)fail('duplicate removal');
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
