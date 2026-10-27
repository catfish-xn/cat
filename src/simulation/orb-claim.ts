import { pipelineExtraOrbs, recordPipelineOpening } from './augment-pool-batch5-g5-pipeline';
import { soloShopOrb } from './shop-orbs';
import { openingAnvilOrbs, g23AnvilOrbs, grantAnvilUnit } from './anvils';
import { openingRewardOrbs, claimOpeningReward, isOpeningRewardOrb } from './opening-batch-rewards';
import { openingRewardOrbs as batchBRewardOrbs, claimOpeningReward as claimBatchBReward } from './opening-batch-b-rewards';
import { familyOrbs, claimFamilyOrb } from './family-orbs';
import type { MatchState, MatchEvent } from './match-types';
import type { FrozenDirectDrop, RewardOrb } from './loot-types';
import type { MultiplayerCommandResult } from './round-settlement';
import { commitReceipt, grantDirectLoot, type UnitLootPolicy } from './loot-runtime';
import { lootOrbId, lootEntryId, lootReceiptId } from './loot-identity';
import { getMultiplayerRoundById } from './multiplayer-round';
import { isCombatRosterLocked } from './operation-policy';
import { drainG23Rewards, claimG23Atom, mechanicGrantEvents } from './g2-3-runtime';
import { planTemporaryEquipment } from './temporary-equipment';

/** Combat accepts intent only; the authoritative settlement drains the FIFO. */
export const ORB_CLAIM_PHASES: readonly MatchState['phase'][] = ['preparation', 'combat', 'settlement', 'choice'];
export const REWARD_ORB_TIER = 'gray' as const;
export function allClaimableOrbPlans(state: MatchState) {
  return [...state.m8.loot.frozen.rounds.flatMap(r=>r.orbs.map(o=>({...o,source:'pve' as const}))),
    ...pipelineExtraOrbs(state).map(o=>({...o,source:'pve' as const})),
    ...state.m8.loot.rewardOrbs??[]];
}
export function unclaimedOrbPlans(state: MatchState) {
  if (state.multiplayer?.status==='eliminated' || state.phase==='gameOver') return [];
  return [...openingAnvilOrbs(state),...g23AnvilOrbs(state),...openingRewardOrbs(state),...batchBRewardOrbs(state),...familyOrbs(state),...allClaimableOrbPlans(state).filter(o=>getMultiplayerRoundById(o.roundId).ordinal<=state.round
    && o.entries.length && o.entries.some(e=>state.m8.loot.direct.some(d=>d.dropId===e.dropId && d.status==='revealed')
      && (o.source==='mechanic'||state.m8.loot.earnedEvidence.some(v=>v.dropId===e.dropId))))];
}
/** Enqueue once under the mechanic receipt identity; no inventory, RNG or pool allocation. */
export function enqueueRewardOrb(state: MatchState, receiptId: string, definitionId: string, starLevel: 1|2|3 = 1): {state:MatchState;orbId:string} {
  const orbId=lootOrbId(state.roundDefinitionId,'mechanic',receiptId,0);
  if (state.m8.loot.rewardOrbs?.some(o=>o.orbId===orbId)) throw new RangeError('Duplicate reward orb');
  const drop:FrozenDirectDrop={orbId,entryOrdinal:0,dropId:lootEntryId(orbId,0),roundId:state.roundDefinitionId,
    encounterId:'mechanic',sourceUnitId:receiptId,slotOrdinal:0,status:'planned',receiptId:null,revealCondition:'source-killed',
    payload:{kind:'unit',definitionId,quantity:1,starLevel}};
  const orb:RewardOrb={orbId,roundId:state.roundDefinitionId,tier:REWARD_ORB_TIER,source:'mechanic',entries:[drop]};
  return {orbId,state:{...state,m8:{...state.m8,loot:{...state.m8.loot,rewardOrbs:[...state.m8.loot.rewardOrbs??[],orb],
    direct:[...state.m8.loot.direct,{dropId:drop.dropId,status:'revealed',receiptId:null}]}}}};
}

