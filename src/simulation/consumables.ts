import { canonicalContent } from './content';
import { ITEM_DEFINITIONS } from './content/items';
import { CONSUMABLE_DEFINITIONS, CONSUMABLE_RULES, REFORGE_POOLS } from './content/consumables';
import { canOperateEquipment } from './operation-policy';
import { isTemporaryItemId } from './temporary-equipment';
import { getCatalogRoundById } from './round-selectors';
import { planEquip } from './inventory';
import type { GameState } from './game';
import { drawIndex } from './orb-layout';
import type { MatchState, MatchEvent } from './match-types';
import type { ConsumablePreview, ConsumableTarget, ConsumableUseRecord } from './consumable-types';
import type { ItemInstance } from './strategy-types';
export type * from './consumable-types';
const equal=(a:unknown,b:unknown)=>canonicalContent(a)===canonicalContent(b);

export function previewUseConsumable(state:Readonly<MatchState>,consumableId:string,target:ConsumableTarget):ConsumablePreview {
  if (!canOperateEquipment(state)) return {ok:false,reason:'wrong-phase'};
  const tool=state.consumables.find(c=>c.consumableId===consumableId);
  if (!tool) return {ok:false,reason:'unknown-consumable'};
  const definition=CONSUMABLE_DEFINITIONS[tool.definitionId];
  if (!definition) throw new RangeError('Invalid consumable definition');
  if (!target || target.kind!==definition.target) return {ok:false,reason:'invalid-consumable-target'};
  let items: readonly ItemInstance[];
  if (target.kind==='unit') {
    const unit=state.preparation.units.find(u=>u.id===target.unitId);
    if (!unit) return {ok:false,reason:'unknown-unit'};
    if (unit.team!=='player') return {ok:false,reason:'invalid-consumable-target'};
    items=state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===unit.id)
      .sort((a,b)=>(a.location.kind==='unit'?a.location.slot:0)-(b.location.kind==='unit'?b.location.slot:0));
    if (!items.length) return {ok:false,reason:'no-removable-items'};
  } else {
    if (isTemporaryItemId(state,target.itemId)) return {ok:false,reason:'temporary-item'};
    const item=state.items.find(i=>i.id===target.itemId);
    if (!item) return {ok:false,reason:'unknown-item'};
    if (ITEM_DEFINITIONS[item.definitionId]?.kind!==(tool.definitionId==='component-reforger'?'component':'completed')
      || item.location.kind==='unit'&&!state.preparation.units.some(u=>u.id===(item.location.kind==='unit'?item.location.unitId:'')&&u.team==='player'))
      return {ok:false,reason:'invalid-consumable-target'};
    items=[item];
  }
  return {ok:true,effect:definition.effect,affectedItemIds:items.map(i=>i.id),destination:'inventory',affectsCurrentBattle:false};
}
export function planConsumable(state:MatchState,consumableId:string,target:ConsumableTarget) {
  const preview=previewUseConsumable(state,consumableId,target);
  if (!preview.ok) return preview;
  const tool=state.consumables.find(c=>c.consumableId===consumableId)!;
  const affectedItems=preview.affectedItemIds.map(id=>structuredClone(state.items.find(i=>i.id===id)!));
  let rngAfter=state.reforgeState,output:ConsumableUseRecord['output']=null,nextItemSerial=state.nextItemSerial;
  const events:MatchEvent[]=[];
  let items:readonly ItemInstance[];
  if (target.kind==='unit') {
    items=state.items.map(i=>preview.affectedItemIds.includes(i.id)?{...i,location:{kind:'inventory' as const}}:i);
    events.push({type:'itemsRemoved',unitId:target.unitId,itemIds:preview.affectedItemIds});
  } else {
    if (!Number.isSafeInteger(nextItemSerial+1)||state.items.some(i=>i.id===`item-${nextItemSerial}`)) throw new RangeError('Invalid reforge serial');
    const original=affectedItems[0],kind=ITEM_DEFINITIONS[original.definitionId].kind;
    // previewUseConsumable admits only component/completed items, so radiant never reaches a reforge pool.
    const candidates=REFORGE_POOLS[kind as 'component'|'completed'].filter(d=>d.definitionId!==original.definitionId);
    const draw=drawIndex(rngAfter,candidates.length);rngAfter=draw.rng;
    output={id:`item-${nextItemSerial++}`,definitionId:candidates[draw.index].definitionId};
    items=[...state.items.filter(i=>i.id!==original.id),{...output,location:{kind:'inventory' as const}}].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    events.push({type:'itemReforged',itemId:original.id,definitionId:original.definitionId,outputItemId:output.id,
      outputDefinitionId:output.definitionId,consumableId});
  }
  const record:ConsumableUseRecord={...tool,target:structuredClone(target),effect:preview.effect,affectedItems,output,
    rngBefore:state.reforgeState,rngAfter};
  events.push({type:'consumableUsed',...tool,target:structuredClone(target),effect:preview.effect,
    affectedItemIds:preview.affectedItemIds,outputItemId:output?.id??null});
  return {ok:true as const,record,events,state:{...state,items,nextItemSerial,reforgeState:rngAfter,
    consumables:state.consumables.filter(c=>c.consumableId!==consumableId)}};
}
/** Replay recorded equipment changes against a frozen prefix; never grants resources. */
export function replayConsumableItems(items:readonly ItemInstance[],serial:number,record:ConsumableUseRecord,preparation:GameState) {
  const fail=()=>{throw new RangeError('Invalid consumable equipment continuation');};
  if (record.affectedItems.some(before=>!items.some(i=>i.id===before.id&&i.definitionId===before.definitionId
    && (i.location.kind==='inventory'||equal(i.location,before.location))))) fail();
  let placed = items;
  for (const before of record.affectedItems) {
    const current = placed.find(i => i.id === before.id)!;
    if (current.location.kind === 'inventory' && before.location.kind === 'unit') {
      const plan = planEquip(placed, preparation, before.id, before.location.unitId, before.location.slot, serial);
      if (!plan.ok || plan.nextItemSerial !== serial || !plan.items.some(i => equal(i, before))) return fail();
      placed = plan.items;
    }
  }
  if (record.target.kind==='unit') {
    const unitId=record.target.unitId;
    if (placed.some(i=>i.location.kind==='unit'&&i.location.unitId===unitId&&!record.affectedItems.some(a=>a.id===i.id))) fail();
    return {items:items.map(i=>record.affectedItems.some(a=>a.id===i.id)?{...i,location:{kind:'inventory' as const}}:i),nextItemSerial:serial};
  }
  if (!record.output||record.output.id!==`item-${serial}`) return fail();
  return {items:[...items.filter(i=>i.id!==record.affectedItems[0].id),{...record.output,location:{kind:'inventory' as const}}],nextItemSerial:serial+1};
}

