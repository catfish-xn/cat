import { afterAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { scoreboardCombatGrowth } from '../../src/simulation/augment-pool-batch5-h6-scoreboard';
import { snapshotForBattle } from '../../src/simulation/two-sided-snapshot';
import { compileBattle } from '../../src/simulation/two-sided-battle';

describe('scoreboard real room',()=>{
 const {room,clock}=makeRoom(new TwoSidedBattleResolver());let seatId='';
 afterAll(()=>room.dispose());
 for(const round of ['1-2','1-3','1-4','2-1']) it(`reaches ${round} through the room`,()=>{
  if(round==='1-2')room.start();
  expect(runUntilClaiming(room,clock,s=>s.roundId===round&&s.phase==='preparation',5000).roundId).toBe(round);
 });
 it('selects the offered card in the room',()=>{
  for(const id of ['s0','s1','s2','s3','s4','s5','s6','s7']) for(let slot=0;slot<3&&!room.state.seats.some(s=>s.match.pendingChoice?.offers.includes('scoreboard-scrapper'));slot++){
   const c=room.state.seats.find(s=>s.seatId===id)!.match.pendingChoice!;
   expect(room.handle(id,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot})).toMatchObject({ok:true});
  }
  const seat=room.state.seats.find(s=>s.match.pendingChoice?.offers.includes('scoreboard-scrapper'));
  expect(seat).toBeDefined();if(!seat)throw new Error('no offer');seatId=seat.seatId;
  const c=seat.match.pendingChoice!;expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'scoreboard-scrapper'})).toMatchObject({ok:true});
 });
 it('enters the following round with the authenticated rank',()=>{
  runUntilClaiming(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation',5000);
  const match=room.state.seats.find(s=>s.seatId===seatId)!.match;
  const entry=match.augmentHistory!.facts.find(f=>f.kind==='table'&&f.stage==='entry'&&f.round===match.round);
  expect(entry?.kind).toBe('table');if(entry?.kind!=='table')throw new Error('missing table');
  const rank=entry.seats.find(s=>s.seatId===seatId)!.rank;
  const growth=scoreboardCombatGrowth(match,match.preparation.units.filter(u=>u.team==='player').map(u=>u.id))!;
  expect(growth.every(g=>g.healthBps===(rank<=4?1000:0))).toBe(true);
  if(rank>=5)expect(growth.every(g=>g.attackDamageBps===150&&g.abilityPowerCenti===150)).toBe(true);
  const opponent=room.state.seats.find(s=>s.seatId!==seatId&&s.alive)!;
  const input=compileBattle(snapshotForBattle(match,seatId),snapshotForBattle(opponent.match,opponent.seatId),123);
  expect(input.a.h6Growth).toBeDefined();
  const authority=room.augmentHistoryAuthority(seatId);
  for(const form of ['object','json','serialized'] as const){
   const data=form==='object'?match:form==='json'?JSON.stringify(match):canonicalContent(match);
   expect(restoreSharedOrbSnapshot(room.state.pool,data,authority)).toEqual(match);
   const bad:any=form==='serialized'?JSON.parse(canonicalContent(match)):structuredClone(match);
   bad.augmentHistory.facts.find((f:any)=>f.kind==='table'&&f.stage==='entry').seats.find((s:any)=>s.seatId===seatId).rank=8;
   expect(()=>restoreSharedOrbSnapshot(room.state.pool,form==='object'?bad:JSON.stringify(bad),authority)).toThrow();
  }
 });
});
