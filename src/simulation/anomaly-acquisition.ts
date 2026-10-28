
import { grantD11AvariceGold } from './d11-fill';
import {DUAL_WIELDING_POOLS,DUAL_WIELDING_ROLES} from './content/s13-p1-dual-wielding';
import {nextRandom} from './rng';
import {grantMechanicItem} from './seat-mechanics';
import type {MatchState,MatchEvent} from './match-types';
export const SOURCE='s13-anomaly-acquisition';
export const receiptId=(choiceId:string,index:number)=>`s13-anomaly:${choiceId}:dual-wielding:item:${index}`;
/** Project convention: independent seed-derived stream; no repeats, no reroll RNG consumption. */
export function dualWieldingItems(seed:number,choiceId:string,definitionId:string):readonly string[]{
 const pool=[...(DUAL_WIELDING_POOLS[DUAL_WIELDING_ROLES[definitionId]]??[])];
 if(pool.length<2)throw new RangeError('Unknown dual wielding role');
 let rng=(seed^0x44574132)>>>0;for(const c of `${choiceId}:${definitionId}`)rng=Math.imul(rng^c.charCodeAt(0),16777619)>>>0;
 for(let i=0;i<2;i++){
  const n=pool.length-i,limit=Math.floor(2**32/n)*n;let word:number;
  do{const draw=nextRandom(rng);rng=draw.state;word=draw.word;}while(word>=limit);
  const j=i+word%n;[pool[i],pool[j]]=[pool[j],pool[i]];
 }
 return pool.slice(0,2);
}
/** Existing equipment stays untouched. Both new items are permanently owned in inventory. */
export function grantAnomalyAcquisition(initial:MatchState):{state:MatchState;events:MatchEvent[]}{
 if(initial.anomalyBinding?.definitionId==='avarice-incarnate'){
  if(initial.seatMechanics?.receipts.some(r=>r.receiptId===JSON.stringify(['d11-fill',initial.anomalyBinding!.choiceId,'avarice-gold'])))return {state:initial,events:[]};
  const granted=grantD11AvariceGold(initial);
  if(!granted.ok)throw new RangeError('Invalid D11 acquisition');
  return {state:granted.state,events:[...granted.events]};
 }
 const binding=initial.anomalyBinding;if(binding?.definitionId!=='dual-wielding')return {state:initial,events:[]};
 const target=initial.preparation.units.find(u=>u.id===binding.unitId);
 if(!target)throw new RangeError('Missing anomaly acquisition target');
 let state=initial;const events:MatchEvent[]=[];
 for(const [i,definitionId] of dualWieldingItems(state.seed,binding.choiceId,target.definitionId).entries()){
  const id=receiptId(binding.choiceId,i);if(state.seatMechanics?.receipts.some(r=>r.receiptId===id))continue;
  const granted=grantMechanicItem(state,{receiptId:id,source:SOURCE,definitionId});
  if(!granted.ok)throw new RangeError('Invalid anomaly acquisition');state=granted.state;events.push(...granted.events);
 }
 return {state,events};
}

