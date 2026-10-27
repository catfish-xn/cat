import { afterAll,expect,it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { makeRoom,runUntilClaiming } from './helpers';

const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:42,assertPoolConservation:true});
afterAll(()=>room.dispose());
let picker:string,picked:string;
it('starts the shared room',()=>{room.start();expect(room.state.fault).toBeNull();});
for(const round of ['1-3','1-4','2-1']) it(`the room reaches ${round}`,()=>{
 runUntilClaiming(room,clock,s=>s.roundId===round&&s.phase==='preparation');expect(room.state.fault).toBeNull();
});
it('Replication uses the room choose command for the augment and its three-component forge',()=>{
 for(const seat of room.state.seats.filter(s=>s.kind==='human'&&s.alive)){
  for(let slot=0;slot<3;slot++){
   const c=room.state.seats.find(s=>s.seatId===seat.seatId)!.match.pendingChoice!;
   if(c.offers.includes('replication'))break;
   room.handle(seat.seatId,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot});
  }
  if(room.state.seats.find(s=>s.seatId===seat.seatId)!.match.pendingChoice!.offers.includes('replication')){picker=seat.seatId;break;}
 }
 expect(picker).toBeDefined();const seat=()=>room.state.seats.find(s=>s.seatId===picker)!;
 let c=seat().match.pendingChoice!;
 expect(room.handle(picker,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'replication'})).toMatchObject({ok:true});
 c=seat().match.pendingChoice!;expect(c.kind).toBe('forge');expect(c.offers).toHaveLength(3);
 picked=c.offers[1];expect(room.handle(picker,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:picked})).toMatchObject({ok:true});
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(seat().match))).toEqual(seat().match);
});
for(const [round,count] of [['2-2',1],['2-3',2]] as const)it(`Replication grants its ${count}th copy at ${round}`,()=>{
 runUntilClaiming(room,clock,s=>s.roundId===round&&s.phase==='preparation');expect(room.state.fault).toBeNull();
 const seat=room.state.seats.find(s=>s.seatId===picker)!;
 const gifts=seat.match.seatMechanics!.receipts.filter(r=>r.kind==='item'&&r.source==='augment-pool-batch1'&&r.receiptId.includes('replication'));
 expect(gifts).toHaveLength(count);expect(gifts.every(r=>r.kind==='item'&&r.definitionId===picked)).toBe(true);
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(seat.match))).toEqual(seat.match);
});
