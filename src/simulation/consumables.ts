
import { isAnvil } from './content/anvils';
import { ITEM_DEFINITIONS as ORDINARY_ITEMS } from './content/items';
import { g23RadiantDefinitionId } from './g2-3-rewards';
import { isTemporaryItemId } from './temporary-equipment';
import { canonicalContent } from './content';
import { CONSUMABLE_DEFINITIONS,  REFORGE_POOLS, consumableTraitId } from './content/consumables';
import { canOperateEquipment, isCombatRosterLocked } from './operation-policy';
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
import { CARRY_GOLEM_ID } from './content/augment-pool-batch5-g6';
export type * from './consumable-types';
export const equal=(a:unknown,b:unknown)=>canonicalContent(a)===canonicalContent(b);
/** Lesser Shimmer Duplicator: the copied hero must carry the tool's trait (Chem-Baron). */
export const hasTargetTrait=(definition:(typeof CONSUMABLE_DEFINITIONS)[keyof typeof CONSUMABLE_DEFINITIONS],definitionId:string)=>{
  const trait=consumableTraitId(definition);
  return trait===null||(UNIT_DEFINITIONS[definitionId]?.traits as readonly string[]|undefined)?.includes(trait)===true;
};
export const consumableCopyReceiptId=(id:string)=>JSON.stringify(['consumable-copy',id]);

/** Category membership is explicit. Reward-only completed identities never enter the ordinary 36 pool. */
export function reforgeCandidates(definitionId:string):readonly {readonly definitionId:string}[]{
  const pool=Object.values(REFORGE_POOLS).find(entries=>entries.some(d=>d.definitionId===definitionId));
  return pool?.filter(d=>d.definitionId!==definitionId)??[];
}
/** Only permanent ordinary craftable completed items have a masterwork target. */
export function masterworkCandidates(state: Readonly<MatchState>, unitId: string): readonly ItemInstance[] {
  if (state.preparation.units.some(u => u.id === unitId && u.definitionId === CARRY_GOLEM_ID)) return [];
  return state.items.filter(i => i.location.kind === 'unit' && i.location.unitId === unitId
    && ORDINARY_ITEMS[i.definitionId]?.kind === 'completed' && ORDINARY_ITEMS[i.definitionId]?.recipe
    && !!g23RadiantDefinitionId(i.definitionId) && !isTemporaryItemId(state, i.id))
    .sort((a,b) => (a.location.kind === 'unit' ? a.location.slot : 0) - (b.location.kind === 'unit' ? b.location.slot : 0));
}
export function previewUseConsumable(state:Readonly<MatchState>,consumableId:string,target:ConsumableTarget):ConsumablePreview {
  if(!canOperateEquipment(state))return {ok:false,reason:'wrong-phase'};
  const tool=state.consumables.find(c=>c.consumableId===consumableId);
  if(!tool)return {ok:false,reason:'unknown-consumable'};
  const definition=CONSUMABLE_DEFINITIONS[tool.definitionId];
  if(!definition)throw new RangeError('Invalid consumable definition');
  if(!target||target.kind!=='unit')return {ok:false,reason:'invalid-consumable-target'};
  const unit=state.preparation.units.find(u=>u.id===target.unitId);
  if(unit&&(unit.definitionId==='carry-golem'||unit.definitionId==='trainer-golem'||unit.definitionId==='training-dummy'||unit.definitionId==='forming-dummy'||unit.definitionId==='tower-dummy'||unit.definitionId==='augment-golem'||isAnvil(unit.definitionId)))return {ok:false,reason:'invalid-consumable-target'};
  if(!unit)return {ok:false,reason:'unknown-unit'};
  if(unit.team!=='player')return {ok:false,reason:'invalid-consumable-target'};
  if (definition.effect !== 'masterwork-upgrade' && target.itemId !== undefined) return {ok:false,reason:'invalid-consumable-target'};
  if(definition.effect==='duplicate-unit'){
    if(isCombatRosterLocked(state))return {ok:false,reason:'wrong-phase'};
    if(!SHOP_CATALOG.includes(unit.definitionId)||(definition.maxCost!==null&&UNIT_DEFINITIONS[unit.definitionId].cost>definition.maxCost)||!hasTargetTrait(definition,unit.definitionId))return {ok:false,reason:'invalid-consumable-target'};
    if(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length>=state.preparation.benchSize)return {ok:false,reason:'bench-full'};
    if(!planUnitAcquisition(state,unit.definitionId,{kind:'mechanic',receiptId:consumableCopyReceiptId(consumableId)},state.resourceProvenance.entries.length).ok)return {ok:false,reason:'bench-full'};
    return {ok:true,effect:definition.effect,affectedItemIds:[],destination:'inventory',affectsCurrentBattle:false};
  }
  if (definition.effect === 'masterwork-upgrade') {
    if (state.phase !== 'preparation' || state.pendingChoice || isCombatRosterLocked(state)) return {ok:false,reason:'wrong-phase'};
    if (target.itemId && isTemporaryItemId(state, target.itemId)) return {ok:false,reason:'temporary-item'};
    const eligible = masterworkCandidates(state, target.unitId).filter(i => target.itemId === undefined || i.id === target.itemId);
    if (!eligible.length) return {ok:false,reason:'invalid-consumable-target'};
    return {ok:true,effect:definition.effect,affectedItemIds:eligible.map(i=>i.id),destination:'inventory',affectsCurrentBattle:false};
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
  if (preview.effect === 'masterwork-upgrade' && (target.kind !== 'unit' || !target.itemId || preview.affectedItemIds.length !== 1))
    return {ok:false as const,reason:'invalid-consumable-target' as const};
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
      if (preview.effect === 'masterwork-upgrade') {
        if (!Number.isSafeInteger(nextItemSerial + 1) || state.items.some(i => i.id === `item-${nextItemSerial}`)) throw new RangeError('Invalid masterwork serial');
        output = {id: `item-${nextItemSerial++}`, definitionId: g23RadiantDefinitionId(original.definitionId)!};
        events.push({type:'itemReforged',itemId:original.id,definitionId:original.definitionId,outputItemId:output.id,outputDefinitionId:output.definitionId,consumableId});
      }
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
  const output=preview.effect==='reforge-all'||preview.effect==='masterwork-upgrade'?(outputs[0]??null):null;
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
  if(record.effect !== 'masterwork-upgrade' && placed.some(i=>i.location.kind==='unit'&&i.location.unitId===unitId&&!record.affectedItems.some(a=>a.id===i.id)))fail();
  const ids=new Set(record.affectedItems.map(i=>i.id));
  for(const [n,output] of record.outputs.entries())if(output.id!==record.affectedItems[n].id){if(output.id!==`item-${serial++}`)fail();}
  return {items:[...items.filter(i=>!ids.has(i.id)),...record.outputs.map(i=>({...i,location:{kind:'inventory' as const}}))].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),nextItemSerial:serial};
}

