import {g23BattleFacts} from '../src/simulation/g2-3-settlement';
import {expect,it} from 'vitest';
import {createMatch} from '../src/simulation/match';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {compileBattle,resolveTwoSidedBattle} from '../src/simulation/two-sided-battle';
import {getMultiplayerRoundByOrdinal} from '../src/simulation/multiplayer-round';
import {enableMultiplayerSettlement} from '../src/simulation/round-settlement';

function onlineInitial(){
 const result=enableMultiplayerSettlement(createMatch(42),'A');
 if(!result.ok)throw Error(result.reason);
 return result.state;
}

// Hand-transcribed from augments-14.24.json TFT6_Augment_Traitless2.effects
// HP1..4=240/330/420/530, AS1..4=45/50/55/60; no interpolation or B-patch override.
it.each([[4,240,4500],[9,240,4500],[11,330,5000],[16,330,5000],[18,420,5500],[23,420,5500],[25,530,6000],[32,530,6000],[39,530,6000]] as const)(
 'built-different round %i applies exact 14.24 stats only to eligible units in two-sided compilation',(ordinal,hp,speed)=>{
  const initial=onlineInitial(),round=getMultiplayerRoundByOrdinal(ordinal);
  const preparation={...initial.preparation,units:['lux','darius','draven'].map((definitionId,i)=>({
   id:`unit-${i+1}`,definitionId,starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:i,row:4}},
  }))};
  const plain={...initial,level:3,nextUnitSerial:4,round:ordinal,roundDefinitionId:round.roundId,m8:{...initial.m8,round},preparation};
  const owned={...plain,augments:[{definitionId:'built-different',choiceId:'stage-vector',acquiredRound:4}]};
  const baseline=buildStrategySnapshot(plain);
  const battle=compileBattle(snapshotForBattle(owned,'A'),snapshotForBattle(plain,'B'),42);
  for(const seat of ['A','B'])for(const [i,name] of ['lux','darius','draven'].entries()){
   const id=`unit-${i+1}`,before=baseline.units.find(u=>u.unitId===id)!;
   const after=battle.strategy.units.find(u=>u.unitId===JSON.stringify(['t2',seat,'unit',id]))!;
   const eligible=seat==='A'&&name==='lux'; // Darius/Draven activate Conqueror; B owns no augment.
   expect(after.stats.health-before.stats.health).toBe(eligible?hp:0);
   expect((after.stats.attackSpeedBonusBps??0)-(before.stats.attackSpeedBonusBps??0)).toBe(eligible?speed:0);
  }
 });

it.each([12,16,18,25,32,39])('placebo-plus keeps exactly 100 Bps attack speed in two-sided round %i',ordinal=>{
 const initial=onlineInitial(),round=getMultiplayerRoundByOrdinal(ordinal);
 const plain={...initial,round:ordinal,roundDefinitionId:round.roundId,m8:{...initial.m8,round}};
 const owned={...plain,augments:[{definitionId:'placebo-plus',choiceId:'fixed-vector',acquiredRound:12}]};
 const battle=compileBattle(snapshotForBattle(owned,'A'),snapshotForBattle(plain,'B'),42);
 for(const unit of battle.strategy.units)expect(unit.stats.attackSpeedBonusBps??0).toBe(JSON.parse(unit.unitId)[1]==='A'?100:0);
});

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

it.each(['bronze-for-life-i','bronze-for-life-ii'])('%s tracks current board bronze tiers in two-sided compilation and settlement facts',id=>{
 const initial=createMatch(42), round=getMultiplayerRoundByOrdinal(8);
 // Disjoint trait memberships: two Conquerors and three Chem-Barons, no other active trait.
 const names=['darius','draven','singed','renata','silco','rell','mordekaiser','smeech'];
 const all=names.map((definitionId,i)=>({id:`unit-${i+1}`,definitionId,starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:i%7,row:4+Math.floor(i/7)}}}));
 for(const [active,conquerorTier,chemTier,bronzeCount] of [[5,2,3,2],[8,4,4,3],[5,2,3,2]] as const){
   // At eight units Sentinel (Singed/Rell), Visionary (Renata/Rell), and Dominator (Silco/Mordekaiser) are bronze; Conqueror/Chem-Baron become silver.
   const preparation={...initial.preparation,units:all.map((u,i)=>i<active?u:{...u,location:{kind:'bench' as const,slot:i}})};
   const state={...initial,level:8,round:8,roundDefinitionId:round.roundId,m8:{...initial.m8,round},preparation,augments:[{definitionId:id,choiceId:'test',acquiredRound:4}]};
   const battle=compileBattle(snapshotForBattle(state,'A'),snapshotForBattle(state,'B'),42);
   const result=resolveTwoSidedBattle(battle,1201);
   expect(result.terminal.status).toBe('finished');
   for(const team of ['player','enemy'] as const){
     const traits=battle.strategy.traits.filter(t=>t.team===team);
     expect(traits.find(t=>t.traitId==='conqueror')!.tier).toBe(conquerorTier);
     expect(traits.find(t=>t.traitId==='chem-baron')!.tier).toBe(chemTier);
     const target=battle.strategy.units.find(u=>u.unitId===JSON.stringify(['t2',team==='player'?'A':'B','unit','unit-1']))!;
     const amp=target.mechanics?.find(m=>m.mechanic==='damageAmp')?.values.bps;
     expect(amp).toBe(bronzeCount*(id==='bronze-for-life-i'?300:350));
     const facts=g23BattleFacts(result.terminal,team,8,'pvp',battle.preparation.units);
     expect([facts.conquerorTier,facts.chemBaronTier]).toEqual([conquerorTier,chemTier]);
   }
 }
});
