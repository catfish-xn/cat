import { expect,it } from 'vitest';
import { stepCombat,type CombatUnit,type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { battle,unit,freeze } from './combat-helpers';
import { packets,heals } from './helpers/replay2-views';
function hero(name:string,patch:Partial<CombatUnit>={}):CombatUnit{return unit('p','player',1,3,{definitionId:name,ability:resolveAbility(name+'-ability',1),hp:4000,maxHp:5000,armor:0,magicResist:0,mana:100,maxMana:100,attackDamage:100,attackRange:6,abilityPower:100,baseAttackSpeedBps:1,runtime:{...EMPTY_RUNTIME},statuses:[],shieldLayers:[],tasks:[],mechanics:[],...patch});}
function dummy(id='e',patch:Partial<CombatUnit>={}):CombatUnit{return unit(id,'enemy',2,3,{definitionId:'neutral-stage-2',ability:resolveAbility('neutral-attack',1),hp:10000,maxHp:10000,mana:0,maxMana:1,attackDamage:0,cooldownTicks:1000,moveCooldownTicks:1000,runtime:{...EMPTY_RUNTIME},statuses:[],shieldLayers:[],tasks:[],...patch});}
const raw=(events:readonly CombatEvent[])=>packets(events).filter(x=>x.source.ownerId==='p').map(x=>x.raw);
it.each([
 ['renata',[310]],['cassiopeia',[230]],['elise',[120]],['elise-ranged',[200]],['swain-ranged',[310]],
 ['gangplank',[680]],['gangplank-ranged',[305]],['smeech',[190,190,190]],['jayce',[500]],['jayce-ranged',[625,400,400]],
] as const)('%s source-backed first-cast coefficients',(name,expected)=>{
 const initial=freeze(battle([hero(name),dummy()],{rngState:42})),saved=JSON.stringify(initial);
 expect(raw(stepCombat(initial).events)).toEqual(expected);expect(JSON.stringify(initial)).toBe(saved);
});
it('Cassiopeia every third cast splashes only two other targets',()=>{
 const r=stepCombat(battle([hero('cassiopeia',{runtime:{...EMPTY_RUNTIME,castCount:2}}),dummy(),dummy('a',{cell:{col:3,row:3}}),dummy('b',{cell:{col:2,row:2}}),dummy('c',{cell:{col:3,row:2}})],{rngState:42}));
 expect(raw(r.events)).toEqual([230,160,160]);
});
it('Mundo splits the complete 1550 healing without truncation or duplicate pulses',()=>{
 let state=battle([hero('drmundo'),dummy()],{rngState:42});const events:CombatEvent[]=[];
 for(let i=0;i<41;i++){const step=stepCombat(freeze(state));state=step.state;events.push(...step.events);}
 expect(heals(events).filter(e=>e.unitId==='p').map(e=>e.requested)).toEqual([620,465,465]);
 expect(raw(events)).toEqual([120,120,350]);
});
it('Renni delayed damage and healing conserve complete source amounts',()=>{
 let state=battle([hero('renni'),dummy()],{rngState:42});const events:CombatEvent[]=[];
 for(let i=0;i<31;i++){const step=stepCombat(freeze(state));state=step.state;events.push(...step.events);}
 expect(raw(events).reduce((a,b)=>a+b,0)).toBe(700);
 expect(heals(events).filter(e=>e.unitId==='p').reduce((n,e)=>n+e.requested,0)).toBe(1050);
});
it('Silco accounts for all four monstrosities and twenty delayed attacks',()=>{
 let state=battle([hero('silco'),dummy()],{rngState:42});const events:CombatEvent[]=[];
 for(let i=0;i<=240;i++){const r=stepCombat(state);state=r.state;events.push(...r.events);}
 expect(raw(events)).toEqual([100,...Array(20).fill(36)]);
});
it('Swain pulses follow live adjacency and a killing contribution extends ascension once',()=>{
 let state=battle([hero('swain'),dummy('weak',{hp:1,maxHp:1}),dummy('far',{cell:{col:6,row:0}})],{rngState:42});
 for(let i=0;i<22;i++)state=stepCombat(state).state;
 const swain=state.units.find(u=>u.id==='p')!;
 expect(swain.g23?.ascension?.takedowns).toEqual(['weak']);
 expect(swain.g23!.ascension!.untilTick).toBeGreaterThan(121);
});
it('Rumble3 self-destruct deals20000% resists before last-unit elimination',()=>{
 const player=hero('rumble',{starLevel:3,hp:1,maxHp:1,mana:0,maxMana:150,armor:40,magicResist:60,cooldownTicks:1000,mechanics:[{source:{ownerId:'p',sourceKind:'trait',definitionId:'junker-king',instanceId:'test',effectIndex:0},mechanic:'g23Junker',values:{flame:0,rod:0,repair:0,death:1,tank:0,titan:0}}]});
 const enemy=dummy('e',{hp:10000,maxHp:10000,attackDamage:1000,cooldownTicks:0});
 const r=stepCombat(battle([player,enemy],{rngState:42}));
 const explosion=packets(r.events).find(p=>p.source.definitionId==='junker-king');expect(explosion?.raw).toBe(20000);expect(r.state.result).toBe('draw');
});
it('Smeech leaps again only after a kill, with the next three slashes reduced by source30%',()=>{
 let state=battle([hero('smeech'),dummy('e',{hp:1,maxHp:1}),dummy('far',{cell:{col:5,row:3}})],{rngState:42});
 const first=stepCombat(state);state=first.state;
 expect(state.units.find(u=>u.id==='e')!.alive).toBe(false);
 expect(state.units.find(u=>u.id==='p')!.tasks?.some(t=>t.kind==='g23Smeech')).toBe(true);
 const second=stepCombat(state);
 expect(packets(second.events).filter(p=>p.source.ownerId==='p'&&p.source.sourceKind==='ability').map(p=>p.raw)).toEqual([133,133,133]);
 expect(second.events.some(e=>e.type==='movement'&&e.unitId==='p')).toBe(true);
});

import {reviveG23Forge} from '../src/simulation/combat-g2-3-summons';
import type {AbilityContext} from '../src/simulation/combat-s13-abilities';
import type {S13Unit} from '../src/simulation/combat-s13-state';
import {DEFAULT_BOARD} from '../src/simulation/board';
it('forge revival relocates in owner coordinates, mirrors on the enemy side, and never duplicates or draws RNG',()=>{
 for(const team of ['player','enemy'] as const){
  const row=(value:number)=>team==='player'?value:7-value;
  const jayce=hero('jayce',{id:'j',team,cell:{col:2,row:row(4)}}) as S13Unit;
  const forge=hero('jayce',{id:'j:g23-forge',definitionId:'g23-forge',team,alive:false,hp:0,maxHp:1000,cell:{col:2,row:row(5)}}) as S13Unit;
  const blocker=dummy('blocker',{team,cell:{col:2,row:row(5)}}) as S13Unit;
  const ctx:AbilityContext={tick:10,combatId:'forge',board:DEFAULT_BOARD,units:[jayce,forge,blocker],events:[],packets:[],heals:[],draw:()=>{throw Error('forge must not draw');}};
  expect(reviveG23Forge(ctx,jayce)).toBe(forge);
  expect(forge.cell).toEqual({col:0,row:row(0)});expect(forge.hp).toBe(1000);expect(forge.alive).toBe(true);
  expect(ctx.events.map(e=>e.type)).toEqual(['movement','unitRevived']);
  expect(reviveG23Forge(ctx,jayce)).toBe(forge);expect(ctx.events).toHaveLength(2);expect(ctx.units).toHaveLength(3);
 }
});
