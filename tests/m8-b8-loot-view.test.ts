import {lootPlan as independentLootPlan} from './fixtures/orb-combo-oracle.cjs';
import {beforeAll,describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import type {MatchState} from '../src/simulation/match';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {accepted,battle,bench,fillBench,plan,publicPrefix,terminalPreparation,configuredPrefix,reserveExcept,players,TERMINAL_EMPTY_BOARD_ROUNDS} from './fixtures/t13-loot-public';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
// v22: seed 10 draws the crab-rave opening (crabs carry the wolf orbs); v22's seed 2412 draws Prismatic Prelude
// under v23 fmix32. Seed 3155 has no opening encounter and the same 3-7 shape: one Akali sharing an orb with
// other entries, components and a full bench.
const prepared=fillBench(await publicPrefix('3-7',3155),['akali']),live=battle(prepared),frozen=plan(prepared);
const hero=frozen.encounterPlan.drops.find(d=>d.payload.kind==='unit')!;
function view(s:MatchState){const saved=serializeMatch(s),v=api.readLootView(s);expect(api.readLootView(s)).toEqual(v);expect(api.readLootView(restoreMatch(saved))).toEqual(v);expect(serializeMatch(s)).toBe(saved);
 expect(Object.isFrozen(v)&&Object.isFrozen(v.revealedDrops)&&Object.isFrozen(v.revealedOrbs)).toBe(true);
 // v22 exposes the unclaimed-orb pair whenever an orb is listed (see the mid-combat case); otherwise the set is unchanged.
 expect(Object.keys(v).sort()).toEqual(['canContinue','pendingChoice','pendingClaims','reason','revealedDrops','revealedOrbs','roundId',...(v.unclaimedOrbs?['claimReceipts','unclaimedOrbs']:[])].sort());
 for(const d of v.revealedDrops)expect(Object.keys(d).filter(k=>!['orbId','entryOrdinal','dropId','encounterId','sourceUnitId','roundId','payload','status','receiptId','allowedActions','reason'].includes(k))).toEqual([]);
 expect(api.nextRound(s,s.round).ok).toBe(v.canContinue);return v;}
function hiddenIndependent(s:MatchState,mutate:(s:any)=>void){const raw=JSON.parse(serializeMatch(s));mutate(raw);expect(api.readLootView(raw)).toEqual(api.readLootView(s));}
// The cannon driver now sells its early Maddie. Keep the original seed and
// acquire her as a real sniper-core unit instead. Every item/remover is earned
// on that route; two ordinary rod recipes and public equipment commands give
// the same two-carrier terminal control without killing the anvil carrier.
let terminalHero:MatchState;
async function prepareTerminalHero(){
 let s=reserveExcept(await configuredPrefix('4-7',{seed:2146,build:'sniper',
  emptyBoardRounds:[...TERMINAL_EMPTY_BOARD_ROUNDS,'4-7'],protectedUnitIds:[]}),[]);
 const holder=players(s).find(u=>u.definitionId==='maddie');if(!holder)throw Error('Missing earned Maddie');
 for(const unit of players(s).filter(u=>s.items.some(i=>i.location.kind==='unit'&&i.location.unitId===u.id))){
  const remover=s.consumables.find(c=>c.definitionId==='magnetic-remover');if(!remover)throw Error('Missing earned remover');
  s=accepted(api.useConsumable(s,remover.consumableId,{kind:'unit',unitId:unit.id}));
 }
 for(let recipe=0;recipe<2;recipe++){
  const rods=s.items.filter(i=>i.location.kind==='inventory'&&i.definitionId==='rod');
  if(rods.length<2)throw Error('Missing earned rods');s=accepted(api.combineItems(s,rods[0].id,rods[1].id));
 }
 for(const [slot,definitionId]of ['warmog','deathcap','statikk-shiv'].entries()){
  const item=s.items.find(i=>i.location.kind==='inventory'&&i.definitionId===definitionId);if(!item)throw Error(`Missing earned ${definitionId}`);
  s=accepted(api.equipItem(s,item.id,holder.id,slot));
 }
 s=accepted(api.deployMatchUnit(s,holder.id,{kind:'board',cell:{col:0,row:7}}));
 return fillBench(s,['ezreal']);
}
// Warm shared prefixes once; report each original 10 s callback separately.
async function warmTerminal(hero=false){
 const began=performance.now();
 try{if(hero)terminalHero=await prepareTerminalHero();else await terminalPreparation(null);}
 finally{console.info(`B8 terminal warmup ${hero?'hero':'default'}: ${performance.now()-began} ms`);}
}
beforeAll(async () => { await warmTerminal(); });
beforeAll(async () => { await warmTerminal(true); });
describe('B8 readLootView over real randomized public routes',()=>{
 it('exposes no future orb content and hidden payloads cannot leak before a death',()=>{
  const v=view(prepared);expect(v).toEqual({roundId:'3-7',revealedDrops:[],revealedOrbs:[],pendingClaims:[],canContinue:false,reason:'unsettled-round',pendingChoice:null});
  hiddenIndependent(prepared,s=>{for(const d of s.m8.loot.frozen.rounds.at(-1).encounterPlan.drops)d.payload={kind:'gold',quantity:99};});
  expect(view(live.started)).toEqual(v);
 });
 it('reveals only earned orb entries mid-combat, still without receipts or player actions',()=>{
  const s=live.revealed!,v=view(s);expect(s.phase).toBe('combat');expect(v.revealedDrops.length).toBeGreaterThan(0);
  expect(v.revealedDrops.map(d=>d.dropId)).toEqual(s.m8.loot.direct.filter(d=>d.status==='revealed').map(d=>d.dropId));
  for(const d of v.revealedDrops){const p=frozen.orbs.flatMap(o=>o.entries).find(p=>p.dropId===d.dropId)!;
   expect(d).toEqual({orbId:p.orbId,entryOrdinal:p.entryOrdinal,dropId:p.dropId,encounterId:p.encounterId,sourceUnitId:p.sourceUnitId,roundId:'3-7',payload:p.payload,status:'revealed',receiptId:null,allowedActions:[],reason:'auto-grant-in-domain'});
   expect(api.readEncounterPreview(s)!.units.filter(u=>u.unitId===d.sourceUnitId)).toHaveLength(1);
  }
  expect(v.revealedOrbs.map(o=>o.orbId)).toEqual([...new Set(v.revealedDrops.map(d=>d.orbId))]);
  // v22 lists the earned orb as unclaimed while it waits for settlement. In single player it is still granted
  // by the domain: no claim receipt exists and claimOrb is refused. The online claim flow for these same orbs
  // is covered by tests/t5r-loot-view.test.ts ('shows real shared-pool shortage compensation...' and
  // 'shows an unclaimed full-bench orb at deadline...').
  expect(v.unclaimedOrbs!.map(o=>o.orbId)).toEqual(v.revealedOrbs.map(o=>o.orbId));
  expect(v.claimReceipts).toEqual([]);
  for(const orb of v.unclaimedOrbs!)expect(api.claimOrb(s,orb.orbId,s.round)).toEqual({ok:false,state:s,reason:'multiplayer-required'});
 });
 it('after PvE grants item/tool entries and withholds the full-bench hero, with no obsolete choice',()=>{
  const v=view(live.ended);expect(live.ended.phase).toBe('settlement');expect(v.pendingChoice).toBeNull();
  expect(v).toMatchObject({canContinue:false,reason:'pending-capacity',pendingClaims:[hero.dropId]});
  expect(v.revealedDrops.map(d=>d.status)).toEqual(frozen.encounterPlan.drops.map(d=>d.payload.kind==='unit'?'pending-capacity':'granted'));
  for(const d of v.revealedDrops){const r=live.ended.m8.loot.receipts.find(r=>r.dropId===d.dropId);expect(d.receiptId).toBe(r?.receiptId??null);}
  expect(v.revealedOrbs.some(o=>o.status==='partially-claimed')).toBe(true);
 });
 it('one real sale grants the hero and unblocks Continue, while the next round clears the view',()=>{
  const s=accepted(api.sellUnit(live.ended,bench(live.ended)[0].id)),v=view(s);
  expect(v).toMatchObject({canContinue:true,reason:null,pendingClaims:[],pendingChoice:null});
  expect(v.revealedDrops.map(d=>d.status)).toEqual(Array(frozen.encounterPlan.drops.length).fill('granted'));
  const ids=new Set(frozen.encounterPlan.drops.map(d=>d.dropId));expect(v.revealedDrops.map(d=>d.receiptId).sort()).toEqual(s.m8.loot.receipts.filter(r=>ids.has(r.dropId)).map(r=>r.receiptId).sort());
  const next=accepted(api.nextRound(s,17));expect(view(next).revealedDrops).toEqual([]);expect(view(next).revealedOrbs).toEqual([]);
 });
 // v25: the same seed-2146 sniper route retains Maddie; earned equipment at
 // (0,7) kills r01/r03 and leaves the first-orb anvil unearned.
// Tool carrier: Leona (was Loris) at (0,7). After the xp/batch-3 merge seed 2253's augments let a lone Loris there
// clear all six razorbeaks; Leona kills the same r01 rod and r02 reforger carriers and dies.
 it.each([{name:'two source deaths including a hero',keep:'maddie',col:0,row:7,deaths:2,seed:2146},{name:'only component carrier',keep:'urgot',col:0,row:4,deaths:1},{name:'tool carrier',keep:'leona',col:0,row:7,deaths:2},{name:'no carrier',keep:null,col:1,row:7,deaths:0}])('terminal $name: retained reward is read-only and unearned content stays hidden',async({keep,col,row,deaths,seed})=>{
  const prep=seed===2146?terminalHero:await terminalPreparation(keep,col,row,seed);
  if(seed===2146){expect(prep.playerHp).toBe(3);expect(bench(prep)).toHaveLength(9);expect(players(prep).find(u=>u.definitionId===keep)!.location).toEqual({kind:'board',cell:{col,row}});}
  const terminal=battle(prep),s=terminal.ended,v=view(s);expect(s.phase).toBe('gameOver');
  expect(s.combat!.neutralReceipts!.deaths).toHaveLength(deaths);
  expect(v).toMatchObject({canContinue:false,reason:'game-over',pendingClaims:[],pendingChoice:null});
  const killed=new Set(s.combat!.neutralReceipts!.deaths.map(d=>d.unitId));
  const expected=independentLootPlan(s.seed,24).rounds.at(-1)!.encounterPlan.drops.filter(d=>killed.has(d.sourceUnitId!));
  if(seed===2146)expect(expected.some(d=>d.payload.kind==='unit')).toBe(true);
  expect(v.revealedDrops.map(d=>d.payload)).toEqual(expected.map(d=>d.payload));
  expect(v.revealedDrops.map(d=>d.status)).toEqual(expected.map(d=>d.payload.kind==='unit'?'retained-terminal':'granted'));
  for(const d of v.revealedDrops)if(d.payload.kind==='unit')expect(d).toMatchObject({status:'retained-terminal',receiptId:null,reason:'terminal-bench-full'});
  const bonus=v.revealedDrops.find(d=>d.payload.kind==='consumable');
  if(bonus){
   expect(bonus.payload).toEqual({kind:'consumable',definitionId:'reforger',quantity:1});expect(bonus.entryOrdinal).toBe(1);
   const receipts=s.m8.loot.receipts.filter(r=>r.dropId===bonus.dropId);expect(receipts).toHaveLength(1);expect(bonus.receiptId).toBe(receipts[0].receiptId);
   expect(receipts[0].grantedConsumableIds).toHaveLength(1);
   expect(s.consumables.filter(c=>c.consumableId===receipts[0].grantedConsumableIds![0])).toEqual([{consumableId:receipts[0].grantedConsumableIds![0],definitionId:'reforger'}]);
   expect(terminal.events.filter(e=>e.type==='lootGranted'&&e.receipt.dropId===bonus.dropId)).toHaveLength(1);
   const corrupted=JSON.parse(serializeMatch(s));corrupted.m8.loot.receipts.push(receipts[0]);expect(()=>restoreMatch(corrupted)).toThrow();
  }
  const restored=restoreMatch(serializeMatch(s));expect(api.stepMatch(restored)).toEqual({state:restored,events:[]});expect(api.nextRound(restored,restored.round)).toEqual({ok:false,state:restored,reason:'wrong-phase'});
  expect(v.revealedDrops.every(d=>d.allowedActions.length===0)).toBe(true);
  if(!deaths)hiddenIndependent(s,raw=>{for(const d of raw.m8.loot.frozen.rounds.at(-1).encounterPlan.drops)d.payload={kind:'gold',quantity:99};});
 });
});
