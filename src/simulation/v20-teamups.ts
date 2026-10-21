import { EMBLEM_ITEMS } from './content/emblems';
import { TEAMUP_IDS, V20_TRAITS, type TeamupId } from './content/v20-traits';
import type { CombatStrategyInputs } from './combat-input';
import type { TraitProjectionSource } from './traits/effective-membership';

/** Only on-board, distinct partners qualify. One immutable binding per relationship. */
export function bindV20Teamups(state:CombatStrategyInputs):Map<TeamupId,readonly string[]> {
  const bindings=new Map<TeamupId,readonly string[]>();
  const count=(id:string)=>state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===id).length;
  for(const id of TEAMUP_IDS){
    if(!state.augments.some(a=>a.definitionId===id))continue;
    const partners=V20_TRAITS[id].partners.map(def=>state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&u.definitionId===def)
      .sort((a,b)=>count(b.id)-count(a.id)||b.starLevel-a.starLevel||(a.id<b.id?-1:a.id>b.id?1:0))[0]);
    if(partners.every(Boolean))bindings.set(id,partners.map(u=>u!.id));
  }
  return bindings;
}
export function v20MembershipSources(state:CombatStrategyInputs,bindings:ReturnType<typeof bindV20Teamups>):TraitProjectionSource[]{
  const result:TraitProjectionSource[]=[];
  for(const [id,partners] of bindings)for(const unitId of partners)result.push({kind:'add-trait',sourceId:`v20:${id}:${unitId}`,unitId,traitId:id,activeFromRound:state.round,expiresBeforeRound:state.round+1});
  const powder=bindings.get('menaces')?.[0];
  if(powder&&!state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===powder&&EMBLEM_ITEMS[i.definitionId]?.emblemTrait==='dominator'))
    result.push({kind:'add-trait',sourceId:`v20:menaces:dominator:${powder}`,unitId:powder,traitId:'dominator',activeFromRound:state.round,expiresBeforeRound:state.round+1});
  return result;
}
