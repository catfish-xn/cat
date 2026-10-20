import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as api from '../src/simulation/match';
import { accepted, reachRound, resolveM5Choices } from './match-helpers';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, deriveAugmentTier } from '../src/simulation/augment-offers';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { BattleHistory } from '../src/replay/history';
import { recordedCrownBattle } from './crown-history-helpers';
import { drainAllD11Gifts, d11GiftPlan, d11PriorKills } from '../src/simulation/d11-fill';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { toCombatViewState } from '../src/simulation/combat-replay-view';
import type { MatchState, MatchCommandResult } from '../src/simulation/match';

function seedFor(id:string){
  for(let seed=0;seed<1000;seed++)if(generateChoices(augmentCandidates(deriveAugmentTier(seed,'round:2-1:augment'),[]),(seed^0x9e3779b9)>>>0).offers.includes(id))return seed;
  throw Error('D11 offer seed budget');
}
function observe(history:BattleHistory,before:MatchState,result:{state:MatchState;events:readonly api.MatchEvent[]}){
  history.observe({before,after:result.state,events:result.events.filter(e=>e.domain==='combat'),reason:before.phase==='combat'?'tick':'command'});
  return result.state;
}
function command(history:BattleHistory,before:MatchState,result:MatchCommandResult){accepted(result);return observe(history,before,result.ok?result:{state:before,events:[]});}

it.each(['all-for-one-i','trifecta-i','spirit-link'])('%s uses public acquisition, combat, settlement and strict resume without replaying gifts',id=>{
  let s=reachRound('2-1',false,seedFor(id));const c=s.pendingChoice!,before=s;
  const selected=api.selectChoice(s,c.choiceId,c.generation,id);s=accepted(selected);
  expect(s.augments.at(-1)?.definitionId).toBe(id);
  const gifts=d11GiftPlan(s,s.augments.at(-1)!);
  expect(gifts).toHaveLength(id==='spirit-link'?0:2);
  expect(s.seatMechanics!.receipts.filter(r=>r.source==='d11-fill')).toHaveLength(gifts.length);
  expect(selected.ok&&selected.events.filter(e=>e.type==='mechanicGranted')).toHaveLength(gifts.length);
  for(const key of ['rngState','choiceRngState','rewardRngState','battleSeedRngState'] as const)expect(s[key]).toBe(before[key]);
  expect(drainAllD11Gifts(s)).toBe(s);expect(restoreMatch(serializeMatch(s))).toEqual(s);
  const heroes=s.preparation.units.filter(u=>u.team==='player').sort((a,b)=>UNIT_DEFINITIONS[b.definitionId].cost-UNIT_DEFINITIONS[a.definitionId].cost).slice(0,s.level);
  for(const [i,u] of heroes.entries())s=accepted(api.deployMatchUnit(s,u.id,{kind:'board',cell:{col:i*2,row:7}}));
  const strategy=buildStrategySnapshot(s);
  if(id==='all-for-one-i'){
    const n=new Set(heroes.filter(u=>UNIT_DEFINITIONS[u.definitionId].cost===1).map(u=>u.definitionId)).size;
    expect(n).toBeGreaterThan(0);
    for(const u of strategy.units.filter(u=>heroes.some(h=>h.id===u.unitId)))expect(u.sources).toContainEqual(expect.objectContaining({effect:{kind:'statPercentBps',stat:'maxHp',bps:n*200}}));
  }
  if(id==='trifecta-i'){
    const threes=heroes.filter(u=>UNIT_DEFINITIONS[u.definitionId].cost===3);expect(threes.length).toBeGreaterThan(0);
    for(const u of threes)expect(strategy.units.find(x=>x.unitId===u.id)!.sources).toContainEqual(expect.objectContaining({effect:{kind:'statFlat',stat:'maxHp',amount:250}}));
  }
  const started=api.startMatchCombat(s);s=accepted(started);
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  expect(toPrivateSeatView(s).d11Display?.definitions).toContainEqual(expect.objectContaining({definitionId:id}));
  expect(toCombatViewState(s.combat!).units.some(u=>u.choiceEffects?.some(d=>d.definitionId===id))).toBe(true);
  const events=[...(started.ok?started.events:[])];
  while(s.phase==='combat'){const next=api.stepMatch(s);s=next.state;events.push(...next.events);}
  expect(s.roundResults.at(-1)?.round).toBe(s.round);
  if(id==='spirit-link')expect(events.some(e=>e.type==='heal'&&e.outcome.shares.some(share=>share.source.definitionId===id)&&e.outcome.actual>0)).toBe(true);
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  expect(api.stepMatch(s).state).toBe(s);
  expect(drainAllD11Gifts(s)).toBe(s);
});

