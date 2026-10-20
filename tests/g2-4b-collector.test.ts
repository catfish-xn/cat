import {expect,it} from 'vitest';
import {reachRound,accepted} from './match-helpers';
import {deployMatchUnit,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem,grantMechanicUnit} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {readG23Progress} from '../src/simulation/g2-3-state';
import {createItemRandomStreams,drawItemRandom} from '../src/simulation/g2-4b-item-kernel';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

it('executes through real combat, settles only successful independent rolls, and restores exact gold authority',()=>{
 let executions=0,awards=0;
 for(const seed of [42,1,7,19]){
  let entered=reachRound('2-1',true,seed);
  for(let n=0;n<9;n++){const unit=grantMechanicUnit(entered,{receiptId:`singed-${n}`,source:'test',definitionId:'singed'});if(!unit.ok)throw Error(unit.reason);entered=unit.state;}
  const singed=entered.preparation.units.find(u=>u.team==='player'&&u.definitionId==='singed'&&u.starLevel===3)!;
  const deployed=accepted(deployMatchUnit(entered,singed.id,{kind:'board',cell:{col:3,row:4}}));
  const g=grantMechanicItem(deployed,{receiptId:'collector',source:'test',definitionId:'TFT4_Item_OrnnTheCollector'});if(!g.ok)throw Error(g.reason);
  const owner=g.state.preparation.units.find(u=>u.id===singed.id)!;
  const e=equipItem(g.state,g.state.items.at(-1)!.id,owner.id,0);if(!e.ok)throw Error(e.reason);
  const start=startMatchCombat(e.state);if(!start.ok)throw Error(start.reason);
  let state=start.state;
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  while(state.phase==='combat')state=stepMatch(state).state;
  const receipts=state.combat!.itemGoldReceipts!;
  executions+=receipts.length;
  let streams=createItemRandomStreams(state.combatInputBasis!.battleSeed);
  for(const receipt of receipts){
   const draw=drawItemRandom(streams,'collector');streams=draw.streams;
   expect(receipt.word).toBe(draw.word);expect(receipt.gold).toBe(BigInt(draw.word)*10000n<4000n*4294967296n?1:0);
  }
  const gold=receipts.reduce((n,r)=>n+r.gold,0);awards+=gold;
  const payoutReceipts=state.seatMechanics!.receipts.filter(r=>r.source==='g24-item-gold');
  expect(payoutReceipts).toHaveLength(gold);
  const facts=readG23Progress(state)!.economyReceipts.find(r=>r.kind==='battle'&&r.facts.round===state.round);
  expect(facts?.kind==='battle'?(facts.facts.itemGoldPayouts?.length??0):-1).toBe(gold);
  const restored=restoreMatch(serializeMatch(state));expect(restored).toEqual(state);
  expect(stepMatch(restored).state).toEqual(state);
  // Even a self-consistent extra failure and matching RNG cursor cannot create
  // another opportunity: the validator independently reconstructs the battle.
  const forged=structuredClone(state);
  const extra=drawItemRandom(forged.combat!.itemRandomStreams!,'collector');
  Object.assign(forged.combat!,{itemRandomStreams:extra.streams,itemGoldReceipts:[...receipts,
   {battleId:state.combat!.combatId!,ownerId:owner.id,itemInstanceId:g.state.items.at(-1)!.id,kind:'collector',tick:state.combat!.tick,
    ordinal:receipts.length,id:'forged-opportunity',word:extra.word,gold:0}]});
  expect(()=>restoreMatch(forged)).toThrow('authoritative item gold replay');
 }
 expect(executions).toBeGreaterThan(0);expect(awards).toBeGreaterThan(0);
},20_000);
