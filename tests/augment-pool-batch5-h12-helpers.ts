import { canonicalContent } from '../src/simulation/content';
import { expect } from 'vitest';
import { augmentCandidates, resolveAugmentTier, drawAugmentCard } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { firstNodeSeed } from './augment-stage-helpers';
import { accepted, reachRound } from './match-helpers';
import { selectChoice, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { makeRoom } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';

export const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
export function firstOffer(id:string):MatchState {return reachRound('2-1',false,firstNodeSeed(id,101));}
export function pick(s:MatchState,id:string):MatchState {const c=s.pendingChoice!;expect(c.offers).toContain(id);return accepted(selectChoice(s,c.choiceId,c.generation,id));}
export function trip(s:MatchState):void {
 const serialized=serializeMatch(s);
 for(const input of [s,JSON.stringify(s),serialized])expect(restoreMatch(input)).toEqual(s);
}
export function reject(s:MatchState,edit:(s:any)=>void):void {
 const bad=structuredClone(s);edit(bad);
 expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();
 expect(()=>restoreMatch(serializeMatch(bad))).toThrow();
}
export function roomOffer(id:string,node='2-1',allowReroll=false) {
 // A bounded real-room search; no forged choice or mock content and no seeds outside 0..100.
 for(let seed=0;seed<=100;seed++){
  const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed,carousel:CAROUSEL_RULES_BINDING});
  for(const seat of room.state.seats.filter(s=>s.kind==='human')) {
   const s=seat.match,tier=resolveAugmentTier(s,`round:${node}:augment`),filter={node,fieldedTraits:[],blocked:[]};
   const choice=generateChoices(augmentCandidates(tier,[],[],null,filter),s.choiceRngState);
   let offers=[...choice.offers],rng=choice.choiceRngState;const removed=[...offers];
   for(let rerolls=0;rerolls<=(allowReroll?3:0);rerolls++){
    if(offers.includes(id)){room.start();return {room,clock,seatId:seat.seatId,rerolls};}
    if(rerolls===3)break;
    const draw=drawAugmentCard(augmentCandidates(tier,[],removed,null,filter),rng);offers[rerolls]=draw.definitionId;
    removed.push(draw.definitionId);rng=draw.choiceRngState;
   }
  }
  room.dispose();
 }
 throw new Error(`No real room offer for ${id} in 0..100`);
}
export function onlineTripAndReject(ctx:ReturnType<typeof roomOffer>,edit:(s:any)=>void):void {
 const s=ctx.room.state.seats.find(s=>s.seatId===ctx.seatId)!.match;
 const authority=ctx.room.augmentHistoryAuthority(ctx.seatId);
 for(const input of [s,JSON.stringify(s),canonicalContent(s)])expect(restoreSharedOrbSnapshot(ctx.room.state.pool,input,authority)).toEqual(s);
 const bad=structuredClone(s);edit(bad);
 for(const input of [bad,JSON.stringify(bad),canonicalContent(bad)])expect(()=>restoreSharedOrbSnapshot(ctx.room.state.pool,input,authority)).toThrow();
 expect(()=>restoreSharedOrbSnapshot(ctx.room.state.pool,s)).toThrow(/authority/);
}
