import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {createItemRandomStreams,drawItemRandom} from '../src/simulation/g2-4b-item-kernel';
import {g23SoloFacts,commitG23Settlement} from '../src/simulation/g2-3-settlement';
import {readG23Progress} from '../src/simulation/g2-3-state';
import type {CombatEvent} from '../src/simulation/combat-types';
import {expect,it} from 'vitest';
import {reachRound,accepted} from './match-helpers';
import {deployMatchUnit,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
const items=['TFT_Item_Artifact_SuspiciousTrenchCoat','TFT7_Item_ShimmerscaleGamblersBlade','TFT4_Item_OrnnTheCollector'];
function prepare(seed:number){
 let state=reachRound('2-1',true,seed);
 const owner=state.preparation.units.find(u=>u.team==='player')!;
 state=accepted(deployMatchUnit(state,owner.id,{kind:'board',cell:{col:3,row:4}}));
 for(const [slot,definitionId] of items.entries()){
  const grant=grantMechanicItem(state,{receiptId:`trench-gold-${slot}`,source:'test',definitionId});if(!grant.ok)throw Error(grant.reason);
  state=accepted(equipItem(grant.state,grant.state.items.at(-1)!.id,owner.id,slot));
 }
 return {state,ownerId:owner.id};
}

it('real Trench copies inherit the same gold items but earn independent owner-scoped rolls and exactly-once payouts',()=>{
 // v15 seed 1 is a real public-command route: the original Irelia and copies all
 // attack, with positive Gambler payouts on both sides of the split and an
 // actual successful Collector execution by a copy. No combat state is edited.
 const {state,ownerId}=prepare(1);
 const equippedItems=state.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===ownerId);
 const gamblerId=equippedItems.find(i=>i.definitionId===items[1])!.id;
 const collectorId=equippedItems.find(i=>i.definitionId===items[2])!.id;
 let current=accepted(startMatchCombat(state));
 const events:CombatEvent[]=[];
 while(current.phase==='combat'&&!current.combat!.trenchSplits?.length){const next=stepMatch(current);for(const event of next.events)if(event.domain==='combat')events.push(event);current=next.state;}
 expect(current.phase).toBe('combat');
 expect(current.combat!.trenchSplits).toHaveLength(1);
 const split=current.combat!.trenchSplits![0];
 expect(split.ownerId).toBe(ownerId);expect(split.copyIds).toHaveLength(3);
 expect(current.combat!.units.some(u=>u.id===ownerId)).toBe(false);
 for(const copyId of split.copyIds){
  const copy=current.combat!.units.find(u=>u.id===copyId)!;
  expect(copy.mechanics!.find(m=>m.mechanic==='g24Gambler')!.source).toMatchObject({ownerId:copyId,instanceId:gamblerId});
  expect(copy.mechanics!.find(m=>m.mechanic==='g24Collector')!.source).toMatchObject({ownerId:copyId,instanceId:collectorId});
 }
 const splitRestored=restoreMatch(serializeMatch(current));expect(splitRestored).toEqual(current);
 expect(stepMatch(splitRestored)).toEqual(stepMatch(current));
 let resumed=splitRestored;
 while(current.phase==='combat'){const next=stepMatch(current);for(const event of next.events)if(event.domain==='combat')events.push(event);current=next.state;}
 while(resumed.phase==='combat')resumed=stepMatch(resumed).state;
 expect(resumed).toEqual(current);
 const receipts=current.combat!.itemGoldReceipts!;
 const actors=[ownerId,...split.copyIds];
 for(const actor of actors){
  const attacks=events.filter(e=>e.type==='attack'&&e.attackerId===actor);
  const rolls=receipts.filter(r=>r.ownerId===actor&&r.kind==='gamblers-blade');
  expect(attacks.length).toBeGreaterThan(0);expect(rolls).toHaveLength(attacks.length);
  expect(rolls.map(r=>r.ordinal)).toEqual(Array.from({length:rolls.length},(_,i)=>i));
  expect(rolls.every(r=>r.itemInstanceId===gamblerId)).toBe(true);
  expect(rolls.map(r=>r.tick)).toEqual(attacks.map(a=>a.tick));
 }
 const originalWins=receipts.filter(r=>r.ownerId===ownerId&&r.kind==='gamblers-blade'&&r.gold===1);
 const copyWins=receipts.filter(r=>split.copyIds.includes(r.ownerId)&&r.kind==='gamblers-blade'&&r.gold===1);
 const executions=receipts.filter(r=>split.copyIds.includes(r.ownerId)&&r.kind==='collector'&&r.gold===1);
 expect(originalWins).toHaveLength(1);expect(copyWins).toHaveLength(1);expect(executions).toHaveLength(1);
 expect(originalWins.every(r=>r.tick<=split.tick)).toBe(true);
 expect(copyWins.concat(executions).every(r=>r.tick>split.tick)).toBe(true);
 expect(executions.every(r=>r.itemInstanceId===collectorId)).toBe(true);
 expect(new Set(receipts.map(r=>r.id)).size).toBe(receipts.length);
 let streams=createItemRandomStreams(current.combatInputBasis!.battleSeed);
 for(const receipt of receipts){
  expect(['gamblers-blade','collector']).toContain(receipt.kind);
  const kind=receipt.kind as 'gamblers-blade'|'collector',draw=drawItemRandom(streams,kind);streams=draw.streams;
  expect(receipt.word).toBe(draw.word);
  expect(receipt.gold).toBe(BigInt(draw.word)*10000n<BigInt(kind==='collector'?4000:500)*4294967296n?1:0);
 }
 expect(current.combat!.itemRandomStreams).toEqual(streams);
 const positive=receipts.filter(r=>r.gold===1),payouts=current.seatMechanics!.receipts.filter(r=>r.source==='g24-item-gold');
 expect(positive).toHaveLength(3);expect(payouts).toHaveLength(3);
 const fact=readG23Progress(current)!.economyReceipts.find(r=>r.kind==='battle'&&r.facts.battleId===current.combat!.combatId)!;
 expect(fact.kind).toBe('battle');if(fact.kind!=='battle')throw Error('Missing battle settlement');
 expect(fact.facts.itemGoldPayouts!.map(p=>p.receiptId)).toEqual(positive.map(r=>r.id));
 expect(current.items).toEqual(state.items);
 expect(current.preparation.units.some(u=>split.copyIds.includes(u.id))).toBe(false);
 const restored=restoreMatch(serializeMatch(current));expect(restored).toEqual(current);
 expect(stepMatch(restored).state).toEqual(current);
 const facts=g23SoloFacts(current,current.combat!);
 expect(commitG23Settlement(current,facts)).toBe(current);
 expect(commitG23Settlement(restored,facts)).toEqual(current);
 expect(current.seatMechanics!.receipts.filter(r=>r.source==='g24-item-gold')).toHaveLength(3);
});
