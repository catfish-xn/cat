import {grantXp} from '../src/simulation/progression';
import {expect,it} from 'vitest';
import {planRoundEconomy} from '../src/simulation/economy';
import {readAugmentIncome,investmentGrowth} from '../src/simulation/augment-income';
import {selectChoice,startMatchCombat,nextRound,deployMatchUnit} from '../src/simulation/match';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {accepted,reachRound,emptyBoard,resolveM5Choices} from './match-helpers';
import {previewRoundEconomy} from '../src/simulation/economy-preview';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
const owned=(id:string)=>({definitionId:id,choiceId:id,acquiredRound:4});
const input={stage:2,roundId:'2-1',roundKind:'pvp' as const,result:'playerWin' as const,gold:99,streak:{kind:null,count:0},level:4,xp:0,hp:100,enemySurvivors:0};
it.each([['going-long',0,2,105],['hedge-fund',10,2,115],['investment-strategy-ii',7,2,112]] as const)('%s independently calculates the real income and experience', (id,interest,xp,gold)=>{
 const plan=planRoundEconomy({...input,augments:[owned(id)]});
 expect(plan.incomeBreakdown).toEqual({base:5,win:1,interest,streak:0});
 expect(plan.goldAfter).toBe(gold);expect(plan.progression.xpRequested).toBe(xp);
});
it('no-interest wins over both raised caps; investment growth is earned interest, not bank size',()=>{
 expect(readAugmentIncome([owned('going-long'),owned('hedge-fund'),owned('investment-strategy-ii')])).toEqual({interestCap:0,roundXp:4,healthPerInterest:9});
 expect(investmentGrowth([owned('investment-strategy-ii')],[{round:3,incomeBreakdown:{interest:7}},{round:4,incomeBreakdown:{interest:7}},{round:5,incomeBreakdown:{interest:3}}])).toBe(90);
});
it.each(['going-long','hedge-fund','investment-strategy-ii'])('%s public acquisition has one receipt, strict restore and actual settled effect', id=>{
 let seed=0,state=reachRound('2-1',false,seed);
 for(;seed<200&&!state.pendingChoice?.offers.includes(id);seed++)state=reachRound('2-1',false,seed+1);
 expect(state.pendingChoice?.offers).toContain(id);
 const choice=state.pendingChoice!,before=state.gold;
 state=accepted(selectChoice(state,choice.choiceId,choice.generation,id));
 expect(state.gold-before).toBe(id==='going-long'?15:id==='hedge-fund'?25:5);
 expect(state.scheduleReceipts.filter(r=>r.eventId===choice.eventId)).toHaveLength(1);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const duplicate=selectChoice(state,choice.choiceId,choice.generation,id);expect(duplicate.ok).toBe(false);expect(duplicate.state).toBe(state);
 const broken=structuredClone(state);Object.assign(broken.scheduleReceipts.find(r=>r.eventId===choice.eventId)!,{gold:999});
 expect(()=>restoreMatch(broken)).toThrow('choice receipt values');
 const preview=previewRoundEconomy(state)!;
 const goldBefore=state.gold;
 state=accepted(startMatchCombat(emptyBoard(state))); // real loss, no fabricated receipts
 state=resolveM5Choices(state);
 const result=state.roundResults.at(-1)!;
 expect(result.goldBefore).toBe(goldBefore);
 expect(result.incomeBreakdown.interest).toBe(id==='going-long'?0:Math.min(id==='hedge-fund'?10:7,Math.floor(goldBefore/10)));
 expect(result.incomeBreakdown.interest).toBe(preview.ifLoss.interest);
 expect(result.xpRequested).toBe(2);
 expect(state.augmentProgress.investmentHp).toBe(id==='investment-strategy-ii'?result.incomeBreakdown.interest*9:0);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const settledState=state;
 state=accepted(nextRound(state,state.round));expect(restoreMatch(serializeMatch(state))).toEqual(state);
 if(id==='going-long'){const expected=grantXp(settledState.level,settledState.xp,4);expect({level:state.level,xp:state.xp}).toEqual({level:expected.level,xp:expected.xp});expect(nextRound(state,settledState.round).ok).toBe(false);}

 if(id==='investment-strategy-ii'){
  state=accepted(deployMatchUnit(state,'unit-1',{kind:'board',cell:{col:1,row:4}}));
  const actual=buildStrategySnapshot(state).units.find(u=>u.unitId==='unit-1')!;
  const plain=buildStrategySnapshot({...state,augments:[],augmentProgress:{...state.augmentProgress,investmentHp:0}}).units.find(u=>u.unitId==='unit-1')!;
  expect(actual.stats.health-plain.stats.health).toBe(result.incomeBreakdown.interest*9);
 }
});
it('I and II share one HP aggregate without applying it twice',()=>{
 const s=accepted(deployMatchUnit(reachRound('2-1'),'unit-1',{kind:'board',cell:{col:1,row:4}}));const augments=[owned('investment-strategy-i'),owned('investment-strategy-ii')];
 const state={...s,augments,augmentProgress:{pumpingRounds:0,investmentHp:51}};
 const a=buildStrategySnapshot(state).units.find(u=>u.unitId==='unit-1')!,b=buildStrategySnapshot({...state,augments:[]}).units.find(u=>u.unitId==='unit-1')!;
 expect(a.stats.health-b.stats.health).toBe(51);
 expect(readAugmentIncome(augments).healthPerInterest).toBe(17);
});
