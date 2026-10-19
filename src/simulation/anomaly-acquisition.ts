import {traceBoundUnitIdentity} from './bound-unit-identity';
import {getCatalogRoundByOrdinal} from './round-selectors';
import {DUAL_WIELDING_POOLS,DUAL_WIELDING_ROLES} from './content/s13-p1-dual-wielding';
import {nextRandom} from './rng';
import {grantMechanicItem} from './seat-mechanics';
import type {MatchState,MatchEvent} from './match-types';
import {foldResourceProvenance,type ResourceProvenanceContext} from './resource-provenance';
const SOURCE='s13-anomaly-acquisition';
const receiptId=(choiceId:string,index:number)=>`s13-anomaly:${choiceId}:dual-wielding:item:${index}`;
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
/** Called after the full resource fold has authenticated births and consumption. Reconstruct the
 * original target before acquisition, even if it later upgraded or was sold. No saved role is trusted. */
export function validateAnomalyAcquisition(state:MatchState,context:ResourceProvenanceContext,parsedJsonInput=false):void{
 const fail=()=>{throw new RangeError('Invalid anomaly acquisition');},expected=new Set<string>();
 for(const selected of state.scheduleReceipts.filter(r=>r.kind==='anomaly'&&r.definitionId==='dual-wielding')){
  const ids=[receiptId(selected.eventId,0),receiptId(selected.eventId,1)];ids.forEach(id=>expected.add(id));
  const first=state.resourceProvenance.entries.findIndex(e=>e.kind==='item-acquired'&&e.source.kind==='mechanic'&&e.source.receiptId===ids[0]);
  if(first<1||!selected.unitId)fail();
  const before=foldResourceProvenance(state.resourceProvenance,{...context,prefixLength:first},parsedJsonInput);
  const target=before.units.find(u=>u.id===selected.unitId);if(!target)fail();
  const finalUnit=traceBoundUnitIdentity(selected.unitId!,state.resourceProvenance.entries.slice(first));
  if(finalUnit===null?state.anomalyBinding!==null:state.anomalyBinding?.unitId!==finalUnit||state.anomalyBinding.definitionId!=='dual-wielding'||state.anomalyBinding.choiceId!==selected.eventId)fail();
  const items=dualWieldingItems(state.seed,selected.eventId,target!.definitionId);
  for(const [i,id] of ids.entries()){
   const r=state.seatMechanics?.receipts.find(r=>r.receiptId===id);
   if(!r||r.kind!=='item'||r.source!==SOURCE||r.definitionId!==items[i]||r.round!==selected.round||r.roundId!==getCatalogRoundByOrdinal(selected.round).roundId)fail();
  }
 }
 for(const r of state.seatMechanics?.receipts??[])if((r.source===SOURCE||r.receiptId.startsWith('s13-anomaly:'))&&!expected.has(r.receiptId))fail();
}
