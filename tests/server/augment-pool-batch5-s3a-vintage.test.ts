import { expect,it,afterAll,vi } from 'vitest';
// Exercise disabled source content through real room commands under a test-only offer policy.
vi.mock('../../src/simulation/content/augment-stage-bans',async importOriginal=>{
 const actual=await importOriginal<typeof import('../../src/simulation/content/augment-stage-bans')>();
 return {...actual,AUGMENT_STAGE_BANS:{...actual.AUGMENT_STAGE_BANS,TFT11_Augment_FineVintage:['3-2','4-2']}};
});
import { makeRoom,runUntil,claimAllOrbs,answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { batch5InventoryPlan,BATCH5_S3A_SOURCE } from '../../src/simulation/augment-pool-batch5-s3a';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { generateChoices } from '../../src/simulation/choices';
import { augmentCandidates,resolveAugmentTier } from '../../src/simulation/augment-offers';
// Only opening states are inspected; bounded to room seeds 0..100.
function fixture(id:string){
 for(let seed=0;seed<=100;seed++){
  const fixture=makeRoom(new TwoSidedBattleResolver(),{seed});
  const seat=fixture.room.state.seats.find(s=>generateChoices(augmentCandidates(resolveAugmentTier(s.match,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),s.match.choiceRngState).offers.includes(id));
  if(seat)return {...fixture,seatId:seat.seatId};fixture.room.dispose();
 }
 throw new Error('No room offer in 0..100');
}
const {room,clock,seatId}=fixture('fine-vintage');
const state=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
afterAll(()=>room.dispose());
it.each(['1-3','1-4','2-1'])('B5-15 room route to %s',round=>{if(room.state.phase==='waiting')room.start();runUntil(room,clock,s=>s.roundId===round&&s.phase==='preparation');expect(room.state.fault).toBeNull();});
let itemId:string;
it('B5-15 room selects and combines through its existing dispatch',()=>{
 const c=state().pendingChoice!;expect(c.offers).toContain('fine-vintage');expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'fine-vintage'})).toMatchObject({ok:true});
 answerOpenChoices(room);claimAllOrbs(room,[seatId]);
 const components=state().items.filter(i=>i.location.kind==='inventory');expect(components.length).toBeGreaterThanOrEqual(2);
 expect(room.handle(seatId,{type:'combine',a:components[0].id,b:components[1].id})).toMatchObject({ok:true});itemId=state().items.at(-1)!.id;
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(state()))).toEqual(state());
});
it.each(['2-2','2-3','2-4','2-5'])('B5-15 room ages through %s',round=>{
 answerOpenChoices(room);runUntil(room,clock,s=>s.roundId===round&&(s.phase==='preparation'||s.phase==='choice'));
 expect(state().items.some(i=>i.id===itemId)).toBe(round!=='2-5');
 expect(batch5InventoryPlan(state()).anvils.length).toBe(round==='2-5'?1:0);
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(state()))).toEqual(state());
});
it('B5-15 room opens support anvil, restores and rejects altered conversion identity',()=>{
 const r=state().seatMechanics!.receipts.find(r=>r.source===BATCH5_S3A_SOURCE);expect(r).toMatchObject({kind:'unit',definitionId:'TFT_ArmoryKeySupport'});if(r?.kind!=='unit')throw new Error('no anvil');
 expect(room.handle(seatId,{type:'openAnvil',unitId:r.unitId!})).toMatchObject({ok:true});const c=state().pendingChoice!;
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]})).toMatchObject({ok:true});
 for(const input of [state(),JSON.stringify(state())])expect(restoreSharedOrbSnapshot(room.state.pool,input)).toEqual(state());
 const forged=structuredClone(state()) as any;forged.seatMechanics.receipts.find((r:any)=>r.source===BATCH5_S3A_SOURCE).receiptId+='tampered';
 for(const input of [forged,JSON.stringify(forged)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input)).toThrow();
 expect(room.state.fault).toBeNull();
});
