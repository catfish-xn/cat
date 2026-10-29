import { canonicalContent } from '../src/simulation/content';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntil } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { augmentLevelCap } from '../src/simulation/augment-pool-batch5-h12-progression';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';

// Fixed-composition carousel: seed 6 retains the real 4-2 Max Cap offer (v25 used seed 4).
describe('B5-84 actual Room',()=>{
 const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:6,carousel:CAROUSEL_RULES_BINDING});
 let seatId:string;
 const get=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
 beforeAll(()=>{room.start();});
 for(let round=2;round<=getMultiplayerRoundById('4-2').ordinal;round++)if(getMultiplayerRoundByOrdinal(round).kind!=='supply')beforeAll(()=>{
  runUntil(room,clock,s=>s.round===round&&s.phase==='preparation');
 });
 beforeAll(()=>{
  for(const seat of room.state.seats.filter(s=>s.kind==='human')){
   seatId=seat.seatId;
   for(let slot=0;slot<3&&!get().pendingChoice?.offers.includes('max-cap');slot++){
    const c=get().pendingChoice!;expect(room.handle(seatId,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot})).toMatchObject({ok:true});
   }
   if(get().pendingChoice?.offers.includes('max-cap'))return;
  }
  throw new Error('seed 6 real room has no Max Cap after three rerolls per human');
 });
 afterAll(()=>room.dispose());
 it('XP bought while the offered choice is pending remains legal before acquisition',()=>{
  for(let i=0;i<80&&get().level<7;i++)expect(room.handle(seatId,{type:'buyXp'})).toMatchObject({ok:true});
  expect(get().level).toBe(7);
  expect(room.handle(seatId,{type:'buyXp'})).toMatchObject({ok:true});expect(get().xp).toBeGreaterThan(0);
  expect(get().pendingChoice!.offers).toContain('max-cap');
 });
 it('Room chooses Max Cap, gives 60 gold and shield, caps purchases and authenticates server restore',()=>{
  const before=get(),c=before.pendingChoice!;
  expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'max-cap'})).toMatchObject({ok:true});
  expect(get().gold-before.gold).toBe(60);expect(get().items.filter(i=>i.definitionId==='TFT_Item_TacticiansScepter')).toHaveLength(1);
  expect(augmentLevelCap(get().augments)).toBe(7);
  for(let i=0;i<80&&get().level<7;i++)expect(room.handle(seatId,{type:'buyXp'})).toMatchObject({ok:true});
  expect(get().level).toBe(7);expect(get().xp).toBe(0);
  const capped=room.state;expect(room.handle(seatId,{type:'buyXp'})).toMatchObject({ok:false,reason:'max-level'});expect(room.state).toBe(capped);
  expect(requireAugmentFacts(get(),'offer-level',get().round).length).toBeGreaterThan(0);
  assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
  const authority=room.augmentHistoryAuthority(seatId),match=get();
  for(const input of [match,JSON.stringify(match),canonicalContent(match)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(match);
  for(const change of [(s:any)=>{s.level=8;},(s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='offer-level').level=8;},(s:any)=>{s.gold++;}]){
   const bad=structuredClone(match);change(bad);
   for(const input of [bad,JSON.stringify(bad),canonicalContent(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();
  }
 });
 it('real online settlement and next entry keep capped XP and the receipt is paid once',()=>{
  const round=room.state.round;runUntil(room,clock,s=>s.round===round+1&&s.phase==='preparation');
  expect(get().level).toBe(7);expect(get().xp).toBe(0);
  expect(get().scheduleReceipts.filter(r=>r.definitionId==='max-cap')).toHaveLength(1);
  expect(get().roundResults.at(-1)?.xpAwarded).toBe(0);
  expect(restoreSharedOrbSnapshot(room.state.pool,get(),room.augmentHistoryAuthority(seatId))).toEqual(get());
 });
});
