import { canonicalContent } from './content';
import { validatePveRemover } from './pve-remover';
import { CONSUMABLE_DEFINITIONS, CONSUMABLE_RULES, REFORGE_POOLS } from './content/consumables';
import { canOperateEquipment, isCombatRosterLocked } from './operation-policy';
import { getCatalogRoundById } from './round-selectors';
import { planEquip } from './inventory';
import type { GameState } from './game';
import { drawIndex } from './orb-layout';
import type { MatchState, MatchEvent } from './match-types';
import type { ConsumablePreview, ConsumableTarget, ConsumableUseRecord } from './consumable-types';
import type { ItemInstance } from './strategy-types';
import { SHOP_CATALOG } from './match-rules';
import { UNIT_DEFINITIONS } from './units';
import { planUnitAcquisition } from './unit-acquisition';
import { grantMechanicUnit } from './seat-mechanics/grants';
export type * from './consumable-types';
const equal=(a:unknown,b:unknown)=>canonicalContent(a)===canonicalContent(b);
export const consumableCopyReceiptId=(id:string)=>JSON.stringify(['consumable-copy',id]);

/** Category membership is explicit. Reward-only completed identities never enter the ordinary 36 pool. */
export function reforgeCandidates(definitionId:string):readonly {readonly definitionId:string}[]{
  const pool=Object.values(REFORGE_POOLS).find(entries=>entries.some(d=>d.definitionId===definitionId));
  return pool?.filter(d=>d.definitionId!==definitionId)??[];
}
export function previewUseConsumable(state:Readonly<MatchState>,consumableId:string,target:ConsumableTarget):ConsumablePreview {
  if(!canOperateEquipment(state))return {ok:false,reason:'wrong-phase'};
  const tool=state.consumables.find(c=>c.consumableId===consumableId);
  if(!tool)return {ok:false,reason:'unknown-consumable'};
  const definition=CONSUMABLE_DEFINITIONS[tool.definitionId];
  if(!definition)throw new RangeError('Invalid consumable definition');
  if(!target||target.kind!=='unit')return {ok:false,reason:'invalid-consumable-target'};
  const unit=state.preparation.units.find(u=>u.id===target.unitId);
  if(!unit)return {ok:false,reason:'unknown-unit'};
  if(unit.team!=='player')return {ok:false,reason:'invalid-consumable-target'};
  if(definition.effect==='duplicate-unit'){
    if(isCombatRosterLocked(state))return {ok:false,reason:'wrong-phase'};
    if(!SHOP_CATALOG.includes(unit.definitionId)||(definition.maxCost!==null&&UNIT_DEFINITIONS[unit.definitionId].cost>definition.maxCost))return {ok:false,reason:'invalid-consumable-target'};
    if(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length>=state.preparation.benchSize)return {ok:false,reason:'bench-full'};
    if(!planUnitAcquisition(state,unit.definitionId,{kind:'mechanic',receiptId:consumableCopyReceiptId(consumableId)},state.resourceProvenance.entries.length).ok)return {ok:false,reason:'bench-full'};
    return {ok:true,effect:definition.effect,affectedItemIds:[],destination:'inventory',affectsCurrentBattle:false};
  }
  const items=state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===unit.id)
    .sort((a,b)=>(a.location.kind==='unit'?a.location.slot:0)-(b.location.kind==='unit'?b.location.slot:0));
  if(!items.length)return {ok:false,reason:definition.effect==='reforge-all'?'invalid-consumable-target':'no-removable-items'};
  return {ok:true,effect:definition.effect,affectedItemIds:items.map(i=>i.id),destination:'inventory',affectsCurrentBattle:false};
}
export function planConsumable(state:MatchState,consumableId:string,target:ConsumableTarget){
  const preview=previewUseConsumable(state,consumableId,target);
  if(!preview.ok)return preview;
  const tool=state.consumables.find(c=>c.consumableId===consumableId)!;
  const affectedItems=preview.affectedItemIds.map(id=>structuredClone(state.items.find(i=>i.id===id)!));
  let rngAfter=state.reforgeState,nextItemSerial=state.nextItemSerial;
  const outputs:ConsumableUseRecord['outputs'][number][]=[],events:MatchEvent[]=[];
  let items=state.items;
  if(preview.effect!=='duplicate-unit'){
    const ids=new Set(preview.affectedItemIds);
    items=state.items.filter(i=>!ids.has(i.id));
    for(const original of affectedItems){
      const candidates=preview.effect==='reforge-all'?reforgeCandidates(original.definitionId):[];
      let output={id:original.id,definitionId:original.definitionId};
      if(candidates.length){
        if(!Number.isSafeInteger(nextItemSerial+1)||state.items.some(i=>i.id===`item-${nextItemSerial}`))throw new RangeError('Invalid reforge serial');
        const draw=drawIndex(rngAfter,candidates.length);rngAfter=draw.rng;
        output={id:`item-${nextItemSerial++}`,definitionId:candidates[draw.index].definitionId};
        events.push({type:'itemReforged',itemId:original.id,definitionId:original.definitionId,outputItemId:output.id,outputDefinitionId:output.definitionId,consumableId});
      }
      outputs.push(output);items=[...items,{...output,location:{kind:'inventory'}}];
    }
    items=[...items].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    events.push({type:'itemsRemoved',unitId:(target as Extract<ConsumableTarget,{kind:'unit'}>).unitId,itemIds:preview.affectedItemIds});
  }
  const unit=target.kind==='unit'?state.preparation.units.find(u=>u.id===target.unitId):undefined;
  const copiedUnit=preview.effect==='duplicate-unit'?{id:unit!.id,definitionId:unit!.definitionId}:null;
  const output=preview.effect==='reforge-all'?(outputs[0]??null):null;
  const record:ConsumableUseRecord={...tool,target:structuredClone(target),effect:preview.effect,affectedItems,outputs,output,copiedUnit,rngBefore:state.reforgeState,rngAfter};
  events.push({type:'consumableUsed',...tool,target:structuredClone(target),effect:preview.effect,affectedItemIds:preview.affectedItemIds,outputItemId:output?.id??null});
  const next:MatchState={...state,items,nextItemSerial,reforgeState:rngAfter,consumables:state.consumables.filter(c=>c.consumableId!==consumableId)};
  // Match appends the use fact BEFORE this grant, so ordered provenance proves the target existed at use time.
  return {ok:true as const,record,events,state:next};
}
export function grantConsumableCopy(state:MatchState,record:ConsumableUseRecord){
  if(!record.copiedUnit)return {state,events:[] as readonly MatchEvent[]};
  const granted=grantMechanicUnit(state,{receiptId:consumableCopyReceiptId(record.consumableId),source:'consumable-copy',definitionId:record.copiedUnit.definitionId});
  if(!granted.ok)throw new RangeError('Invalid consumable copy continuation');
  return granted;
}
/** Replay recorded equipment changes against an authenticated prefix; never allocates resources. */
export function replayConsumableItems(items:readonly ItemInstance[],serial:number,record:ConsumableUseRecord,preparation:GameState){
  const fail=():never=>{throw new RangeError('Invalid consumable equipment continuation');};
  if(record.effect==='duplicate-unit')return {items,nextItemSerial:serial};
  if(record.affectedItems.some(before=>!items.some(i=>i.id===before.id&&i.definitionId===before.definitionId&&(i.location.kind==='inventory'||equal(i.location,before.location)))))fail();
  let placed=items;
  for(const before of record.affectedItems){
    const current=placed.find(i=>i.id===before.id)!;
    if(current.location.kind==='inventory'&&before.location.kind==='unit'){
      const plan=planEquip(placed,preparation,before.id,before.location.unitId,before.location.slot,serial);
      if(!plan.ok||plan.nextItemSerial!==serial||!plan.items.some(i=>equal(i,before)))return fail();
      placed=plan.items;
    }
  }
  if(record.target.kind!=='unit')return fail();
  const unitId=record.target.unitId;
  if(placed.some(i=>i.location.kind==='unit'&&i.location.unitId===unitId&&!record.affectedItems.some(a=>a.id===i.id)))fail();
  const ids=new Set(record.affectedItems.map(i=>i.id));
  for(const [n,output] of record.outputs.entries())if(output.id!==record.affectedItems[n].id){if(output.id!==`item-${serial++}`)fail();}
  return {items:[...items.filter(i=>!ids.has(i.id)),...record.outputs.map(i=>({...i,location:{kind:'inventory' as const}}))].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),nextItemSerial:serial};
}
/** Rebuild tools from unique grant receipts and validate each ordered draw/output. */
export function validateConsumableState(state:MatchState):void {
  validatePveRemover(state);
  const check=(condition:unknown)=>{if(!condition)throw new RangeError('Invalid consumable ledger');};
  const grants=new Map<string,{definitionId:string;roundId:string}>();let serial=1;
  const all:{id:string;definitionId:string;roundId:string}[]=[];
  for(const r of state.seatMechanics?.receipts??[])if(r.kind==='consumable'){check(Object.hasOwn(CONSUMABLE_DEFINITIONS,r.definitionId));all.push({id:r.consumableId,definitionId:r.definitionId,roundId:r.roundId});}
  for(const receipt of state.m8.loot.receipts){
    if(receipt.payload.kind!=='consumable'||receipt.resolution==='forfeited'){check(!receipt.grantedConsumableIds);continue;}
    const ids=receipt.grantedConsumableIds;check(ids?.length===1&&receipt.payload.quantity===1&&Object.hasOwn(CONSUMABLE_DEFINITIONS,receipt.payload.definitionId));
    const drop=state.m8.loot.frozen.rounds.flatMap(r=>r.encounterPlan.drops).find(d=>d.dropId===receipt.dropId);check(drop);
    all.push({id:ids![0],definitionId:receipt.payload.definitionId,roundId:receipt.claimedRoundId??drop!.roundId});
  }
  all.sort((a,b)=>Number(a.id.slice(11))-Number(b.id.slice(11)));
  for(const r of all){check(r.id===`consumable-${serial}`&&!grants.has(r.id));grants.set(r.id,{definitionId:r.definitionId,roundId:r.roundId});serial++;}
  let rng={state:(state.seed^CONSUMABLE_RULES.seedXor)>>>0,draws:0};const settled=new Set<string>(),copies=new Set<string>();
  for(const fact of state.resourceProvenance.entries){
    if(fact.kind==='combat-growth-committed')settled.add(fact.roundId);
    if(fact.kind!=='consumable-used')continue;
    const r=fact.record,grant=grants.get(r.consumableId),definition=CONSUMABLE_DEFINITIONS[r.definitionId];
    check(grant&&grant.definitionId===r.definitionId&&definition&&definition.effect===r.effect&&r.target.kind==='unit'&&equal(r.rngBefore,rng));
    const loot=state.m8.loot.receipts.find(x=>x.grantedConsumableIds?.includes(r.consumableId));
    check(grant&&(settled.has(grant.roundId)||loot?.claimedRoundId||state.seatMechanics?.receipts.some(x=>x.kind==='consumable'&&x.consumableId===r.consumableId))&&getCatalogRoundById(grant.roundId).ordinal<=getCatalogRoundById(fact.roundId).ordinal);
    check(Array.isArray(r.affectedItems)&&Array.isArray(r.outputs)&&new Set(r.affectedItems.map(i=>i.id)).size===r.affectedItems.length);
    if(definition.effect==='duplicate-unit'){
      check(r.affectedItems.length===0&&r.outputs.length===0&&r.output===null&&r.copiedUnit&&r.target.kind==='unit'&&r.copiedUnit.id===r.target.unitId&&SHOP_CATALOG.includes(r.copiedUnit.definitionId)&&(definition.maxCost===null||UNIT_DEFINITIONS[r.copiedUnit.definitionId].cost<=definition.maxCost));
      const id=consumableCopyReceiptId(r.consumableId),receipt=state.seatMechanics?.receipts.find(x=>x.receiptId===id);
      check(receipt?.kind==='unit'&&receipt.source==='consumable-copy'&&receipt.definitionId===r.copiedUnit?.definitionId&&receipt.resolution===(state.multiplayer?'orb':'held')&&receipt.roundId===fact.roundId);copies.add(id);
    }else{
      check(r.affectedItems.length>0&&r.copiedUnit===null&&r.outputs.length===r.affectedItems.length&&r.affectedItems.every(i=>i.location.kind==='unit'&&r.target.kind==='unit'&&i.location.unitId===r.target.unitId));
      check(r.affectedItems.every((item,i)=>item.location.kind==='unit'&&(i===0||r.affectedItems[i-1].location.kind==='unit'&&(r.affectedItems[i-1].location as {slot:number}).slot<item.location.slot)));
      for(const [i,original] of r.affectedItems.entries()){
        const candidates=r.effect==='reforge-all'?reforgeCandidates(original.definitionId):[];
        let expected=original.definitionId;
        if(candidates.length){const draw=drawIndex(rng,candidates.length);rng=draw.rng;expected=candidates[draw.index].definitionId;}
        check(r.outputs[i]?.definitionId===expected&&(candidates.length?r.outputs[i].id!==original.id:r.outputs[i].id===original.id));
      }
      check(equal(r.output,r.effect==='reforge-all'?r.outputs[0]:null));
    }
    check(equal(r.rngAfter,rng));grants.delete(r.consumableId);
  }
  check((state.seatMechanics?.receipts??[]).filter(r=>r.source==='consumable-copy').every(r=>copies.has(r.receiptId)));
  check(serial===state.nextConsumableSerial&&equal(rng,state.reforgeState)&&equal(state.consumables,[...grants].map(([consumableId,g])=>({consumableId,definitionId:g.definitionId}))));
}
