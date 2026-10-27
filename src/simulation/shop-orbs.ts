import { canonicalContent } from './content';
import { lootEntryId, lootOrbId, lootReceiptId } from './loot-identity';
import { getCatalogRoundById } from './round-selectors';
import type { MatchState } from './match-types';

/** Existing mechanic-orb envelope, limited to the new shop gifts in solo mode. */
export function soloShopOrb(state: MatchState, orbId: string): boolean {
 return !state.multiplayer && !!state.seatMechanics?.receipts.some(r=>r.source==='augment-pool-shop'
  &&r.kind==='unit'&&r.resolution==='orb'&&r.orbId===orbId);
}
/** Validate the additional mechanic entries before applying the unchanged solo PvE validator.
 * The returned projection excludes only authenticated shop entries; the live save and provenance retain them. */
export function soloPveLoot(state: MatchState): MatchState['m8']['loot'] {
 const loot=state.m8.loot,orbs=loot.rewardOrbs??[],receipts=state.seatMechanics?.receipts.filter(r=>r.kind==='unit'&&r.resolution==='orb')??[];
 const fail=(ok:unknown)=>{if(!ok)throw new RangeError('Invalid solo shop reward orb');};
 fail(Array.isArray(orbs));
 const ids=new Set<string>();
 for(const orb of orbs){
  const r=receipts.find(r=>r.kind==='unit'&&r.orbId===orb.orbId);
  fail(r?.kind==='unit'&&r.source==='augment-pool-shop'&&soloShopOrb(state,orb.orbId));
  if(!r||r.kind!=='unit')throw new RangeError('Invalid solo shop reward receipt');
  const orbId=lootOrbId(r.roundId,'mechanic',r.receiptId,0),dropId=lootEntryId(orbId,0);
  const drop={orbId,entryOrdinal:0,dropId,roundId:r.roundId,encounterId:'mechanic',sourceUnitId:r.receiptId,
   slotOrdinal:0,status:'planned',receiptId:null,revealCondition:'source-killed',payload:{kind:'unit',definitionId:r.definitionId,quantity:1,starLevel:r.starLevel??1}};
  fail(canonicalContent(orb)===canonicalContent({orbId,roundId:r.roundId,tier:'gray',source:'mechanic',entries:[drop]}));
  fail(!ids.has(dropId)&&r.round<=state.round);ids.add(dropId);
  const progress=loot.direct.filter(d=>d.dropId===dropId),claims=loot.receipts.filter(c=>c.dropId===dropId);
  fail(progress.length===1&&['revealed','granted'].includes(progress[0].status));
  const claim=claims[0];
  if(progress[0].status==='revealed')fail(!claims.length&&progress[0].receiptId===null);
  else {
   fail(claims.length===1&&claim.receiptId===lootReceiptId(dropId)&&progress[0].receiptId===claim.receiptId);
   fail(canonicalContent(claim.payload)===canonicalContent(drop.payload)&&claim.grantedItemIds.length===0&&claim.grantedUnitIds.length===1);
   const round=claim.claimedRoundId===undefined?r.round:getCatalogRoundById(claim.claimedRoundId).ordinal;
   fail(round>=r.round&&round<=state.round);
   fail(claim.resolution===undefined||claim.resolution==='held');fail(claim.gold===undefined||claim.gold===0);
  }
  fail(!loot.earnedEvidence.some(e=>e.dropId===dropId));
 }
 fail(receipts.every(r=>r.kind==='unit'&&r.source==='augment-pool-shop'&&r.orbId===lootOrbId(r.roundId,'mechanic',r.receiptId,0)&&orbs.some(o=>o.orbId===r.orbId)));
 const {rewardOrbs:_,...pve}=loot;
 return {...pve,direct:loot.direct.filter(d=>!ids.has(d.dropId)),receipts:loot.receipts.filter(r=>!ids.has(r.dropId))};
}
