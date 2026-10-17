import {expect,it} from 'vitest';
import {createMatch,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem,grantMechanicGold} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {readCombatStats} from '../src/simulation/combat-s13';
import {createItemRandomStreams,drawItemRandom} from '../src/simulation/g2-4b-item-kernel';

function battle(bank:number,seed=42){
 let state=createMatch(seed);
 if(bank){const gold=grantMechanicGold(state,{receiptId:'bank',source:'test',amount:bank});if(!gold.ok)throw Error(gold.reason);state=gold.state;}
 const g=grantMechanicItem(state,{receiptId:'gambler',source:'test',definitionId:'TFT7_Item_ShimmerscaleGamblersBlade'});if(!g.ok)throw Error(g.reason);
 const owner=g.state.preparation.units.find(u=>u.team==='player')!;
 const e=equipItem(g.state,g.state.items.at(-1)!.id,owner.id,0);if(!e.ok)throw Error(e.reason);
 const start=startMatchCombat(e.state);if(!start.ok)throw Error(start.reason);
 return {state:start.state,ownerId:owner.id};
}

it('freezes the actual bank, grants 1% per gold capped at30, and rejects a forged opening bank',()=>{
 for(const bank of [0,15,30,100]){
  const {state,ownerId}=battle(bank),unit=state.combat!.units.find(u=>u.id===ownerId)!;
  expect(state.combatInputBasis!.inputs.bankGold).toBe(bank);
  expect(unit.openingItemBankGold).toBe(Math.min(bank,30));
  const expected=Math.ceil(200000*10000/(unit.baseAttackSpeedBps!*(10000+4500+Math.min(bank,30)*100)));
  expect(readCombatStats(unit,state.combat!).attackIntervalTicks).toBe(expected);
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  const forged=structuredClone(state);Object.assign(forged.combatInputBasis!.inputs,{bankGold:bank+1});
  expect(()=>restoreMatch(forged)).toThrow();
 }
});

it('draws exactly once per real attack, preserves failures and rejects forged opportunities/bank growth',()=>{
 const {state:initial,ownerId}=battle(15);
 let state=initial;
 while(state.phase==='combat')state=stepMatch(state).state;
 const unit=state.combat!.units.find(u=>u.id===ownerId)!,receipts=state.combat!.itemGoldReceipts!;
 expect(receipts.length).toBe(unit.runtime!.attackCount);expect(receipts.length).toBeGreaterThan(0);
 let streams=createItemRandomStreams(initial.combatInputBasis!.battleSeed);
 for(const receipt of receipts){
  const draw=drawItemRandom(streams,'gamblers-blade');streams=draw.streams;
  expect(receipt.word).toBe(draw.word);expect(receipt.gold).toBe(BigInt(draw.word)*10000n<500n*4294967296n?1:0);
 }
 expect(state.combat!.itemRandomStreams).toEqual(streams);
 expect(unit.currentItemBankGold).toBe(Math.min(30,15+receipts.reduce((n,r)=>n+r.gold,0)));
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const forged=structuredClone(state);Object.assign(forged.combat!.units.find(u=>u.id===ownerId)!,{currentItemBankGold:unit.currentItemBankGold!+1});
 expect(()=>restoreMatch(forged)).toThrow('authoritative item gold replay');
});
