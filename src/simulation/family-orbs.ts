import { readG23Progress } from './g2-3-state';
import { g23RewardAtoms } from './g2-3-rewards';
import { claimG23Atom } from './g2-3-runtime';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import type { MatchState, MatchEvent } from './match-types';
import type { UnitLootPolicy } from './loot-runtime';
import type { FrozenDirectDrop } from './loot-types';
import type { LootPayload } from './m8/contracts';

/** Family reward orbs are a projection of frozen bundles minus unique atom receipts; no second mutable inventory. */
export function familyOrbs(state:MatchState){
  if(!(state.seatMechanics?.hidden.progress as {family?:unknown}|undefined)?.family)return [];
  const p=readG23Progress(state);if(!p)return [];
  return p.rewards.filter(b=>b.source==='family').flatMap(b=>{
    const roundId=getMultiplayerRoundByOrdinal(b.round).roundId;
    const entries=g23RewardAtoms(b,p.seed,!!state.multiplayer).flatMap((a,i)=>{
      if(p.rewardClaims.some(c=>c.atomId===a.id))return [];
      const payload:LootPayload=a.kind==='gold'?{kind:'gold',quantity:a.gold}:a.kind==='tool'?{kind:'consumable',definitionId:a.options[0] as import('./consumable-types').ConsumableDefinitionId,quantity:1}:a.kind==='unit'?{kind:'unit',definitionId:a.options[0],quantity:1,starLevel:a.starLevel??1}:{kind:'item',definitionId:a.options[0],quantity:1};
      return [{orbId:b.id,entryOrdinal:i,dropId:a.id,roundId,encounterId:'family',sourceUnitId:b.id,slotOrdinal:0,status:'planned',receiptId:null,revealCondition:'source-killed',payload} satisfies FrozenDirectDrop];
    });
    return entries.length?[{orbId:b.id,roundId,tier:'gray' as const,source:'family' as const,entries}]:[];
  });
}
export function claimFamilyOrb(state:MatchState,orbId:string,policy?:UnitLootPolicy):{ok:true;state:MatchState;events:readonly MatchEvent[]}|{ok:false;state:MatchState;reason:'unknown-orb'|'already-claimed'} {
  const p=readG23Progress(state),bundle=p?.rewards.find(b=>b.source==='family'&&b.id===orbId);
  if(!p||!bundle)return {ok:false,state,reason:'unknown-orb'};
  const atoms=g23RewardAtoms(bundle,p.seed,!!state.multiplayer),events:MatchEvent[]=[];let current=state;
  if(atoms.every(a=>p.rewardClaims.some(c=>c.atomId===a.id)))return {ok:false,state,reason:'already-claimed'};
  for(const a of atoms){
    if(readG23Progress(current)!.rewardClaims.some(c=>c.atomId===a.id))continue;
    const r=claimG23Atom(current,a.id,a.kind==='gold'?'':a.options[0],policy);
    if(r.ok){current=r.state;events.push(...r.events);}else if(r.reason!=='bench-full')throw new RangeError('Invalid family claim: '+r.reason);
  }
  return {ok:true,state:current,events};
}
