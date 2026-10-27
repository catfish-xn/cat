import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runUntil, claimAllOrbs, TIMINGS, SEATS } from './helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { restoreCarouselSeat } from '../../src/simulation/carousel';
import { COST, batch5TransformPlan as batch5Transforms } from '../fixtures/m5/oracle.g2.cjs';
import { rewardPlan } from '../fixtures/m5/augment-rewards-oracle.cjs';
import type { MatchState } from '../../src/simulation/match-types';
import type { CarouselReceipt } from '../../src/simulation/carousel-types';
import type { ResourceProvenanceEntry } from '../../src/simulation/resource-provenance';

const clock=new ManualClock(),room=new Room(SEATS.map(s=>({...s,kind:'human'})),{...ROOM_TIMING_DEFAULTS,...TIMINGS,seed:6,roomId:'test-room',clock,resolver:new TwoSidedBattleResolver()});
const mine=()=>room.state.seats[0].match;
let before:MatchState, selected:MatchState, expected:ReturnType<typeof batch5Transforms>;
beforeAll(()=>room.start());
for(const round of ['1-3','1-4','2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-1'])beforeAll(()=>runUntil(room,clock,s=>s.roundId===round&&s.phase===(round==='2-4'?'choice':'preparation')));
beforeAll(()=>{
  claimAllOrbs(room,['s0']);
  const s=mine(),slot=s.shop.slots.findIndex(o=>o.status==='available'&&COST[o.definitionId]<=s.gold&&s.preparation.units.filter(u=>u.definitionId===o.definitionId&&u.starLevel===1).length<2);
  expect(slot).toBeGreaterThanOrEqual(0);expect(room.handle('s0',{type:'buy',slot,generation:s.shop.generation})).toMatchObject({ok:true});
  const bought=mine().preparation.units.find(u=>u.id===`unit-${s.nextUnitSerial}`)!;
  expect(room.handle('s0',{type:'deploy',unitId:bought.id,target:{kind:'board',cell:{col:6,row:6}}})).toMatchObject({ok:true});
  const item=mine().items.find(i=>i.location.kind==='inventory');expect(item).toBeDefined();
  expect(room.handle('s0',{type:'equip',itemId:item!.id,unitId:bought.id,slot:0})).toMatchObject({ok:true});
});
beforeAll(()=>runUntil(room,clock,s=>s.roundId==='3-2'&&s.phase==='preparation'));
beforeAll(()=>{
  const c=mine().pendingChoice!;expect(c.offers).toContain('recombobulator');before=mine();
  const preview={...before,augments:[...before.augments,{definitionId:'recombobulator',choiceId:c.choiceId,acquiredRound:before.round}]};
  expected=batch5Transforms(preview,'recombobulator',room.state.pool.available);
  const poolBefore=room.state.pool;
  const command={type:'choose' as const,choiceId:c.choiceId,generation:c.generation,definitionId:'recombobulator'};
  const result=room.handle('s0',command);expect(result,result.ok?'':result.reason).toMatchObject({ok:true});selected=mine();
  expect(room.state.pool.available).toEqual(expected.available);
  expect(room.state.pool).not.toBe(poolBefore);
  // Repeating the actual selection cannot exchange cards or grant another tool.
  expect(room.handle('s0',command).ok).toBe(false);expect(mine()).toBe(selected);
});
afterAll(()=>room.dispose());
it('real room selection upgrades the board and grants exactly the independently derived two removers',()=>{
  expect(room.state.fault).toBeNull();expect(expected.exchanges.length).toBeGreaterThanOrEqual(2);
  expect(selected.preparation.units).toEqual(expected.units);expect(selected.items).toEqual(before.items);
  const gifts=rewardPlan(selected,{ROUNDS:[]}).gifts.filter(g=>g.definitionId==='magnetic-remover'&&g.receiptId.includes('recombobulator'));
  expect(gifts).toHaveLength(2);
  const receipts=selected.seatMechanics!.receipts.filter(r=>gifts.some(g=>g.receiptId===r.receiptId));
  expect(receipts.map(r=>r.kind)).toEqual(['consumable','consumable']);
  expect(selected.consumables.slice(before.consumables.length).map(c=>c.definitionId)).toEqual(['magnetic-remover','magnetic-remover']);
  expect(selected.nextConsumableSerial-before.nextConsumableSerial).toBe(2);
  expect(selected.rngState).toBe(before.rngState);expect(selected.choiceRngState).toBe(before.choiceRngState);
  assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
});
it('object/JSON restores authenticate the selection, including gifts and failed duplicate operations',()=>{
 const authority=room.augmentHistoryAuthority('s0');
 for(const input of [selected,JSON.stringify(selected)])expect(restoreSharedOrbSnapshot(room.state.pool,input,authority)).toEqual(selected);
 expect(()=>restoreSharedOrbSnapshot(room.state.pool,selected)).toThrow('independent server authority');
 const mutations=[
  (s:any)=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='unit-transformed').from='mel';},
  (s:any)=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='unit-transformed').starLevel=3;},
  (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='acquire'&&f.definitionId==='recombobulator').roster.units=[];},
  (s:any)=>{s.consumables.pop();},
  (s:any)=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>!r.receiptId.includes('recombobulator'));},
  (s:any)=>{s.persistentGrowth=[{unitId:s.preparation.units[0].id,attackDamageBps:125}];},
  (s:any)=>{s.augments=s.augments.filter((a:any)=>a.definitionId!=='recombobulator');delete s.augmentHistory;},
 ];
 for(const change of mutations){const bad=structuredClone(selected);change(bad);for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();}
});

