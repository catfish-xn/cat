import { afterAll, beforeAll, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { makeRoom, runUntil } from './server/helpers';

// Fixed public 2-1 offer for seat s2 (room seed 6; v25 batch-5 pool re-search in 0..100).
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:6});
afterAll(()=>room.dispose());
// Keep every real PvE leg, bounded by its own default-timeout hook. Only frozen
// fault observations are cached; augment selection still runs in its case.
const entries=new Map<string,Readonly<{fault:typeof room.state.fault}>>();
beforeAll(()=>{room.start();});
for(const roundId of ['1-2','1-3','2-1'])beforeAll(()=>{
 runUntil(room,clock,s=>s.roundId===roundId&&s.phase==='preparation');
 entries.set(roundId,Object.freeze({fault:room.state.fault}));
});
it('B5-48 room opens and advances the first PvE round',()=>{
 expect(entries.get('1-2')?.fault).toBeNull();
});
it('B5-48 room advances the second PvE round',()=>{
 expect(entries.get('1-3')?.fault).toBeNull();
});
it('B5-48 room opens the public 2-1 augment',()=>{
 expect(entries.get('2-1')?.fault).toBeNull();
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
