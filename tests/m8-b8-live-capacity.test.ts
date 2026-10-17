import {beforeAll,describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import type {MatchState} from '../src/simulation/match';
import {restoreWithEvidence as restoreMatch,serializeWithEvidence as serializeMatch} from './fixtures/history-evidence';
import {getUnitSellPrice} from '../src/simulation/unit-stats';
import {accepted,battle,bench,fillBench,plan,publicPrefix,terminalPreparation} from './fixtures/t13-loot-public';
const prepared=fillBench(await publicPrefix('3-7',36),['tristana']),live=battle(prepared),waiting=live.ended;
const hero=plan(prepared).encounterPlan.drops.find(d=>d.payload.kind==='unit')!;
const soldUnit=bench(waiting)[0];
function roundTrip(s:MatchState){const saved=serializeMatch(s),r=restoreMatch(saved);expect(r).toEqual(s);expect(r).not.toBe(s);expect(serializeMatch(s)).toBe(saved);return r;}
function command(s:MatchState,f:(s:MatchState)=>api.MatchCommandResult){const saved=serializeMatch(s),a=f(s),b=f(roundTrip(s));expect(b).toEqual(a);expect(serializeMatch(s)).toBe(saved);if(!a.ok)expect(a.state).toBe(s);return a;}
function reject(s:MatchState,message:string,change:(s:any)=>void){const saved=serializeMatch(s),bad=JSON.parse(saved);change(bad);expect(()=>restoreMatch(bad)).toThrow(message);expect(serializeMatch(s)).toBe(saved);}
const soldResult=command(waiting,s=>api.sellUnit(s,soldUnit.id)),sold=accepted(soldResult);
describe('B8 live full-bench settlement and exact command resumption',()=>{
 it('earns a non-merging hero at nine capacity without receipt or unit ID consumption',()=>{
  expect(prepared.gold).toBe(18);expect(bench(prepared)).toHaveLength(9);
  expect(hero.payload).toEqual({kind:'unit',definitionId:'tristana',quantity:1});
  expect(waiting.phase).toBe('settlement');expect(waiting.pendingChoice).toBeNull();
  expect(live.revealed!.combat!.tick).toBe(117);expect(waiting.combat!.tick).toBe(137);
  expect(waiting.m8.loot.direct.find(d=>d.dropId===hero.dropId)).toEqual({dropId:hero.dropId,status:'pending-capacity',receiptId:null});
  expect(waiting.m8.loot.receipts.some(r=>r.dropId===hero.dropId)).toBe(false);
  expect(waiting.nextUnitSerial).toBe(prepared.nextUnitSerial);expect(waiting.preparation).toEqual(prepared.preparation);
  expect(waiting.nextItemSerial).toBe(prepared.nextItemSerial+2);
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
// The lethal cases share the same full public campaign prefix.
beforeAll(async () => { await terminalPreparation('loris', 1); });
describe('B8 live lethal PvE with randomized orbs',()=>{
 it.each([{name:'two killed carriers',keep:'loris',col:1,row:6,deaths:2,earned:true},{name:'only orb carrier killed',keep:'loris',col:1,row:7,deaths:1,earned:true},{name:'no carrier killed',keep:null,col:1,row:7,deaths:0,earned:false}])('$name: strict terminal restore cannot resurrect unearned loot',async scenario=>{
  const preparation=await terminalPreparation(scenario.keep,scenario.col,scenario.row),l=battle(preparation),s=l.ended;
  expect(preparation.playerHp).toBe(3);expect(preparation.roundResults.reduce((n,r)=>n+r.hpLost,0)).toBe(97);
  expect(s.phase).toBe('gameOver');expect(s.outcome).toBe('defeat');expect(s.playerHp).toBe(0);
  expect(s.combat!.neutralReceipts!.deaths).toHaveLength(scenario.deaths);
  expect(s.roundResults.at(-1)).toMatchObject({hpBefore:3,hpAfter:0,hpLost:3,result:'enemyWin'});
  const drops=plan(s).encounterPlan.drops,ids=new Set(drops.map(d=>d.dropId));
  expect(s.m8.loot.direct.filter(d=>ids.has(d.dropId)).map(d=>d.status)).toEqual(scenario.earned?['granted','granted','retained-terminal','granted']:Array(4).fill('forfeited'));
  expect(s.nextUnitSerial).toBe(preparation.nextUnitSerial);expect(s.preparation).toEqual(preparation.preparation);
  expect(s.nextItemSerial).toBe(preparation.nextItemSerial+(scenario.earned?2:0));
  expect(s.m8.loot.choiceResolutions).toEqual([]);expect(s.pendingChoice).toBeNull();
  expect(l.events.filter(e=>e.type==='roundSettled')).toHaveLength(1);
  expect(l.events.filter(e=>e.type==='lootGranted')).toHaveLength(scenario.earned?3:0);
  expect(s.scheduleReceipts).toEqual(preparation.scheduleReceipts);expect(s.m8.loot.frozen).toEqual(preparation.m8.loot.frozen);
  const hero=drops.find(d=>d.payload.kind==='unit')!;
  reject(s,scenario.earned?'unit capacity status':'qualification evidence',x=>{x.m8.loot.direct.find((d:any)=>d.dropId===hero.dropId).status='pending-capacity';});
  reject(s,'actual guarantee counters',x=>{x.m8.loot.guaranteeCounters[Object.keys(x.m8.loot.guaranteeCounters).at(-1)!]++;});
  if(scenario.earned)reject(s,'frozen receipt payload',x=>{const r=x.m8.loot.receipts.find((r:any)=>r.dropId===drops[0].dropId);r.payload.definitionId='sword';x.items.find((i:any)=>i.id===r.grantedItemIds[0]).definitionId='sword';});
  for(const x of [s,roundTrip(s)]){expect(api.stepMatch(x)).toEqual({state:x,events:[]});expect(api.nextRound(x,24)).toMatchObject({ok:false,reason:'wrong-phase'});expect(api.sellUnit(x,bench(x)[0].id)).toMatchObject({ok:false,reason:'wrong-phase'});}
 });
});
