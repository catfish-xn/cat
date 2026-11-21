import { roomOfferFor } from './augment-offer-helpers';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { makeRoom, runUntil } from './helpers';

// v26 D5 (7953c99a) moved the room 2-1 draws: seed 22's s3 no longer reaches beggars-can-be-choosers within three public
// rerolls. Re-searched room seeds 0..39 with the same seat and rerolls: seed 31 (s3 is offered it without rerolling).
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:31});
let sid:string;
beforeAll(()=>{
 room.start();runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='preparation');
 roomOfferFor(room,'s3','beggars-can-be-choosers');const seat=room.state.seats.find(s=>s.match.pendingChoice?.offers.includes('beggars-can-be-choosers'));
 expect(seat).toBeDefined();sid=seat!.seatId;const c=seat!.match.pendingChoice!;
 expect(room.handle(sid,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'beggars-can-be-choosers'})).toMatchObject({ok:true});
});
beforeAll(()=>{runUntil(room,clock,s=>s.roundId==='3-2'&&s.phase==='preparation');});
afterAll(()=>room.dispose());
it('room routes a real Beggars pick and repeated-slot rerolls',()=>{
 for(let i=0;i<4;i++){
  const choice=room.state.seats.find(s=>s.seatId===sid)!.match.pendingChoice!;
  expect(choice.rerollsRemaining).toBe(6-i);
  expect(room.handle(sid,{type:'rerollAugment',choiceId:choice.choiceId,generation:choice.generation,optionIndex:0})).toMatchObject({ok:true});
 }
 const match=room.state.seats.find(s=>s.seatId===sid)!.match;
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(match),room.augmentHistoryAuthority(sid))).toEqual(match);
 expect(room.state.fault).toBeNull();
});
