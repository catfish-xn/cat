import {lootPlan as independentLootPlan} from './fixtures/orb-combo-oracle.cjs';
import {openingEncounter} from './fixtures/m5/oracle.g2.cjs';
import {beforeAll,describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import type {MatchState} from '../src/simulation/match';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {getUnitSellPrice} from '../src/simulation/unit-stats';
import {installB1Offers} from './fixtures/b1-scripted-offers';
import {reachRound} from './match-helpers';
import {accepted,advanceTerminalRoute,battle,bench,fillBench,plan,publicPrefix,terminalPreparation} from './fixtures/t13-loot-public';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
// v25 batch-5 expands the 2-1 gold pool from 80 (100589ca) to 98 candidates while
// generateChoices still consumes three RNG words. Seed3155 now naturally selects
// Pandora's Items II + Blistering Strikes instead of All For One II + Lineup.
// Capacity rejection uses only the non-merging acquisition and full bench, not either augment;
// their acquisition is checked separately below, with no scripted offers in this B8 witness.
// Keep the already checked-in seed3155: an independent oracle scan of 0..100 finds no
// no-encounter seed with four item drops and exactly one hero. No new seed outside 0..100 is selected.
// Its public route still earns a lone Akali sharing an orb and four components. A real
// 1G Irelia sale, 2G refresh and 2G Vander purchase preserve nine reserves and the original 12G premise.
// Reveal/final ticks61/122 are exact checkpoints of this natural combat (v24's final tick was86).
// v26 re-pin (route drift above): reveal/final ticks 91/152 (were 61/122).
let prepared=fillBench(await publicPrefix('3-7',3155,'cannon',['bulky-buddies-i']),['akali']);
const reserve=bench(prepared).find(u=>u.definitionId==='irelia'&&u.starLevel===1)!;
expect(getUnitSellPrice(reserve)).toBe(1);
prepared=accepted(api.sellUnit(prepared,reserve.id));
prepared=accepted(api.rerollShop(prepared));
// v26 (D5 pool 7953c99a; 14.24 neutrals/targeting route drift): seed 3155 now naturally takes Noxian Guillotine + Lone Hero
// (was Pandora's Items II + Blistering Strikes) and reaches 3-7 with 12G after fillBench (the sale/refresh/purchase leave 9G).
// The refreshed shop no longer holds Vander (leona, nunu, smeech, leona, rell); buy the first 2G Leona instead, a new
// one-star copy that merges with nothing, so the nine-reserve, lone-Akali premise is unchanged.
const replacement=prepared.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId==='leona');
expect(replacement).toBeGreaterThanOrEqual(0);
prepared=accepted(api.buyUnit(prepared,replacement,prepared.shop.generation));
const live=battle(prepared),waiting=live.ended;
const hero=plan(prepared).encounterPlan.drops.find(d=>d.payload.kind==='unit')!;
const soldUnit=bench(waiting).find(u=>!waiting.items.some(i=>i.location.kind==='unit'&&i.location.unitId===u.id))!;
function roundTrip(s:MatchState){const saved=serializeMatch(s),r=restoreMatch(saved);expect(r).toEqual(s);expect(r).not.toBe(s);expect(serializeMatch(s)).toBe(saved);return r;}
function command(s:MatchState,f:(s:MatchState)=>api.MatchCommandResult){const saved=serializeMatch(s),a=f(s),b=f(roundTrip(s));expect(b).toEqual(a);expect(serializeMatch(s)).toBe(saved);if(!a.ok)expect(a.state).toBe(s);return a;}
function reject(s:MatchState,message:string,change:(s:any)=>void){const saved=serializeMatch(s),bad=JSON.parse(saved);change(bad);expect(()=>restoreMatch(bad)).toThrow(message);expect(serializeMatch(s)).toBe(saved);}
const soldResult=command(waiting,s=>api.sellUnit(s,soldUnit.id)),sold=accepted(soldResult);
describe('B8 live full-bench settlement and exact command resumption',()=>{
 it('acquires All For One II and Lineup through scripted offers (fixture self-check)',()=>{
  const priorities=['all-for-one-ii','lineup'],restoreOffers=installB1Offers(priorities);
  try {
   const before=reachRound('3-2',false,3155,priorities),choice=before.pendingChoice!;
   expect(before.augments.map(a=>a.definitionId)).toEqual(['all-for-one-ii']);
   expect(before.seatMechanics!.receipts.filter(r=>r.source==='s13-augments-p2')).toHaveLength(3);
   expect(choice.kind).toBe('augment');
   // Fixture self-check only: installB1Offers supplies Lineup; this is not a natural-RNG witness.
   expect(choice.offers).toContain('lineup');
   const acquired=accepted(api.selectChoice(before,choice.choiceId,choice.generation,'lineup'));
   expect(acquired.augments.map(a=>a.definitionId)).toEqual(['all-for-one-ii','lineup']);
   // Scripted offer history must restore while the generator wrapper is still installed.
   roundTrip(acquired);
  } finally {restoreOffers();}
 });
 it('earns a non-merging hero at nine capacity without receipt or unit ID consumption',()=>{
  expect(openingEncounter(prepared.seed)).toBe('none');
  expect(prepared.augments.map(a=>a.definitionId)).toEqual(['noxian-guillotine','lone-hero']);
  expect(prepared.gold).toBe(9);expect(bench(prepared)).toHaveLength(9);
  expect(plan(prepared).encounterPlan.drops.map(d=>d.payload)).toEqual(independentLootPlan(prepared.seed,17).rounds.at(-1)!.encounterPlan.drops.map(d=>d.payload));
  expect(plan(prepared).encounterPlan.drops.filter(d=>d.payload.kind==='item')).toHaveLength(4);
  expect(plan(prepared).encounterPlan.drops.filter(d=>d.payload.kind==='unit')).toHaveLength(1);
  expect(prepared.preparation.units.some(u=>u.team==='player'&&u.definitionId==='akali')).toBe(false);
  expect(hero.payload).toEqual({kind:'unit',definitionId:'akali',quantity:1});
  expect(waiting.phase).toBe('settlement');expect(waiting.pendingChoice).toBeNull();
  expect(live.revealed!.combat!.tick).toBe(91);expect(waiting.combat!.tick).toBe(152);
  expect(waiting.m8.loot.direct.find(d=>d.dropId===hero.dropId)).toEqual({dropId:hero.dropId,status:'pending-capacity',receiptId:null});
  expect(waiting.m8.loot.receipts.some(r=>r.dropId===hero.dropId)).toBe(false);
  expect(waiting.nextUnitSerial).toBe(prepared.nextUnitSerial);expect(waiting.preparation).toEqual(prepared.preparation);
  expect(waiting.nextItemSerial).toBe(prepared.nextItemSerial+4);
  expect(api.nextRound(waiting,17)).toEqual({ok:false,state:waiting,reason:'unsettled-round'});
  let a=live.revealed!,b=roundTrip(a);while(a.phase==='combat'){const x=api.stepMatch(a),y=api.stepMatch(b);expect(y).toEqual(x);a=x.state;b=y.state;}expect(a).toEqual(waiting);roundTrip(waiting);
 });
 it('a real sale grants once without resettling income, investment, XP or growth',()=>{
  const receipt=sold.m8.loot.receipts.find(r=>r.dropId===hero.dropId)!;
  expect(receipt.grantedUnitIds).toEqual([`unit-${waiting.nextUnitSerial}`]);
  expect(sold.gold).toBe(waiting.gold+getUnitSellPrice(soldUnit));
  for(const key of ['roundResults','augmentProgress','xp','persistentGrowth','rngState','choiceRngState','rewardRngState','equipmentState','combatInputBasis','combat'] as const)expect(sold[key]).toEqual(waiting[key]);
  expect(sold.m8.loot.frozen).toEqual(waiting.m8.loot.frozen);
  expect(sold.resourceProvenance.entries.slice(waiting.resourceProvenance.entries.length)).toEqual([
   {kind:'unit-sold',unitId:soldUnit.id,goldGranted:getUnitSellPrice(soldUnit),context:'settlement-capacity',roundId:'3-7',sequence:waiting.resourceProvenance.entries.length},
   {kind:'unit-acquired',unitId:`unit-${waiting.nextUnitSerial}`,source:{kind:'loot',receiptId:receipt.receiptId},roundId:'3-7',sequence:waiting.resourceProvenance.entries.length+1},
  ]);
  expect(soldResult.ok&&soldResult.events.map(e=>e.type)).toEqual(['lootGranted']);
  expect(api.stepMatch(sold)).toEqual({state:sold,events:[]});
  expect(command(sold,s=>api.sellUnit(s,bench(s)[0].id))).toMatchObject({ok:false,reason:'wrong-phase'});
  const next=accepted(command(sold,s=>api.nextRound(s,17)));expect(next.roundDefinitionId).toBe('4-1');expect(next.m8.loot.receipts).toEqual(sold.m8.loot.receipts);roundTrip(next);
 });
 it('rejects capacity status, sale price/context, transaction order and duplicate settlement tampering',()=>{
  const progress=(s:any)=>s.m8.loot.direct.find((d:any)=>d.dropId===hero.dropId);
  for(const [message,change] of [
   ['unit capacity status',(s:any)=>{progress(s).status='retained-terminal';}],
   ['unprocessed direct',(s:any)=>{progress(s).status='revealed';}],
   ['current resource fold',(s:any)=>{s.nextUnitSerial++;}],
   ['current resource fold',(s:any)=>{s.preparation.units=s.preparation.units.filter((u:any)=>u.id!==soldUnit.id);}]
  ] as const)reject(waiting,message,change);
  for(const [message,change] of [
   ['current settlement totals',(s:any)=>{s.gold=s.roundResults.at(-1).goldAfter;}],
   ['sale price',(s:any)=>{s.resourceProvenance.entries.at(-2).goldGranted++;s.gold++;}],
   ['preparation sale after settlement',(s:any)=>{s.resourceProvenance.entries.at(-2).context='preparation';}],
   ['direct receipt',(s:any)=>{progress(s).status='pending-capacity';progress(s).receiptId=null;}],
   ['sale before settlement',(s:any)=>{const e=s.resourceProvenance.entries,i=e.length-3;[e[i],e[i+1]]=[e[i+1],e[i]];e.forEach((x:any,n:number)=>{x.sequence=n;});}],
   ['combat settlement identity/uniqueness',(s:any)=>{const e=structuredClone(s.resourceProvenance.entries.find((e:any)=>e.kind==='combat-growth-committed'&&e.roundId==='3-7'));e.sequence=s.resourceProvenance.entries.length;s.resourceProvenance.entries.push(e);}]
  ] as const)reject(sold,message,change);
 });
});
// The consuming suite owns its prefix. Ordered hooks play one real round each,
// including when a lethal case is filtered or suites/tests are shuffled.
describe('B8 live lethal PvE with randomized orbs',()=>{
 for(let round=1;round<24;round++)beforeAll(async()=>{await advanceTerminalRoute(round);});
 beforeAll(async () => { await terminalPreparation('loris', 1); });
 // Seed 2253's terminal 4-7 after the xp/batch-3 merge: its new augments (blinding-speed) let a lone Loris at (0,7)
// clear all six razorbeaks, so the two-carrier case keeps Leona there instead (was Loris): it kills the same
// r01 rod and r02 reforger/gold carriers the pre-merge Loris did, then dies at 3 HP.
// v26 14.24 neutrals (568eeea4: five stronger razorbeaks) and targeting P0/P1: a lone Leona or Urgot no longer kills any
// razorbeak from any player cell. Loris at (0,4) kills the r01 rod and r02 reforger/gold carriers (2 deaths), and Loris at
// (0,7) kills only the rod carrier (1 death); both still die at 3 HP. (Were Leona (0,7) and Urgot (0,4).)
it.each([{name:'two killed carriers',keep:'loris',col:0,row:4,deaths:2,earned:true},{name:'only orb carrier killed',keep:'loris',col:0,row:7,deaths:1,earned:true},{name:'no carrier killed',keep:null,col:1,row:7,deaths:0,earned:false}])('$name: strict terminal restore cannot resurrect unearned loot',async scenario=>{
  const preparation=await terminalPreparation(scenario.keep,scenario.col,scenario.row),l=battle(preparation),s=l.ended;
  expect(preparation.playerHp).toBe(3);expect(preparation.roundResults.reduce((n,r)=>n+r.hpLost,0)).toBe(97);
  expect(s.phase).toBe('gameOver');expect(s.outcome).toBe('defeat');expect(s.playerHp).toBe(0);
  expect(s.combat!.neutralReceipts!.deaths).toHaveLength(scenario.deaths);
  expect(s.roundResults.at(-1)).toMatchObject({hpBefore:3,hpAfter:0,hpLost:3,result:'enemyWin'});
  const drops=plan(s).encounterPlan.drops,ids=new Set(drops.map(d=>d.dropId));
  const expected=independentLootPlan(preparation.seed,24).rounds.at(-1)!.encounterPlan.drops;
  const killed=new Set(s.combat!.neutralReceipts!.deaths.map(d=>d.unitId));
  expect(drops.map(d=>d.payload)).toEqual(expected.map(d=>d.payload));
  expect(s.m8.loot.direct.filter(d=>ids.has(d.dropId)).map(d=>d.status)).toEqual(expected.map(d=>!killed.has(d.sourceUnitId!)?'forfeited':d.payload.kind==='unit'?'retained-terminal':'granted'));
  expect(s.nextUnitSerial).toBe(preparation.nextUnitSerial);expect(s.preparation).toEqual(preparation.preparation);
  const earnedItems=expected.filter(d=>killed.has(d.sourceUnitId!)&&d.payload.kind==='item');
  expect(s.nextItemSerial).toBe(preparation.nextItemSerial+earnedItems.length);
  expect(s.m8.loot.choiceResolutions).toEqual([]);expect(s.pendingChoice).toBeNull();
  expect(l.events.filter(e=>e.type==='roundSettled')).toHaveLength(1);
  expect(l.events.filter(e=>e.type==='lootGranted')).toHaveLength(expected.filter(d=>killed.has(d.sourceUnitId!)&&d.payload.kind!=='unit').length);
  expect(s.scheduleReceipts).toEqual(preparation.scheduleReceipts);expect(s.m8.loot.frozen).toEqual(preparation.m8.loot.frozen);
  const hero=drops.find(d=>d.payload.kind==='unit')!;
  reject(s,killed.has(hero.sourceUnitId!)?'unit capacity status':'qualification evidence',x=>{x.m8.loot.direct.find((d:any)=>d.dropId===hero.dropId).status='pending-capacity';});
  reject(s,'actual guarantee counters',x=>{x.m8.loot.guaranteeCounters[Object.keys(x.m8.loot.guaranteeCounters).at(-1)!]++;});
  if(scenario.earned)reject(s,'frozen receipt payload',x=>{const r=x.m8.loot.receipts.find((r:any)=>r.dropId===earnedItems[0].dropId);r.payload.definitionId='sword';x.items.find((i:any)=>i.id===r.grantedItemIds[0]).definitionId='sword';});
  for(const x of [s,roundTrip(s)]){expect(api.stepMatch(x)).toEqual({state:x,events:[]});expect(api.nextRound(x,24)).toMatchObject({ok:false,reason:'wrong-phase'});expect(api.sellUnit(x,bench(x)[0].id)).toMatchObject({ok:false,reason:'wrong-phase'});}
 });
});
