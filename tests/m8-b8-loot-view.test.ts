import {beforeAll,describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import type {MatchState} from '../src/simulation/match';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {accepted,battle,bench,fillBench,plan,publicPrefix,terminalPreparation} from './fixtures/t13-loot-public';
const prepared=fillBench(await publicPrefix('3-7',36),['tristana']),live=battle(prepared),frozen=plan(prepared);
const hero=frozen.encounterPlan.drops.find(d=>d.payload.kind==='unit')!;
function view(s:MatchState){const saved=serializeMatch(s),v=api.readLootView(s);expect(api.readLootView(s)).toEqual(v);expect(api.readLootView(restoreMatch(saved))).toEqual(v);expect(serializeMatch(s)).toBe(saved);
 expect(Object.isFrozen(v)&&Object.isFrozen(v.revealedDrops)&&Object.isFrozen(v.revealedOrbs)).toBe(true);
 expect(Object.keys(v).sort()).toEqual(['canContinue','pendingChoice','pendingClaims','reason','revealedDrops','revealedOrbs','roundId']);
 for(const d of v.revealedDrops)expect(Object.keys(d).filter(k=>!['orbId','entryOrdinal','dropId','encounterId','sourceUnitId','roundId','payload','status','receiptId','allowedActions','reason'].includes(k))).toEqual([]);
 expect(api.nextRound(s,s.round).ok).toBe(v.canContinue);return v;}
function hiddenIndependent(s:MatchState,mutate:(s:any)=>void){const raw=JSON.parse(serializeMatch(s));mutate(raw);expect(api.readLootView(raw)).toEqual(api.readLootView(s));}
beforeAll(async () => { await terminalPreparation('loris', 1); });
beforeAll(async () => { await terminalPreparation('rell', 1); });
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
 });
 it('after PvE grants item/tool entries and withholds the full-bench hero, with no obsolete choice',()=>{
  const v=view(live.ended);expect(live.ended.phase).toBe('settlement');expect(v.pendingChoice).toBeNull();
  expect(v).toMatchObject({canContinue:false,reason:'pending-capacity',pendingClaims:[hero.dropId]});
  expect(v.revealedDrops.map(d=>d.status)).toEqual(['granted','granted','pending-capacity','granted']);
  for(const d of v.revealedDrops){const r=live.ended.m8.loot.receipts.find(r=>r.dropId===d.dropId);expect(d.receiptId).toBe(r?.receiptId??null);}
  expect(v.revealedOrbs.some(o=>o.status==='partially-claimed')).toBe(true);
 });
 it('one real sale grants the hero and unblocks Continue, while the next round clears the view',()=>{
  const s=accepted(api.sellUnit(live.ended,bench(live.ended)[0].id)),v=view(s);
  expect(v).toMatchObject({canContinue:true,reason:null,pendingClaims:[],pendingChoice:null});
  expect(v.revealedDrops.map(d=>d.status)).toEqual(Array(4).fill('granted'));
  const ids=new Set(frozen.encounterPlan.drops.map(d=>d.dropId));expect(v.revealedDrops.map(d=>d.receiptId).sort()).toEqual(s.m8.loot.receipts.filter(r=>ids.has(r.dropId)).map(r=>r.receiptId).sort());
  const next=accepted(api.nextRound(s,17));expect(view(next).revealedDrops).toEqual([]);expect(view(next).revealedOrbs).toEqual([]);
 });
 it.each([{name:'two source deaths',keep:'loris',row:6,earned:true},{name:'only orb carrier',keep:'loris',row:7,earned:true},{name:'no carrier',keep:null,row:7,earned:false}])('terminal $name: retained reward is read-only and unearned content stays hidden',async({keep,row,earned})=>{
  const s=battle(await terminalPreparation(keep,1,row)).ended,v=view(s);expect(s.phase).toBe('gameOver');
  expect(v).toMatchObject({canContinue:false,reason:'game-over',pendingClaims:[],pendingChoice:null});
  expect(v.revealedDrops.map(d=>d.status)).toEqual(earned?['granted','granted','retained-terminal','granted']:[]);
  expect(v.revealedDrops.every(d=>d.allowedActions.length===0)).toBe(true);
  if(earned)expect(v.revealedDrops.find(d=>d.payload.kind==='unit')).toMatchObject({status:'retained-terminal',receiptId:null,reason:'terminal-bench-full'});
  else hiddenIndependent(s,raw=>{for(const d of raw.m8.loot.frozen.rounds.at(-1).encounterPlan.drops)d.payload={kind:'gold',quantity:99};});
 });
});
