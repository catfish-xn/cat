import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import {describe,expect,it} from 'vitest';
import {createCombatWithEvents} from '../src/simulation/combat';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {nextRandom} from '../src/simulation/rng';
import {buyUnit,buyXp,deployMatchUnit,nextRound,rerollShop,sellUnit,startMatchCombat,stepMatch,type MatchState,type MatchEvent} from '../src/simulation/match';
import {accepted,battle,deployed,finish,freeze,readyMatch,emptyBoard,resolveM5Choices,reachRound} from './match-helpers';
import {settlement,shop} from './fixtures/m5/oracle.cjs';
const players=(s:MatchState)=>s.preparation.units.filter(u=>u.team==='player');
describe('M5 lifecycle retains unique settlement and isolated snapshots',()=>{
 it.each(['playerWin','enemyWin','draw'] as const)('atomically settles %s and rejects replayed transitions',result=>{
  // Explicit single-tick boundary fixture, not a normal acquisition route.
  const initial=battle();if(initial.phase!=='combat')throw Error('combat expected');
  const state:MatchState={...initial,combat:{...initial.combat,maxTicks:1,units:initial.combat.units.map(u=>({...u,
   alive:result==='draw'||(result==='playerWin'?u.team==='player':u.team==='enemy'),hp:result==='draw'||(result==='playerWin'?u.team==='player':u.team==='enemy')?u.hp:0}))}};
  const before=structuredClone(state),settled=finish(freeze(state));expect(settled.combat?.result).toBe(result);
  const record=settlement(before,settled.combat);expect(settled.roundResults).toEqual([record]);
  expect(settled).toMatchObject({gold:record.goldAfter,level:record.levelAfter,xp:record.xpAfter,playerHp:record.hpAfter});
  for(let i=0;i<20;i++){expect(stepMatch(settled)).toEqual({state:settled,events:[]});expect(stepMatch(settled).state).toBe(settled);expect(startMatchCombat(settled).ok).toBe(false);}
  const next=accepted(nextRound(settled,1));expect(next).toMatchObject({phase:'preparation',round:2,combat:null,gold:settled.gold});
  expect(next.roundResults).toBe(settled.roundResults);expect(players(next)).toEqual(players(before));expect({shop:next.shop,rngState:next.rngState}).toEqual(shop(settled.rngState,2,settled.level));
  expect(nextRound(next,1)).toEqual({ok:false,state:next,reason:'wrong-phase'});
 });
 it('natural XP crosses a level once and refresh uses the resulting odds',()=>{
  const prep=accepted(buyXp(emptyBoard(reachRound('2-1')))),settled=accepted(startMatchCombat(prep));
  expect(settled).toMatchObject({phase:'settlement',level:4,xp:0,gold:11,playerHp:86});
  expect(settled.roundResults.at(-1)).toMatchObject({xpRequested:2,xpAwarded:2,levelBefore:3,levelAfter:4,xpBefore:4,xpAfter:0});
  const next=accepted(nextRound(settled,settled.round));expect({shop:next.shop,rngState:next.rngState}).toEqual(shop(settled.rngState,settled.shop.generation+1,4));
 });
 it('caps XP and records requested versus applied',()=>{
  for(const[level,xp,applied]of[[8,75,1],[9,0,0]]){const end=accepted(startMatchCombat({...emptyBoard(),level,xp}));expect(end).toMatchObject({level:9,xp:0});expect(end.roundResults[0]).toMatchObject({xpRequested:2,xpAwarded:applied});}
 });
 it('rejects stale or unsettled Continue with the original complete state',()=>{
  const first=finish(battle()),pending=freeze(finish(accepted(startMatchCombat(accepted(nextRound(first,1))))));
  const pendingBefore=structuredClone(pending);expect(pending.phase).toBe('choice');
  // B8: 1-3 must resolve its earned component choice before stale/receipt guards are reachable.
  for(const round of [1,2]){const rejected=nextRound(pending,round);expect(rejected).toEqual({ok:false,state:pending,reason:'wrong-phase'});expect(rejected.state).toBe(pending);}
  const second=freeze(resolveM5Choices(pending)),before=structuredClone(second);expect(second.phase).toBe('settlement');
  expect(pending).toEqual(pendingBefore);
  const stale=nextRound(second,1);expect(stale).toEqual({ok:false,state:second,reason:'stale-round'});expect(stale.state).toBe(second);expect(second).toEqual(before);
  const invalid=freeze({...second,roundResults:[]}),invalidBefore=structuredClone(invalid);
  expect(nextRound(invalid,2)).toEqual({ok:false,state:invalid,reason:'unsettled-round'});expect(nextRound(invalid,2).state).toBe(invalid);expect(invalid).toEqual(invalidBefore);
 });
 it('does not tick preparation, rejects missing teams, and permits an empty-board concession',()=>{
  const empty=freeze(emptyBoard());expect(stepMatch(empty)).toEqual({state:empty,events:[]});expect(stepMatch(empty).state).toBe(empty);
  expect(accepted(startMatchCombat(empty))).toMatchObject({phase:'settlement',playerHp:97,gold:2});
  for(const[teams,reason]of[[['player'],'missing-enemy'],[[],'missing-both']]as const){const input=deployed(),fixture={...input,preparation:{...input.preparation,units:input.preparation.units.filter(u=>(teams as readonly string[]).includes(u.team))}};expect(startMatchCombat(fixture)).toEqual({ok:false,state:fixture,reason});}
 });
 it('clamps lethal loss while awarding income and XP just once',()=>{
  const before={...emptyBoard(),playerHp:1,level:3,xp:5},terminal=accepted(startMatchCombat(freeze(before)));
  expect(terminal).toMatchObject({phase:'gameOver',outcome:'defeat',playerHp:0,gold:2,level:4,xp:1});expect(terminal.roundResults).toEqual([settlement(before,terminal.combat)]);
  expect(terminal.roundResults[0]).toMatchObject({playerDamage:3,hpLost:1});
  for(const command of[buyXp,rerollShop,startMatchCombat,(s:MatchState)=>buyUnit(s,0,s.shop.generation),(s:MatchState)=>sellUnit(s,'unit-1'),(s:MatchState)=>nextRound(s,s.round),(s:MatchState)=>deployMatchUnit(s,'unit-1',{kind:'bench',slot:0})])expect(command(terminal)).toEqual({ok:false,state:terminal,reason:'wrong-phase'});
 });
 it('a nonempty starting roster naturally loses without HP/result injection',()=>{
  let state=readyMatch(),defeats=0;
  while(state.phase!=='gameOver'){
   if(state.phase==='choice'){state=resolveM5Choices(state);continue;}
   if(state.phase==='settlement'){state=accepted(nextRound(state,state.round));continue;}
   const before=state,end=finish(accepted(startMatchCombat(state)));if(end.combat?.result==='enemyWin')defeats++;
   expect(end.roundResults.at(-1)).toEqual(settlement(before,end.combat));state=end;
  }
  expect(state.outcome).toBe('defeat');expect(state.playerHp).toBe(0);expect(state.round).toBeLessThan(ROUND_CATALOG.length);expect(defeats).toBeGreaterThan(0);
 },30000);
 it('an empty zero-income roster can recover through a paid normal purchase next round',()=>{
  let state=readyMatch();for(const unit of players(state))state=accepted(sellUnit(state,unit.id));while(state.gold>=4)state=accepted(buyXp(state));while(state.gold>=2)state=accepted(rerollShop(state));
  expect(state.gold).toBeLessThan(2);expect(players(state)).toHaveLength(0);
  const end=accepted(startMatchCombat(state));expect(end.gold).toBe(state.gold+2);expect(end.playerHp).toBeLessThan(state.playerHp);
  const next=accepted(nextRound(end,1));expect(buyUnit(next,0,next.shop.generation).ok).toBe(true);
 });
 it('preserves every frozen preparation/economic snapshot until terminal commit',()=>{
  const prep=freeze(deployed()),copy=structuredClone(prep),started=startMatchCombat(prep);let state=accepted(started);
  if(!started.ok)throw Error(started.reason);
  const basis=state.combatInputBasis,basisBefore=structuredClone(basis),events:MatchEvent[]=[...started.events];
  const sourceUnitId=JSON.stringify(['pve','1-2','minions-a-v1','m01']),dropId=JSON.stringify(['1-2','minions-a-v1',sourceUnitId,0]);
  const receiptId=JSON.stringify([dropId,'grant']),receipt={receiptId,dropId,payload:{kind:'unit',definitionId:'maddie',quantity:1},grantedItemIds:[],grantedUnitIds:['unit-2']};
  const maddie={id:'unit-2',definitionId:'maddie',team:'player',starLevel:1,location:{kind:'bench',slot:0}};
  while(state.phase==='combat'){
   const prior=freeze(state),saved=structuredClone(prior),step=stepMatch(prior);state=step.state;events.push(...step.events);
   expect(prior).toEqual(saved);expect(state.shop).toBe(prep.shop);
   expect(state.combatInputBasis).toBe(basis);expect(state.combatInputBasis).toEqual(basisBefore);
   expect(state.combat?.units.map(u=>u.id)).toEqual(started.state.combat!.units.map(u=>u.id));
   if(state.phase==='combat'){
    expect(state.preparation).toEqual(prep.preparation);
    expect([state.gold,state.level,state.xp,state.playerHp]).toEqual([prep.gold,prep.level,prep.xp,prep.playerHp]);
    expect(state.nextUnitSerial).toBe(2);expect(state.m8.loot.receipts).toEqual([]);
   }else{
    // B8: terminal preparation admits only the unique approved Maddie birth, never live combat changes.
    expect(state.preparation).toEqual({...prep.preparation,units:[...prep.preparation.units.filter(u=>u.team==='enemy'),...players(prep),maddie]});
    expect(state.nextUnitSerial).toBe(3);expect(state.items).toEqual(prep.items);expect(state.nextItemSerial).toBe(prep.nextItemSerial);
    expect(state.m8.loot.receipts).toEqual([receipt]);expect(step.events.filter(e=>e.domain==='match')).toEqual([
     {type:'lootGranted',receipt,domain:'match',eventSeq:prior.nextMatchEventSeq},
     {type:'roundSettled',round:1,domain:'match',eventSeq:prior.nextMatchEventSeq+1},
    ]);
    expect(state.resourceProvenance).toEqual({...prep.resourceProvenance,entries:[...prep.resourceProvenance.entries,
     {sequence:1,roundId:'1-2',kind:'unit-acquired',unitId:'unit-2',source:{kind:'loot',receiptId}},
     {sequence:2,roundId:'1-2',kind:'combat-growth-committed',combatId:'round-1',settlementId:'round-1-settled',combatStartProvenancePrefixLength:1,sourceDeltas:[]},
    ]});
   }
  }
  const deaths=events.filter((e):e is Extract<MatchEvent,{type:'death'}>=>e.type==='death'&&e.unitId===sourceUnitId);expect(deaths).toHaveLength(1);
  expect(state.m8.loot.earnedEvidence).toEqual([{dropId,death:{combatId:'round-1',tick:deaths[0].tick,eventSeq:deaths[0].eventSeq}}]);
  expect(events.filter(e=>e.domain==='match')).toEqual([
   {type:'lootRevealed',dropId,death:{combatId:'round-1',tick:deaths[0].tick,eventSeq:deaths[0].eventSeq},domain:'match',eventSeq:prep.nextMatchEventSeq},
   {type:'lootGranted',receipt,domain:'match',eventSeq:prep.nextMatchEventSeq+1},
   {type:'roundSettled',round:1,domain:'match',eventSeq:prep.nextMatchEventSeq+2},
  ]);
  expect(state.m8.loot.frozen).toBe(prep.m8.loot.frozen);
  expect(state.m8.loot.direct).toEqual([{dropId,status:'granted',receiptId}]);
  expect(state.m8.loot.choiceResolutions).toEqual([]);expect(state.m8.loot.choiceEligibility).toEqual([]);
  expect(state.m8.loot.guaranteeCounters).toEqual(prep.m8.loot.guaranteeCounters);
  const combatEvents=events.filter(e=>e.domain==='combat');expect(combatEvents.map(e=>e.eventSeq)).toEqual(combatEvents.map((_,i)=>i));
  expect(state.roundResults).toEqual([settlement(prep,state.combat)]);expect(state.roundResults[0].combatEventCount).toBe(combatEvents.length);
  expect(prep).toEqual(copy);
 });
 it('creates fresh independent Combat with exactly one battle-seed word',()=>{
  const state=readyMatch(),draw=nextRandom(state.battleSeedRngState),expected=createCombatWithEvents(state.preparation,buildStrategySnapshot(state),'round-1',draw.word);
  const started=accepted(startMatchCombat(state));expect(started.combat).toEqual(expected.state);expect(started.battleSeedRngState).toBe(draw.state);
  expect(started.preparation).toBe(state.preparation);expect(started.combat!.units.every(u=>u.alive&&u.cooldownTicks===0&&u.moveCooldownTicks===0&&u.targetId===null)).toBe(true);
 });
});
