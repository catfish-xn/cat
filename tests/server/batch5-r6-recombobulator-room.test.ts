import { afterAll, beforeAll, expect, it } from 'vitest';
import { runUntil, claimAllOrbs, TIMINGS, SEATS } from './helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { COST, batch5TransformPlan as batch5Transforms } from '../fixtures/m5/oracle.g2.cjs';
import { rewardPlan } from '../fixtures/m5/augment-rewards-oracle.cjs';
import type { MatchState } from '../../src/simulation/match-types';

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
