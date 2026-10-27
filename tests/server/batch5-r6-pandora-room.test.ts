import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { restoreCarouselSeat } from '../../src/simulation/carousel';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntil, answerOpenChoices, claimAllOrbs } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation, nextSharedRound } from '../../src/simulation/shared-pool';
import { COST, batch5TransformPlan as batch5Transforms } from '../fixtures/m5/oracle.g2.cjs';
import { requireAugmentFacts } from '../../src/simulation/augment-history';
import type { MatchState } from '../../src/simulation/match-types';
import type { CarouselReceipt } from '../../src/simulation/carousel-types';
import type { ResourceProvenanceEntry } from '../../src/simulation/resource-provenance';

const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:8,carousel:CAROUSEL_RULES_BINDING});
const mine=()=>room.state.seats.find(s=>s.seatId==='s3')!.match;
let before:MatchState, expected:ReturnType<typeof batch5Transforms>;
beforeAll(()=>room.start());
for(const round of ['1-3','1-4','2-1'])beforeAll(()=>runUntil(room,clock,s=>s.roundId===round&&s.phase==='preparation'));
beforeAll(()=>{
  const c=mine().pendingChoice!;expect(c.offers).toContain('pandoras-bench');const gold=mine().gold;
  expect(room.handle('s3',{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'pandoras-bench'})).toMatchObject({ok:true});
  expect(mine().gold).toBe(gold+2);expect(mine().resourceProvenance.entries.filter(e=>e.kind==='unit-transformed')).toEqual([]);
  answerOpenChoices(room);
  claimAllOrbs(room,['s3']);
  // Fill the field through real commands so automatic deployment cannot consume a test bench slot.
  while(mine().preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length<mine().level){
    let candidate=mine().preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&COST[u.definitionId]);
    if(!candidate){
      const s=mine(),slot=s.shop.slots.findIndex(o=>o.status==='available'&&COST[o.definitionId]<=s.gold&&s.preparation.units.filter(u=>u.definitionId===o.definitionId&&u.starLevel===1).length<2);
      expect(slot).toBeGreaterThanOrEqual(0);expect(room.handle('s3',{type:'buy',slot,generation:s.shop.generation})).toMatchObject({ok:true});
      candidate=mine().preparation.units.find(u=>u.id===`unit-${s.nextUnitSerial}`)!;expect(candidate).toBeDefined();
    }
    const col=Array.from({length:7},(_,i)=>i).find(col=>!mine().preparation.units.some(u=>u.location.kind==='board'&&u.location.cell.row===5&&u.location.cell.col===col))!;
    expect(room.handle('s3',{type:'deploy',unitId:candidate.id,target:{kind:'board',cell:{col,row:5}}})).toMatchObject({ok:true});
  }
  for(let i=0;i<3;i++){
    const s=mine(), slot=s.shop.slots.findIndex(o=>o.status==='available'&&COST[o.definitionId]<=s.gold&&s.preparation.units.filter(u=>u.definitionId===o.definitionId&&u.starLevel===1).length<2);
    expect(slot).toBeGreaterThanOrEqual(0);expect(room.handle('s3',{type:'buy',slot,generation:s.shop.generation})).toMatchObject({ok:true});
    const bought=mine().preparation.units.find(u=>u.id===`unit-${s.nextUnitSerial}`)!;expect(bought).toBeDefined();
    expect(room.handle('s3',{type:'deploy',unitId:bought.id,target:{kind:'bench',slot:6+i}})).toMatchObject({ok:true});
  }
  const item=mine().items.find(i=>i.location.kind==='inventory');expect(item).toBeDefined();
  const target=mine().preparation.units.find(u=>u.location.kind==='bench'&&u.location.slot===6)!;
  expect(room.handle('s3',{type:'equip',itemId:item!.id,unitId:target.id,slot:0})).toMatchObject({ok:true});
});
beforeAll(()=>runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='settlement'));
beforeAll(()=>{
  before=mine();expected=batch5Transforms({...before,round:5},'pandoras-bench',room.state.pool.available);
  runUntil(room,clock,s=>s.roundId==='2-2'&&s.phase==='preparation');
});
afterAll(()=>room.dispose());
it('real Room choose/deploy/equip/round-entry uses the shared pool and all three original slots',()=>{
  const s=mine();expect(room.state.fault).toBeNull();
  expect(expected.exchanges).toHaveLength(3);
  expect(s.preparation.units.filter(u=>u.team==='player')).toEqual(expected.units.filter(u=>u.team==='player'));
  expect(s.items).toEqual(before.items);
  const actual=s.resourceProvenance.entries.slice(before.resourceProvenance.entries.length).filter(e=>e.kind==='unit-transformed').map(({unitId,from,to,starLevel})=>({unitId,from,to,starLevel}));
  expect(actual).toEqual(expected.exchanges);
  expect(requireAugmentFacts(s,'round-entry',5)).toHaveLength(1);
  assertSharedPoolConservation(room.state.pool,room.state.seats.map(x=>x.match));
  const failed=nextSharedRound(room.state.pool,room.state.seats.map(x=>x.match),4);
  expect(failed.ok).toBe(false);expect(failed.pool).toBe(room.state.pool);
});
it('online object/JSON round trips use independent authority, with a tamper matrix',()=>{
  const s=mine(),authority=room.augmentHistoryAuthority('s3');
  for(const input of [s,JSON.stringify(s)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(s);
  expect(()=>restoreSharedOrbSnapshot(room.state.pool,s)).toThrow('independent server authority');
  const mutations=[
    (x:any)=>{x.gold++;},
    (x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='round-entry').roster.units=[];},
    (x:any)=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='unit-transformed').to='mel';},
    (x:any)=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='unit-transformed').starLevel=3;},
    (x:any)=>{x.resourceProvenance.entries=x.resourceProvenance.entries.filter((e:any)=>e.kind!=='augment-transform-completed');},
    (x:any)=>{x.items[0].definitionId='blue-buff';},
    (x:any)=>{x.augments=[];delete x.augmentHistory;},
  ];
  for(const mutate of mutations){const bad=structuredClone(s);mutate(bad);for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();}
});

