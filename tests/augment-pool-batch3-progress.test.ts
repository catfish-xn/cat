import { firstNodeSeed } from './augment-stage-helpers';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { needsCrownHistory } from '../src/simulation/crown-history';
import { createMatch, nextRound, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import { batch1GiftPlan, drainBatch1Gifts, validateBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { batch3RewardPlan, drainBatch3Gold, validateBatch3Gold } from '../src/simulation/augment-pool-batch3-progress';
import { g23BattleFacts } from '../src/simulation/g2-3-settlement';
import { advanceG23Economy, validateG23BattleFacts } from '../src/simulation/g2-3-economy';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { createCombatWithEvents } from '../src/simulation/combat';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { BattleHistory } from '../src/replay/history';
import { recordCommand, recordedEmptyRoute } from './fixtures/recorded-empty-route';
import { accepted, fieldBench, resolveM5Choices } from './match-helpers';

// The reward restore validator is tested separately from resource-provenance admission:
// these explicit upgrade facts isolate all four provenance envelopes without inventing shop history.
it.each(['unit-upgraded','unit-upgraded-after-combat','carousel-unit-claimed','carousel-preparation-settled'] as const)('Adventure: %s completes the second distinct 3-star, pays next entry and survives reward restoration once',kind=>{
 let s:MatchState={...createMatch(42),round:4,roundDefinitionId:'2-1',augments:[{definitionId:'an-exalted-adventure',choiceId:'test',acquiredRound:4}]};
 const defs=batch1GiftPlan(s).filter(g=>g.kind==='unit').map(g=>g.definitionId);
 s=drainBatch1Gifts(s);
 const event=(definitionId:string)=>({type:'unitUpgraded' as const,survivorId:'q',consumedIds:['a','b'],definitionId,fromStar:2 as const,toStar:3 as const,location:{kind:'bench' as const,slot:0}});
 const add=(fact:object,roundId:string)=>{s={...s,resourceProvenance:{...s.resourceProvenance,entries:[...s.resourceProvenance.entries,{...fact,roundId,sequence:s.resourceProvenance.entries.length} as any]}};};
 add({kind:'unit-upgraded-after-combat',event:event(defs[0])},'2-2');
 // Duplicate completion of champion #1 cannot finish a two-champion quest.
 add({kind:'carousel-unit-claimed',unitId:'duplicate',receiptId:'dup',upgrades:[event(defs[0])]},'2-4');
 s={...s,round:getMultiplayerRoundById('2-4').ordinal,roundDefinitionId:'2-4'};
 expect(batch3RewardPlan(s)).toEqual([]);
 add(kind==='unit-upgraded'?{kind,acquisitionSequence:0,event:event(defs[1])}:kind==='unit-upgraded-after-combat'?{kind,event:event(defs[1])}:kind==='carousel-unit-claimed'?{kind,unitId:'claim',receiptId:'claim',upgrades:[event(defs[1])]}:{kind,receiptIds:['claim'],claimedUnitIds:['claim'],upgrades:[event(defs[1])]},'2-4');
 expect(batch3RewardPlan(s)).toEqual([]);
 s={...s,round:getMultiplayerRoundById('2-5').ordinal,roundDefinitionId:'2-5'};
 const plan=batch3RewardPlan(s);expect(plan.length).toBeGreaterThan(0);
 expect(plan.every(g=>g.acquiredRound===s.round)).toBe(true);
 const paid=drainBatch1Gifts(s);expect(paid.seatMechanics!.receipts.length).toBeGreaterThan(s.seatMechanics!.receipts.length);
 validateBatch1Gifts(paid);
 const restored=JSON.parse(JSON.stringify(paid)) as MatchState;
 validateBatch1Gifts(restored);expect(drainBatch1Gifts(restored)).toBe(restored);
 expect(drainBatch1Gifts(paid)).toBe(paid);
 const unpaid=JSON.parse(JSON.stringify(s)) as MatchState;
 expect(()=>validateBatch1Gifts(unpaid)).toThrow();
 expect(drainBatch1Gifts(unpaid)).toEqual(paid);
});

// Hand-authored authoritative terminal projection, with neutral PvE and exclusion controls.
function kills(kind:'pve'|'pvp',round:number,n:number,ownsSpoils=true,team:'player'|'enemy'='player'){
 const m={...resolveM5Choices(createMatch(42)),augments:ownsSpoils?[{definitionId:'spoils-of-war-i',choiceId:'test',acquiredRound:1}]:[]},base=m.preparation.units[0];
 const enemies=Array.from({length:n},(_,i)=>({...base,id:'victim'+i,definitionId:'vex',team:'enemy' as const,location:{kind:'board' as const,cell:{col:i%7,row:Math.floor(i/7)}}}));
 const prep={...m.preparation,units:[{...base,location:{kind:'board' as const,cell:{col:0,row:7}}},...enemies]};
 const c=createCombatWithEvents(prep,buildStrategySnapshot({...m,preparation:prep}),'battle-'+round,42).state;
 const units=[...c.units.map((u,i)=>u.team==='enemy'?{...u,definitionId:kind==='pve'?(i%2?'pve-wolf-small':'pve-krug'):u.definitionId,unitKind:kind==='pve'?'neutral' as const:u.unitKind}:u),
  {...c.units[1],id:'item',itemSummon:{} as never},{...c.units[1],id:'anomaly',anomalySummon:{} as never},{...c.units[1],id:'spawned'},
  {...c.units[1],id:'summon',definitionId:'training-dummy'}];
 const opening=[...prep.units,{...enemies[0],id:'item'},{...enemies[0],id:'anomaly'},{...enemies[0],id:'summon'}];
 return g23BattleFacts({...c,units,result:'draw',openingDeaths:units.map((u,i)=>({unitId:u.id,eventSeq:i+1}))},team,round,kind,opening);
}
it('Spoils dedicated facts count krugs/wolves and PvP, excluding allies/summons/spawns; old openingDeaths stays crab-only',()=>{
 const pve=kills('pve',1,2),pvp=kills('pvp',2,3);
 expect(pve.openingDeaths).toEqual([]);
 expect(pve.batch2).toEqual([{definitionId:'spoils-of-war',count:2}]);
 expect(pvp.openingDeaths).toHaveLength(3);expect(pvp.batch2).toEqual([{definitionId:'spoils-of-war',count:3}]);
 validateG23BattleFacts(pve);validateG23BattleFacts(pvp);
 for(const count of [-1,1.5,NaN,100001])expect(()=>validateG23BattleFacts({...pve,batch2:[{definitionId:'spoils-of-war',count}]})).toThrow();
 expect(()=>validateG23BattleFacts({...pve,batch2:[...pve.batch2!,...pve.batch2!]})).toThrow();
});
it('seats without Spoils emit no kill fact for PvE or PvP deaths',()=>{
 expect(kills('pve',1,2,false).batch2).toBeUndefined();
 expect(kills('pvp',2,3,false).batch2).toBeUndefined();
 expect(kills('pvp',2,3,true,'enemy').batch2).toBeUndefined();
});
it('Spoils uses one continuous ordinal across PvE/PvP and reward restoration; modified/missing rewards fail authentication',()=>{
 const initial:MatchState={...createMatch(42),augments:[{definitionId:'spoils-of-war-iii',choiceId:'test',acquiredRound:1}]};
 const run=(parts:readonly (readonly ['pve'|'pvp',number])[],restore:boolean)=>{
  let s=initial;
  for(const [i,[kind,n]] of parts.entries()){
   s=writeG23Progress({...s,round:i+1},advanceG23Economy(readG23Progress(s)!,kills(kind,i+1,n)).progress);
   s=drainBatch3Gold(s);validateBatch3Gold(s);
   if(restore){s=JSON.parse(JSON.stringify(s));validateBatch3Gold(s);expect(drainBatch3Gold(s)).toBe(s);}
  }
  return s;
 };
 const split=run([['pve',2],['pvp',3],['pve',2],['pvp',3]],true),flat=run([['pvp',10]],false);
 const drops=(s:MatchState)=>s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch3').map(r=>[r.receiptId,r.kind==='gold'?r.amount:0]);
 expect(drops(split)).toEqual(drops(flat));expect(drops(split).length).toBeGreaterThan(0);
 const bad=structuredClone(split) as any;bad.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch3').amount++;
 expect(()=>validateBatch3Gold(bad)).toThrow();
 const progress=readG23Progress(split)!;
 const changed=writeG23Progress(split,{...progress,economyReceipts:progress.economyReceipts.filter(r=>r.kind!=='battle'||r.facts.round!==1)});
 expect(()=>validateBatch3Gold(changed)).toThrow();
});
it.each(['terminal','historical'] as const)('real owned Spoils %s kill fact restores exactly and forged or omitted counts are rejected',boundary=>{
 const history=new BattleHistory('spoils-restore');
 let s=recordedEmptyRoute(firstNodeSeed('spoils-of-war-i'),'2-1',history);
 const c=s.pendingChoice!;expect(c.offers).toContain('spoils-of-war-i');
 s=resolveM5Choices(accepted(selectChoice(s,c.choiceId,c.generation,'spoils-of-war-i')));
 // A receipt-backed fixture champion guarantees a real kill without changing the reward oracle.
 s=fieldBench(accepted(grantMechanicUnit(s,{receiptId:'spoils-test-garen',source:'test',definitionId:'garen',starLevel:3})));
 s=accepted(recordCommand(history,s,startMatchCombat(s)));
 while(s.phase==='combat')s=recordCommand(history,s,stepMatch(s)).state;
 const battleRound=s.round;
 if(boundary==='historical')s=accepted(nextRound(resolveM5Choices(s),s.round));
 const p=readG23Progress(s)!,r=p.economyReceipts.find(r=>r.kind==='battle'&&r.facts.round===battleRound);
 expect(r?.kind).toBe('battle');if(r?.kind!=='battle')throw Error('missing battle');
 expect(r.facts.batch2?.find(f=>f.definitionId==='spoils-of-war')?.count).toBeGreaterThan(0);
 expect(restoreMatch(serializeMatch(s,history.completedRecords),history.completedRecords)).toEqual(s);
 for(const count of [undefined,0,r.facts.batch2!.find(f=>f.definitionId==='spoils-of-war')!.count+1]){
  const bad=structuredClone(s);const facts=readG23Progress(bad)!.economyReceipts.find(r=>r.kind==='battle'&&r.facts.round===battleRound)!;
  if(facts.kind!=='battle')throw Error('missing battle');
  const rows=facts.facts.batch2!.filter(f=>f.definitionId!=='spoils-of-war');
  Object.assign(facts.facts,{batch2:count===undefined?rows:[...rows,{definitionId:'spoils-of-war',count}]});
  for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreMatch(input,history.completedRecords)).toThrow();
 }
});

it('Spoils historical authentication cannot be bypassed by deleting the kill counter or claiming zero',()=>{
 for(const count of [undefined,0,2]){
  let s:MatchState={...createMatch(42),round:5,augments:[{definitionId:'spoils-of-war-i',choiceId:'test',acquiredRound:4}]};
  const facts={...kills('pve',4,2),...(count===undefined?{batch2:undefined}:{batch2:[{definitionId:'spoils-of-war',count}]})};
  if(count===undefined)delete facts.batch2;
  s=writeG23Progress(s,advanceG23Economy(readG23Progress(s)!,facts).progress);
  expect(needsCrownHistory(s)).toBe(true);
  expect(needsCrownHistory({...s,augments:[{...s.augments[0],acquiredRound:5}]})).toBe(false);
 }
});

// Frozen pre-fb3prog settlement bytes under current content; see fixture provenance.
// Keep this independent baseline rather than synthesizing it with the new settlement code.
it.each([1,2])('pre-Spoils baseline bytes restore and continue round %i with full history',targetRound=>{
 const baseline=readFileSync(new URL('./fixtures/compat/pre-spoils-v24-seed42.json',import.meta.url),'utf8');
 const history=new BattleHistory('spoils-compatibility');
 let s=fieldBench(resolveM5Choices(createMatch(42)));
 s=accepted(recordCommand(history,s,startMatchCombat(s)));
 while(s.phase==='combat')s=recordCommand(history,s,stepMatch(s)).state;
 expect(s.augments).toEqual([]);
 expect(serializeMatch(s,history.completedRecords)).toBe(baseline);
 expect(restoreMatch(baseline)).toEqual(s);
 // Build preceding rounds through public commands; compare this case's complete next round.
 for(let round=1;round<targetRound;round++){
  s=accepted(nextRound(resolveM5Choices(s),s.round));
  s=fieldBench(resolveM5Choices(s));s=accepted(recordCommand(history,s,startMatchCombat(s)));
  while(s.phase==='combat')s=recordCommand(history,s,stepMatch(s)).state;
 }
 let restored=restoreMatch(serializeMatch(s,history.completedRecords),JSON.parse(JSON.stringify(history.completedRecords)));
 expect(restored).toEqual(s);
 {
  const left=nextRound(resolveM5Choices(s),s.round),right=nextRound(resolveM5Choices(restored),restored.round);
  expect(right).toEqual(left);s=accepted(left);restored=accepted(right);
  s=fieldBench(resolveM5Choices(s));restored=fieldBench(resolveM5Choices(restored));expect(restored).toEqual(s);
  const start=startMatchCombat(s),resumed=startMatchCombat(restored);expect(resumed).toEqual(start);
  s=accepted(recordCommand(history,s,start));restored=accepted(resumed);
  while(s.phase==='combat'){
   const live=stepMatch(s),continued=stepMatch(restored);expect(continued).toEqual(live);
   s=recordCommand(history,s,live).state;restored=continued.state;
  }
  const json=serializeMatch(s,history.completedRecords);
  expect(json).not.toContain('spoils-of-war');
  restored=restoreMatch(json,JSON.parse(JSON.stringify(history.completedRecords)));expect(restored).toEqual(s);
 }
});
