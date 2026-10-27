import { roomOfferFor } from './server/augment-offer-helpers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntil, answerOpenChoices, claimAllOrbs } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { snapshotForBattle, restorePlayerBattleSnapshot } from '../src/simulation/two-sided-snapshot';
import { compileBattle } from '../src/simulation/two-sided-battle';
import { canonicalContent } from '../src/simulation/content';
import { readSniperOpening } from '../src/simulation/augment-pool-batch5-h10-sniper';
describe.each([false,true])('sniper online streaming=%s', combatStreaming=>{
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:41,combatStreaming});
const seat=()=>room.state.seats.find(s=>s.seatId==='s0')!;
let zeri:string;
beforeAll(()=>{room.start();});
for(const round of [2,3,4])beforeAll(()=>{runUntil(room,clock,s=>s.round===round&&s.phase==='preparation');});
afterAll(()=>room.dispose());
it('real room choose/claim/deploy freezes sniper damage for both-side compilation and commits history',()=>{
 roomOfferFor(room,'s0','snipers-nest');const c=seat().match.pendingChoice!;expect(c.offers).toContain('snipers-nest');
 expect(room.handle('s0',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'snipers-nest'})).toMatchObject({ok:true});
 answerOpenChoices(room);claimAllOrbs(room,['s0']);
 zeri=seat().match.preparation.units.find(u=>u.definitionId==='zeri')!.id;
 expect(room.handle('s0',{type:'deploy',unitId:zeri,target:{kind:'board',cell:{col:1,row:7}}})).toMatchObject({ok:true});
 const frozen=snapshotForBattle(seat().match,'s0');expect(frozen.sniperOpening![zeri]).toBe(800);
 for(const edit of [(s:any)=>{delete s.sniperOpening;},(s:any)=>{s.sniperOpening={};},(s:any)=>{s.sniperOpening[zeri]=4000;},(s:any)=>{s.sniperOpening[zeri]=801;},(s:any)=>{s.sniperOpening.absent=800;}]){
  const bad=structuredClone(frozen);edit(bad);
  for(const input of [bad,JSON.stringify(bad),canonicalContent(bad)])expect(()=>restorePlayerBattleSnapshot(input)).toThrow();
 }
 const opponent=room.state.seats.find(s=>s.seatId==='s1')!;
 const input=compileBattle(snapshotForBattle(opponent.match,'s1'),frozen,123,{battleId:'h10-side-b'});
 const mapped=input.mapping.find(m=>m.seatId==='s0'&&m.originalId===zeri&&m.kind==='unit')!;
 expect(input.strategy.units.find(u=>u.unitId===mapped.combatId)!.mechanics).toContainEqual(expect.objectContaining({mechanic:'damageAmp',values:{bps:800}}));
 runUntil(room,clock,s=>s.round===4&&s.phase==='settlement');
 expect(room.state.fault).toBeNull();
 const state=seat().match, authority=room.augmentHistoryAuthority('s0');
 expect(requireAugmentFacts(state,'pvp-roster',4)).toHaveLength(1);
 for(const entry of ['object','JSON','serialized'] as const){
  const asInput=(s:unknown)=>entry==='object'?s:entry==='JSON'?JSON.stringify(s):canonicalContent(s);
  expect(restoreSharedOrbSnapshot(room.state.pool,asInput(state),authority)).toEqual(state);
  for(const mutate of [(s:any)=>{delete s.augmentHistory;},(s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='pvp-roster').seats[0].units[0].location.cell.col++;}]){
   const bad=structuredClone(state);mutate(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,asInput(bad),authority)).toThrow();
  }
 }
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,state)).toThrow('missing independent server authority');
});

for(const [round,bps] of [[5,1600],[6,2400],[8,3200],[9,3200],[10,3200]])it(`round ${round}: opens at ${bps} Bps through the room and restores after settlement`,()=>{
 runUntil(room,clock,s=>s.round===round&&s.phase==='preparation');
 answerOpenChoices(room);
 expect(readSniperOpening(seat().match)![zeri]).toBe(bps);
 runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');
 const state=seat().match,authority=room.augmentHistoryAuthority('s0');
 expect(room.state.fault).toBeNull();
 expect(readSniperOpening(state)![zeri]).toBe(bps);
 expect(requireAugmentFacts(state,round===10?'combat-roster':'pvp-roster',round)).toHaveLength(1);
 for(const input of [state,JSON.stringify(state),canonicalContent(state)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(state);
});
});
