import type {MatchState} from './match-types';
import type {Unit} from './units';
import {readG23Progress} from './g2-3-state';

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