/** Tools are reconstructed from unique grant receipts and ordered use facts. */
export function validateConsumableState(state:MatchState):void {
  const check=(condition:unknown)=>{if(!condition)throw new RangeError('Invalid consumable ledger');};
  const grants=new Map<string,{definitionId:string;roundId:string}>(); let serial=1;
  for (const receipt of state.m8.loot.receipts) {
    if (receipt.payload.kind!=='consumable') {check(!receipt.grantedConsumableIds);continue;}
    const ids=receipt.grantedConsumableIds;
    check(ids?.length===1&&ids[0]===`consumable-${serial}`&&receipt.payload.quantity===1
      &&Object.hasOwn(CONSUMABLE_DEFINITIONS,receipt.payload.definitionId));
    const drop=state.m8.loot.frozen.rounds.flatMap(r=>r.encounterPlan.drops).find(d=>d.dropId===receipt.dropId);
    check(drop);grants.set(ids![0],{definitionId:receipt.payload.definitionId,roundId:drop!.roundId});serial++;
  }
  let rng={state:(state.seed^CONSUMABLE_RULES.seedXor)>>>0,draws:0};
  const settled = new Set<string>();
  for (const fact of state.resourceProvenance.entries) {
    if (fact.kind === 'combat-growth-committed') settled.add(fact.roundId);
    if (fact.kind!=='consumable-used') continue;
    const r=fact.record,grant=grants.get(r.consumableId),definition=CONSUMABLE_DEFINITIONS[r.definitionId];
    check(grant&&grant.definitionId===r.definitionId&&definition&&definition.effect===r.effect
      &&definition.target===r.target.kind&&equal(r.rngBefore,rng));
    check(grant && settled.has(grant.roundId)
      && getCatalogRoundById(grant.roundId).ordinal <= getCatalogRoundById(fact.roundId).ordinal);
    check(Array.isArray(r.affectedItems)&&r.affectedItems.length>0&&new Set(r.affectedItems.map(i=>i.id)).size===r.affectedItems.length);
    if (r.target.kind==='unit') {
      check(r.output===null&&r.affectedItems.every(i=>i.location.kind==='unit'&&i.location.unitId===(r.target.kind==='unit'?r.target.unitId:'')));
    } else {
      const original=r.affectedItems[0],kind=r.definitionId==='component-reforger'?'component':'completed';
      check(r.affectedItems.length===1&&original.id===r.target.itemId&&ITEM_DEFINITIONS[original.definitionId]?.kind===kind);
      const candidates=REFORGE_POOLS[kind].filter(d=>d.definitionId!==original.definitionId),draw=drawIndex(rng,candidates.length);
      rng=draw.rng;check(r.output?.definitionId===candidates[draw.index].definitionId);
    }
    check(equal(r.rngAfter,rng));grants.delete(r.consumableId);
  }
  check(serial===state.nextConsumableSerial&&equal(rng,state.reforgeState)
    &&equal(state.consumables,[...grants].map(([consumableId,g])=>({consumableId,definitionId:g.definitionId}))));
}
