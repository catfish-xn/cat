import type { MatchState } from './match-types';
import type { ItemInstance } from './strategy-types';
import type { ResourceFact, ResourceProvenanceEntry } from './resource-provenance';
import { getCatalogRoundById } from './round-selectors';
import { AUGMENT_BATCH5_S3B } from './content/augment-pool-batch5-s3b';
import { pandoraConversions, isS3bConversion, validS3bConversion } from './augment-pool-batch5-s3b-conversions';
import { salvagePlan, S3B_SOURCE } from './augment-pool-batch5-s3b-salvage';
import { canonicalContent } from './content';

export function hasS3bInventory(state:MatchState):boolean {
 return state.augments.some(a=>AUGMENT_BATCH5_S3B[a.definitionId])||state.resourceProvenance.entries.some(isS3bConversion)
  ||!!state.seatMechanics?.receipts.some(r=>r.source===S3B_SOURCE||r.receiptId.startsWith('["augment-pool-batch5-s3b",')||Object.keys(AUGMENT_BATCH5_S3B).some(id=>r.receiptId.includes(id)));
}
/** Observer of the existing ordered item replay, never of the candidate live
 * inventory. It requires every entry roll and sale output, even unchanged rolls. */
export function s3bInventoryReplay(next:MatchState,previous:MatchState|null){
 if(!hasS3bInventory(next))return {beforeFact:(_fact:ResourceProvenanceEntry,_items:readonly ItemInstance[],_serial:number)=>{},finish:(_items:readonly ItemInstance[])=>{}};
 const check=(value:unknown,message:string)=>{if(!value)throw new RangeError(`Invalid S3B inventory: ${message}`);};
 const receipts=new Set<string>();let round=previous?.round??1,pending:ResourceFact[]=[];
 const enter=(target:number,items:readonly ItemInstance[])=>{
  while(round<target){check(!pending.length,'missing round conversions');pending=pandoraConversions(next,items,++round);}
 };
 return {
  beforeFact(fact:ResourceProvenanceEntry,items:readonly ItemInstance[],serial:number){
   check(next.resourceProvenance.entries[fact.sequence]===fact,'sequence');
   enter(getCatalogRoundById(fact.roundId).ordinal,items);
   if(pending.length){const {sequence:_sequence,roundId:_roundId,...actual}=fact;check(canonicalContent(actual)===canonicalContent(pending.shift()),'conversion coverage/order');}
   else check(!isS3bConversion(fact),'unexpected conversion');
   if(fact.kind!=='unit-sold')return;
   for(const p of salvagePlan(next,items,fact)){
    const receipt=next.seatMechanics?.receipts.find(r=>r.receiptId===p.receiptId),itemId=`item-${serial++}`;
    check(receipt?.kind==='item'&&receipt.source===S3B_SOURCE&&receipt.definitionId===p.definitionId&&receipt.itemId===itemId
      &&receipt.roundId===fact.roundId&&receipt.round===getCatalogRoundById(fact.roundId).ordinal,'salvage component receipt');
    receipts.add(p.receiptId);pending.push(p.conversion,{kind:'item-acquired',itemId,source:{kind:'mechanic',receiptId:p.receiptId}});
   }
  },
  finish(items:readonly ItemInstance[]){
   enter(next.round,items);check(!pending.length,'missing inventory conversions');
   for(const r of (next.seatMechanics?.receipts??[]).slice(previous?.seatMechanics?.receipts.length??0))
    if(r.source===S3B_SOURCE||r.receiptId.startsWith('["augment-pool-batch5-s3b",'))check(receipts.has(r.receiptId),'orphan salvage receipt');
  },
 };
}

/** A revoked Thief's Gloves roll remains in the immutable equipment RNG ledger.
 * Pandora entry conversions cannot justify a roll in that same new round;
 * a sale can follow a genuine equip during its own round. The full observer
 * above independently authenticates ownership and the conversion boundary. */
export function s3bHistoricalEquipmentParent(state:MatchState,itemId:string,roundId:string):ItemInstance|undefined {
 const round=getCatalogRoundById(roundId).ordinal;
 const conversion=state.resourceProvenance.entries.find(e=>{
  if(e.kind!=='g23-item-converted'||e.itemId!==itemId||e.from!=='thiefs-gloves'||!isS3bConversion(e)||!validS3bConversion(state,e,e.roundId))return false;
  const at=getCatalogRoundById(e.roundId).ordinal,kind=JSON.parse(e.receiptId)[2];
  return kind==='salvage'?at>=round:kind==='pandora'&&at>round;
 });
 return conversion?.kind==='g23-item-converted'?{id:itemId,definitionId:conversion.from,location:{kind:'inventory'}}:undefined;
}
