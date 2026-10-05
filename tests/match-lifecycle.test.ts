import {describe,expect,it} from 'vitest';
import {createCombatWithEvents} from '../src/simulation/combat';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {nextRandom} from '../src/simulation/rng';
import {buyUnit,buyXp,deployMatchUnit,nextRound,rerollShop,sellUnit,startMatchCombat,stepMatch,type MatchState} from '../src/simulation/match';
import {accepted,battle,deployed,finish,freeze,readyMatch,emptyBoard,resolveM5Choices} from './match-helpers';
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
  const prep=accepted(buyXp(emptyBoard())),settled=accepted(startMatchCombat(prep));
  expect(settled).toMatchObject({phase:'settlement',level:4,xp:0,gold:11,playerHp:95});
  expect(settled.roundResults[0]).toMatchObject({xpRequested:2,xpAwarded:2,levelBefore:3,levelAfter:4,xpBefore:4,xpAfter:0});
  const next=accepted(nextRound(settled,1));expect({shop:next.shop,rngState:next.rngState}).toEqual(shop(settled.rngState,2,4));
 });
 it('caps XP and records requested versus applied',()=>{
  for(const[level,xp,applied]of[[8,75,1],[9,0,0]]){const end=accepted(startMatchCombat({...emptyBoard(),level,xp}));expect(end).toMatchObject({level:9,xp:0});expect(end.roundResults[0]).toMatchObject({xpRequested:2,xpAwarded:applied});}
 });
 it('rejects stale or unsettled Continue with the original complete state',()=>{
  const first=finish(battle()),second=finish(accepted(startMatchCombat(accepted(nextRound(first,1)))));
  expect(nextRound(freeze(second),1)).toEqual({ok:false,state:second,reason:'stale-round'});
  const invalid={...second,roundResults:[]};expect(nextRound(invalid,2)).toEqual({ok:false,state:invalid,reason:'unsettled-round'});expect(nextRound(invalid,2).state).toBe(invalid);
 });
 it('does not tick preparation, rejects missing teams, and permits an empty-board concession',()=>{
  const empty=freeze(emptyBoard());expect(stepMatch(empty)).toEqual({state:empty,events:[]});expect(stepMatch(empty).state).toBe(empty);
  expect(accepted(startMatchCombat(empty))).toMatchObject({phase:'settlement',playerHp:95,gold:16});
  for(const[teams,reason]of[[['player'],'missing-enemy'],[[],'missing-both']]as const){const input=deployed(),fixture={...input,preparation:{...input.preparation,units:input.preparation.units.filter(u=>(teams as readonly string[]).includes(u.team))}};expect(startMatchCombat(fixture)).toEqual({ok:false,state:fixture,reason});}
 });
 it('clamps lethal loss while awarding income and XP just once',()=>{
  const before={...emptyBoard(),playerHp:1,xp:5},terminal=accepted(startMatchCombat(freeze(before)));
  expect(terminal).toMatchObject({phase:'gameOver',outcome:'defeat',playerHp:0,gold:16,level:4,xp:1});expect(terminal.roundResults).toEqual([settlement(before,terminal.combat)]);
  expect(terminal.roundResults[0]).toMatchObject({playerDamage:5,hpLost:1});
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
  expect(state.outcome).toBe('defeat');expect(state.playerHp).toBe(0);expect(state.round).toBeLessThan(35);expect(defeats).toBeGreaterThan(0);
 },30000);
 it('an empty zero-income roster can recover through a paid normal purchase next round',()=>{
  let state=readyMatch();for(const unit of players(state))state=accepted(sellUnit(state,unit.id));while(state.gold>=4)state=accepted(buyXp(state));while(state.gold>=2)state=accepted(rerollShop(state));
  expect(state.gold).toBeLessThan(2);expect(players(state)).toHaveLength(0);
  const end=accepted(startMatchCombat(state));expect(end.gold).toBe(state.gold+5);expect(end.playerHp).toBeLessThan(state.playerHp);
  const next=accepted(nextRound(end,1));expect(buyUnit(next,0,next.shop.generation).ok).toBe(true);
 });
 it('preserves every frozen preparation/economic snapshot until terminal commit',()=>{
  const prep=freeze(deployed()),copy=structuredClone(prep);let state=accepted(startMatchCombat(prep));
  while(state.phase==='combat'){const prior=freeze(state),saved=structuredClone(prior);state=stepMatch(prior).state;expect(prior).toEqual(saved);expect(state.preparation).toEqual(prep.preparation);expect(state.shop).toBe(prep.shop);if(state.phase==='combat')expect([state.gold,state.level,state.xp,state.playerHp]).toEqual([prep.gold,prep.level,prep.xp,prep.playerHp]);}
  expect(prep).toEqual(copy);
 });
 it('creates fresh independent Combat with exactly one battle-seed word',()=>{
  const state=readyMatch(),draw=nextRandom(state.battleSeedRngState),expected=createCombatWithEvents(state.preparation,buildStrategySnapshot(state),'round-1',draw.word);
  const started=accepted(startMatchCombat(state));expect(started.combat).toEqual(expected.state);expect(started.battleSeedRngState).toBe(draw.state);
  expect(started.preparation).toBe(state.preparation);expect(started.combat!.units.every(u=>u.alive&&u.cooldownTicks===0&&u.moveCooldownTicks===0&&u.targetId===null)).toBe(true);
 });
});
