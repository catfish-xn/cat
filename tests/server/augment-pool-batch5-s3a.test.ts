import { expect,it,afterAll } from 'vitest';
import { makeRoom,runUntil,claimAllOrbs,answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { BATCH5_S3A_SOURCE } from '../../src/simulation/augment-pool-batch5-s3a';
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
const {room,clock,seatId}=fixture('component-buffet');
const state=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
afterAll(()=>room.dispose());
it.each(['1-3','1-4','2-1'])('B5-13 room route to %s',round=>{if(room.state.phase==='waiting')room.start();runUntil(room,clock,s=>s.roundId===round&&s.phase==='preparation');expect(room.state.fault).toBeNull();});
it('B5-13 room choose → claimOrb → openAnvil → choose uses existing dispatch and shared restore',()=>{
  const c=state().pendingChoice!;expect(c.offers).toContain('component-buffet');
  expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'component-buffet'})).toMatchObject({ok:true});
  // Keep the opening PvE orbs unclaimed until the augment has been selected.
  answerOpenChoices(room);claimAllOrbs(room,[seatId]);
  const anvil=state().seatMechanics!.receipts.find(r=>r.source===BATCH5_S3A_SOURCE);expect(anvil?.kind).toBe('unit');if(anvil?.kind!=='unit')throw new Error('no converted anvil');
  expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(state()))).toEqual(state());
  expect(room.handle(seatId,{type:'openAnvil',unitId:anvil.unitId!})).toMatchObject({ok:true});
  const choice=state().pendingChoice!;expect(choice.offers).toHaveLength(4);
  expect(room.handle(seatId,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:choice.offers[2]})).toMatchObject({ok:true});
  expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(state()))).toEqual(state());
  const bad=structuredClone(state()) as any;bad.items.at(-1).definitionId='invalid-item';
  expect(()=>restoreSharedOrbSnapshot(room.state.pool,bad)).toThrow();expect(()=>restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(bad))).toThrow();
  const missing=structuredClone(state()) as any;
  const gift=missing.resourceProvenance.entries.find((e:any)=>e.kind==='item-acquired'&&e.source.receiptId?.includes('component-buffet'));
  missing.resourceProvenance.entries=missing.resourceProvenance.entries.filter((e:any)=>e!==gift).map((e:any,sequence:number)=>({...e,sequence}));
  for(const input of [missing,JSON.stringify(missing)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input)).toThrow();
  expect(room.state.fault).toBeNull();
});
