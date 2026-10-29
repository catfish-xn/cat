import type { CombatStrategyInputs } from './combat-input';
import { UNIT_DEFINITIONS } from './units';
import { getUnitStats } from './unit-stats';
import { resolveAbility } from './combat-abilities';
import { resolveFourthStarAbility } from './fourth-star-ability';
import type { Unit } from './unit-types';
import { freezeContent } from './content/freeze';

export const FAMILY_REUNION_POLICY=freezeContent({version:'v19-13.4-backport-v2',members:['violet','vander','powder','warwick','jinx','vi'],emblems:['warwick','jinx','vi'],selection:'one-real-instance-per-definition-lowest-id',maximumStar:4,deathDowngrade:'first-true-member-death-once-per-team-unverified-PBE',downgradeHealth:'preserve-ratio-floor-minimum-one',downgradeShields:'preserve-existing-snapshots',fourthRank:'placeholder-1.8x-third-varying-coefficients-unless-archived',fourthHealthAdBps:58320,sixCostFourthHealthAdBps:64800});
export function familyReunionParticipants(state:Pick<CombatStrategyInputs,'preparation'|'items'>,team:'player'|'enemy'='player'):readonly string[] {
  const ids:string[]=[];
  for(const id of FAMILY_REUNION_POLICY.members){
    const unit=state.preparation.units.filter(u=>u.team===team&&u.location.kind==='board'&&u.definitionId===id&&!UNIT_DEFINITIONS[u.definitionId]?.summon
      &&(!FAMILY_REUNION_POLICY.emblems.includes(id)||state.items.some(i=>i.definitionId==='TFT13_Item_FamilyEmblemItem'&&i.location.kind==='unit'&&i.location.unitId===u.id))).sort((a,b)=>a.id<b.id?-1:1)[0];
    if(!unit)return [];ids.push(unit.id);
  }
  return ids;
}
/** Combat-only base, before applying item/trait/growth sources exactly once. Physical ownership is unchanged. */
export function familyCombatBase(unit:Pick<Unit,'definitionId'|'starLevel'>,effectiveStarLevel:1|2|3|4){
  const star=Math.min(3,effectiveStarLevel) as 1|2|3;
  let base=getUnitStats(unit.definitionId,star),ability=resolveAbility(base.abilityId,star);
  if(effectiveStarLevel===4){
    const def=UNIT_DEFINITIONS[unit.definitionId],bps=def.cost===6?64800:58320;
    base={...base,health:Math.floor(def.baseStats.health*bps/10000),attack:Math.floor(def.baseStats.attack*bps/10000)};
    ability=resolveFourthStarAbility(unit.definitionId,base.abilityId);
  }
  return {base,ability};
}
export function familyReunionView(state:Pick<CombatStrategyInputs,'preparation'|'items'>&{readonly combat?:import('./combat-types').CombatState|null;readonly combatInputBasis?:import('./combat-input').CombatInputBasis|null}){
  // During combat the frozen opening owns activation, even after a public sale
  // or equipment transfer changes the current preparation projection.
  const source=state.combat&&state.combatInputBasis?state.combatInputBasis.inputs:state;
  const ids=familyReunionParticipants(source);
  const downgradedAtTick=state.combat?.units.find(u=>u.team==='player'&&u.familyReunion?.downgradedAtTick!==undefined)?.familyReunion?.downgradedAtTick??null;
  return {eligible:ids.length===6,participantIds:[...ids],downgraded:downgradedAtTick!==null,downgradedAtTick,backport:'13.4 → 14.24b',deathDowngrade:'已启用；未验证（PBE 观察）：首个成员阵亡后，其余成员失去额外的一星',participants:ids.map(id=>{const u=source.preparation.units.find(u=>u.id===id)!;return {unitId:id,originalStarLevel:u.starLevel,combatStarLevel:Math.min(4,u.starLevel+1)};})};
}
