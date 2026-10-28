import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { SHOP_CATALOG } from '../src/simulation/match-rules';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';

const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:182});
// v25 drift-3: seed 182 offers pilfer at 2-1 for s2 and records a positive pilfer battle count on the public room route.
afterAll(()=>room.dispose());
it('room advances to 1-3',()=>{room.start();runUntilClaiming(room,clock,s=>s.roundId==='1-3'&&s.phase==='preparation');});
it('room advances to 1-4',()=>{runUntilClaiming(room,clock,s=>s.roundId==='1-4'&&s.phase==='preparation');});
it('room chooses the actual 2-1 Pilfer offer',()=>{
 runUntilClaiming(room,clock,s=>s.roundId==='2-1'&&s.phase==='preparation');
 const choice=room.state.seats.find(s=>s.seatId==='s2')!.match.pendingChoice!;
 expect(choice.offers).toContain('pilfer');
 expect(room.handle('s2',{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'pilfer'})).toMatchObject({ok:true});
});
it('room settles real combat and delivers the next-round shared reward',()=>{
 runUntilClaiming(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation');
 const current=room.state.seats.find(s=>s.seatId==='s2')!.match;
 const battle=readG23Progress(current)!.economyReceipts.find(r=>r.kind==='battle'&&r.facts.round===4);
 expect(battle?.kind).toBe('battle');if(battle?.kind!=='battle')throw Error('Missing real battle');
 const count=battle.facts.batch2?.find(x=>x.definitionId==='pilfer')?.count;
 expect(count).toBeGreaterThan(0);
 const receipt=current.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.receiptId.includes('pilfer'));
 expect(receipt).toMatchObject({kind:'unit',definitionId:SHOP_CATALOG[count!-1],starLevel:1,round:5,resolution:'orb'});
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(current))).toEqual(current);
 const forged=structuredClone(current) as any;const gift=forged.seatMechanics.receipts.find((r:any)=>r.kind==='unit'&&r.receiptId.includes('pilfer'));gift.definitionId=gift.definitionId==='mel'?'viktor':'mel';
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,forged)).toThrow();
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(forged))).toThrow();
 expect(room.state.fault).toBeNull();
});
