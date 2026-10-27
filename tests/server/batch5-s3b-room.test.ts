import type { Room } from '../../src/server/room/room';
import type { ManualClock } from '../../src/server/room/clock';
import { createSoloOpeningEncounter, openingEncounterId } from '../../src/simulation/opening-encounter';
import { expect, it, describe, afterAll } from 'vitest';
import { createMatch } from '../../src/simulation/match';
import { nextRandom } from '../../src/simulation/rng';
import { augmentCandidates, resolveAugmentTier } from '../../src/simulation/augment-offers';
import { generateChoices } from '../../src/simulation/choices';
import { makeRoom, runUntilClaiming } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../../src/simulation/shared-pool';
import { academicGiftPlan } from '../../src/simulation/augment-pool-batch5-s3b';

function seedFor(id:string){
 for(let seed=0;seed<=100;seed++)for(const index of id==='salvage-bin'?[0,1,2,3]:[1]){
  let seatSeed=seed;for(let i=0;i<=index;i++)seatSeed=nextRandom(seatSeed).word;
  const s={...createMatch(seatSeed),augmentTierSeed:seed,openingEncounter:createSoloOpeningEncounter(seed)};
  if(generateChoices(augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],openingEncounterId(s),{node:'2-1',fieldedTraits:[],blocked:[]}),s.choiceRngState).offers.includes(id))return {seed,seatId:`s${index}`};
 }
 throw Error('No room seed in 0..100');
}
describe('academic-research real room',()=>{
 let room:Room,clock:ManualClock,sid:string;
 const mine=()=>room.state.seats.find(s=>s.seatId===sid)!.match;
 afterAll(()=>room?.dispose());
 it('creates the room',()=>{const selected=seedFor('academic-research');sid=selected.seatId;({room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:selected.seed}));room.start();});
 for(const roundId of ['1-3','1-4','2-1'])it(`public opening ${roundId}`,()=>{
  runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation');expect(room.state.roundId).toBe(roundId);expect(room.state.fault).toBeNull();
 });
 it('academic research routes room combine / openAnvil / choose without a new command and restores shared inventory',()=>{

  
  const c=mine().pendingChoice!;expect(c.offers).toContain('academic-research');
  expect(room.handle(sid,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'academic-research'})).toMatchObject({ok:true});
  const parts=mine().items.filter(i=>i.location.kind==='inventory');expect(parts.length).toBeGreaterThanOrEqual(2);
  expect(room.handle(sid,{type:'combine',a:parts[0].id,b:parts[1].id})).toMatchObject({ok:true});
  const gift=academicGiftPlan(mine())[0],birth=mine().seatMechanics!.receipts.find(r=>r.receiptId===gift.receiptId)!;
  expect(birth.kind).toBe('unit');if(birth.kind!=='unit')throw Error('unit');
  expect(room.handle(sid,{type:'openAnvil',unitId:birth.unitId!})).toMatchObject({ok:true});
  expect(mine().pendingChoice!.offers).toHaveLength(2);
  for(const input of [mine(),JSON.stringify(mine())])expect(restoreSharedOrbSnapshot(room.state.pool,input)).toEqual(mine());
  const forge=mine().pendingChoice!;
  expect(room.handle(sid,{type:'choose',choiceId:forge.choiceId,generation:forge.generation,definitionId:forge.offers[1]})).toMatchObject({ok:true});
  expect(mine().items.at(-1)?.definitionId).toBe(forge.offers[1]);
  expect(()=>assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match))).not.toThrow();
  for(const input of [mine(),JSON.stringify(mine())])expect(restoreSharedOrbSnapshot(room.state.pool,input)).toEqual(mine());
  for(const mutate of [(x:any)=>{x.items.at(-1).definitionId='blue-buff';},(x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId===gift.receiptId).definitionId='TFT_ArmoryKeyOrnn';}]){
   const x=structuredClone(mine());mutate(x);for(const input of [x,JSON.stringify(x)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input)).toThrow();
  }
  expect(room.state.fault).toBeNull();
 });
});