it('the transformed army fights and advances without repeating its acquisition effect',()=>{
 const facts=selected.resourceProvenance.entries.filter(e=>e.kind==='unit-transformed');
 runUntil(room,clock,s=>s.roundId==='3-2'&&s.phase==='settlement');expect(room.state.fault).toBeNull();
 runUntil(room,clock,s=>s.roundId==='3-3'&&s.phase==='preparation');expect(room.state.fault).toBeNull();
 expect(mine().resourceProvenance.entries.filter(e=>e.kind==='unit-transformed')).toEqual(facts);
 const authority=room.augmentHistoryAuthority('s0');expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(mine()),authority)).toEqual(mine());
});

describe('carousel ancestry after Recombobulator',()=>{
 const localClock=new ManualClock(),localRoom=new Room(SEATS.map(s=>({...s,kind:'human'})),{...ROOM_TIMING_DEFAULTS,...TIMINGS,seed:9,roomId:'test-room',clock:localClock,resolver:new TwoSidedBattleResolver(),carousel:CAROUSEL_RULES_BINDING});
 const state=()=>localRoom.state.seats[0].match;
 let receipt:CarouselReceipt,mergedId:string,transformed:Extract<ResourceProvenanceEntry,{kind:'unit-transformed'}>;
 beforeAll(()=>localRoom.start());
 for(const round of ['1-3','1-4','2-1','2-2','2-3'])beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId===round&&s.phase==='preparation'));
 beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId==='2-4'&&s.phase==='carousel'));
 beforeAll(()=>{
  const opened=localRoom.state.carousel!;
  localClock.advance(Math.max(0,opened.startedAt+opened.state.releaseAtMs.s0-localClock.now()));
  const carousel=localRoom.state.carousel!.state;
  const slot=carousel.slots.find(x=>x.pickedBy===null&&COST[x.definitionId]<5&&state().preparation.units.filter(u=>u.definitionId===x.definitionId&&u.starLevel===1).length<2);
  expect(slot).toBeDefined();
  expect(localRoom.handle('s0',{type:'carousel-pick',carouselId:carousel.id,revision:carousel.revision,slot:slot!.slot})).toMatchObject({ok:true});
  receipt=state().carousel!.receipts.find(r=>r.carouselId===carousel.id)!;
 });
 beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId==='2-5'&&s.phase==='preparation'));
 beforeAll(()=>{
  // The 2-4 pick joins an existing board copy; buying the third copy consumes the pick's ID.
  expect(state().preparation.units.some(u=>u.id===receipt.unitId)).toBe(true);
  expect(state().preparation.units.some(u=>u.id!==receipt.unitId&&u.definitionId===receipt.definitionId&&u.location.kind==='board')).toBe(true);
  const slot=state().shop.slots.findIndex(o=>o.status==='available'&&o.definitionId===receipt.definitionId);
  expect(slot).toBeGreaterThanOrEqual(0);
  expect(localRoom.handle('s0',{type:'buy',slot,generation:state().shop.generation})).toMatchObject({ok:true});
  const merge=state().resourceProvenance.entries.find(e=>e.kind==='unit-upgraded'&&e.event.consumedIds.includes(receipt.unitId!));
  expect(merge).toBeDefined();
  if(!merge||merge.kind!=='unit-upgraded')throw Error('missing carousel merge');
  mergedId=merge.event.survivorId;
  expect(state().preparation.units.find(u=>u.id===mergedId)).toMatchObject({definitionId:receipt.definitionId,starLevel:2});
 });
 for(const round of ['2-6','2-7','3-1','3-2'])beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId===round&&s.phase==='preparation'));
 beforeAll(()=>{
  for(let i=0;i<3&&!state().pendingChoice!.offers.includes('recombobulator');i++){
   const c=state().pendingChoice!;
   expect(localRoom.handle('s0',{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:i})).toMatchObject({ok:true});
  }
  const choice=state().pendingChoice!;expect(choice.offers).toContain('recombobulator');
  expect(localRoom.handle('s0',{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'recombobulator'})).toMatchObject({ok:true});
  const fact=state().resourceProvenance.entries.find(e=>e.kind==='unit-transformed'&&e.unitId===mergedId&&e.roundId==='3-2');
  expect(fact).toMatchObject({kind:'unit-transformed',from:receipt.definitionId,starLevel:2});
  if(!fact||fact.kind!=='unit-transformed')throw Error('missing carousel transformation');
  transformed=fact;
  expect(transformed.to).not.toBe(receipt.definitionId);
 });
 beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId==='3-3'&&s.phase==='preparation'));
 beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId==='3-4'&&s.phase==='carousel'));
 afterAll(()=>localRoom.dispose());
 it('restores the original carousel receipt after its merged survivor transforms',()=>{
  const saved=state(),current=localRoom.state.carousel!.state,authority=localRoom.augmentHistoryAuthority('s0');
  expect(saved.carousel!.receipts.find(r=>r.id===receipt.id)).toEqual(receipt);
  expect(saved.preparation.units.find(u=>u.id===receipt.unitId)).toBeUndefined();
  expect(saved.preparation.units.find(u=>u.id===mergedId)).toMatchObject({definitionId:transformed.to,starLevel:2});
  expect(current.pool.holdings.find(h=>h.seatId==='s0'&&h.sources.includes(receipt.holdingSource))).toMatchObject({unitId:mergedId,definitionId:transformed.to});
  for(const input of [saved,JSON.stringify(saved)])expect(restoreCarouselSeat(current,input,authority)).toEqual(saved);
  expect(()=>restoreCarouselSeat(current,saved)).toThrow('independent server authority');
 });
 it('rejects forged transformations, merge ancestry and current identities',()=>{
  const saved=state(),current=localRoom.state.carousel!.state,authority=localRoom.augmentHistoryAuthority('s0');
  const mutations=[
   (s:any)=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='unit-transformed'&&e.unitId===mergedId).to='mel';},
   (s:any)=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='unit-transformed'&&e.unitId===mergedId).from='mel';},
   (s:any)=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='unit-transformed'&&e.unitId===mergedId).starLevel=1;},
   (s:any)=>{s.resourceProvenance.entries=s.resourceProvenance.entries.filter((e:any)=>!(e.kind==='unit-transformed'&&e.unitId===mergedId));},
   (s:any)=>{s.resourceProvenance.entries.find((e:any)=>e.kind==='unit-upgraded'&&e.event.survivorId===mergedId).event.survivorId=receipt.unitId;},
   (s:any)=>{s.preparation.units.find((u:any)=>u.id===mergedId).definitionId='mel';},
  ];
  for(const mutate of mutations){const bad=structuredClone(saved);mutate(bad);for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreCarouselSeat(current,input,authority)).toThrow();}
 });
});