/** Match owns stamping and equipment commits. Shared pool policy is transaction-local. */
export function planOrbClaim(state: MatchState, orbId: string, expectedRound: number, policy?:UnitLootPolicy): MultiplayerCommandResult {
  const orb = unclaimedOrbPlans(state).find(o => o.orbId === orbId);
  const result = executeOrbClaim(state, orbId, expectedRound, policy);
  if (!result.ok || !orb || orb.tier !== 'prismatic') return result;
  return { ...result, state: recordPipelineOpening(state, result.state, orb,
    unclaimedOrbPlans(result.state).some(o => o.orbId === orbId)) };
}
function executeOrbClaim(state: MatchState, orbId: string, expectedRound: number, policy?:UnitLootPolicy): MultiplayerCommandResult {
  const fail=(reason:Extract<MultiplayerCommandResult,{ok:false}>['reason']):MultiplayerCommandResult=>({ok:false,state,reason});
  if (!state.multiplayer&&!soloShopOrb(state,orbId)&&!orbId.startsWith('g23-anvil:')&&!orbId.startsWith('opening-anvil:')&&!allClaimableOrbPlans(state).some(o=>o.orbId===orbId&&o.entries.some(e=>e.payload.kind==='forge'))&&!orbId.startsWith('family:orb:')&&!isOpeningRewardOrb(orbId)&&!orbId.startsWith('opening-batch-b/')) return fail('multiplayer-required');
  if (state.multiplayer?.status==='eliminated') return fail('seat-eliminated');
  if (state.round!==expectedRound) return fail('stale-round');
  if(soloShopOrb(state,orbId)&&state.phase==='combat')return fail('wrong-phase');
  if (!ORB_CLAIM_PHASES.includes(state.phase) || state.pendingChoice?.payload?.source === 'masterwork-upgrade') return fail('wrong-phase');
  if(orbId.startsWith('g23-anvil:')){
    const orb=g23AnvilOrbs(state).find(o=>o.orbId===orbId);if(!orb)return fail('unknown-orb');
    if(isCombatRosterLocked(state))return fail('wrong-phase');
    const entry=orb.entries[0],result=claimG23Atom(state,entry.dropId,entry.payload.definitionId,policy);
    return !result.ok&&result.reason==='bench-full'?{ok:true,state,events:[]}:result;
  }
  if(orbId.startsWith('opening-anvil:')){
    const orb=openingAnvilOrbs(state).find(o=>o.orbId===orbId);if(!orb)return fail('unknown-orb');
    if(isCombatRosterLocked(state))return fail('wrong-phase');
    return grantAnvilUnit(state,{receiptId:orb.entries[0].sourceUnitId,source:'opening-encounter',definitionId:orb.entries[0].payload.definitionId});
  }
  if(isOpeningRewardOrb(orbId)){
    if(state.sharedPool&&!policy)return fail('shared-pool-required');
    if(state.m8.loot.queuedOrbClaims?.includes(orbId))return fail('already-claimed');
    if(!openingRewardOrbs(state).some(o=>o.orbId===orbId))return fail('unknown-orb');
    if(isCombatRosterLocked(state))return {ok:true,state:{...state,m8:{...state.m8,loot:{...state.m8.loot,queuedOrbClaims:[...state.m8.loot.queuedOrbClaims??[],orbId]}}},events:[]};
    return claimOpeningReward(state,orbId,policy);
  }
  if(orbId.startsWith('opening-batch-b/')){
    if(state.sharedPool&&!policy)return fail('shared-pool-required');
    if(isCombatRosterLocked(state))return fail('wrong-phase');
    if(!batchBRewardOrbs(state).some(o=>o.orbId===orbId))return fail('already-claimed');
    const result=claimBatchBReward(state,orbId,policy);return result.ok?result:fail(result.reason==='bench-full'?'bench-full':'invalid-loot');
  }
  if(orbId.startsWith('family:orb:')){
    if(state.m8.loot.queuedOrbClaims?.includes(orbId))return fail('already-claimed');
    if(!familyOrbs(state).some(o=>o.orbId===orbId))return fail('unknown-orb');
    if(state.sharedPool&&!policy)return fail('shared-pool-required');
    if(isCombatRosterLocked(state))return {ok:true,state:{...state,m8:{...state.m8,loot:{...state.m8.loot,queuedOrbClaims:[...state.m8.loot.queuedOrbClaims??[],orbId]}}},events:[]};
    return claimFamilyOrb(state,orbId,policy);
  }
  const orb=allClaimableOrbPlans(state).find(o=>o.orbId===orbId);
  if (!orb) return fail('unknown-orb');
  if (state.m8.loot.queuedOrbClaims?.includes(orbId)) return fail('already-claimed');
  if (orb.entries.every(e=>state.m8.loot.direct.some(d=>d.dropId===e.dropId&&d.status==='granted'))) return fail('already-claimed');
  if (!unclaimedOrbPlans(state).some(o=>o.orbId===orbId)) return fail('unknown-orb');
  // A shared seat must be executed by runSharedMatchCommand to consume its pool.
  if (state.sharedPool && !policy) return fail('shared-pool-required');
  if (isCombatRosterLocked(state)) return {ok:true,events:[],state:{...state,m8:{...state.m8,loot:{...state.m8.loot,
    queuedOrbClaims:[...state.m8.loot.queuedOrbClaims??[],orbId]}}}};
  const result=grantDirectLoot(state,false,policy,[...orb.entries].sort((a,b)=>a.entryOrdinal-b.entryOrdinal));
  if(soloShopOrb(state,orbId)&&result.state.m8.loot.direct.some(d=>orb.entries.some(e=>e.dropId===d.dropId)&&d.status==='pending-capacity'))return {ok:true,state,events:[]};
  return {ok:true,state:result.state,events:result.events};
}

