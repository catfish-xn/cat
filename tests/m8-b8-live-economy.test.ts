import {lootPlan as independentLootPlan} from './fixtures/orb-combo-oracle.cjs';
import {describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {UNIT_DEFINITIONS} from '../src/simulation/units';
import type {MatchState} from '../src/simulation/match';
import {accepted,battle,players,reserveExcept,plan} from './fixtures/t13-loot-public';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
// v22 seed: the first with no opening encounter whose independent 2-7 loot keeps the
// original shape (three items plus 1G, no new unit) and whose public 2-1 offer has
// Investment I; seed 11111 lost the offer under the v22 augment tiers and now draws
// the scuttle-crab opening. The 2-6 loss keeps the 2-7 win's streak gold at 0.
// v23: fmix32 gives 4867 the Golden Gala opening and the 151-offer pool drops its Investment I; 229819 is the next
// no-opening seed with Investment I at 2-1 and the same 2-7 shape (three items plus 1G), reaching the same 66G/73HP/136.
const SEED=229819;
let preparation=api.createMatch(SEED);
while(preparation.roundDefinitionId!=='2-7'){
 if(preparation.phase==='choice'){const c=preparation.pendingChoice!;preparation=accepted(api.selectChoice(preparation,c.choiceId,c.generation,c.kind==='component'?'sword':'investment-strategy-i'));}
 else if(preparation.phase==='settlement')preparation=accepted(api.nextRound(preparation,preparation.round));
 else{if(preparation.round>3)preparation=reserveExcept(preparation,[]);
  else for(const u of players(preparation).filter(u=>u.location.kind==='bench')){const held=players(preparation).filter(u=>u.location.kind==='board');if(held.length>=preparation.level)break;const col=[3,5,1,0,6].find(col=>!held.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===7))!;preparation=accepted(api.deployMatchUnit(preparation,u.id,{kind:'board',cell:{col,row:7}}));}
  preparation=battle(preparation).ended;}
}
for(const [i,u]of players(preparation).slice(0,preparation.level).entries())preparation=accepted(api.deployMatchUnit(preparation,u.id,{kind:'board',cell:{col:[1,3,5,0,6][i],row:i===2?7:4}}));
preparation=accepted(api.equipItem(preparation,'item-1','unit-1',0));
preparation=accepted(api.equipItem(preparation,'item-2','unit-1',1));
preparation=accepted(api.equipItem(preparation,'item-3','unit-2',0));
function roundTrip(s:MatchState){const saved=serializeMatch(s),r=restoreMatch(saved);expect(r).toEqual(s);expect(r).not.toBe(s);expect(serializeMatch(s)).toBe(saved);return r;}
function reject(s:MatchState,change:(s:any)=>void,message:string){const saved=serializeMatch(s),bad=JSON.parse(saved);change(bad);expect(()=>restoreMatch(bad)).toThrow(message);expect(serializeMatch(s)).toBe(saved);}
// Isolated H=80 arithmetic remains in the independent oracle. This real route has H=136.
describe('B8 live gold before interest, randomized direct loot',()=>{
 it.each([{gold:9,basis:10,interest:1,after:16,hp:144},{gold:49,basis:50,interest:5,after:60,hp:176},{gold:50,basis:51,interest:5,after:61,hp:176}])('$gold G plus earned 1G settles to $after once, across exact restore/Continue',v=>{
  expect(preparation).toMatchObject({gold:66,playerHp:73,level:4,augmentProgress:{investmentHp:136}});
  let before=preparation;
  if(v.gold%2===1){const slot=before.shop.slots.findIndex(o=>o.status==='available'&&UNIT_DEFINITIONS[o.definitionId].cost%2===1);expect(slot).toBeGreaterThanOrEqual(0);before=accepted(api.buyUnit(before,slot,before.shop.generation));}
  while(before.gold>v.gold)before=accepted(api.rerollShop(before));
  expect(before.gold).toBe(v.gold);roundTrip(before);
  const l=battle(before),s=l.ended;
  expect(battle(roundTrip(before))).toEqual(l);
  expect(s.phase).toBe('settlement');expect(s.pendingChoice).toBeNull();
  expect(s.roundResults.at(-1)).toMatchObject({roundId:'2-7',result:'playerWin',interestBasis:v.basis,goldBefore:v.basis,goldAfter:v.after,incomeBreakdown:{base:5,win:0,interest:v.interest,streak:0}});
  expect(s.gold).toBe(v.basis);expect(s.augmentProgress.investmentHp).toBe(before.augmentProgress.investmentHp);
  expect(s.gold+5+v.interest).toBe(v.after);
  const drops=plan(before).encounterPlan.drops,ids=new Set(drops.map(d=>d.dropId));
  expect(drops.map(d=>d.payload)).toEqual(independentLootPlan(SEED,10).rounds.at(-1)!.encounterPlan.drops.map(d=>d.payload));
  const receipts=s.m8.loot.receipts.filter(r=>ids.has(r.dropId));expect(receipts.map(r=>r.payload)).toEqual(drops.map(d=>d.payload));
  expect(receipts.slice(0,2).map(r=>r.grantedItemIds)).toEqual([[`item-${before.nextItemSerial}`],[`item-${before.nextItemSerial+1}`]]);
  expect(s.nextUnitSerial).toBe(before.nextUnitSerial);expect(s.nextItemSerial).toBe(before.nextItemSerial+3);
  expect(s.scheduleReceipts).toEqual(before.scheduleReceipts);expect(s.m8.loot.frozen).toEqual(before.m8.loot.frozen);
  for(const key of ['rngState','choiceRngState','rewardRngState','equipmentState'] as const)expect(s[key]).toEqual(before[key]);
  expect(s.combatInputBasis).toEqual(l.started.combatInputBasis);
  expect(l.events.filter(e=>e.type==='roundSettled')).toHaveLength(1);
  expect(l.events.filter(e=>e.type==='lootGranted')).toHaveLength(4);
  for(const x of [s,roundTrip(s)]){
   expect(api.stepMatch(x)).toEqual({state:x,events:[]});
   expect(api.startMatchCombat(x)).toEqual({ok:false,state:x,reason:'wrong-phase'});
   expect(api.selectChoice(x,'obsolete-pve-choice',0,'tear')).toEqual({ok:false,state:x,reason:'wrong-phase'});
  }
  reject(s,x=>{x.gold++;},'current settlement totals');
  reject(s,x=>{x.roundResults.at(-1).interestBasis--;},'history income');
  reject(s,x=>{x.augmentProgress.investmentHp+=8;},'investment');
  reject(s,x=>{x.m8.loot.receipts.find((r:any)=>r.dropId===drops.find(d=>d.payload.kind==='gold')!.dropId).payload.quantity=2;},'frozen receipt payload');
  const next=accepted(api.nextRound(s,10));expect(api.nextRound(roundTrip(s),10)).toEqual(api.nextRound(s,10));roundTrip(next);
  expect(next).toMatchObject({roundDefinitionId:'3-1',gold:v.after,augmentProgress:{investmentHp:v.hp},combat:null,combatInputBasis:null});
  expect(next.resourceProvenance).toEqual(s.resourceProvenance);expect(next.m8.loot.receipts).toEqual(s.m8.loot.receipts);
  expect(api.nextRound(next,10)).toEqual({ok:false,state:next,reason:'wrong-phase'});
 });
});
