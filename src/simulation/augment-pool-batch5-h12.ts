import type { MatchState, MatchEvent } from './match-types';
import type { Unit } from './unit-types';
import { requireAugmentFacts } from './augment-history';
import { AUGMENT_BATCH5_H12 } from './content/augment-pool-batch5-h12';
import { returnUnitItems } from './inventory';
import { getUnitSellPrice } from './unit-stats';
import { appendResourceProvenance } from './resource-provenance';
import { isSellableUnit } from './seat-mechanics/forms';
import { isAnvil } from './content/anvils';

/** The same sale transaction for a public sale and Head Start's frozen acquisition roster.
 * Caller checks phase, ownership and sellability; rewards drain only after the whole batch. */
export function sellPreparedUnit(state:MatchState,unit:Unit,capacity=false):{state:MatchState;events:MatchEvent[]} {
 const returned=returnUnitItems(state.items,unit.id),removesBinding=state.anomalyBinding?.unitId===unit.id;
 return {state:{...state,items:returned.items,anomalyBinding:removesBinding?null:state.anomalyBinding,
  persistentGrowth:state.persistentGrowth.filter(g=>g.unitId!==unit.id),gold:state.gold+getUnitSellPrice(unit),
  resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,
   {kind:'unit-sold',unitId:unit.id,context:capacity?'settlement-capacity':'preparation',goldGranted:getUnitSellPrice(unit)}),
  preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.id!==unit.id)}},
  events:[...returned.events,...(removesBinding?[{type:'anomalyRemoved' as const,unitId:unit.id}]:[])]};
}
/** Only the selection transaction calls this, before any reward is granted. The acquired roster is authenticated. */
export function applyHeadStart(state:MatchState):{state:MatchState;events:MatchEvent[]} {
 const owner=state.augments.find(a=>a.definitionId==='head-start'&&a.acquiredRound===state.round);
 if(!owner)return {state,events:[]};
 const acquisition=requireAugmentFacts(state,'acquire',owner.acquiredRound).find(f=>f.choiceId===owner.choiceId);
 if(!acquisition)throw new RangeError('Invalid augment history: missing Head Start acquisition');
 const events:MatchEvent[]=[];
 for(const unit of acquisition.roster.units){
  if(unit.team!=='player'||isAnvil(unit.definitionId)||!isSellableUnit(unit.definitionId))continue;
  const current=state.preparation.units.find(u=>u.id===unit.id);
  if(!current)continue; // Repeat invocation cannot sell the newly granted heroes.
  const sold=sellPreparedUnit(state,current);state=sold.state;events.push(...sold.events);
 }
 return {state,events};
}
/** Three natural rounds including acquisition. No mutable countdown or wall clock. */
export function headStartShopDisabled(state:MatchState):boolean {
 const owner=state.augments.find(a=>a.definitionId==='head-start');if(!owner)return false;
 const acquired=requireAugmentFacts(state,'acquire',owner.acquiredRound).find(f=>f.choiceId===owner.choiceId);
 if(!acquired)throw new RangeError('Invalid augment history: missing Head Start acquisition');
 return state.round>=acquired.round&&state.round<acquired.round+AUGMENT_BATCH5_H12['head-start'].source.values.RoundsToSkip!;
}