/** After economy/HP/mechanic hooks/deferred upgrades, before any post-battle choice.
 * Caller owns atomic pool commit and event stamping. No client or saved callbacks. */
export function settleQueuedOrbClaims(initial: MatchState, policy?: UnitLootPolicy): {state:MatchState;events:MatchEvent[]} {
  if (!initial.m8.loot.queuedOrbClaims?.length) return {state:initial,events:[]};
  if (initial.multiplayer?.status==='eliminated' || initial.phase==='gameOver') return forfeitUnclaimedOrbs(initial);
  let state=initial; const events:MatchEvent[]=[];
  for (const orbId of initial.m8.loot.queuedOrbClaims) {
    // Remove only the current head so the normal planner can execute it once.
    state={...state,m8:{...state.m8,loot:{...state.m8.loot,queuedOrbClaims:state.m8.loot.queuedOrbClaims!.slice(1)}}};
    const claimed=planOrbClaim(state,orbId,state.round,policy);
    if (!claimed.ok) throw new RangeError(`Invalid queued orb claim: ${claimed.reason}`);
    events.push(...claimed.events);
    const drained=drainG23Rewards(claimed.state,policy,events);
    events.push(...mechanicGrantEvents(claimed.state,drained));
    const equipment=planTemporaryEquipment(drained);
    state=equipment.state;events.push(...equipment.events);
  }
  return {state,events};
}

/** Once per pending entry, on elimination or terminal match finalization. */
export function forfeitUnclaimedOrbs(initial: MatchState): {state:MatchState;events:MatchEvent[]} {
  if (!initial.multiplayer) return {state:initial.m8.loot.queuedOrbClaims?.length
    ?{...initial,m8:{...initial.m8,loot:{...initial.m8.loot,queuedOrbClaims:[]}}}:initial,events:[]};
  let state=initial.m8.loot.queuedOrbClaims?.length
    ? {...initial,m8:{...initial.m8,loot:{...initial.m8.loot,queuedOrbClaims:[]}}} : initial;
  const events:MatchEvent[]=[];
  for (const orb of allClaimableOrbPlans(state)) for (const drop of orb.entries) {
    if (!state.m8.loot.direct.some(d=>d.dropId===drop.dropId&&d.status==='revealed')) continue;
    const receipt={receiptId:lootReceiptId(drop.dropId),dropId:drop.dropId,payload:drop.payload,
      resolution:'forfeited' as const,gold:0,claimedRoundId:state.roundDefinitionId,grantedItemIds:[],grantedUnitIds:[]};
    state=commitReceipt(state,receipt);
    state={...state,m8:{...state.m8,loot:{...state.m8.loot,direct:state.m8.loot.direct.map(d=>d.dropId===drop.dropId?{dropId:d.dropId,status:'forfeited',receiptId:null}:d)}}};
    events.push({type:'lootForfeited',dropId:drop.dropId},{type:'lootGranted',receipt});
  }
  return {state,events};
}
