import { SHOP_CATALOG } from './match-rules';
import type { CombatState } from './combat-types';
import type { Team } from './board';
import type { MatchState } from './match-types';
import { planAugmentGifts } from './augment-gift-plan';
import { readG23Progress } from './g2-3-state';

/** Existing extensible battle-counter envelope: 0 means no eligible victim, otherwise catalog index + 1. */
export function pilferBattleCount(combat:CombatState,team:Team,openingUnits:readonly {readonly id:string;readonly team:Team}[]):number|undefined {
 if(!combat.strategy?.units.some(u=>openingUnits.some(x=>x.id===u.unitId&&x.team===team)&&u.sources.some(s=>s.source.sourceKind==='augment'&&s.source.sourceDefinitionId==='pilfer')))return undefined;
 const victim=(combat.openingDeaths??[]).find(d=>combat.units.some(u=>u.id===d.unitId&&u.team!==team&&openingUnits.some(o=>o.id===u.id&&o.team===u.team)&&!u.itemSummon&&!u.anomalySummon&&SHOP_CATALOG.includes(u.definitionId)));
 const unit=victim&&combat.units.find(u=>u.id===victim.unitId);
 return unit?SHOP_CATALOG.indexOf(unit.definitionId)+1:0;
}
export function pilferRewardPlan(state:MatchState) {
 const a=state.augments.find(x=>x.definitionId==='pilfer');if(!a)return [];
 return (readG23Progress(state)?.economyReceipts??[]).flatMap(r=>{
  if(r.kind!=='battle'||r.facts.round<a.acquiredRound||r.facts.round+1>state.round)return [];
  const count=r.facts.batch2?.find(x=>x.definitionId==='pilfer')?.count??0;
  if(!count)return [];
  return planAugmentGifts(state,{...a,choiceId:JSON.stringify([a.choiceId,'pilfer',r.facts.round]),acquiredRound:r.facts.round+1},[{kind:'unit',definitionId:SHOP_CATALOG[count-1],starLevel:1}]);
 });
}
