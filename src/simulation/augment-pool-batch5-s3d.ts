import { G23_RADIANT_MAPPING } from './content/g2-3-special-item-runtime';
import type { CombatStrategyInputs } from './combat-input';
import type { OwnedAugment, StrategySnapshot } from './strategy-types';
import type { MatchState } from './match-types';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { nextRandom } from './rng';
import { planAugmentGifts } from './augment-gift-plan';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';

/** Freeze eligibility from permanent equipment at the start; keep original inventory identities. */
export function qualityProjection(state:CombatStrategyInputs,basis?:StrategySnapshot):CombatStrategyInputs {
 if(!state.augments.some(a=>a.definitionId==='quality-over-quantity'))return state;
 const converted=new Map<string,{definitionId:string;unitId:string}>();
 if(basis){
  for(const unit of basis.units)for(const source of unit.sources) {
   const id=source.source.sourceDefinitionId,instance=source.source.sourceInstanceId;
   if(source.source.sourceKind==='item'&&ITEM_DEFINITIONS[id]?.kind==='radiant')converted.set(instance,{definitionId:id,unitId:unit.unitId});
  }
  for(const unit of basis.units)for(const program of unit.itemPrograms??[])if(program.source.sourceKind==='item'&&ITEM_DEFINITIONS[program.source.definitionId]?.kind==='radiant')converted.set(program.source.instanceId,{definitionId:program.source.definitionId,unitId:unit.unitId});
 } else {
  for(const item of state.items){
   if(item.location.kind!=='unit')continue;
   const holderId=item.location.unitId;
   const same=state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===holderId);
   const definition=ITEM_DEFINITIONS[item.definitionId];
   const radiant=(G23_RADIANT_MAPPING as Readonly<Record<string,string>>)[item.definitionId];
   if(same.length===1&&definition?.kind==='completed'&&definition.recipe&&definition.slotCost!==3&&radiant)converted.set(item.id,{definitionId:radiant,unitId:item.location.unitId});
  }
 }
 return {...state,items:state.items.map(item=>{const frozen=converted.get(item.id);return frozen&&item.location.kind==='unit'&&item.location.unitId===frozen.unitId?{...item,definitionId:frozen.definitionId}:item;})};
}
/** HP applies once to a holder of any projected radiant item, including naturally radiant or temporary equipment. */
export function qualityHealth(state:CombatStrategyInputs,unitId:string):boolean {
 return state.augments.some(a=>a.definitionId==='quality-over-quantity')&&(
  state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===unitId&&ITEM_DEFINITIONS[i.definitionId]?.kind==='radiant') ||
  state.temporaryEquipment.some(i=>i.holderId===unitId&&ITEM_DEFINITIONS[i.definitionId]?.kind==='radiant'));
}

/** P-B5-52: deterministic seed-bound three distinct uniform components, separate from live RNG. */
export function replicationOffers(seed:number,a:OwnedAugment):readonly string[] {
 const pool=[...G24_FORGE_POOLS.TFT_ArmoryKeyComponent];
 const key=`s13-augment:${a.choiceId}:${a.definitionId}`;
 let rng=(seed^0x513f0421)>>>0;
 for(const c of key)rng=Math.imul(rng^c.charCodeAt(0),16777619)>>>0;
 for(let i=0;i<3;i++) {const draw=nextRandom(rng);rng=draw.state;const j=i+Math.floor(draw.word*(pool.length-i)/4294967296);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,3);
}
/** The authenticated initial forge receipt supplies the choice; each next natural round owns one gift receipt. */
export function replicationGiftPlan(state:MatchState) {
 return state.augments.flatMap(a=>{
  if(a.definitionId!=='replication')return [];
  const r=state.seatMechanics?.receipts.find(r=>r.receiptId===`s13-augment:${a.choiceId}:${a.definitionId}:forge`);
  if(!r||r.kind!=='choice')return [];
  return [1,2].filter(n=>a.acquiredRound+n<=state.round).flatMap(n=>planAugmentGifts(state,
   {...a,choiceId:JSON.stringify([a.choiceId,'replication',n]),acquiredRound:a.acquiredRound+n},[{kind:'item',definitionId:r.optionId}]));
 });
}
