import { expect,it,afterAll } from 'vitest';
import { makeRoom,runUntil,claimAllOrbs,answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { generateChoices } from '../../src/simulation/choices';
import { augmentCandidates,resolveAugmentTier } from '../../src/simulation/augment-offers';
import { G24_FORGE_POOLS } from '../../src/simulation/content/g2-4-forges';
import { pandoraPick } from '../fixtures/m5/augment-inventory-oracle.cjs';
import type { ItemInstance } from '../../src/simulation/strategy-types';
// Only opening states are inspected; bounded to room seeds 0..100.
function fixture(id:string){
 for(let seed=0;seed<=100;seed++){
  const fixture=makeRoom(new TwoSidedBattleResolver(),{seed});
  const seat=fixture.room.state.seats.find(s=>generateChoices(augmentCandidates(resolveAugmentTier(s.match,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),s.match.choiceRngState).offers.includes(id));
  if(seat)return {...fixture,seatId:seat.seatId};fixture.room.dispose();
 }
 throw new Error('No room offer in 0..100');
}
const {room,clock,seatId}=fixture('pandoras-items');
const state=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
afterAll(()=>room.dispose());
it.each(['1-3','1-4','2-1'])('B5-16 room route to %s',round=>{if(room.state.phase==='waiting')room.start();runUntil(room,clock,s=>s.roundId===round&&s.phase==='preparation');expect(room.state.fault).toBeNull();});
let before:readonly ItemInstance[]=[];
it('B5-16 room select grants one component and normal combine still works',()=>{
 const count=state().items.length,c=state().pendingChoice!;expect(c.offers).toContain('pandoras-items');
 expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'pandoras-items'})).toMatchObject({ok:true});expect(state().items.length).toBe(count+1);
 answerOpenChoices(room);claimAllOrbs(room,[seatId]);
 const parts=state().items.filter(i=>G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(i.definitionId));expect(parts.length).toBeGreaterThanOrEqual(2);
 expect(room.handle(seatId,{type:'combine',a:parts[0].id,b:parts[1].id})).toMatchObject({ok:true});before=structuredClone(state().items);
 expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(state()))).toEqual(state());
});
it('B5-16 room natural entry rerolls by category and shared restore authenticates object/JSON',()=>{
 runUntil(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation');const s=state(),owner=s.augments.find(a=>a.definitionId==='pandoras-items')!;
 for(const item of before){const pool=G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(item.definitionId)?G24_FORGE_POOLS.TFT_ArmoryKeyComponent:G24_FORGE_POOLS.TFT_ArmoryKeyCompleted;expect(s.items.find(i=>i.id===item.id)!.definitionId).toBe(pandoraPick(s.seed,seatId,owner.choiceId,s.round,item.id,pool));}
 for(const input of [s,JSON.stringify(s)])expect(restoreSharedOrbSnapshot(room.state.pool,input)).toEqual(s);
 const bad=structuredClone(s) as any;bad.items[0].definitionId=bad.items[0].definitionId==='sword'?'blue-buff':'sword';
 for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input)).toThrow();
 expect(room.state.fault).toBeNull();
});
