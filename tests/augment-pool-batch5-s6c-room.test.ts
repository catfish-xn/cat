import { afterAll, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { makeRoom, runUntil } from './server/helpers';

// Fixed public 2-1 offer (seed in 0..100); legs keep each real room battle in its own test.
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:6});
afterAll(()=>room.dispose());
it('B5-48 room opens and advances the first PvE round',()=>{
 room.start();runUntil(room,clock,s=>s.roundId==='1-2'&&s.phase==='preparation');expect(room.state.fault).toBeNull();
});
it('B5-48 room advances the second PvE round',()=>{
 runUntil(room,clock,s=>s.roundId==='1-3'&&s.phase==='preparation');expect(room.state.fault).toBeNull();
});
it('B5-48 room opens the public 2-1 augment',()=>{
 runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='preparation');
 const seat=room.state.seats.find(s=>s.seatId==='s2')!,choice=seat.match.pendingChoice!;
 expect(choice.offers).toContain('tiniest-titan');
 expect(room.handle(seat.seatId,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'tiniest-titan'})).toMatchObject({ok:true});
});
it('B5-48 room settles PvP; shared snapshots reject forged health and receipts',()=>{
 runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='settlement');
 const match=room.state.seats.find(s=>s.seatId==='s2')!.match;
 expect(room.state.fault).toBeNull();expect(match.roundResults.at(-1)!.roundKind).toBe('pvp');
 expect(match.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5-s6c')).toHaveLength(1);
 for(const input of [match,structuredClone(match),JSON.stringify(match)])expect(restoreSharedOrbSnapshot(room.state.pool,input)).toEqual(match);
 for(const mutate of [
  (x:any)=>{x.playerHp--;},
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-s6c').amount++;},
  (x:any)=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-pool-batch5-s6c');},
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-s6c').roundId='2-2';},
 ]) {const bad=structuredClone(match);mutate(bad);for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input)).toThrow();}
});
