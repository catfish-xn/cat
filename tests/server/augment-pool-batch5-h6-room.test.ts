import { afterAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming } from './helpers';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';

describe('contested real room',()=>{
 const {room,clock}=makeRoom(new TwoSidedBattleResolver());
 afterAll(()=>room.dispose());
 for(const round of ['1-2','1-3','1-4','2-1','2-3','2-5','2-7','3-2']) it(`reaches ${round} through the room`,()=>{
  if(round==='1-2')room.start();
  expect(runUntilClaiming(room,clock,s=>s.roundId===round&&s.phase==='preparation',5000).roundId).toBe(round);
 });
 it('selects contested, freezes the table, and settles the player combat',()=>{
  for(const id of ['s0','s1','s2','s3','s4','s5','s6','s7']) for(let slot=0;slot<3&&!room.state.seats.some(s=>s.match.pendingChoice?.offers.includes('contested'));slot++){
   const c=room.state.seats.find(s=>s.seatId===id)!.match.pendingChoice!;
   expect(room.handle(id,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot})).toMatchObject({ok:true});
  }
  const seat=room.state.seats.find(s=>s.match.pendingChoice?.offers.includes('contested'));
  expect(seat).toBeDefined();if(!seat)throw new Error('no offer');
  const c=seat.match.pendingChoice!;
  expect(room.handle(seat.seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'contested'})).toMatchObject({ok:true});
  runUntilClaiming(room,clock,s=>s.roundId==='3-2'&&s.phase==='settlement',5000);
  const match=room.state.seats.find(s=>s.seatId===seat.seatId)!.match;
  expect(match.augmentHistory?.facts.filter(f=>f.kind==='pvp-roster'&&f.round===match.round)).toHaveLength(1);
  expect(match.roundResults.at(-1)?.roundKind).toBe('pvp');
  const authority=room.augmentHistoryAuthority(seat.seatId);
  for(const form of ['object','json','serialized'] as const){
   const input=form==='object'?match:form==='json'?JSON.stringify(match):canonicalContent(match);
   expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(match);
   const bad:any=form==='serialized'?JSON.parse(canonicalContent(match)):structuredClone(match);
   bad.augmentHistory.facts.find((f:any)=>f.kind==='pvp-roster'&&f.round===match.round).seats[0].hp++;
   expect(()=>restoreSharedOrbSnapshot(room.state.pool,form==='object'?bad:JSON.stringify(bad),authority)).toThrow();
  }

 });
});
