import {afterEach,expect,it,vi} from 'vitest';
import * as combat from '../src/simulation/combat';
import {createMatch,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {recordItemGold} from '../src/simulation/g2-4b-item-gold';
import {MAX_COMBAT_TICKS} from '../src/simulation/combat-types';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const ids={collector:'TFT4_Item_OrnnTheCollector',gambler:'TFT7_Item_ShimmerscaleGamblersBlade',mogul:'TFT7_Item_ShimmerscaleMogulsMail',zephyr:'TFT_Item_Zephyr'};
function checkpoint(item:string,seed=42){
 const g=grantMechanicItem(createMatch(seed),{receiptId:'restore-audit',source:'test',definitionId:item});if(!g.ok)throw Error(g.reason);
 const owner=g.state.preparation.units.find(u=>u.team==='player')!;
 const e=equipItem(g.state,g.state.items.at(-1)!.id,owner.id,0);if(!e.ok)throw Error(e.reason);
 const start=startMatchCombat(e.state);if(!start.ok)throw Error(start.reason);
 let state=start.state;for(let n=0;n<30&&state.phase==='combat';n++)state=stepMatch(state).state;
 return {state,ownerId:owner.id,itemId:g.state.items.at(-1)!.id};
}
afterEach(()=>vi.restoreAllMocks());

it.each(Object.values(ids))('%s rebuilds the entire elapsed combat on every call, including warm JSON calls',item=>{
 const {state}=checkpoint(item),text=serializeMatch(state),before=JSON.stringify(state);
 const step=vi.spyOn(combat,'stepCombat'),create=vi.spyOn(combat,'createCombatWithEvents');
 for(const input of [text,text,state]){
  step.mockClear();create.mockClear();
  const result=restoreMatch(input);expect(result).toEqual(state);expect(result).not.toBe(state);
  expect(create).toHaveBeenCalledTimes(1);expect(step).toHaveBeenCalledTimes(state.combat!.tick);
 }
 expect(JSON.stringify(state)).toBe(before);
});

it('a warm successful Collector restore does not authenticate a self-consistent new receipt/RNG opportunity',()=>{
 const {state,ownerId,itemId}=checkpoint(ids.collector),text=serializeMatch(state);
 restoreMatch(text);
 const bad=JSON.parse(text),ledger=recordItemGold({streams:bad.combat.itemRandomStreams,receipts:bad.combat.itemGoldReceipts},
  {battleId:bad.combat.combatId,ownerId,itemInstanceId:itemId,kind:'collector',tick:bad.combat.tick,ordinal:bad.combat.itemGoldReceipts.length});
 bad.combat.itemRandomStreams=ledger.streams;bad.combat.itemGoldReceipts=ledger.receipts;
 for(const input of [JSON.stringify(bad),bad])expect(()=>restoreMatch(input)).toThrow('authoritative item gold replay');
 expect(restoreMatch(text)).toEqual(state);
});

it('warm restore rejects edited bank/absence and frozen inputs without poisoning later valid calls',()=>{
 for(const item of [ids.gambler,ids.zephyr]){
  const {state,ownerId}=checkpoint(item),text=serializeMatch(state);restoreMatch(text);
  const bad=JSON.parse(text);
  if(item===ids.gambler)bad.combat.units.find((u:{id:string})=>u.id===ownerId).currentItemBankGold++;
  else bad.combat.units.find((u:{itemBanish?:unknown})=>u.itemBanish).itemBanish.untilTick++;
  for(const input of [JSON.stringify(bad),bad])expect(()=>restoreMatch(input)).toThrow(/authoritative/);
  const basis=JSON.parse(text);basis.combatInputBasis.battleSeed=(basis.combatInputBasis.battleSeed+1)>>>0;
  expect(()=>restoreMatch(JSON.stringify(basis))).toThrow('combat input basis');
  const other=checkpoint(item,7).state;expect(restoreMatch(serializeMatch(other))).toEqual(other);
  const returned=restoreMatch(text);Object.assign(returned.combat!.units[0],{hp:1});
  expect(restoreMatch(text)).toEqual(state);
 }
});

it('rejects invalid tick bounds before any replay work',()=>{
 const {state}=checkpoint(ids.zephyr),step=vi.spyOn(combat,'stepCombat'),create=vi.spyOn(combat,'createCombatWithEvents');
 for(const tick of [-1,0.5,MAX_COMBAT_TICKS+1,1201,Number.MAX_SAFE_INTEGER,NaN,Infinity]){
  const bad=structuredClone(state);Object.assign(bad.combat!,{tick});
  expect(()=>restoreMatch(bad)).toThrow();
 }
 expect(step).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
});

it('an in-range forged late Zephyr clock stops replay at the real terminal boundary and rejects',()=>{
 const {state}=checkpoint(ids.zephyr);let terminal=state;
 while(terminal.phase==='combat')terminal=stepMatch(terminal).state;
 // v22: combat is 45 s (MAX_COMBAT_TICKS 900), so the last in-range forged clock is 899.
 const late=MAX_COMBAT_TICKS-1;expect(terminal.combat!.tick).toBeLessThan(late);
 const bad=structuredClone(state);Object.assign(bad.combat!,{tick:late});
 const step=vi.spyOn(combat,'stepCombat');
 expect(()=>restoreMatch(JSON.stringify(bad))).toThrow('authoritative Zephyr replay');
 expect(step).toHaveBeenCalledTimes(terminal.combat!.tick);
 expect(step.mock.calls.length).toBeLessThan(late);
});
