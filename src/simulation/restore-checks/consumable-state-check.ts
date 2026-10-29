// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { pipelineExtraOrbs } from '../augment-pool-batch5-g5-pipeline';
import { consumableCopyReceiptId, equal, hasTargetTrait, reforgeCandidates } from '../consumables';
import { CONSUMABLE_DEFINITIONS, CONSUMABLE_RULES } from '../content/consumables';
import { ITEM_DEFINITIONS as ORDINARY_ITEMS } from '../content/items';
import { g23RadiantDefinitionId } from '../g2-3-rewards';
import { validateMasterworkChoice } from '../masterwork-choice';
import { SHOP_CATALOG } from '../match-rules';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundById } from '../multiplayer-round';
import { drawIndex } from '../orb-layout';
import { validatePveRemover } from '../pve-remover';
import { UNIT_DEFINITIONS } from '../units';

/** Rebuild tools from unique grant receipts and validate each ordered draw/output. */
export function validateConsumableState(state:MatchState):void {
  validatePveRemover(state);
  validateMasterworkChoice(state);
  const check=(condition:unknown)=>{if(!condition)throw new RangeError('Invalid consumable ledger');};
  const grants=new Map<string,{definitionId:string;roundId:string}>();let serial=1;
  const all:{id:string;definitionId:string;roundId:string}[]=[];
  for(const r of state.seatMechanics?.receipts??[])if(r.kind==='consumable'){check(Object.hasOwn(CONSUMABLE_DEFINITIONS,r.definitionId));all.push({id:r.consumableId,definitionId:r.definitionId,roundId:r.roundId});}
  for(const receipt of state.m8.loot.receipts){
    if(receipt.payload.kind!=='consumable'||receipt.resolution==='forfeited'){check(!receipt.grantedConsumableIds);continue;}
    const ids=receipt.grantedConsumableIds;check(ids?.length===1&&receipt.payload.quantity===1&&Object.hasOwn(CONSUMABLE_DEFINITIONS,receipt.payload.definitionId));
    const drop=[...state.m8.loot.frozen.rounds.flatMap(r=>r.encounterPlan.drops),...pipelineExtraOrbs(state).flatMap(o=>o.entries)].find(d=>d.dropId===receipt.dropId);check(drop);
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
    check(grant&&(settled.has(grant.roundId)||loot?.claimedRoundId||state.seatMechanics?.receipts.some(x=>x.kind==='consumable'&&x.consumableId===r.consumableId))&&getMultiplayerRoundById(grant.roundId).ordinal<=getMultiplayerRoundById(fact.roundId).ordinal);
    check(Array.isArray(r.affectedItems)&&Array.isArray(r.outputs)&&new Set(r.affectedItems.map(i=>i.id)).size===r.affectedItems.length);
    if(definition.effect==='duplicate-unit'){
      check(r.affectedItems.length===0&&r.outputs.length===0&&r.output===null&&r.copiedUnit&&r.target.kind==='unit'&&r.copiedUnit.id===r.target.unitId&&SHOP_CATALOG.includes(r.copiedUnit.definitionId)&&(definition.maxCost===null||UNIT_DEFINITIONS[r.copiedUnit.definitionId].cost<=definition.maxCost)&&hasTargetTrait(definition,r.copiedUnit.definitionId));
      const id=consumableCopyReceiptId(r.consumableId),receipt=state.seatMechanics?.receipts.find(x=>x.receiptId===id);
      check(receipt?.kind==='unit'&&receipt.source==='consumable-copy'&&receipt.definitionId===r.copiedUnit?.definitionId&&receipt.resolution===(state.multiplayer?'orb':'held')&&receipt.roundId===fact.roundId);copies.add(id);
    }else{
      check(r.affectedItems.length>0&&r.copiedUnit===null&&r.outputs.length===r.affectedItems.length&&r.affectedItems.every(i=>i.location.kind==='unit'&&r.target.kind==='unit'&&i.location.unitId===r.target.unitId));
      check(r.affectedItems.every((item,i)=>item.location.kind==='unit'&&(i===0||r.affectedItems[i-1].location.kind==='unit'&&(r.affectedItems[i-1].location as {slot:number}).slot<item.location.slot)));
      for(const [i,original] of r.affectedItems.entries()){
        const candidates=r.effect==='reforge-all'?reforgeCandidates(original.definitionId):[];
        let expected=original.definitionId;
        if (r.effect === 'masterwork-upgrade') {
          check(ORDINARY_ITEMS[original.definitionId]?.kind === 'completed' && ORDINARY_ITEMS[original.definitionId]?.recipe
            && g23RadiantDefinitionId(original.definitionId) && r.affectedItems.length === 1 && r.target.kind === 'unit' && r.target.itemId === original.id);
          expected = g23RadiantDefinitionId(original.definitionId)!;
        }
        if(candidates.length){const draw=drawIndex(rng,candidates.length);rng=draw.rng;expected=candidates[draw.index].definitionId;}
        check(r.outputs[i]?.definitionId===expected&&(candidates.length || r.effect === 'masterwork-upgrade' ? r.outputs[i].id!==original.id:r.outputs[i].id===original.id));
      }
      check(equal(r.output,r.effect==='reforge-all'||r.effect==='masterwork-upgrade'?r.outputs[0]:null));
      if (r.effect === 'masterwork-upgrade') {
        const choice = state.seatMechanics?.receipts.find(c => c.receiptId === JSON.stringify(['masterwork',r.consumableId]));
        check(choice?.kind === 'choice' && choice.source === 'masterwork-upgrade' && choice.choiceKind === 'armory'
          && choice.optionId === r.affectedItems[0].id && choice.price === 0 && !choice.skipped && choice.itemId === null && choice.roundId === fact.roundId);
      }
    }
    check(equal(r.rngAfter,rng));grants.delete(r.consumableId);
  }
  check((state.seatMechanics?.receipts??[]).filter(r=>r.source==='consumable-copy').every(r=>copies.has(r.receiptId)));
  for (const choice of state.seatMechanics?.receipts ?? []) if (choice.source === 'masterwork-upgrade' || choice.receiptId.startsWith('["masterwork",')) {
    check(state.resourceProvenance.entries.some(f => f.kind === 'consumable-used' && f.record.effect === 'masterwork-upgrade'
      && choice.receiptId === JSON.stringify(['masterwork', f.record.consumableId])));
  }
  check(serial===state.nextConsumableSerial&&equal(rng,state.reforgeState)&&equal(state.consumables,[...grants].map(([consumableId,g])=>({consumableId,definitionId:g.definitionId}))));
}
