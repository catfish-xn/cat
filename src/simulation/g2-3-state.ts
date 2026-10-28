import { hasMutationSurvives, mutationSacrificeCell } from './augment-pool-batch5-g3-mutation';
import { readRestoreG23Progress, rememberReadG23Progress } from './g23-restore-reuse';
import { TACTICIAN_SIZE_ITEMS } from './content/tactician-items';
import { activateFamily, familyDisplay } from './family-heist';
import { getCatalogRoundById } from './round-selectors';
import {g23RewardAtoms,type G23RewardClaim} from './g2-3-rewards';
import type {MatchState} from './match-types';
import type {G23MatchProgress} from './g2-3-match-progress';
import {emptySeatMechanics} from './seat-mechanics/state';
import {g23Laboratories} from './g2-3-experiment';
import { deriveEffectiveTrait, projectEffectiveMembership } from './traits/effective-membership';
/** Settled economy receipts only. Expands no reward atoms, so restore-time readers that run before
 * validateG23RewardSources never sample an unauthenticated reward descriptor. */
export function readG23EconomyReceipts(state:Pick<MatchState,'seatMechanics'>):G23MatchProgress['economyReceipts']{
 const m=state.seatMechanics;if(!m?.seat.academy||!m.seat.junkerKing||!m.seat.alchemist)return [];
 return (m.hidden.progress as {economyReceipts?:G23MatchProgress['economyReceipts']}|undefined)?.economyReceipts??[];
}
/** The DTO is reconstructed from disjoint container fields; never persisted alongside them. */
export function readG23Progress(state:{readonly seatMechanics?:MatchState['seatMechanics'];readonly g23?:G23MatchProgress;readonly multiplayer?:MatchState['multiplayer'];readonly m8?:MatchState['m8'];readonly resourceProvenance?:MatchState['resourceProvenance']}):G23MatchProgress|undefined{
 const known=readRestoreG23Progress(state);if(known)return known;
 if(state.g23)return state.g23; // immutable combat-input DTO, never a MatchState field
 const m=state.seatMechanics;if(!m?.seat.academy||!m.seat.junkerKing||!m.seat.alchemist)return undefined;
 const h=(m.hidden.progress??{version:'g2-3-progress-v1',seed:0,rngState:0,rngDraws:0,economyReceipts:[]}) as Omit<G23MatchProgress,'conquest'|'sponsored'|'chem'|'junkerRounds'|'junkerPurchases'|'itemReceipts'|'rewardClaims'|'rewards'>;
 const {rewards:storedRewards,...c}=m.seat.conqueror as Omit<G23MatchProgress['conquest'],'radiantConversion'>&{rewards:G23MatchProgress['rewards']};
 const rewards=m.hidden.progress?storedRewards:storedRewards.filter(b=>b.source!=='family');
 const a=m.seat.academy as {sponsored:readonly string[]};
 const j=m.seat.junkerKing as {rounds:number;purchases:G23MatchProgress['junkerPurchases']};
 const rewardClaims:G23RewardClaim[]=[];
 const bundles=rewards.map(b=>({b,atoms:g23RewardAtoms(b,h.seed,!!state.multiplayer)}));
 for(const r of m.receipts)for(const {b,atoms} of bundles){
  for(const atom of atoms){
   const prefix=atom.id+':copy:';
   if(!r.receiptId.startsWith(prefix))continue;
   const copy=Number(r.receiptId.slice(prefix.length));
   const definitionId=r.kind==='item'||r.kind==='unit'||r.kind==='consumable'?r.definitionId:r.kind==='choice'?r.optionId:'';
   const instanceId=r.kind==='item'||r.kind==='choice'?r.itemId:r.kind==='unit'?r.unitId:r.kind==='consumable'?r.consumableId:null;
   rewardClaims.push({id:r.receiptId,bundleId:b.id,atomId:atom.id,copy,round:r.round,kind:atom.kind,definitionId,instanceId,gold:atom.gold});
  }
 }
 const epicCrowns=[...(state.m8?.loot.receipts.filter(r=>r.payload.kind==='item'&&r.payload.definitionId==='TFT_Item_ForceOfNature'&&r.resolution!=='forfeited').map(r=>({receiptId:r.receiptId,round:getCatalogRoundById(r.claimedRoundId??JSON.parse(JSON.parse(r.dropId)[0])[1]).ordinal}))??[]),...m.receipts.filter(r=>r.kind==='item'&&TACTICIAN_SIZE_ITEMS.includes(r.definitionId)&&!rewardClaims.some(c=>c.id===r.receiptId&&c.definitionId==='TFT_Item_ForceOfNature')).map(r=>({receiptId:r.receiptId,round:r.round})),...(state.resourceProvenance?.entries.flatMap(e=>e.kind==='item-combined'&&TACTICIAN_SIZE_ITEMS.includes(e.event.definitionId)?[{receiptId:JSON.stringify(['crafted-tactician',e.sequence]),round:getCatalogRoundById(e.roundId).ordinal}]:[])??[])];
 return rememberReadG23Progress(state,{...h,...(epicCrowns?.length?{epicCrowns}:{}),rewards,rewardClaims,conquest:{...c,radiantConversion:m.seat.radiantConversion as boolean},sponsored:a.sponsored,chem:m.seat.alchemist as G23MatchProgress['chem'],junkerRounds:j.rounds,junkerPurchases:j.purchases,
 itemReceipts:m.receipts.flatMap(r=>r.kind==='item'&&(r.source==='academy'||r.receiptId.startsWith('g23:academy:'))?[{id:r.receiptId,kind:'academy' as const,tier:Number(r.receiptId.split(':').at(-1)),round:r.round,itemId:r.itemId,definitionId:r.definitionId}]:[])});
}
export function writeG23Progress<T extends Pick<MatchState,'seatMechanics'>>(state:T,p:G23MatchProgress):T{
 const m=state.seatMechanics??emptySeatMechanics();
 const {conquest,sponsored,chem,junkerRounds,junkerPurchases,itemReceipts:_derived,rewardClaims:_selectors,epicCrowns:_epic,rewards,...hidden}=p;
 const {radiantConversion,...conqueror}=conquest;
 return {...state,seatMechanics:{...m,seat:{...m.seat,conqueror:{...conqueror,rewards},academy:{sponsored},alchemist:chem,junkerKing:{rounds:junkerRounds,purchases:junkerPurchases},radiantConversion,...(p.mel?{melRescue:{pvpCasts:p.mel.pvpCasts,saved:p.mel.savedBattleId!==null}}:{}),...(p.family?{familyHeist:familyDisplay(p.family)}:{})},hidden:{...m.hidden,progress:hidden}}};
}
export function updateG23Cells(state:MatchState):MatchState{
 let p=readG23Progress(state);if(!p)return state;
 // Both consumers need one trait, not the full catalog on every combat tick.
 const projection = projectEffectiveMembership(state.preparation, undefined, undefined, state.items);
 if(!p.family&&state.phase==='preparation'&&!state.multiplayer?.combatRosterLocked&&deriveEffectiveTrait(projection,'player','family').tier>=5){p=activateFamily(p,state.round);state=writeG23Progress(state,p);}
 const tier=deriveEffectiveTrait(projection,'player','experiment').tier;
 return {...state,seatMechanics:{...state.seatMechanics!,seat:{...state.seatMechanics!.seat,experimentCells:g23Laboratories(p.seed,'player',tier,hasMutationSurvives(state.augments)?mutationSacrificeCell():undefined)}}};
}


/** Receipt-backed permanent population at an authenticated resource prefix, including same-round online claims. */
export function epicCrownsAtResourcePrefix(state:MatchState,prefixLength:number):NonNullable<G23MatchProgress['epicCrowns']>{
 const granted=new Set(state.resourceProvenance.entries.slice(0,prefixLength).flatMap(e=>e.kind==='item-combined'&&TACTICIAN_SIZE_ITEMS.includes(e.event.definitionId)?[JSON.stringify(['crafted-tactician',e.sequence])]:e.kind==='item-acquired'&&(e.source.kind==='loot'||e.source.kind==='mechanic')?[e.source.receiptId]:[]));
 return (readG23Progress(state)?.epicCrowns??[]).filter(c=>granted.has(c.receiptId));
}
