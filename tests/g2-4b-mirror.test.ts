import {expect,it} from 'vitest';
import {createMatch,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {countsG23SurvivorDamage} from '../src/simulation/g2-3-summons';
import {createCombatWithEvents} from '../src/simulation/combat';
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
