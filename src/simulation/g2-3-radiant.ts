import {readG23Progress} from './g2-3-state';
import {g23RadiantDefinitionId} from './g2-3-rewards';
import type {MatchState} from './match-types';
import {appendResourceProvenance,type ResourceFact} from './resource-provenance';
/** User2026-10-16: all equipped board/bench completed items, then only newly combined items. */
export function applyG23Radiant(state:MatchState,newItemIds?:ReadonlySet<string>):MatchState{
 if(!readG23Progress(state)?.conquest.radiantConversion)return state;
 const facts:ResourceFact[]=[];
 const items=state.items.map(item=>{
  const permitted=newItemIds?newItemIds.has(item.id):item.location.kind==='unit'&&state.preparation.units.some(u=>u.team==='player'&&item.location.kind==='unit'&&u.id===item.location.unitId);
  const to=permitted?g23RadiantDefinitionId(item.definitionId):undefined;if(!to)return item;
  facts.push({kind:'g23-item-converted',itemId:item.id,from:item.definitionId,to,receiptId:'g23:conqueror:15'});return {...item,definitionId:to};
 });
 return facts.length?{...state,items,resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,facts)}:state;
}
