import { combineItems, equipItem, type MatchState } from '../../src/simulation/match';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import { accepted, resolveM5Choices } from '../match-helpers';

/** Build and equip ordinary items through public commands; the history remains replayable. */
export function equipArmyItems(initial:MatchState,carryId?:string):MatchState {
 let state=resolveM5Choices(initial);
 const priority=['gunblade','jeweled-gauntlet','rabadons-deathcap','spear-of-shojin','guinsoos-rageblade','sunfire-cape'];
 const recipes=Object.values(ITEM_DEFINITIONS).filter(d=>d.recipe?.length===2)
  .sort((a,b)=>(priority.indexOf(a.id)<0?100:priority.indexOf(a.id))-(priority.indexOf(b.id)<0?100:priority.indexOf(b.id)));
 for(let n=0;n<32;n++){
  const items=state.items.filter(i=>i.location.kind==='inventory');
  const pair=recipes.flatMap(d=>items.flatMap(a=>items.filter(b=>a.id!==b.id&&[a.definitionId,b.definitionId].sort().join()===d.recipe!.slice().sort().join()).map(b=>[a,b] as const)))[0];
  if(!pair)break;
  state=accepted(combineItems(state,pair[0].id,pair[1].id));
 }
 const units=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').sort((a,b)=>Number(b.id===carryId)-Number(a.id===carryId));
 for(const item of state.items.filter(i=>i.location.kind==='inventory').sort((a,b)=>Number(!!ITEM_DEFINITIONS[b.definitionId]?.recipe)-Number(!!ITEM_DEFINITIONS[a.definitionId]?.recipe))){
  let equipped=false;
  for(const unit of units){
   for(let slot=0;slot<3;slot++){const r=equipItem(state,item.id,unit.id,slot);if(r.ok){state=r.state;equipped=true;break;}}
   if(equipped)break;
  }
 }
 return resolveM5Choices(state);
}
