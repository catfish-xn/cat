import { canonicalContent } from '../src/simulation/content';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { selectChoice, buyXp, buyUnit, rerollShop, sellUnit, deployMatchUnit, setShopLock, startMatchCombat, nextRound, type MatchState } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { trackerActiveTraits, trackerGiftPlan, completeTraitTrackerCommand } from '../src/simulation/augment-pool-batch5-h10-tracker';
import { historyRoster } from '../src/simulation/augment-history';
import { AUGMENT_BATCH5_H10 } from '../src/simulation/content/augment-pool-batch5-h10';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { accepted, resolveM5Choices, finish, reachRound } from './match-helpers';
import type { HistoryRoster } from '../src/simulation/augment-history-types';

/** v25 batch-5 pool drift: seed 73 at 3-2 (re-searched 0..100). */
function offerTraitTracker(): MatchState {
 let state=reachRound('3-2',false,73);
 expect(state.pendingChoice!.offers).toContain('trait-tracker');
 return state;
}
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
const { rewardPlan } = createRequire(import.meta.url)('./fixtures/m5/augment-rewards-oracle.cjs');
const TARGET=['draven','gangplank','maddie','nami','steb','swain','trundle'];
let acquired:MatchState, state:MatchState, triggered:MatchState, beforeTrigger:MatchState;
let rewardEvents:readonly unknown[];
beforeAll(()=>{
 const s=offerTraitTracker(),c=s.pendingChoice!;expect(c.offers).toContain('trait-tracker');
 acquired=state=accepted(selectChoice(s,c.choiceId,c.generation,'trait-tracker'));
});
function prepare(s:MatchState,allowTrigger=true):MatchState {
 for(const u of s.preparation.units.filter(u=>u.team==='player'&&!TARGET.includes(u.definitionId)))s=accepted(sellUnit(s,u.id));
 for(let roll=0;roll<30;roll++){
  for(let i=0;i<5;i++){const o=s.shop.slots[i];if(o.status==='available'&&TARGET.includes(o.definitionId)&&!s.preparation.units.some(u=>u.team==='player'&&u.definitionId===o.definitionId)){const r=buyUnit(s,i,s.shop.generation);if(r.ok)s=r.state;}}
  if(s.preparation.units.filter(u=>u.team==='player').length>=(allowTrigger?7:6)||s.gold<12)break;
  s=accepted(rerollShop(s));
 }
 if(allowTrigger&&s.preparation.units.filter(u=>u.team==='player').length===7)
  while(s.level<7&&s.gold>=4)s=accepted(buyXp(s));
 for(const u of s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench')){
  const used=new Set(s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').map(u=>u.location.kind==='board'?`${u.location.cell.col},${u.location.cell.row}`:''));
  if(used.size>=s.level)break;
  const cell=Array.from({length:28},(_,i)=>({col:i%7,row:4+Math.floor(i/7)})).find(c=>!used.has(`${c.col},${c.row}`))!;
  const before=s,r=deployMatchUnit(s,u.id,{kind:'board',cell});s=accepted(r);
  if(!before.augmentHistory!.facts.some(f=>f.kind==='trait-activation')&&s.augmentHistory!.facts.some(f=>f.kind==='trait-activation')){beforeTrigger=before;triggered=s;if(r.ok)rewardEvents=r.events;}
 }
 return s;
}
beforeAll(()=>{state=prepare(state,false);expect(trackerGiftPlan(state)).toHaveLength(0);});
beforeAll(()=>{state=accepted(nextRound(resolveM5Choices(finish(accepted(startMatchCombat(state)))),state.round));});
beforeAll(()=>{state=prepare(state);});
for(let leg=0;leg<8;leg++)beforeAll(()=>{
 if(triggered)return;
 state=resolveM5Choices(state);
 if(state.phase==='preparation')state=resolveM5Choices(finish(accepted(startMatchCombat(state))));
 state=resolveM5Choices(accepted(nextRound(state,state.round)));
 if(state.phase==='preparation')state=prepare(state);
});
beforeAll(()=>{expect(triggered,JSON.stringify({round:state.round,level:state.level,gold:state.gold,units:state.preparation.units.map(u=>[u.definitionId,u.location]),traits:trackerActiveTraits(historyRoster(state))})).toBeDefined();});

it.skipIf(!existsSync(RESEARCH_FILE))('matches source 8 traits / 6 emblems',()=>{
 const row=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_TraitTracker');
 expect(AUGMENT_BATCH5_H10['trait-tracker'].source.values).toEqual(row.effects);
});
it('offers only gold 3-2, and respects source exclusions',()=>{
 for(const node of ['2-1','3-2','4-2'])for(const tier of ['silver','gold','prismatic'] as const)
  expect(augmentCandidates(tier,[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('trait-tracker')).toBe(tier==='gold'&&node==='3-2');
 for(const definitionId of ['built-different','flexible'])expect(augmentCandidates('gold',[{definitionId,choiceId:'old',acquiredRound:4}],[],null,{node:'3-2',fieldedTraits:[],blocked:[]})).not.toContain('trait-tracker');
});
it('uses distinct fielded definitions, equipped emblems, and excludes unique traits; Emissary counts',()=>{
 const roster=(ids:string[]):HistoryRoster=>({units:ids.map((definitionId,i)=>({id:`unit-${i+1}`,definitionId,team:'player',starLevel:1,location:{kind:'board',cell:{col:i%7,row:4+Math.floor(i/7)}}})),items:[]});
 expect(trackerActiveTraits(roster(TARGET))).toHaveLength(8);
 expect(trackerActiveTraits(roster(TARGET))).toContain('emissary');
 expect(trackerActiveTraits(roster(['rumble','mel','warwick','viktor','jayce']))).not.toEqual(expect.arrayContaining(['junker-king']));
 expect(trackerActiveTraits(roster(['draven','draven']))).not.toContain('conqueror');
 const one=roster(['draven','steb']);
 const emblem={id:'item-1',definitionId:'TFT13_Item_WarbandEmblemItem',location:{kind:'unit' as const,unitId:'unit-2',slot:0}};
 expect(trackerActiveTraits({...one,items:[emblem]})).toContain('conqueror');
 expect(trackerActiveTraits({...one,items:[{...emblem,location:{kind:'inventory'}}]})).not.toContain('conqueror');
});
it('real buy/XP/roll/deploy commands award exactly six distinct emblems at first activation, emit all receipts, and never repeat',()=>{
 expect(trackerGiftPlan(beforeTrigger)).toHaveLength(0);
 expect(trackerActiveTraits(historyRoster(beforeTrigger)).length).toBeLessThan(8);
 const gifts=trackerGiftPlan(triggered);expect(gifts).toHaveLength(6);expect(new Set(gifts.map(g=>g.definitionId)).size).toBe(6);
 expect(Object.keys(EMBLEM_ITEMS)).toHaveLength(22);
 expect(gifts.every(g=>Object.hasOwn(EMBLEM_ITEMS,g.definitionId))).toBe(true);
 expect(triggered.items.length-beforeTrigger.items.length).toBe(6);
 expect(triggered.resourceProvenance.entries.length-beforeTrigger.resourceProvenance.entries.length).toBe(6);
 expect(triggered.augmentHistory!.facts.filter(f=>f.kind==='trait-activation')).toHaveLength(1);
 expect(rewardEvents.filter((e:any)=>e.type==='mechanicGranted')).toHaveLength(6);
 expect(triggered.rngState).toBe(beforeTrigger.rngState);expect(triggered.choiceRngState).toBe(beforeTrigger.choiceRngState);
 const repeated=accepted(setShopLock(triggered,!triggered.shop.locked,triggered.shop.generation));expect(repeated.items).toEqual(triggered.items);expect(trackerGiftPlan(repeated)).toEqual(gifts);
 const failed=deployMatchUnit(beforeTrigger,'absent',{kind:'bench',slot:0});expect(failed.ok).toBe(false);expect(failed.state).toBe(beforeTrigger);expect('events' in failed).toBe(false);
 // Grants are preparation-only even if a battle or deadline auto-deploy produces an eight-trait roster.
 const synthetic={...triggered,augmentHistory:{...triggered.augmentHistory!,facts:triggered.augmentHistory!.facts.filter(f=>f.kind!=='trait-activation')}};
 for(const name of ['nextRound','advanceMultiplayerRound','autoDeployToCap','lockMatchCombatRoster','startMatchCombat','stepMatch'])expect(completeTraitTrackerCommand(name,synthetic)).toEqual({state:synthetic,events:[]});
 expect(completeTraitTrackerCommand('equipItem',{...synthetic,phase:'settlement'} as MatchState).events).toEqual([]);
});
it('matches the independent integer reward oracle and never filters already held emblems',()=>{
 const owner=triggered.augments.find(a=>a.definitionId==='trait-tracker')!;
 for(const seed of [0,1,17,39,100]){
  const state={...triggered,seed,augments:[owner]};
  const plan=trackerGiftPlan(state),oracle=rewardPlan(state,{}).gifts;
  expect(plan.map(g=>[g.receiptId,g.definitionId,g.acquiredRound])).toEqual(oracle.map((g:any)=>[g.receiptId,g.definitionId,g.acquiredRound]));
  expect(trackerGiftPlan({...state,items:[]})).toEqual(plan);
 }
});
const entries=['object','JSON','serialized'] as const;
function restore(s:MatchState,entry:typeof entries[number]) {return restoreMatch(entry==='object'?s:entry==='JSON'?JSON.stringify(s):serializeMatch(s));}
for(const entry of entries)describe(entry,()=>{
 for(const get of [()=>acquired,()=>beforeTrigger,()=>triggered])it('round trips pending/completed history',()=>{const s=get();expect(restore(s,entry)).toEqual(s);});
 it('preserves exactly-once continuation',()=>{
  expect(setShopLock(restore(triggered,entry),true,triggered.shop.generation)).toEqual(setShopLock(triggered,true,triggered.shop.generation));
 });
 for(const [name,edit] of [
  ['missing section',(s:any)=>{delete s.augmentHistory;}],
  ['wrong version',(s:any)=>{s.augmentHistory.version='v0';}],
  ['missing threshold fact',(s:any)=>{s.augmentHistory.facts=s.augmentHistory.facts.filter((f:any)=>f.kind!=='trait-activation');s.augmentHistory.facts.forEach((f:any,i:number)=>f.sequence=i);}],
  ['duplicate threshold',(s:any)=>{s.augmentHistory.facts.push({...s.augmentHistory.facts.find((f:any)=>f.kind==='trait-activation'),sequence:s.augmentHistory.facts.length});}],
  ['wrong owner',(s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='trait-activation').choiceId='invented';}],
  ['counterfeit roster',(s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='trait-activation').roster.units[0].location={kind:'bench',slot:8};}],
  ['removed reward',(s:any)=>{s.seatMechanics.receipts.pop();}],
  ['replaced reward',(s:any)=>{s.seatMechanics.receipts.at(-1).definitionId='sword';}],
  ['removed command',(s:any)=>{s.augmentHistory.proof.commands.pop();}],
 ] as const)it(`rejects ${name}`,()=>{const bad=entry==='serialized'?JSON.parse(serializeMatch(triggered)):structuredClone(triggered);edit(bad);expect(()=>restoreMatch(entry==='object'?bad:entry==='JSON'?JSON.stringify(bad):canonicalContent(bad))).toThrow();});
});
