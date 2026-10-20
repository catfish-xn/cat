import type { MatchState, MatchEvent } from './match-types';
import type { FrozenDirectDrop, RewardOrb } from './loot-types';
import type { MultiplayerCommandResult } from './round-settlement';
import { commitReceipt, grantDirectLoot, type UnitLootPolicy } from './loot-runtime';
import { lootOrbId, lootEntryId, lootReceiptId } from './loot-identity';
import { getMultiplayerRoundById } from './multiplayer-round';

/** Provisional 2026-10-20: change only this list if combat claims are approved. */
export const ORB_CLAIM_PHASES: readonly MatchState['phase'][] = ['preparation', 'settlement', 'choice'];
export const REWARD_ORB_TIER = 'gray' as const;
export function allClaimableOrbPlans(state: MatchState) {
  return [...state.m8.loot.frozen.rounds.flatMap(r=>r.orbs.map(o=>({...o,source:'pve' as const}))),
    ...state.m8.loot.rewardOrbs??[]];
}
export function unclaimedOrbPlans(state: MatchState) {
  if (!state.multiplayer || state.multiplayer.status==='eliminated' || state.phase==='gameOver') return [];
  return allClaimableOrbPlans(state).filter(o=>getMultiplayerRoundById(o.roundId).ordinal<=state.round
    && o.entries.length && o.entries.every(e=>state.m8.loot.direct.some(d=>d.dropId===e.dropId && d.status==='revealed')
      && (o.source==='mechanic'||state.m8.loot.earnedEvidence.some(v=>v.dropId===e.dropId))));
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
  const fail=(reason:Extract<MultiplayerCommandResult,{ok:false}>['reason']):MultiplayerCommandResult=>({ok:false,state,reason});
  if (!state.multiplayer) return fail('multiplayer-required');
  if (state.multiplayer.status==='eliminated') return fail('seat-eliminated');
  if (state.round!==expectedRound) return fail('stale-round');
  if (!ORB_CLAIM_PHASES.includes(state.phase) || state.multiplayer.combatRosterLocked) return fail('wrong-phase');
  const orb=allClaimableOrbPlans(state).find(o=>o.orbId===orbId);
  if (!orb) return fail('unknown-orb');
  if (orb.entries.every(e=>state.m8.loot.direct.some(d=>d.dropId===e.dropId&&d.status==='granted'))) return fail('already-claimed');
  if (!unclaimedOrbPlans(state).some(o=>o.orbId===orbId)) return fail('unknown-orb');
  // A shared seat must be executed by runSharedMatchCommand to consume its pool.
  if (state.sharedPool && !policy) return fail('shared-pool-required');
  const result=grantDirectLoot(state,false,policy,[...orb.entries].sort((a,b)=>a.entryOrdinal-b.entryOrdinal));
  return {ok:true,state:result.state,events:result.events};
}

/** Once per pending entry, on elimination or terminal match finalization. */
export function forfeitUnclaimedOrbs(initial: MatchState): {state:MatchState;events:MatchEvent[]} {
  if (!initial.multiplayer) return {state:initial,events:[]};
  let state=initial; const events:MatchEvent[]=[];
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