it('the production carousel path keeps transformation history and authenticates both restore entrances',()=>{
 runUntil(room,clock,s=>s.roundId==='2-3'&&s.phase==='preparation');expect(room.state.fault).toBeNull();
 runUntil(room,clock,s=>s.roundId==='2-4'&&s.phase==='carousel');expect(room.state.fault).toBeNull();
 const s=mine(),carousel=room.state.carousel!.state,authority=room.augmentHistoryAuthority('s3');
 expect(s.resourceProvenance.entries.filter(e=>e.kind==='augment-transform-completed')).toHaveLength(3);
 for(const input of [s,JSON.stringify(s)])expect(restoreCarouselSeat(carousel,input,authority)).toEqual(s);
 expect(()=>restoreCarouselSeat(carousel,s)).toThrow('independent server authority');
 const bad=structuredClone(s) as any;bad.augments=[];delete bad.augmentHistory;
 for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreCarouselSeat(carousel,input)).toThrow();
});

describe('carousel ancestry after Pandora',()=>{
 let receipt:CarouselReceipt,transformed:Extract<ResourceProvenanceEntry,{kind:'unit-transformed'}>;
 beforeAll(()=>runUntil(room,clock,s=>s.roundId==='2-4'&&s.phase==='carousel'));
 beforeAll(()=>{
 const opened=room.state.carousel!;
 clock.advance(Math.max(0,opened.startedAt+opened.state.releaseAtMs.s3-clock.now()));
 const carousel=room.state.carousel!.state;
 const slot=carousel.slots.find(x=>x.pickedBy===null&&x.definitionId==='zyra')
   ?? carousel.slots.find(x=>x.pickedBy===null&&mine().preparation.units.filter(u=>u.definitionId===x.definitionId&&u.starLevel===1).length<2);
 expect(slot).toBeDefined();
 expect(room.handle('s3',{type:'carousel-pick',carouselId:carousel.id,revision:carousel.revision,slot:slot!.slot})).toMatchObject({ok:true});
 receipt=mine().carousel!.receipts.find(r=>r.carouselId===carousel.id)!;
 expect(receipt.definitionId).toBe(slot!.definitionId);
 });
 beforeAll(()=>runUntil(room,clock,s=>s.roundId==='2-5'&&s.phase==='preparation'));
 beforeAll(()=>{
 expect(mine().preparation.units.some(u=>u.id===receipt.unitId)).toBe(true);
 expect(room.handle('s3',{type:'deploy',unitId:receipt.unitId!,target:{kind:'bench',slot:6}})).toMatchObject({ok:true});
 });
 beforeAll(()=>runUntil(room,clock,s=>s.roundId==='2-6'&&s.phase==='preparation'));
 beforeAll(()=>{
 const fact=mine().resourceProvenance.entries.find(e=>e.kind==='unit-transformed'&&e.unitId===receipt.unitId&&e.roundId==='2-6');
 expect(fact).toMatchObject({kind:'unit-transformed',from:receipt.definitionId});
 if(!fact||fact.kind!=='unit-transformed')throw Error('missing carousel transformation');
 transformed=fact;
 expect(transformed.to).not.toBe(receipt.definitionId);
 expect(room.handle('s3',{type:'deploy',unitId:receipt.unitId!,target:{kind:'bench',slot:0}})).toMatchObject({ok:true});
 });
 for(const round of ['2-7','3-1','3-2','3-3'])beforeAll(()=>runUntil(room,clock,s=>s.roundId===round&&s.phase==='preparation'));
 beforeAll(()=>runUntil(room,clock,s=>s.roundId==='3-4'&&s.phase==='carousel'));
 it('restores the transformed unit with its original carousel receipt',()=>{
 const state=mine(),current=room.state.carousel!.state,authority=room.augmentHistoryAuthority('s3');
 expect(state.carousel!.receipts.find(r=>r.id===receipt.id)).toEqual(receipt);
 expect(state.preparation.units.find(u=>u.id===receipt.unitId)?.definitionId).toBe(transformed.to);
 for(const input of [state,JSON.stringify(state)])expect(restoreCarouselSeat(current,input,authority)).toEqual(state);
 expect(()=>restoreCarouselSeat(current,state)).toThrow('independent server authority');
 });
 it('rejects forged transformations and current identities',()=>{
 const state=mine(),current=room.state.carousel!.state,authority=room.augmentHistoryAuthority('s3');
 const mutations=[
  (s:any)=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='unit-transformed'&&e.unitId===receipt.unitId).to='mel';},
  (s:any)=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='unit-transformed'&&e.unitId===receipt.unitId).from='mel';},
  (s:any)=>{s.resourceProvenance.entries=s.resourceProvenance.entries.filter((e:any)=>!(e.kind==='unit-transformed'&&e.unitId===receipt.unitId));},
  (s:any)=>{s.preparation.units.find((u:any)=>u.id===receipt.unitId).definitionId='mel';},
 ];
 for(const mutate of mutations){const bad=structuredClone(state);mutate(bad);for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreCarouselSeat(current,input,authority)).toThrow();}
 });
});