describe('carousel unit transformed before merging',()=>{
 const localClock=new ManualClock(),localRoom=new Room(SEATS.map(s=>({...s,kind:'human'})),{...ROOM_TIMING_DEFAULTS,...TIMINGS,seed:9,roomId:'test-room',clock:localClock,resolver:new TwoSidedBattleResolver(),carousel:CAROUSEL_RULES_BINDING});
 const state=()=>localRoom.state.seats[0].match;
 let receipt:CarouselReceipt,transformed:Extract<ResourceProvenanceEntry,{kind:'unit-transformed'}>,mergedId:string;
 beforeAll(()=>localRoom.start());
 for(const round of ['1-3','1-4','2-1','2-2','2-3'])beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId===round&&s.phase==='preparation'));
 beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId==='2-4'&&s.phase==='carousel'));
 beforeAll(()=>{
  const opened=localRoom.state.carousel!;
  localClock.advance(Math.max(0,opened.startedAt+opened.state.releaseAtMs.s0-localClock.now()));
  const carousel=localRoom.state.carousel!.state;
  const slot=carousel.slots.find(x=>x.pickedBy===null&&COST[x.definitionId]<5&&state().preparation.units.filter(u=>u.definitionId===x.definitionId&&u.starLevel===1).length<2);
  expect(slot).toBeDefined();
  expect(localRoom.handle('s0',{type:'carousel-pick',carouselId:carousel.id,revision:carousel.revision,slot:slot!.slot})).toMatchObject({ok:true});
  receipt=state().carousel!.receipts.find(r=>r.carouselId===carousel.id)!;
 });
 beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId==='2-5'&&s.phase==='preparation'));
 beforeAll(()=>{
  const occupied=state().preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
  expect(localRoom.handle('s0',{type:'deploy',unitId:receipt.unitId!,target:occupied.location})).toMatchObject({ok:true});
 });
 for(const round of ['2-6','2-7','3-1','3-2'])beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId===round&&s.phase==='preparation'));
 beforeAll(()=>{
  for(let i=0;i<3&&!state().pendingChoice!.offers.includes('recombobulator');i++){
   const c=state().pendingChoice!;
   expect(localRoom.handle('s0',{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:i})).toMatchObject({ok:true});
  }
  const choice=state().pendingChoice!;expect(choice.offers).toContain('recombobulator');
  expect(localRoom.handle('s0',{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'recombobulator'})).toMatchObject({ok:true});
  const fact=state().resourceProvenance.entries.find(e=>e.kind==='unit-transformed'&&e.unitId===receipt.unitId);
  expect(fact).toMatchObject({from:receipt.definitionId,starLevel:1});
  if(!fact||fact.kind!=='unit-transformed')throw Error('missing carousel transformation');
  transformed=fact;
  expect(transformed.to).not.toBe(receipt.definitionId);
 });
 beforeAll(()=>{
  // Put the first bought copy on the board so the transformed carousel ID is consumed by the triple.
  let moved=false,merge:Extract<ResourceProvenanceEntry,{kind:'unit-upgraded'}>|undefined;
  while(state().gold>=2+COST[transformed.to]&&!merge){
   const before=state(),slot=before.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId===transformed.to);
   if(slot<0){expect(localRoom.handle('s0',{type:'reroll'})).toMatchObject({ok:true});continue;}
   const boughtId=`unit-${before.nextUnitSerial}`;
   expect(localRoom.handle('s0',{type:'buy',slot,generation:before.shop.generation})).toMatchObject({ok:true});
   merge=state().resourceProvenance.entries.find((e):e is Extract<ResourceProvenanceEntry,{kind:'unit-upgraded'}>=>e.kind==='unit-upgraded'&&e.event.consumedIds.includes(receipt.unitId!));
   if(!moved&&!merge){
    const original=state().preparation.units.find(u=>u.id===receipt.unitId)!;
    expect(localRoom.handle('s0',{type:'deploy',unitId:boughtId,target:original.location})).toMatchObject({ok:true});
    moved=true;
   }
  }
  expect(merge).toBeDefined();
  if(!merge)throw Error('missing post-transform carousel merge');
  mergedId=merge.event.survivorId;
  expect(state().preparation.units.find(u=>u.id===mergedId)).toMatchObject({definitionId:transformed.to,starLevel:2});
 });
 beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId==='3-3'&&s.phase==='preparation'));
 beforeAll(()=>runUntil(localRoom,localClock,s=>s.roundId==='3-4'&&s.phase==='carousel'));
 afterAll(()=>localRoom.dispose());
 it('restores the original receipt after the transformed copy is consumed in a merge',()=>{
  const saved=state(),carousel=localRoom.state.carousel!.state,authority=localRoom.augmentHistoryAuthority('s0');
  expect(saved.carousel!.receipts.find(r=>r.id===receipt.id)).toEqual(receipt);
  expect(saved.preparation.units.find(u=>u.id===receipt.unitId)).toBeUndefined();
  expect(saved.preparation.units.find(u=>u.id===mergedId)).toMatchObject({definitionId:transformed.to,starLevel:2});
  expect(carousel.pool.holdings.find(h=>h.seatId==='s0'&&h.sources.includes(receipt.holdingSource))).toMatchObject({unitId:mergedId,definitionId:transformed.to});
  for(const input of [saved,JSON.stringify(saved)])expect(restoreCarouselSeat(carousel,input,authority)).toEqual(saved);
 });
});
