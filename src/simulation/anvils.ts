import { batch5AnvilSpecification, BATCH5_S3A_SOURCE } from './augment-pool-batch5-s3a';
import { academicAnvilOffers } from './augment-pool-batch5-s3b';
import { batch1AnvilSpecification } from './augment-pool-grants';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { isAnvil } from './content/anvils';
import type { MatchState, MatchCommandResult } from './match-types';
import { grantMechanicUnit, type MechanicGrantRequest } from './seat-mechanics/grants';
import { openMechanicChoice } from './seat-mechanics/choices';
import { appendResourceProvenance } from './resource-provenance';
import { openingForgeOffers, pendingOpeningForges, openingEncounterId } from './opening-encounter';
import { openingRewardAtoms, openingRewardOffers as batchOffers } from './opening-batch-rewards';
import { openingRewards, openingRewardOffers as batchBOffers } from './opening-batch-b-rewards';
import { epicForgeOffers } from './epic-forges';
import { readG23Progress } from './g2-3-state';
import { g23RewardAtoms } from './g2-3-rewards';
import { isCombatRosterLocked } from './operation-policy';
import { isOverflowUnit } from './bench-capacity';

/** Grant seam: callers supply an authenticated reward receipt; new sources must also define their deterministic offers. */
export function grantAnvilUnit(state:MatchState,request:MechanicGrantRequest & {readonly definitionId:string}):MatchCommandResult {
  if(!isAnvil(request.definitionId))return {ok:false,state,reason:'invalid-mechanic-state'};
  return grantMechanicUnit(state,{...request,immediate:true});
}
export function openingAnvilOrbs(state:MatchState){
 return pendingOpeningForges(state).map(r=>{const orbId=`opening-anvil:${r.receiptId}`;
  return {orbId,roundId:'1-2',tier:'gray' as const,source:'mechanic' as const,entries:[{orbId,entryOrdinal:0,dropId:orbId,roundId:'1-2',encounterId:'opening-encounter',sourceUnitId:r.receiptId,slotOrdinal:0,status:'planned' as const,receiptId:null,revealCondition:'source-killed' as const,payload:{kind:'forge' as const,definitionId:openingEncounterId(state)==='component-anvils'?'TFT_ArmoryKeyComponent' as const:'TFT_ArmoryKeyOrnn' as const,quantity:1 as const}}]};});
}
/** Frozen G2-3 forge atoms remain claimable, including when the bench is full. */
export function g23AnvilOrbs(state:MatchState){
 const p=readG23Progress(state);if(!p)return [];
 return p.rewards.flatMap(b=>g23RewardAtoms(b,p.seed,!!state.multiplayer).flatMap(a=>{
  if(!a.forgeDefinitionId||!isAnvil(a.forgeDefinitionId)||a.forgeDefinitionId==='TFT_ArmoryKeyRadiant')return []; // Batch4 radiant is a direct unit gift, never a loot payload.
  const copy=p.rewardClaims.filter(c=>c.atomId===a.id).length;if(copy>=a.quantity)return [];
  const orbId=`g23-anvil:${JSON.stringify([a.id,copy])}`,roundId=getMultiplayerRoundByOrdinal(b.round).roundId;
  return [{orbId,roundId,tier:'gray' as const,source:'mechanic' as const,entries:[{orbId,entryOrdinal:0,dropId:a.id,roundId,encounterId:b.source,sourceUnitId:b.id,slotOrdinal:0,status:'planned' as const,receiptId:null,revealCondition:'source-killed' as const,payload:{kind:'forge' as const,definitionId:a.forgeDefinitionId,quantity:1 as const}}]}];
 }));
}
export const anvilChoiceId=(unitId:string)=>JSON.stringify(['anvil',unitId]);
export function specification(state:MatchState,unitId:string) {
  const loot=state.m8.loot.receipts.find(r=>r.payload.kind==='forge'&&r.grantedUnitIds.includes(unitId));
  if(loot?.payload.kind==='forge')return {definitionId:loot.payload.definitionId,offers:epicForgeOffers(state.seed,loot.receiptId,loot.payload.definitionId)};
  const r=state.seatMechanics?.receipts.find(r=>r.kind==='unit'&&r.unitId===unitId);
  if(!r||r.kind!=='unit'||!isAnvil(r.definitionId))throw new RangeError('Invalid anvil birth');
  let offers:readonly string[]|undefined;
  if(r.source===BATCH5_S3A_SOURCE){const spec=batch5AnvilSpecification(state,r.receiptId);if(spec?.definitionId===r.definitionId)offers=spec.offers;}
  else if(r.source==='augment-pool-batch1'){
    const spec=batch1AnvilSpecification(state,r.receiptId);if(spec?.definitionId===r.definitionId)offers=spec.offers;
  }else if(r.source==='opening-encounter')offers=openingForgeOffers(state,r.receiptId);
  else if(r.source==='opening-encounter-batch-a'){
    const a=openingRewardAtoms(state).find(a=>a.id===r.receiptId);if(a)offers=batchOffers(state,a);
  }else if(r.source==='opening-batch-b'){
    const a=openingRewards(state).find(a=>a.id===r.receiptId);if(a)offers=batchBOffers(state,a);
  }else {
    const p=readG23Progress(state);
    if(p)for(const b of p.rewards)for(const a of g23RewardAtoms(b,p.seed,!!state.multiplayer))
      if(r.receiptId.startsWith(`${a.id}:copy:`)&&a.forgeDefinitionId===r.definitionId)offers=a.options;
  }
  if(!offers||offers.length!==(academicAnvilOffers(state,r.receiptId)?2:r.definitionId==='TFT_ArmoryKeyRadiant'?5:4))throw new RangeError('Invalid anvil source');
  return {definitionId:r.definitionId,offers};
}
export function planOpenAnvil(state:MatchState,unitId:string):MatchCommandResult {
  const fail=(reason:Extract<MatchCommandResult,{ok:false}>['reason']):MatchCommandResult=>({ok:false,state,reason});
  if(!['preparation','settlement'].includes(state.phase)||state.pendingChoice||isCombatRosterLocked(state)||state.multiplayer?.status==='eliminated')return fail('wrong-phase');
  const unit=state.preparation.units.find(u=>u.id===unitId);
  if(!unit)return fail('unknown-unit');
  if(unit.team!=='player')return fail('enemy-unit');
  if(!isAnvil(unit.definitionId)||(unit.location.kind!=='bench'&&!isOverflowUnit(state.preparation,unitId)))return fail('invalid-target');
  const {offers}=specification(state,unitId),choiceId=anvilChoiceId(unitId);
  const opened=openMechanicChoice(state,{choiceId,offers,returnPhase:state.phase as 'preparation'|'settlement',payload:{kind:'forge',source:'anvil-unit',timeoutMs:30000,timeoutOption:offers[0]}});
  if(!opened.ok)return opened;
  return {...opened,state:{...opened.state,preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.id!==unitId)},
    resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,{kind:'anvil-opened',unitId,choiceId})}};
}

