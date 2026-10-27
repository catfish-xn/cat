import { existsSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUGMENT_BATCH5_H4 } from '../src/simulation/content/augment-pool-batch5-h4';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { recordRoomSettlementTable } from '../src/server/room/augment-history';
import { offeredAt, firstNodeSeed } from './augment-stage-helpers';
import { reachRound, accepted } from './match-helpers';
import { selectChoice } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { makeRoom, runUntil } from './server/helpers';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(RESEARCH_FILE))('B5-34 source numbers',()=>{
 const row=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===AUGMENT_BATCH5_H4.survivor.apiName);
 expect(row.effects).toEqual(AUGMENT_BATCH5_H4.survivor.values);
});
it('B5-34 offer nodes',()=>expect(['2-1','3-2','4-2'].filter(n=>offeredAt('survivor',n as '2-1'|'3-2'|'4-2'))).toEqual(['2-1']));
it('B5-34 awards previously eliminated seats in the real room acquisition',()=>{
 const inner=new TwoSidedBattleResolver();
 const {room,clock}=makeRoom({resolveBattle(input,pool){
  const seat=input.seats[0];
  if(input.round===1&&['s0','s1','s2'].includes(seat.seatId))return {kind:'placeholder',battleId:input.battleId,round:input.round,roomRevision:input.roomRevision,outcomes:[{
   seatId:seat.seatId,state:{...seat.state,playerHp:0,multiplayer:{...seat.state.multiplayer!,status:'eliminated'}},result:null,damage:100,combat:null}]};
  return inner.resolveBattle(input,pool);
 }},{seed:8});
 try {
  room.start();runUntil(room,clock,s=>s.round===4&&s.phase==='preparation');
  const seat=room.state.seats.find(s=>s.seatId==='s4')!,choice=seat.match.pendingChoice!;expect(choice.offers).toContain('survivor');
  expect(room.handleBot('s4',seat.controlEpoch,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'survivor'})).toMatchObject({ok:true});
  const picked=room.state.seats.find(s=>s.seatId==='s4')!.match;expect(picked.gold).toBe(seat.match.gold+60);
  expect(picked.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5-h4-survivor')).toMatchObject([{kind:'gold',amount:60}]);
  const authority=room.augmentHistoryAuthority('s4');
  for(const format of ['object','json'] as const){
   const input=(v:typeof picked)=>format==='object'?v:JSON.stringify(v);
   expect(restoreSharedOrbSnapshot(room.state.pool,input(picked),authority)).toEqual(picked);
   const bad:any=structuredClone(picked);bad.augmentHistory.facts.find((f:any)=>f.kind==='table').seats[0].alive=true;
   expect(()=>restoreSharedOrbSnapshot(room.state.pool,input(bad),authority)).toThrow();
  }
 } finally{room.dispose();}
});
it('B5-34 solo selection round trips and rejects tampering in all offline restore entries',()=>{
 const open=reachRound('2-1',false,firstNodeSeed('survivor',101)),c=open.pendingChoice!;
 const picked=accepted(selectChoice(open,c.choiceId,c.generation,'survivor'));
 expect(picked.gold).toBe(open.gold);
 for(const format of ['object','json','serialized'] as const){
  const input=(v:typeof picked)=>format==='object'?v:format==='json'?JSON.stringify(v):serializeMatch(v);
  expect(restoreMatch(input(picked))).toEqual(picked);
  const bad:any=structuredClone(picked);bad.augmentHistory.facts[0].goldBefore++;
  expect(()=>restoreMatch(input(bad))).toThrow();
 }
});
describe('B5-34 simultaneous elimination publication',()=>{
 const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:8});
 beforeAll(()=>{room.start();runUntil(room,clock,s=>s.round===4&&s.phase==='preparation');});
 afterAll(()=>room.dispose());
 it('selects survivor through the real bot command without paying early',()=>{
  const seat=room.state.seats.find(s=>s.seatId==='s4')!,choice=seat.match.pendingChoice!;expect(choice.offers).toContain('survivor');
  expect(room.handleBot('s4',seat.controlEpoch,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'survivor'})).toMatchObject({ok:true});
  const picked=room.state.seats.find(s=>s.seatId==='s4')!.match;expect(picked.gold).toBe(seat.match.gold);
 });
 it('publishes a controlled simultaneous three-seat elimination once and excludes a dying holder',()=>{
  runUntil(room,clock,s=>s.round===4&&s.phase==='battle');
  const plan=room.planSettlement(room.state.battles);expect(plan.ok).toBe(true);if(!plan.ok)throw Error(plan.detail);
  const dying=['s0','s1','s2'];
  const staged=plan.settlement.seats.map(row=>dying.includes(row.seatId)?{...row,hpAfter:0,match:{...row.match,playerHp:0,multiplayer:{...row.match.multiplayer!,status:'eliminated' as const}}}:row);
  const ranked=dying.map((seatId,i)=>({seatId,rank:8-i}));
  // Verify the same simultaneous batch with the holder also dead, before publishing the living-holder case.
  const hypothetical=room.state.seats.map(seat=>{const row=staged.find(r=>r.seatId===seat.seatId)!;const dead=dying.includes(seat.seatId)||seat.seatId==='s4';
   return {...seat,match:row.match,alive:!dead,hp:dead?0:row.hpAfter,rank:dead?8-seat.index:null,eliminatedRound:dead?4:null};});
  const dead=recordRoomSettlementTable(hypothetical).find(s=>s.seatId==='s4')!.match;
  expect((dead.seatMechanics?.receipts??[]).filter(r=>r.source==='augment-pool-batch5-h4-survivor')).toHaveLength(0);
  const settlement={...plan.settlement,seats:staged,eliminated:ranked};
  expect(room.commitSettlement(settlement)).toMatchObject({ok:true});expect(room.commitSettlement(settlement)).toMatchObject({ok:false,reason:'duplicate-settlement'});
  const picked=room.state.seats.find(s=>s.seatId==='s4')!.match;
  expect(picked.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5-h4-survivor')).toMatchObject([{kind:'gold',amount:60}]);
 });
 it('authenticates the independently captured online state in object and JSON restore',()=>{
  const picked=room.state.seats.find(s=>s.seatId==='s4')!.match,authority=room.augmentHistoryAuthority('s4');
  for(const format of ['object','json'] as const){
   const input=(v:typeof picked)=>format==='object'?v:JSON.stringify(v);
   expect(restoreSharedOrbSnapshot(room.state.pool,input(picked),authority)).toEqual(picked);
   const bad:any=structuredClone(picked);bad.augmentHistory.facts.find((f:any)=>f.kind==='table'&&f.stage==='settlement').seats[0].alive=true;
   expect(()=>restoreSharedOrbSnapshot(room.state.pool,input(bad),authority)).toThrow();
  }
 });
});
