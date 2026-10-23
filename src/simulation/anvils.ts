import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { isAnvil } from './content/anvils';
import { canonicalContent } from './content';
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
  if(!a.forgeDefinitionId||!isAnvil(a.forgeDefinitionId))return [];
  const copy=p.rewardClaims.filter(c=>c.atomId===a.id).length;if(copy>=a.quantity)return [];
  const orbId=`g23-anvil:${JSON.stringify([a.id,copy])}`,roundId=getMultiplayerRoundByOrdinal(b.round).roundId;
  return [{orbId,roundId,tier:'gray' as const,source:'mechanic' as const,entries:[{orbId,entryOrdinal:0,dropId:a.id,roundId,encounterId:b.source,sourceUnitId:b.id,slotOrdinal:0,status:'planned' as const,receiptId:null,revealCondition:'source-killed' as const,payload:{kind:'forge' as const,definitionId:a.forgeDefinitionId,quantity:1 as const}}]}];
 }));
}
export const anvilChoiceId=(unitId:string)=>JSON.stringify(['anvil',unitId]);
function specification(state:MatchState,unitId:string) {
  const loot=state.m8.loot.receipts.find(r=>r.payload.kind==='forge'&&r.grantedUnitIds.includes(unitId));
  if(loot?.payload.kind==='forge')return {definitionId:loot.payload.definitionId,offers:epicForgeOffers(state.seed,loot.receiptId,loot.payload.definitionId)};
  const r=state.seatMechanics?.receipts.find(r=>r.kind==='unit'&&r.unitId===unitId);
  if(!r||r.kind!=='unit'||!isAnvil(r.definitionId))throw new RangeError('Invalid anvil birth');
  let offers:readonly string[]|undefined;
  if(r.source==='opening-encounter')offers=openingForgeOffers(state,r.receiptId);
  else if(r.source==='opening-encounter-batch-a'){
    const a=openingRewardAtoms(state).find(a=>a.id===r.receiptId);if(a)offers=batchOffers(state,a);
  }else if(r.source==='opening-batch-b'){
    const a=openingRewards(state).find(a=>a.id===r.receiptId);if(a)offers=batchBOffers(state,a);
  }else {
    const p=readG23Progress(state);
    if(p)for(const b of p.rewards)for(const a of g23RewardAtoms(b,p.seed,!!state.multiplayer))
      if(r.receiptId.startsWith(`${a.id}:copy:`)&&a.forgeDefinitionId===r.definitionId)offers=a.options;
  }
  if(!offers||offers.length!==4)throw new RangeError('Invalid anvil source');
  return {definitionId:r.definitionId,offers};
}
export function planOpenAnvil(state:MatchState,unitId:string):MatchCommandResult {
  const fail=(reason:Extract<MatchCommandResult,{ok:false}>['reason']):MatchCommandResult=>({ok:false,state,reason});
  if(!['preparation','settlement'].includes(state.phase)||state.pendingChoice||isCombatRosterLocked(state)||state.multiplayer?.status==='eliminated')return fail('wrong-phase');
  const unit=state.preparation.units.find(u=>u.id===unitId);
  if(!unit)return fail('unknown-unit');
  if(unit.team!=='player')return fail('enemy-unit');
  if(!isAnvil(unit.definitionId)||unit.location.kind!=='bench')return fail('invalid-target');
  const {offers}=specification(state,unitId),choiceId=anvilChoiceId(unitId);
  const opened=openMechanicChoice(state,{choiceId,offers,returnPhase:state.phase as 'preparation'|'settlement',payload:{kind:'forge',source:'anvil-unit',timeoutMs:30000,timeoutOption:offers[0]}});
  if(!opened.ok)return opened;
  return {...opened,state:{...opened.state,preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.id!==unitId)},
    resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,{kind:'anvil-opened',unitId,choiceId})}};
}
/** Choice receipts and live units must reconcile with one authenticated birth and one consumption. */
export function validateAnvils(state:MatchState):void {
  const check=(v:unknown)=>{if(!v)throw new RangeError('Invalid anvil ledger');};
  const births=[...state.m8.loot.receipts.filter(r=>r.payload.kind==='forge'&&r.resolution!=='forfeited').flatMap(r=>r.grantedUnitIds),
    ...state.seatMechanics?.receipts.flatMap(r=>r.kind==='unit'&&isAnvil(r.definitionId)&&r.resolution==='held'&&r.unitId?[r.unitId]:[])??[]];
  check(new Set(births).size===births.length);
  const opened=state.resourceProvenance.entries.filter(e=>e.kind==='anvil-opened');
  check(new Set(opened.map(e=>e.unitId)).size===opened.length);
  for(const id of births){
    check(state.preparation.units.some(u=>u.id===id)||opened.some(e=>e.unitId===id));
    check(state.resourceProvenance.entries.some(e=>e.kind==='unit-acquired'&&e.unitId===id));
  }
  for(const u of state.preparation.units)if(isAnvil(u.definitionId)){
    check(u.team==='player'&&u.location.kind==='bench'&&u.starLevel===1&&!state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===u.id));
    check(specification(state,u.id).definitionId===u.definitionId&&!opened.some(e=>e.unitId===u.id));
  }
  for(const e of opened){
    const {offers}=specification(state,e.unitId),r=state.seatMechanics?.receipts.find(r=>r.receiptId===e.choiceId),c=state.pendingChoice;
    check(births.includes(e.unitId)&&e.choiceId===anvilChoiceId(e.unitId));
    if(r)check(r.kind==='choice'&&r.source==='anvil-unit'&&r.choiceKind==='forge'&&!r.skipped&&r.price===0&&r.itemId!==null&&offers.includes(r.optionId)&&(!r.timedOut||r.optionId===offers[0]));
    else check(c?.choiceId===e.choiceId&&c.kind==='forge'&&canonicalContent(c.offers)===canonicalContent(offers)&&canonicalContent(c.payload)===canonicalContent({kind:'forge',source:'anvil-unit',timeoutMs:30000,timeoutOption:offers[0]}));
  }
  for(const r of state.seatMechanics?.receipts??[])if(r.source==='anvil-unit'||r.receiptId.startsWith('["anvil",'))check(opened.some(e=>e.choiceId===r.receiptId));
  if(state.pendingChoice?.payload?.source==='anvil-unit'||state.pendingChoice?.choiceId.startsWith('["anvil",'))check(opened.some(e=>e.choiceId===state.pendingChoice!.choiceId));
}
