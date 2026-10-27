import { batch5RoundInventoryPlan } from './augment-pool-batch5-s3a-history';
import type { MatchState } from './match-types';
import { validateResourceReceipts } from './resource-provenance';
import { planAugmentGifts, augmentAnvilOffers } from './augment-gift-plan';
import { AUGMENT_BATCH5_S3A } from './content/augment-pool-batch5-s3a';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { grantMechanicUnit } from './seat-mechanics/grants';
import { getMultiplayerRoundById } from './multiplayer-round';

export const BATCH5_S3A_SOURCE='augment-pool-batch5-s3a';
export interface InventoryConversion { readonly prefix:number; readonly round:number; readonly itemId:string; readonly to:string|null }
export interface InventoryAnvil { readonly receiptId:string; readonly definitionId:string; readonly acquiredRound:number }
export interface InventoryPlan { readonly items?:readonly import('./strategy-types').ItemInstance[]; readonly conversions:readonly InventoryConversion[]; readonly anvils:readonly InventoryAnvil[] }
/** No new saved facts: the original item birth remains authenticated by its receipt.
 * Consuming it and owing an anvil are pure consequences of that ordered birth. */
export function batch5InventoryPlan(state:MatchState):InventoryPlan {
 return batch5RoundInventoryPlan(state,componentPlan(state));
}
function componentPlan(state:MatchState):InventoryPlan {
 const owner=state.augments.find(a=>a.definitionId==='component-buffet');
 const conversions:InventoryConversion[]=[],anvils:InventoryAnvil[]=[];
 if(!owner)return {conversions,anvils};
 const initial=planAugmentGifts(state,owner,AUGMENT_BATCH5_S3A[owner.definitionId].gifts)[0].receiptId;
 const marker=state.resourceProvenance.entries.find(e=>e.kind==='item-acquired'&&e.source.kind==='mechanic'&&e.source.receiptId===initial);
 if(!marker)return {conversions,anvils};
 const births=validateResourceReceipts({scheduleReceipts:state.scheduleReceipts,lootReceipts:state.m8.loot.receipts,mechanicReceipts:state.seatMechanics?.receipts,carouselReceipts:state.carousel?.receipts,throughRoundOrdinal:state.round});
 const byId=new Map([...births.values()].map(b=>[b.id,b]));
 for(const e of state.resourceProvenance.entries){
  if(e.sequence<=marker.sequence)continue;
  const round=getMultiplayerRoundById(e.roundId).ordinal;
  const outputs=e.kind==='item-acquired'?[{id:e.itemId,definitionId:byId.get(e.itemId)?.definitionId}]
   :e.kind==='consumable-used'?e.record.outputs.filter(o=>!e.record.affectedItems.some(i=>i.id===o.id)):[];
  if(e.kind==='item-acquired'&&e.source.kind==='mechanic'){
   const id=e.source.receiptId,r=state.seatMechanics?.receipts.find(r=>r.receiptId===id);
   if(r?.kind==='choice'&&r.choiceKind==='forge')continue;
  }
  for(const item of outputs)if(item.definitionId&&G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(item.definitionId)){
   conversions.push({prefix:e.sequence+1,round,itemId:item.id,to:null});
   anvils.push({receiptId:JSON.stringify([BATCH5_S3A_SOURCE,owner.choiceId,item.id]),definitionId:'TFT_ArmoryKeyComponent',acquiredRound:round});
  }
 }
 return {conversions,anvils};
}
/** Apply only rule-derived conversions, retaining every unrelated property and item. */
export function projectBatch5Items<T extends {readonly id:string;readonly definitionId:string}>(items:readonly T[],plan:InventoryPlan,prefix:number,round:number,afterPrefix=-1,afterRound=0):T[] {
 let result=[...items];
 for(const c of plan.conversions)if(c.prefix<=prefix&&c.round<=round&&(c.prefix>afterPrefix||c.prefix===afterPrefix&&c.round>afterRound))result=c.to===null?result.filter(i=>i.id!==c.itemId):result.map(i=>i.id===c.itemId?{...i,definitionId:c.to!}:i);
 return result;
}
export function drainBatch5Inventory(state:MatchState):MatchState {
 if(!state.augments.some(a=>AUGMENT_BATCH5_S3A[a.definitionId]))return state;
 // Natural-entry effects have already committed before combat freezes. Ordinary
 // ticks have no inventory work; a newly reforged component alone can need B5-13.
 if(state.phase==='combat'){
  const start=state.combatInputBasis?.nextItemSerial;
  if(!state.augments.some(a=>a.definitionId==='component-buffet')||start!==undefined&&!state.items.some(i=>G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(i.definitionId)&&Number(i.id.slice(5))>=start))return state;
  return {...state,items:projectBatch5Items(state.items,componentPlan(state),state.resourceProvenance.entries.length,state.round)};
 }
 const plan=batch5InventoryPlan(state);
 state={...state,items:plan.items?plan.items.filter(i=>!state.d14?.held?.items.some(h=>h.id===i.id)):projectBatch5Items(state.items,plan,state.resourceProvenance.entries.length,state.round)};
 // Live combat freezes the roster. Entitlements survive it and full benches without an extra saved queue.
 if(state.m8.round.kind==='supply'||state.multiplayer?.combatRosterLocked)return state;
 for(const gift of plan.anvils){
  if(state.seatMechanics?.receipts.some(r=>r.receiptId===gift.receiptId))continue;
  const granted=grantMechanicUnit(state,{...gift,source:BATCH5_S3A_SOURCE,immediate:true});
  if(granted.ok)state=granted.state;
  else if(granted.reason!=='bench-full')throw new RangeError('Invalid batch5 inventory grant');
 }
 return state;
}
export function batch5AnvilSpecification(state:MatchState,receiptId:string){
 const gift=batch5InventoryPlan(state).anvils.find(g=>g.receiptId===receiptId);
 return gift?{definitionId:gift.definitionId,offers:augmentAnvilOffers(state.seed,receiptId,gift.definitionId as 'TFT_ArmoryKeyComponent'|'TFT_ArmoryKeySupport')}:undefined;
}
export function validateBatch5Inventory(state:MatchState,plan=batch5InventoryPlan(state)):void {
 // Shared restores do not run the solo combat-growth fold. Authenticate the same
 // item births/serials here without pretending PvP settlement receipts are solo battles.
 if(state.augments.some(a=>AUGMENT_BATCH5_S3A[a.definitionId])){
  const births=validateResourceReceipts({scheduleReceipts:state.scheduleReceipts,lootReceipts:state.m8.loot.receipts,mechanicReceipts:state.seatMechanics?.receipts,carouselReceipts:state.carousel?.receipts,throughRoundOrdinal:state.round});
  const used=new Set<string>();let serial=1,lastRound=1;
  const check=(ok:unknown)=>{if(!ok)throw new RangeError('Invalid batch5 item receipt history');};
  for(const [index,e] of state.resourceProvenance.entries.entries()){
   const round=getMultiplayerRoundById(e.roundId).ordinal;check(e.sequence===index&&round>=lastRound&&round<=state.round);lastRound=round;
   if(e.kind==='item-acquired'){
    const source=e.source,key=source.kind==='schedule'?`schedule:${source.eventId}`:source.kind==='carousel'?`carousel-item:${source.receiptId}`:`${source.kind}:${source.receiptId}`;
    const b=births.get(key);check(b?.kind==='item'&&b.id===e.itemId&&b.roundId===e.roundId&&!used.has(key)&&e.itemId===`item-${serial++}`);used.add(key);
   }else if(e.kind==='item-combined')check(e.event.itemId===`item-${serial++}`);
   else if(e.kind==='consumable-used')for(const [n,o] of e.record.outputs.entries())if(o.id!==e.record.affectedItems[n]?.id)check(o.id===`item-${serial++}`);
  }
  check(serial===state.nextItemSerial&&[...births].filter(([,b])=>b.kind==='item').every(([key])=>used.has(key)));
 }

 if(state.phase!=='combat'&&state.m8.round.kind!=='supply'&&!state.multiplayer?.combatRosterLocked&&state.preparation.units.filter(u=>u.location.kind==='bench').length<state.preparation.benchSize
   &&plan.anvils.some(g=>!state.seatMechanics?.receipts.some(r=>r.receiptId===g.receiptId)))throw new RangeError('Missing batch5 inventory anvil');
 for(const r of state.seatMechanics?.receipts??[])if(r.source===BATCH5_S3A_SOURCE||r.receiptId.startsWith(`["${BATCH5_S3A_SOURCE}",`)){
  const gift=plan.anvils.find(g=>g.receiptId===r.receiptId);
  if(!gift||r.source!==BATCH5_S3A_SOURCE||r.kind!=='unit'||r.definitionId!==gift.definitionId||r.resolution!=='held'||r.gold!==0||r.round<gift.acquiredRound||r.round>state.round)throw new RangeError('Invalid batch5 inventory authority');
 }
}