// Build a real paid army and record every earlier battle through the normal
// route driver. No fabricated offers, stats, currency, receipts or fingerprints.
const history=new BattleHistory('d11-public-anomaly');
let prefix:MatchState|undefined;
const stop=new Error('D11 captured public 4-5 prefix');
try{
  await createRequire(import.meta.url)('../scripts/generate-m5-route.cjs').run(api,{build:'sniper',seed:42,
    onStep(before:MatchState,result:{state:MatchState;events:readonly api.MatchEvent[]}){
      observe(history,before,result);
      if(result.state.roundDefinitionId==='4-5'&&result.state.phase==='preparation'){prefix=result.state;throw stop;}
    }});
}catch(error){if(error!==stop)throw error;}
if(!prefix)throw Error('D11 public prefix unavailable');
// Authenticate the common paid-route fixture once, outside case execution.
// Every case still checks its own combat and all changed history/receipts.
restoreMatch(serializeMatch(prefix,history.completedRecords),history.completedRecords);

// Temporarily allow full historical replay under CI contention (user-approved 2026-10-20).
it.each(['avarice-incarnate','headhunter'])('%s acquires a real 4-6 offer, fights, settles once and restores with independent historical evidence',id=>{
  const h=new BattleHistory(history.runId,history.completedRecords);
  let s=prefix!;
  // Keep the paid carry and front line; bench sales fund genuine 1G rerolls.
  const target=s.preparation.units.filter(u=>u.team==='player'&&u.definitionId==='kogmaw')
    .sort((a,b)=>b.starLevel-a.starLevel)[0];
  expect(target).toBeTruthy();
  for(const other of s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&u.id!==target.id))s=command(h,s,api.sellUnit(s,other.id));
  const prior=recordedCrownBattle(s,h);s=prior.state;
  s=command(h,s,api.nextRound(s,s.round));
  expect(s.roundDefinitionId).toBe('4-6');
  let c=s.pendingChoice!;s=command(h,s,api.selectAnomalyTarget(s,c.choiceId,c.generation,target.id));
  for(let n=0;n<100&&!s.pendingChoice!.offers.includes(id);n++){
    c=s.pendingChoice!;s=command(h,s,api.rerollAnomaly(s,c.choiceId,c.generation));
  }
  c=s.pendingChoice!;expect(c.offers).toContain(id);const gold=s.gold;
  s=command(h,s,api.selectChoice(s,c.choiceId,c.generation,id));
  expect(s.gold).toBe(gold+(id==='avarice-incarnate'?5:0));
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  if(id==='avarice-incarnate'){
    const forged=structuredClone(s);Object.assign(forged.seatMechanics!.receipts.find(r=>r.source==='d11-fill')!,{amount:6});
    expect(()=>restoreMatch(forged)).toThrow();
  }
  s=command(h,s,api.startMatchCombat(s));
  for(let n=0;n<40&&s.phase==='combat';n++)s=observe(h,s,api.stepMatch(s));
  const resume=restoreMatch(serializeMatch(s));expect(resume).toEqual(s);expect(api.stepMatch(resume)).toEqual(api.stepMatch(s));
  if(id==='headhunter'&&s.combat?.units.find(u=>u.id===target.id)?.d11Kills){
    const bad=structuredClone(s);Object.assign(bad.combat!.units.find(u=>u.id===target.id)!,{d11Kills:[{eventSeq:0,victimId:'forged'}]});
    expect(()=>restoreMatch(bad)).toThrow();
  }
  while(s.phase==='combat')s=observe(h,s,api.stepMatch(s));
  const facts=readG23Progress(s)!.economyReceipts.find(r=>r.kind==='battle'&&r.facts.round===s.round)!;
  if(id==='headhunter'){
    expect(facts.kind==='battle'&&facts.facts.d11Headhunter?.kills.length).toBeGreaterThan(0);
    expect(()=>restoreMatch(s)).toThrow('historical evidence');
    expect(d11PriorKills(readG23Progress(s),s.anomalyBinding!.boundRound)).toBe(facts.kind==='battle'?facts.facts.d11Headhunter!.kills.length:0);
  }
  expect(restoreMatch(serializeMatch(s,h.completedRecords),h.completedRecords)).toEqual(s);
  const saved=s,receipts=s.seatMechanics!.receipts.length;
  expect(api.stepMatch(s).state).toBe(s);expect(s.seatMechanics!.receipts).toHaveLength(receipts);
  s=resolveM5Choices(s);if(s.phase==='settlement'){
    s=accepted(api.nextRound(s,s.round));
    expect(api.nextRound(s,saved.round)).toMatchObject({ok:false,state:s});
    const strategy=buildStrategySnapshot(s);
    if(id==='headhunter')expect(strategy.units.find(u=>u.unitId===target.id)?.mechanics).toContainEqual(expect.objectContaining({mechanic:'d11Anomaly',values:{enabled:1,priorKills:d11PriorKills(readG23Progress(s),s.anomalyBinding!.boundRound)}}));
  }
}, 60000);
