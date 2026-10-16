import {expect,it} from 'vitest';
import {createMatch} from '../src/simulation/match';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {compileBattle} from '../src/simulation/two-sided-battle';
import {getMultiplayerRoundByOrdinal} from '../src/simulation/multiplayer-round';

it.each([['pumping-up-i',600,50],['pumping-up-ii',800,100],['pumping-up-iii',1200,200]] as const)('%s keeps earned growth through the real two-sided snapshot', (id,base,per)=>{
 const initial=createMatch(42),round=getMultiplayerRoundByOrdinal(8);
 const state={...initial,round:8,roundDefinitionId:round.roundId,m8:{...initial.m8,round},
  augments:[{definitionId:id,choiceId:'earned',acquiredRound:4}],augmentProgress:{pumpingRounds:id==='pumping-up-i'?3:0,investmentHp:0}};
 const plain=buildStrategySnapshot({...state,augments:[],augmentProgress:{pumpingRounds:0,investmentHp:0}}).units.find(u=>u.unitId==='unit-1')!;
 const solo=buildStrategySnapshot(state).units.find(u=>u.unitId==='unit-1')!;
 const battle=compileBattle(snapshotForBattle(state,'A'),snapshotForBattle(state,'B'),42);
 expect(solo.stats.attackSpeedBonusBps!-plain.stats.attackSpeedBonusBps!).toBe(base+3*per); // 2-1/2-2/2-3 complete; supply 2-4 does not count.
 for(const unit of battle.strategy.units)expect(unit.stats.attackSpeedBonusBps).toBe(solo.stats.attackSpeedBonusBps);
});
it('Pumping II includes online overtime combat nodes without requiring private history',()=>{
 const initial=createMatch(42),round=getMultiplayerRoundByOrdinal(40);
 const state={...initial,round:40,roundDefinitionId:round.roundId,m8:{...initial.m8,round},augments:[{definitionId:'pumping-up-ii',choiceId:'earned',acquiredRound:4}]};
 const a={...snapshotForBattle(initial,'A'),roundId:round.roundId,augments:state.augments},b={...a,seatId:'B'};
 const battle=compileBattle(a,b,42);
 const plain=buildStrategySnapshot({...state,preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.team==='player')},augments:[]}).units.find(u=>u.unitId==='unit-1')!;
 // 4..39 inclusive is 36 nodes, minus five x-4 supplies = 31 completed battles.
 expect(battle.strategy.units[0].stats.attackSpeedBonusBps!-plain.stats.attackSpeedBonusBps!).toBe(800+31*100);
});