import { pandoraConversions, isS3bConversion } from '../../src/simulation/augment-pool-batch5-s3b-conversions';
describe('pandoras-items-ii real room',()=>{
 let room:Room,clock:ManualClock,sid:string;
 const mine=()=>room.state.seats.find(s=>s.seatId===sid)!.match;
 afterAll(()=>room?.dispose());
 it('creates the room',()=>{const selected=seedFor('pandoras-items-ii');sid=selected.seatId;({room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:selected.seed}));room.start();});
 for(const roundId of ['1-3','1-4','2-1'])it(`public opening ${roundId}`,()=>{
  runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation');expect(room.state.roundId).toBe(roundId);expect(room.state.fault).toBeNull();
 });
 it('Pandora II round-entry conversion runs through the real room and rejects missing or altered shared conversions',()=>{

  
  const c=mine().pendingChoice!,before=mine();expect(c.offers).toContain('pandoras-items-ii');
  expect(room.handle(sid,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'pandoras-items-ii'})).toMatchObject({ok:true});
  expect(mine().items.length-before.items.length).toBe(2);
  const parts=mine().items.filter(i=>i.location.kind==='inventory');expect(parts.length).toBeGreaterThanOrEqual(2);
  expect(room.handle(sid,{type:'combine',a:parts[0].id,b:parts[1].id})).toMatchObject({ok:true});
  const prior=mine(),expected=pandoraConversions(prior,prior.items,prior.round+1);expect(expected.length).toBeGreaterThan(0);
  runUntilClaiming(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation');
  for(const f of expected)expect(mine().items.find(i=>i.id===f.itemId)?.definitionId).toBe(f.to);
  for(const input of [mine(),JSON.stringify(mine())])expect(restoreSharedOrbSnapshot(room.state.pool,input)).toEqual(mine());
  const x=structuredClone(mine()) as any;x.resourceProvenance.entries=x.resourceProvenance.entries.filter((e:any)=>!isS3bConversion(e));
  for(const input of [x,JSON.stringify(x)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input)).toThrow();
  expect(room.state.fault).toBeNull();
 });
});

import { ITEM_DEFINITIONS } from '../../src/simulation/content/g2-3-item-registry';
import { salvageRewardPlan } from '../../src/simulation/augment-pool-batch5-s3b-salvage';
describe('salvage-bin real room',()=>{
 let room:Room,clock:ManualClock,sid:string;
 const mine=()=>room.state.seats.find(s=>s.seatId===sid)!.match;
 afterAll(()=>room?.dispose());
 it('creates the room',()=>{const selected=seedFor('salvage-bin');sid=selected.seatId;({room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:selected.seed}));room.start();});
 for(const roundId of ['1-3','1-4','2-1'])it(`public opening ${roundId}`,()=>{
  runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation');expect(room.state.roundId).toBe(roundId);expect(room.state.fault).toBeNull();
 });
 it('Salvage Bin uses room equip/sell, pays recipe components, and shared restore rejects sale tampering',()=>{

  const c=mine().pendingChoice!;expect(c.offers).toContain('salvage-bin');
  expect(room.handle(sid,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'salvage-bin'})).toMatchObject({ok:true});
  const item=mine().items.at(-1)!,recipe=ITEM_DEFINITIONS[item.definitionId].recipe!,unit=mine().preparation.units.find(u=>u.team==='player')!;
  expect(room.handle(sid,{type:'equip',itemId:item.id,unitId:unit.id,slot:0})).toMatchObject({ok:true});
  const before=mine();expect(room.handle(sid,{type:'sell',unitId:unit.id})).toMatchObject({ok:true});
  expect(mine().items.length-before.items.length).toBe(1);expect(mine().items.find(i=>i.id===item.id)?.definitionId).toBe(recipe[0]);expect(mine().items.at(-1)?.definitionId).toBe(recipe[1]);
  expect(salvageRewardPlan(mine())).toEqual([]);
  for(const input of [mine(),JSON.stringify(mine())])expect(restoreSharedOrbSnapshot(room.state.pool,input)).toEqual(mine());
  const x=structuredClone(mine()) as any;x.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-s3b').definitionId='blue-buff';
  for(const input of [x,JSON.stringify(x)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input)).toThrow();
  expect(()=>assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match))).not.toThrow();expect(room.state.fault).toBeNull();
 });
});
