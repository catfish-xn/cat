import { afterEach, beforeEach, expect, it } from 'vitest';
import type { Room } from '../../src/server/room/room';
import type { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { batch5XpPurchases } from '../../src/simulation/augment-pool-batch5-progress';
import { freeRerollsAvailable } from '../../src/simulation/free-rerolls';
import { makeRoom, runUntil } from './helpers';

let room:Room,clock:ManualClock;
const mine=()=>room.state.seats.find(s=>s.seatId==='s5')!.match;
beforeEach(()=>{
 // Room seed 6, seat s5: first public 2-1 initial offer with Dual Purpose on the 246-card pool (bounded seeds 0..100, then seat index).
 ({room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:6}));room.start();
 runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='preparation');
 const choice=mine().pendingChoice!;expect(choice.offers).toContain('dual-purpose');
 expect(room.handle('s5',{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'dual-purpose'})).toMatchObject({ok:true});
});
afterEach(()=>room?.dispose());

it.each(['preparation','settlement'] as const)('room.handle buyXp after a real Dual Purpose pick works in %s and restores against its shared pool',phase=>{
 if(phase==='settlement')runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='settlement');
 expect(room.state.phase).toBe(phase);expect(mine().phase).toBe(phase);
 expect(batch5XpPurchases(mine(),mine().round)).toBe(0);
 expect(room.handle('s5',{type:'shopLock',locked:true,generation:mine().shop.generation})).toMatchObject({ok:true});
 const before=mine(),poolBefore=room.state.pool,credits=freeRerollsAvailable(before);
 expect(room.handle('s5',{type:'buyXp'})).toMatchObject({ok:true});
 const first=mine();expect(first.gold).toBe(before.gold-2);expect(first.level).toBeGreaterThan(before.level);
 expect(first.shop.generation).toBe(before.shop.generation+1);expect(first.shop.locked).toBe(true);
 expect(freeRerollsAvailable(first)).toBe(credits);expect(room.state.pool).not.toBe(poolBefore);
 expect(room.state.poolRevision).toBe(room.state.pool.revision);
 expect(room.state.pool.shops.filter(s=>s.seatId==='s5').every(s=>s.generation===first.shop.generation)).toBe(true);
 expect(()=>assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match))).not.toThrow();
 for(const input of [first,JSON.stringify(first)])expect(restoreSharedOrbSnapshot(room.state.pool,input)).toEqual(first);
 expect(room.handle('s5',{type:'buyXp'})).toMatchObject({ok:true});
 const second=mine();expect(second.gold).toBe(first.gold-4);expect(second.shop.generation).toBe(first.shop.generation+1);
 expect(batch5XpPurchases(second,second.round)).toBe(2);
 expect(second.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5')).toHaveLength(1);
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(second))).toEqual(second);
 expect(()=>assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match))).not.toThrow();
 for(const mutate of [
  (s:any)=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='dual-purpose-xp-purchased').xpBefore++;},
  (s:any)=>{s.resourceProvenance.entries=s.resourceProvenance.entries.filter((e:any)=>e.kind!=='dual-purpose-xp-purchased');},
  (s:any)=>{s.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5').amount++;},
  (s:any)=>{s.augments=s.augments.filter((a:any)=>a.definitionId!=='dual-purpose');s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-pool-batch5');},
 ]){
  const forged=structuredClone(second);mutate(forged);
  for(const input of [forged,JSON.stringify(forged)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input)).toThrow();
 }
 if(phase==='settlement'){
  runUntil(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation');
  expect(batch5XpPurchases(mine(),mine().round)).toBe(0);const next=mine();
  expect(room.handle('s5',{type:'buyXp'})).toMatchObject({ok:true});expect(mine().gold).toBe(next.gold-2);
  expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(mine()))).toEqual(mine());
 }
 let refused=false;
 for(let attempt=0;attempt<30;attempt++){
  const before=room.state,r=room.handle('s5',{type:'buyXp'});
  if(r.ok)continue;
  expect(r.reason).toBe('insufficient-gold');expect(room.state).toBe(before);
  expect(r.state).toBe(before.seats.find(s=>s.seatId==='s5')!.match);refused=true;break;
 }
 expect(refused).toBe(true);
 expect(room.state.fault).toBeNull();
});
