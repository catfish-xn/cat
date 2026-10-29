import { nextRandom } from './rng';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import type { MatchState } from './match-types';
import type { ItemInstance } from './strategy-types';
import { validateResourceReceipts } from './resource-provenance';
import { getMultiplayerRoundById } from './multiplayer-round';
import { planCombine, planEquip } from './inventory';
import { replayConsumableItems } from './consumables';
import { transferUpgradeResources } from './upgrades';
import { selectOpeningUnit } from './opening-unit';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { AUGMENT_BATCH5_S3A } from './content/augment-pool-batch5-s3a';
import { BATCH5_S3A_SOURCE, projectBatch5Items, type InventoryPlan, type InventoryConversion, type InventoryAnvil } from './augment-pool-batch5-s3a';

/** Replay the existing ordered item history, including equip/remove within one round.
 * Neither live inventory nor a writable age counter is evidence of continuous residence. */
export function batch5RoundInventoryPlan(state:MatchState,base:InventoryPlan):InventoryPlan {
 const vintage=state.augments.find(a=>a.definitionId==='fine-vintage');
 const pandora=state.augments.find(a=>a.definitionId==='pandoras-items');
 if(!vintage&&!pandora)return base;
 const conversions:InventoryConversion[]=[...base.conversions],anvils:InventoryAnvil[]=[...base.anvils],plan={conversions,anvils};
 const births=validateResourceReceipts({scheduleReceipts:state.scheduleReceipts,lootReceipts:state.m8.loot.receipts,mechanicReceipts:state.seatMechanics?.receipts,carouselReceipts:state.carousel?.receipts,throughRoundOrdinal:state.round});
 const byId=new Map([...births.values()].map(b=>[b.id,b]));
 let items:readonly ItemInstance[]=[],serial=1,round=1;
 let preparation={...state.preparation,units:[] as MatchState['preparation']['units']};
 const ages=new Map<string,{definitionId:string;since:number}>();
 const check=(ok:unknown):void=>{if(!ok)throw new RangeError('Invalid batch5 inventory history');};
 const track=()=>{
  const eligible=items.filter(i=>i.location.kind==='inventory'&&ITEM_DEFINITIONS[i.definitionId]?.kind==='completed');
  for(const id of ages.keys())if(!eligible.some(i=>i.id===id))ages.delete(id);
  for(const i of eligible)if(ages.get(i.id)?.definitionId!==i.definitionId)ages.set(i.id,{definitionId:i.definitionId,since:Math.max(round,vintage?.acquiredRound??round)});
 };
 const enter=(target:number,prefix:number)=>{
  while(round<target){
   round++;
   if(vintage&&round>vintage.acquiredRound)for(const item of items){
    const age=ages.get(item.id);
    if(age&&round-age.since>=AUGMENT_BATCH5_S3A['fine-vintage'].source.values.rounds!){
     conversions.push({prefix,round,itemId:item.id,to:null});
     anvils.push({receiptId:JSON.stringify([BATCH5_S3A_SOURCE,vintage.choiceId,item.id,round]),definitionId:'TFT_ArmoryKeySupport',acquiredRound:round});
    }
   }
   if(pandora&&round>pandora.acquiredRound)for(const item of items){
    if(item.location.kind!=='inventory')continue;
    const pool=G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(item.definitionId)?G24_FORGE_POOLS.TFT_ArmoryKeyComponent
     :G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.includes(item.definitionId)?G24_FORGE_POOLS.TFT_ArmoryKeyCompleted:null;
    if(!pool)continue;
    const namespace=JSON.stringify([BATCH5_S3A_SOURCE,state.multiplayer?.seatId??'solo',pandora.choiceId,round,item.id]);
    let hash=0x811c9dc5;for(let i=0;i<namespace.length;i++)hash=Math.imul(hash^namespace.charCodeAt(i),16777619)>>>0;
    const draw=nextRandom((state.seed^hash)>>>0),to=pool[Math.floor(draw.word*pool.length/4294967296)];
    conversions.push({prefix,round,itemId:item.id,to});
   }
   items=projectBatch5Items(items,plan,prefix,round,prefix,round-1);track();
  }
 };
 for(const fact of state.resourceProvenance.entries){
  enter(getMultiplayerRoundById(fact.roundId).ordinal,fact.sequence);
  switch(fact.kind){
   case 'unit-acquired':{
    const definitionId=fact.source.kind==='opening'?selectOpeningUnit(fact.source.seed,fact.source.seatId):fact.source.kind==='shop'?fact.source.definitionId:byId.get(fact.unitId)?.definitionId;
    check(definitionId);preparation={...preparation,units:[...preparation.units,{id:fact.unitId,definitionId:definitionId!,team:'player',starLevel:1,location:{kind:'bench',slot:0}}]};break;
   }
   case 'item-acquired':{
    const birth=byId.get(fact.itemId);check(birth);items=[...items,{id:fact.itemId,definitionId:birth!.definitionId,location:{kind:'inventory'}}];serial++;break;
   }
   case 'unit-sold':case 'anvil-opened':case 'unit-removed':{
    if(fact.kind==='unit-removed'&&fact.definitionId===undefined)break;
    items=items.map(i=>i.location.kind==='unit'&&i.location.unitId===fact.unitId?{...i,location:{kind:'inventory'}}:i);
    preparation={...preparation,units:preparation.units.filter(u=>u.id!==fact.unitId)};break;
   }
   case 'unit-upgraded':case 'unit-upgraded-after-combat':case 'carousel-unit-claimed':case 'carousel-preparation-settled':{
    const upgrades='event'in fact?[fact.event]:fact.upgrades;
    items=transferUpgradeResources(items,null,upgrades).items;
    for(const e of upgrades)preparation={...preparation,units:preparation.units.filter(u=>!e.consumedIds.includes(u.id)).map(u=>u.id===e.survivorId?{...u,starLevel:e.toStar}:u)};break;
   }
   case 'item-equipped':{
    const p=planEquip(items,preparation,fact.itemId,fact.unitId,fact.slot,serial);check(p.ok);if(p.ok){check(p.nextItemSerial===serial);items=p.items;}break;
   }
   case 'item-combined':{
    const inputs=fact.event.consumedIds.map(id=>items.find(i=>i.id===id));check(inputs.every(Boolean));
    const held=inputs.find(i=>i!.location.kind==='unit'),incoming=inputs.find(i=>i!.location.kind==='inventory');
    const p=held?.location.kind==='unit'?planEquip(items,preparation,incoming!.id,held.location.unitId,held.location.slot,serial):planCombine(items,serial,inputs[0]!.id,inputs[1]!.id);
    check(p.ok);if(p.ok){check(p.events.some(e=>e.type==='itemCombined'&&e.definitionId===fact.event.definitionId&&e.itemId===fact.event.itemId));items=p.items;serial=p.nextItemSerial;}break;
   }
   case 'consumable-used':{const p=replayConsumableItems(items,serial,fact.record,preparation);items=p.items;serial=p.nextItemSerial;break;}
   case 'g23-item-converted':items=items.map(i=>i.id===fact.itemId?{...i,definitionId:fact.to}:i);break;
  }
  items=projectBatch5Items(items,base,fact.sequence+1,round,fact.sequence,round);track();
 }
 enter(state.round,state.resourceProvenance.entries.length);
 return {...plan,items};
}
