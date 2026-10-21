import type {MatchState} from './match-types';
import type {Unit} from './units';
import {canonicalContent} from './content';
import {validateDeployment,getPlayerDeploymentCount} from './game';
import {foldResourceProvenance,type ResourceProvenanceContext} from './resource-provenance';
import {getCatalogRoundById} from './round-selectors';
import {readG23Progress,epicCrownsAtResourcePrefix} from './g2-3-state';
import {replayG23Economy} from './g2-3-match-progress';
import {g23JunkerMenu,G23_JUNKER_PAID} from './g2-3-junker';
import {crownTeamSizeBonus} from './deployment-cap';

/** Authority-only grant-time evidence. Locations are historical preparation
 * inputs; identity/star/ownership must match the independently folded prefix. */
export interface G23GrantEvidence {
 readonly receiptId:string;readonly round:number;readonly resourcePrefixLength:number;
 readonly mechanicPrefixLength:number;readonly economyPrefixLength:number;readonly level:number;
 readonly units:readonly Unit[];
}
export function recordG23GrantEvidence(before:MatchState,after:MatchState,receiptId:string):MatchState{
 const m=after.seatMechanics!;
 const evidence:G23GrantEvidence={receiptId,round:before.round,resourcePrefixLength:before.resourceProvenance.entries.length,
  mechanicPrefixLength:before.seatMechanics!.receipts.length,economyPrefixLength:readG23Progress(before)!.economyReceipts.length,level:before.level,
  units:before.preparation.units.filter(u=>u.team==='player').map(({id,definitionId,starLevel,team,location})=>({id,definitionId,starLevel,team,location:structuredClone(location)}))};
 return {...after,seatMechanics:{...m,hidden:{...m.hidden,grantEvidence:[...((m.hidden.grantEvidence as readonly G23GrantEvidence[]|undefined)??[]),evidence]}}};
}
const sort=<T extends {readonly id:string}>(xs:readonly T[])=>[...xs].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
export function validateG23GrantEvidence(state:MatchState,context:ResourceProvenanceContext,parsedJsonInput=false):void{
 function check(ok:unknown,message:string):asserts ok{if(!ok)throw new RangeError('Invalid G23 grant evidence: '+message);}
 const p=readG23Progress(state)!,receipts=state.seatMechanics!.receipts,entries=state.resourceProvenance.entries;
 const required=receipts.filter(r=>r.source==='academy'||r.receiptId.startsWith('g23:academy:')||r.source==='junker-king'||r.receiptId.startsWith('g23:junker:'));
 const raw=state.seatMechanics!.hidden.grantEvidence;
 check(raw===undefined||Array.isArray(raw),'array');
 const evidence=(raw??[]) as readonly G23GrantEvidence[];
 check(evidence.length===required.length,'missing/extra receipt snapshot');
 let previousResource=0,previousMechanic=-1,previousEconomy=0;
 const projections=new Map<number,ReturnType<typeof foldResourceProvenance>>();
 for(const [i,e] of evidence.entries()){
  check(e&&Object.keys(e).length===7&&e.receiptId===required[i].receiptId&&e.round===required[i].round,'identity/order');
  const receipt=required[i],prefix=e.resourcePrefixLength;
  check(Number.isSafeInteger(prefix)&&prefix>=previousResource&&prefix<=entries.length&&entries[prefix]?.kind!=='unit-upgraded','resource prefix');
  check(Number.isSafeInteger(e.mechanicPrefixLength)&&e.mechanicPrefixLength>previousMechanic&&receipts[e.mechanicPrefixLength]===receipt,'mechanic prefix');
  check(Number.isSafeInteger(e.economyPrefixLength)&&e.economyPrefixLength>=previousEconomy&&e.economyPrefixLength<=p.economyReceipts.length,'economy prefix');
  check((prefix===0||getCatalogRoundById(entries[prefix-1].roundId).ordinal<=e.round)
   &&(prefix===entries.length||getCatalogRoundById(entries[prefix].roundId).ordinal>=e.round),'resource round');
  const economy=p.economyReceipts.slice(0,e.economyPrefixLength);
  check(economy.every(r=>r.kind==='battle'?r.facts.round<e.round:r.round<=e.round)
   &&p.economyReceipts.slice(e.economyPrefixLength).every(r=>(r.kind==='battle'?r.facts.round:r.round)>=e.round),'preparation economy boundary');
  const history=state.roundResults[e.round-1],prior=state.roundResults[e.round-2];
  check((!prior||e.mechanicPrefixLength>=prior.mechanicReceiptPrefixLength!)
   &&(!history||e.mechanicPrefixLength<history.mechanicReceiptPrefixLength!),'receipt round boundary');
  check(Number.isSafeInteger(e.level)&&e.level>=(prior?.levelAfter??1)&&e.level<=(history?.levelBefore??state.level),'level');
  let resources=projections.get(prefix);
  if(!resources){resources=foldResourceProvenance(state.resourceProvenance,{...context,prefixLength:prefix},parsedJsonInput);projections.set(prefix,resources);}
  check(Array.isArray(e.units)&&canonicalContent(sort(e.units.map(({id,definitionId,starLevel})=>({id,definitionId,starLevel}))))===canonicalContent(resources.units),'unit ownership/star');
  const preparation={...state.preparation,units:e.units};
  check(new Set(e.units.map(u=>canonicalContent(u.location))).size===e.units.length
   &&e.units.every(u=>Object.keys(u).length===5&&u.team==='player'&&!validateDeployment(preparation,u.id,u.location)),'deployment snapshot');
  const progress=replayG23Economy(state.seed,economy);
  check(getPlayerDeploymentCount(preparation)<=e.level+crownTeamSizeBonus({...progress,epicCrowns:epicCrownsAtResourcePrefix(state,prefix),rewardClaims:p.rewardClaims.filter(c=>receipts.findIndex(r=>r.receiptId===c.id)<e.mechanicPrefixLength)}),'deployment capacity');
  if(receipt.receiptId.startsWith('g23:academy:')){
   const tier=Number(receipt.receiptId.split(':').at(-1));
   check(receipt.kind==='item'&&receipt.source==='academy'&&[3,4,5].includes(tier)
    &&receipt.definitionId===p.sponsored[tier-3],'academy qualification');
   const birth=entries[prefix];
   check(birth?.kind==='item-acquired'&&birth.itemId===receipt.itemId&&birth.source.kind==='mechanic'&&birth.source.receiptId===receipt.receiptId,'academy birth boundary');
  }else{
   const n=p.junkerPurchases.findIndex(r=>r.id===receipt.receiptId),purchase=p.junkerPurchases[n];
   check(n>=0&&receipt.kind==='choice'&&receipt.choiceKind==='armory'&&receipt.source==='junker-king'&&!receipt.skipped&&receipt.itemId===null,'junker receipt');
   check(p.junkerPurchases.slice(0,n).every(r=>receipts.findIndex(x=>x.receiptId===r.id)<e.mechanicPrefixLength),'purchase prefix');
   const menu=g23JunkerMenu({preparation,round:e.round,g23:{...progress,junkerPurchases:p.junkerPurchases.slice(0,n)}});
   check(menu&&menu.id===purchase.id&&menu.unitId===purchase.unitId&&menu.choices.includes(purchase.upgrade)
    &&(!receipt.timedOut||purchase.upgrade===menu.choices.find(c=>!(G23_JUNKER_PAID as readonly string[]).includes(c))),'junker menu/unit');
  }
  previousResource=prefix;previousMechanic=e.mechanicPrefixLength;previousEconomy=e.economyPrefixLength;
 }
}
