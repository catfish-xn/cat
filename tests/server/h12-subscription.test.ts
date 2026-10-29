import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { roomOffer, onlineTripAndReject } from '../augment-pool-batch5-h12-helpers';
import { runUntil } from './helpers';
import { assertSharedPoolConservation } from '../../src/simulation/shared-pool';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { requireAugmentFacts } from '../../src/simulation/augment-history';
import { enterShopAugmentRound } from '../../src/simulation/augment-pool-batch5-h12-subscription';
import type { MatchState } from '../../src/simulation/match-types';
import type { SharedPoolState } from '../../src/server/room/types';

describe('B5-86 actual online Room',()=>{
 let ctx:ReturnType<typeof roomOffer>;
 const get=()=>ctx.room.state.seats.find(s=>s.seatId===ctx.seatId)!.match;
 /** Frozen at each natural round the cases assert; later rounds do not rewrite an earlier mark. */
 const marks=new Map<number,{round:number;phase:string;pool:SharedPoolState;matches:MatchState[]}>();
 const conserve=()=>assertSharedPoolConservation(ctx.room.state.pool,ctx.room.state.seats.map(s=>s.match));
 function mark(round:number):void {
  runUntil(ctx.room,ctx.clock,s=>s.round===round&&s.phase==='preparation');
  marks.set(round,{
   round:ctx.room.state.round,phase:ctx.room.state.phase,
   pool:structuredClone(ctx.room.state.pool),matches:ctx.room.state.seats.map(s=>structuredClone(s.match)),
  });
 }
 beforeAll(()=>{ctx=roomOffer('subscription-service','2-1',true);});
 for(const round of [2,3,4])beforeAll(()=>runUntil(ctx.room,ctx.clock,s=>s.round===round&&s.phase==='preparation'));
 beforeAll(()=>{
  for(let slot=0;slot<ctx.rerolls;slot++){
   const c=get().pendingChoice!;expect(ctx.room.handle(ctx.seatId,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot})).toMatchObject({ok:true});
  }
  // The purchase case used to do this itself. It has to happen before the later rounds, on this same room.
  const {room,seatId}=ctx,before=get(),c=before.pendingChoice!;expect(c.offers).toContain('subscription-service');
  expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'subscription-service'})).toMatchObject({ok:true});
  expect(get().gold).toBe(before.gold+6);expect(get().preparation.units).toEqual(before.preparation.units);
  const ids=get().shop.slots.flatMap(s=>s.status==='available'?[s.definitionId]:[]);
  expect(new Set(ids).size).toBe(4);expect(ids.map(id=>UNIT_DEFINITIONS[id].cost)).toEqual([4,4,4,4]);
  expect(room.state.pool.shops.filter(s=>s.seatId===seatId)).toHaveLength(4);
  const gold=get().gold;expect(room.handle(seatId,{type:'buy',slot:0,generation:get().shop.generation})).toMatchObject({ok:true});
  expect(get().gold).toBe(gold-4);expect(room.state.pool.holdings.some(h=>h.seatId===seatId&&h.definitionId===ids[0])).toBe(true);
  expect(room.handle(seatId,{type:'shopLock',locked:true,generation:get().shop.generation})).toMatchObject({ok:true});
  expect(room.handle(seatId,{type:'reroll'})).toMatchObject({ok:true});expect(get().gold).toBe(gold-6);
  expect(get().shop.slots.filter(s=>s.status==='available')).toHaveLength(5);
  conserve();
 });
 beforeAll(()=>{ for(const round of [5,6,8]) mark(round); });
 beforeAll(()=>{ for(const round of [9,10,11]) mark(round); });
 afterAll(()=>ctx.room.dispose());
 it('choose, buy, lock and reroll all use authoritative finite-pool transactions',()=>{
  const bought=marks.get(5)!;
  const mine=bought.matches.find(s=>s.multiplayer?.seatId===ctx.seatId)!;
  expect(mine.augments.some(a=>a.definitionId==='subscription-service')).toBe(true);
  expect(mine.shop.locked).toBe(true);
  expect(bought.pool.holdings.some(h=>h.seatId===ctx.seatId)).toBe(true);
  assertSharedPoolConservation(bought.pool,bought.matches);
 });
 it.each(['missing history','acquire','bank','shop evidence','stock'])('server restore rejects %s across object, JSON and canonical serialized entries',kind=>onlineTripAndReject(ctx,s=>{
  if(kind==='missing history')delete s.augmentHistory;
  if(kind==='acquire')s.augmentHistory.facts.find((f:any)=>f.kind==='acquire').goldBefore++;
  if(kind==='bank')s.gold++;
  if(kind==='shop evidence')s.shopHistory.entries.find((e:any)=>e.kind==='draw'&&e.cause==='subscription').cause='natural';
  if(kind==='stock')s.shopHistory.entries.find((e:any)=>e.kind==='draw'&&e.cause==='subscription').stock.drmundo++;
 }));
 for(const round of [5,6,8,9,10,11])it(`real room advances to natural round ${round}`,()=>{
  const snap=marks.get(round)!;
  expect(snap.round).toBe(round);expect(snap.phase).toBe('preparation');
  const mine=snap.matches.find(s=>s.multiplayer?.seatId===ctx.seatId)!;
  const rewards=(mine.seatMechanics?.receipts??[]).filter(r=>r.receiptId.startsWith('["augment-pool-shop","subscription"'));
  if(round<11)expect(rewards).toHaveLength(0);
  else {
   expect(mine.roundDefinitionId).toBe('3-1');expect(rewards).toMatchObject([{kind:'gold',amount:6,round:11}]);
   expect(mine.shop.slots.filter(s=>s.status==='available')).toHaveLength(4);expect(mine.shop.locked).toBe(true);
   expect(requireAugmentFacts(mine,'round-entry',11)).toHaveLength(1);
   expect(enterShopAugmentRound(mine)).toBe(mine);
   expect(get().roundDefinitionId).toBe('3-1');
   expect(enterShopAugmentRound(get())).toBe(get());
   onlineTripAndReject(ctx,s=>{s.seatMechanics.receipts.find((r:any)=>r.receiptId.startsWith('["augment-pool-shop","subscription"')).amount++;});
  }
  assertSharedPoolConservation(snap.pool,snap.matches);
 });
});
