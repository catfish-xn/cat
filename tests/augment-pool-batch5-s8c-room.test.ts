import { roomOfferFor } from './server/augment-offer-helpers';
import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { hardCommitRewardPlan } from '../src/simulation/augment-pool-batch5-s8c';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';

const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:0});
afterAll(()=>room.dispose());
const seat=()=>room.state.seats.find(s=>s.seatId==='s1')!;
it('room starts',()=>{room.start();});
for(const id of ['1-2','1-3','1-4'])it(`room proceeds through ${id}`,()=>{runUntilClaiming(room,clock,s=>s.roundId===id);});
it('room reaches 2-1 with a real Hard Commit offer',()=>{
 runUntilClaiming(room,clock,s=>s.roundId==='2-1'&&s.phase==='preparation');
 roomOfferFor(room,'s1','hard-commit');const choice=seat().match.pendingChoice!;expect(choice.offers).toContain('hard-commit');
 expect(room.handle('s1',{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'hard-commit'})).toMatchObject({ok:true});
 const s=seat().match,gifts=hardCommitRewardPlan(s);expect(gifts).toHaveLength(2);
 expect(s.seatMechanics!.receipts.find(r=>r.receiptId===gifts[1].receiptId)).toMatchObject({kind:'unit',resolution:'orb'});
 expect(restoreSharedOrbSnapshot(room.state.pool,s)).toEqual(s);
});
for(const id of ['2-2','2-3','2-4','2-5','2-6','2-7','3-1'])it(`room proceeds through ${id}`,()=>{
 runUntilClaiming(room,clock,s=>s.roundId===id);
 if(id==='3-1'){
  const s=seat().match,gifts=hardCommitRewardPlan(s);expect(gifts).toHaveLength(3);
  expect(s.seatMechanics!.receipts.find(r=>r.receiptId===gifts[2].receiptId)).toMatchObject({kind:'unit',resolution:'orb'});
  expect(restoreSharedOrbSnapshot(room.state.pool,s)).toEqual(s);
 }
});
