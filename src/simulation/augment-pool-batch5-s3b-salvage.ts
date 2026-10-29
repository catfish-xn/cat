import type { MatchState } from './match-types';
import type { ItemInstance } from './strategy-types';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { AUGMENT_BATCH5_S3B } from './content/augment-pool-batch5-s3b';
import { planAugmentGifts } from './augment-gift-plan';
import { appendResourceProvenance, type ResourceProvenanceEntry } from './resource-provenance';
import { s3bAcquiredBefore } from './augment-pool-batch5-s3b';
import { grantMechanicItem } from './seat-mechanics/grants';
import type { S3bConversion } from './augment-pool-batch5-s3b-conversions';

export const S3B_SOURCE='augment-pool-batch5-s3b';
/** Round results are replay-authenticated by the existing battle history. */
export function salvageRewardPlan(state:MatchState){
 const a=state.augments.find(a=>a.definitionId==='salvage-bin');if(!a)return [];
 const threshold=AUGMENT_BATCH5_S3B['salvage-bin'].source.values.NumRounds!;
 const seventh=state.roundResults.filter(r=>r.round>=a.acquiredRound&&r.roundKind==='pvp')[threshold-1];
 return seventh?planAugmentGifts(state,{...a,choiceId:JSON.stringify([a.choiceId,'salvage',threshold]),acquiredRound:seventh.round},[{kind:'random-item',pool:'component',count:1}]):[];
}
export function salvagePlan(state:Pick<MatchState,'augments'|'resourceProvenance'>,items:readonly ItemInstance[],sale:ResourceProvenanceEntry){
 const a=state.augments.find(a=>a.definitionId==='salvage-bin');
 if(!a||sale.kind!=='unit-sold'||!s3bAcquiredBefore(state,'salvage-bin',sale.sequence))return [];
 return items.filter(i=>i.location.kind==='unit'&&i.location.unitId===sale.unitId&&G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.includes(i.definitionId))
  .sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map(i=>{
   const recipe=ITEM_DEFINITIONS[i.definitionId].recipe!;
   const receiptId=JSON.stringify([S3B_SOURCE,a.choiceId,'salvage',sale.sequence,i.id]);
   const conversion:S3bConversion={kind:'g23-item-converted',itemId:i.id,from:i.definitionId,to:recipe[0],receiptId};
   return {conversion,definitionId:recipe[1],receiptId:JSON.stringify([S3B_SOURCE,a.choiceId,'salvage',sale.sequence,i.id,'component'])};
  });
}
/** Preserve the sold item's ID for component one; component two uses a normal
 * authenticated item birth. Temporary equipment never enters the permanent list. */
export function salvageSale(before:MatchState,sold:MatchState,unitId:string):MatchState {
 const sale=sold.resourceProvenance.entries.at(-1)!;
 if(sale.kind!=='unit-sold'||sale.unitId!==unitId)throw new RangeError('Invalid salvage sale');
 let state=sold;
 for(const p of salvagePlan(state,before.items,sale)){
  state={...state,items:state.items.map(i=>i.id===p.conversion.itemId?{...i,definitionId:p.conversion.to}:i),
   resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,p.conversion)};
  const granted=grantMechanicItem(state,{receiptId:p.receiptId,source:S3B_SOURCE,definitionId:p.definitionId});
  if(!granted.ok)throw new RangeError('Invalid salvage grant');state=granted.state;
 }
 return state;
}
export function validSalvageConversion(state:Pick<MatchState,'augments'|'resourceProvenance'>,f:S3bConversion,roundId:string):boolean {
 let key:unknown;try{key=JSON.parse(f.receiptId);}catch{return false;}
 if(!Array.isArray(key)||key.length!==5||key[0]!==S3B_SOURCE||key[2]!=='salvage'||key[4]!==f.itemId||!Number.isSafeInteger(key[3]))return false;
 const sale=state.resourceProvenance.entries[key[3]],a=state.augments.find(a=>a.definitionId==='salvage-bin'&&a.choiceId===key[1]);
 return !!a&&sale?.kind==='unit-sold'&&sale.roundId===roundId&&s3bAcquiredBefore(state,'salvage-bin',sale.sequence)
  &&G24_FORGE_POOLS.TFT_ArmoryKeyCompleted.includes(f.from)&&ITEM_DEFINITIONS[f.from].recipe![0]===f.to;
}
