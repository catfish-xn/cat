import {expect,it} from 'vitest';
import {createMatch,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {countsG23SurvivorDamage} from '../src/simulation/g2-3-summons';
import {createCombatWithEvents,stepCombat} from '../src/simulation/combat';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {snapshotForBattle,compileBattle,restoreBattleInput,startTwoSidedCombat} from '../src/server-entry';
import type {MatchState} from '../src/simulation/match-types';

function equipped(base=createMatch(42)){
 const g=grantMechanicItem(base,{receiptId:'mirror',source:'test',definitionId:'TFT9_Item_OrnnTrickstersGlass'});
 if(!g.ok)throw Error(g.reason);
 const owner=g.state.preparation.units.find(u=>u.team==='player')!;
 const e=equipItem(g.state,g.state.items.at(-1)!.id,owner.id,0);if(!e.ok)throw Error(e.reason);
 return {state:e.state,owner};
}

it('creates one combat-only same-star clone, preserves assets and restores across real ticks',()=>{
 const {state,owner}=equipped();
 const start=startMatchCombat(state);if(!start.ok)throw Error(start.reason);
 const clone=start.state.combat!.units.find(u=>u.itemSummon)!;
 expect(clone).toMatchObject({definitionId:owner.definitionId,starLevel:owner.starLevel,team:'player'});
 expect(start.state.preparation.units).toEqual(state.preparation.units);
 expect(start.state.items).toEqual(state.items);
 expect(countsG23SurvivorDamage(clone)).toBe(false);
 expect(clone.mechanics?.some(m=>m.mechanic==='g24Mirror')).toBe(false);
 expect(clone.itemPrograms?.some(p=>p.source.sourceKind==='item')).toBeFalsy();
 expect(start.events.filter(e=>e.type==='unitSpawned'&&e.unitId===clone.id)).toHaveLength(1);
 let current=start.state;
 for(let n=0;n<60&&current.phase==='combat';n++){
   const restored=restoreMatch(serializeMatch(current));expect(restored).toEqual(current);
   expect(stepMatch(restored)).toEqual(stepMatch(current));current=stepMatch(current).state;
 }
 const forged=structuredClone(start.state);
 Object.assign(forged.combat!.units.find(u=>u.itemSummon)!.itemSummon!,{ownerId:'unrelated'});
 expect(()=>restoreMatch(forged)).toThrow();
 const missing=structuredClone(start.state);
 Object.assign(missing.combat!,{units:missing.combat!.units.filter(u=>!u.itemSummon)});
 expect(()=>restoreMatch(missing)).toThrow();
});

it('freezes form from the owner and gives the clone active trait effects without increasing tier counts',()=>{
 const base=createMatch(42);
 const army:MatchState={...base,preparation:{...base.preparation,units:[
  {id:'j',definitionId:'jayce',team:'player',starLevel:2,location:{kind:'board',cell:{col:3,row:6}}},
  {id:'e',definitionId:'elise',team:'player',starLevel:1,location:{kind:'board',cell:{col:2,row:4}}},
  ...base.preparation.units.filter(u=>u.team==='enemy')]} };
 const plain=buildStrategySnapshot(army),{state}=equipped(army),strategy=buildStrategySnapshot(state);
 const clone=strategy.units.find(u=>u.itemSummon)!;
 expect(clone.ability).toMatchObject({championId:'jayce-ranged'});
 expect(clone.stats.health).toBe(Math.floor(plain.units.find(u=>u.unitId==='j')!.stats.health*.7));
 expect(clone.stats.maxMana).toBe(Math.ceil(plain.units.find(u=>u.unitId==='j')!.stats.maxMana*1.1));
 expect(strategy.traits.map(t=>[t.traitId,t.count,t.tier])).toEqual(plain.traits.map(t=>[t.traitId,t.count,t.tier]));
 for(const trait of plain.traits.filter(t=>t.targetUnitIds.includes('j'))){
   expect(strategy.traits.find(t=>t.team===trait.team&&t.traitId===trait.traitId)!.targetUnitIds).toContain(clone.unitId);
 }
 const combat=createCombatWithEvents(state.preparation,strategy,'mirror-form').state;
 expect(combat.units.find(u=>u.id===clone.unitId)!.form).toBe('ranged');
 expect(new Set(combat.units.map(u=>u.cell.col+':'+u.cell.row)).size).toBe(combat.units.length);
});

it('full deployment cells do not overlap or mint an asset; compilation is deterministic',()=>{
 const base=createMatch(42);
 const army:MatchState={...base,preparation:{...base.preparation,units:Array.from({length:28},(_,i)=>({
   id:`filled-${i.toString().padStart(2,'0')}`,definitionId:'lux',team:'player' as const,starLevel:1 as const,
   location:{kind:'board' as const,cell:{col:i%7,row:4+Math.floor(i/7)}}}))}};
 const {state}=equipped(army),before=structuredClone(state),strategy=buildStrategySnapshot(state);
 expect(strategy.units.some(u=>u.itemSummon)).toBe(false);
 expect(state).toEqual(before);
 const reversed={...state,preparation:{...state.preparation,units:[...state.preparation.units].reverse()}};
 expect(buildStrategySnapshot(reversed)).toEqual(strategy);
});

it.each([
 ['giant-sized',2990,2093],
 ['fortified',2070,1449],
] as const)('copies actual opening HP with equipment/augment growth/%s, retaining naked other stats and restored battle inputs',(anomaly,maxHp,cloneHp)=>{
 const base=createMatch(42),round=getCatalogRoundById('2-1');
 let army:MatchState={...base,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},
  preparation:{...base.preparation,units:[{id:'unit-1',definitionId:'tristana',starLevel:2,team:'player',location:{kind:'board',cell:{col:3,row:4}}}]},
  augments:[{definitionId:'investment-strategy-i',choiceId:'test-investment',acquiredRound:1}],augmentProgress:{pumpingRounds:0,investmentHp:80},
  persistentGrowth:[{unitId:'unit-1',attackDamageBps:1250}],anomalyBinding:{unitId:'unit-1',definitionId:anomaly,choiceId:'test-anomaly',boundRound:1}};
 army=equipped(army).state;
 const g=grantMechanicItem(army,{receiptId:'warmog',source:'test',definitionId:'warmog'});if(!g.ok)throw Error(g.reason);
 const e=equipItem(g.state,g.state.items.at(-1)!.id,'unit-1',1);if(!e.ok)throw Error(e.reason);army=e.state;
 const input=compileBattle(snapshotForBattle(army,'A'),snapshotForBattle(army,'B'),42);
 const restored=restoreBattleInput(JSON.parse(JSON.stringify(input)));
 expect(restored).toEqual(input);
 let combat=startTwoSidedCombat(restored);
 const owner=combat.units.find(u=>u.team==='player'&&!u.itemSummon)!;
 const clone=combat.units.find(u=>u.team==='player'&&u.itemSummon?.kind==='mirror')!;
 // Tristana2: floor(550*1.8)=990. Warmog600 + investment growth80.
 // Giant adds1000, then Warmog12%: floor(2670*1.12)=2990; floor(*.7)=2093.
 // Fortified adds12%: floor(1670*1.24)=2070; floor(*.7)=1449.
 expect(owner.maxHp).toBe(maxHp);expect(clone.maxHp).toBe(cloneHp);
 expect(clone.itemSummonOpeningMaxHp).toBe(maxHp);expect(clone.maxMana).toBe(66);
 expect(clone.attackDamage).toBe(75);expect(owner.attackDamage).toBe(84);
 expect(clone.runtime!.permanentAdBps).toBe(0);
 expect(clone.sources!.some(s=>s.source.sourceKind==='augment'||s.source.sourceKind==='anomaly')).toBe(false);
 expect(clone.itemPrograms?.some(p=>p.source.sourceKind==='item'||p.source.sourceKind==='anomaly')).toBeFalsy();
 for(let n=0;n<81&&combat.status==='running';n++)combat=stepCombat(combat).state;
 expect(combat.units.find(u=>u.id===clone.id)!.maxHp).toBe(cloneHp);
 expect(startTwoSidedCombat(restored)).toEqual(startTwoSidedCombat(input));
});

it('restores inherited high equipment HP and rejects a forged opening maximum',()=>{
 let state=equipped().state;
 const g=grantMechanicItem(state,{receiptId:'large-health',source:'test',definitionId:'warmog'});if(!g.ok)throw Error(g.reason);
 const owner=state.preparation.units.find(u=>u.team==='player')!;
 const e=equipItem(g.state,g.state.items.at(-1)!.id,owner.id,1);if(!e.ok)throw Error(e.reason);
 const started=startMatchCombat(e.state);if(!started.ok)throw Error(started.reason);state=started.state;
 const clone=state.combat!.units.find(u=>u.itemSummon?.kind==='mirror')!;
 expect(clone.maxHp).toBe(Math.floor(state.combat!.units.find(u=>u.id===owner.id)!.maxHp*7/10));
 for(let n=0;n<40&&state.phase==='combat';n++){
  expect(restoreMatch(serializeMatch(state))).toEqual(state);state=stepMatch(state).state;
 }
 const bad=structuredClone(state);Object.assign(bad.combat!.units.find(u=>u.id===clone.id)!,{itemSummonOpeningMaxHp:clone.itemSummonOpeningMaxHp!+100});
 expect(()=>restoreMatch(bad)).toThrow('authoritative Mirror opening');
});
