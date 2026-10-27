import { readAugmentFacts, readAugmentCopyKills, recordAugmentCopyKills } from './augment-history';
import { portableAnomalyId } from './content/augment-pool-batch5-r2';
import type { MatchState } from './match-types';
import type { CombatState } from './combat-types';
import type { Team } from './board';

export interface AugmentCopyKills {readonly itemId:string;readonly count:number}
export function r2CopyKills(state:MatchState,items:readonly {readonly id:string;readonly definitionId:string}[]=state.items):readonly AugmentCopyKills[] {
  if(!state.augments.some(a=>a.definitionId==='another-anomaly'))return [];
  return items.filter(i=>portableAnomalyId(i.definitionId)==='headhunter').map(i=>({itemId:i.id,count:readAugmentCopyKills(state,i.id)}))
    .filter(g=>g.count>0).sort((a,b)=>a.itemId<b.itemId?-1:1);
}
/** A later reforge/sale cannot erase the historical input of a battle already in progress. */
export function r2FrozenCopyKills(state:MatchState):readonly AugmentCopyKills[] {
  if(!state.augments.some(a=>a.definitionId==='another-anomaly'))return [];
  const opening=state.combatInputBasis?readAugmentFacts(state,'combat-roster').find(f=>f.round===state.round):undefined;
  return r2CopyKills(state,opening?.roster.items??state.items);
}
/** Domain sampling of a trusted terminal; the room only supplies its existing identity mapping. */
export function recordR2PortableBattle(state:MatchState,combat:CombatState,team:Team,
  mapping:readonly {readonly kind:string;readonly combatId:string;readonly originalId:string}[]=[]):MatchState {
  if(!state.augments.some(a=>a.definitionId==='another-anomaly'))return state;
  if(combat.status!=='finished')throw new RangeError('Invalid portable anomaly terminal');
  let next=state;
  for(const unit of combat.units.filter(u=>u.team===team&&u.d11Kills!==undefined&&!u.itemSummon&&!u.anomalySummon)){
    const source=unit.mechanics?.find(m=>m.mechanic==='d11Anomaly'&&m.source.definitionId==='headhunter'&&m.source.parentItemInstanceId)?.source;
    if(!source)continue;
    const itemId=mapping.find(m=>m.kind==='item'&&m.combatId===source.parentItemInstanceId)?.originalId??source.parentItemInstanceId!;
    const unitId=mapping.find(m=>m.kind==='unit'&&m.combatId===unit.id)?.originalId??unit.id;
    next=recordAugmentCopyKills(next,{kind:'anomaly-copy-kills',battleId:combat.combatId!,itemId,unitId,kills:unit.d11Kills!});
  }
  return next;
}
