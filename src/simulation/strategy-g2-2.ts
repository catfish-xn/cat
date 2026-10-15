import type { CombatStrategyInputs } from './combat-input';
import type { Unit } from './unit-types';
import type { Effect, ItemDefinition, TraitSnapshot, TraitTier } from './strategy-types';
import { getUnitStats } from './unit-stats';
import { readRoundEnemyProjection } from './round-enemies';
import { G22_CONVENTIONS } from './content/g2-2-traits';
export interface G22Equipment { id:string; unitId:string; definitionId:string }
export function g22Equipment(state:CombatStrategyInputs):G22Equipment[] {
  return [...state.items.flatMap(i=>i.location.kind==='unit'?[{id:i.id,unitId:i.location.unitId,definitionId:i.definitionId}]:[]),
    ...state.temporaryEquipment.map(i=>({id:i.temporaryId,unitId:i.holderId,definitionId:i.definitionId})),
    ...(state.preparation.units.some(u=>u.team==='enemy')?readRoundEnemyProjection(state.round).items:[]).map(i=>({id:`enemy:${state.round}:${i.unitId}:${i.slot}`,unitId:i.unitId,definitionId:i.definitionId}))];
}
/** Frozen combat-only conversion; no item grants, receipts, slots or RNG are mutated. */
export function scrapConversions(units:readonly Unit[],traits:readonly TraitSnapshot[],equipment:readonly G22Equipment[],catalog:Readonly<Record<string,ItemDefinition>>):Map<string,string> {
  const result=new Map<string,string>();
  for(const trait of traits.filter(t=>t.traitId==='scrap'&&t.tier>0)){
    let left=trait.tier>=6?20:trait.tier>=4?3:1;
    for(const item of [...equipment].sort((a,b)=>a.id<b.id?-1:1)){
      const owner=units.find(u=>u.id===item.unitId);
      if(!left||!owner||owner.team!==trait.team||!trait.targetUnitIds.includes(owner.id)||catalog[item.definitionId]?.kind!=='component')continue;
      const held=equipment.filter(i=>i.unitId===owner.id).map(i=>result.get(i.id)??i.definitionId);
      const candidates=Object.values(catalog).filter(d=>d.kind==='completed'&&d.recipe?.includes(item.definitionId)&&d.slotCost!==3&&(!d.unique||!held.includes(d.id))).sort((a,b)=>a.id<b.id?-1:1);
      if(candidates.length){result.set(item.id,candidates[0].id);left--;}
    }
  }
  return result;
}
export function g22TraitEffects(state:CombatStrategyInputs,unit:Unit,trait:TraitSnapshot,tier:TraitTier,
  board:readonly Unit[],equipment:readonly G22Equipment[],converted:ReadonlyMap<string,string>,catalog:Readonly<Record<string,ItemDefinition>>):Effect[] {
  const result:Effect[]=[];
  const member=trait.memberDefinitionIds.includes(unit.definitionId);
  for(const e of [...tier.effects,...(member?tier.memberEffects??[]:[])]) {
    if(e.kind!=='mechanic'){result.push(e);continue;}
    if(e.mechanic==='academy'){
      const sponsored=equipment.some(i=>i.unitId===unit.id&&(G22_CONVENTIONS.academy.sponsored as readonly string[]).includes(converted.get(i.id)??i.definitionId));
      if(sponsored){const bps=e.values.sponsoredBps*(member?2:1)+(member?e.values.memberBaseBps:0);result.push({kind:'statPercentBps',stat:'maxHp',bps},{kind:'mechanic',mechanic:'damageAmp',values:{bps}});}continue;
    }
    if(e.mechanic==='emissary'){
      if(trait.memberDefinitionIds.includes('nami'))result.push({kind:'mechanic',mechanic:'extraAttackMana',values:{amount:e.values.mana}});
      if(trait.memberDefinitionIds.includes('tristana'))result.push({kind:'attackSpeedBps',bps:e.values.starSpeedBps*unit.starLevel});
      if(trait.memberDefinitionIds.includes('ambessa')){
        const wins=unit.team!=='player'?0:Math.min(7,(state.roundResults??[]).filter(r=>r.round<state.round&&r.roundKind==='pvp'&&r.result==='playerWin').length),amount=wins*e.values.armorPerWin;
        result.push({kind:'statFlat',stat:'armor',amount},{kind:'statFlat',stat:'magicResist',amount});
      }
      for(const garen of board.filter(u=>u.team===unit.team&&u.definitionId==='garen'&&trait.memberDefinitionIds.includes('garen'))){
        if(garen.location.kind==='board'&&unit.location.kind==='board'&&unit.location.cell.row===garen.location.cell.row&&Math.abs(unit.location.cell.col-garen.location.cell.col)<=1)
          result.push({kind:'statFlat',stat:'maxHp',amount:Math.floor((getUnitStats('garen',garen.starLevel).health+(trait.tier===4?200:0))*e.values.healthBps/10000)});
      }continue;
    }
    if(e.mechanic==='scrap'){
      const holders=new Set(board.filter(u=>u.team===unit.team).map(u=>u.id));
      const componentCount=equipment.filter(i=>holders.has(i.unitId)).reduce((n,i)=>n+(catalog[i.definitionId]?.kind==='component'?1:catalog[i.definitionId]?.recipe?2:0),0);
      result.push({...e,values:{...e.values,componentCount}});continue;
    }
    result.push(e);
  }
  return result;
}
