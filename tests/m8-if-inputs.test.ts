import {describe,it,expect} from 'vitest';
import {compileUnitInputs,validateNeutralInputs} from '../src/simulation/m8/unit-inputs';
import {resolveUnitStats} from '../src/simulation/unit-stats';
import {UNIT_DEFINITIONS} from '../src/simulation/units';
import {interval,EMPTY_RUNTIME,type S13Unit} from '../src/simulation/combat-s13-state';
import {stepCombat} from '../src/simulation/combat';
import {resolveAbility} from '../src/simulation/combat-abilities';
import {battle,unit} from './combat-helpers';
const definition={...UNIT_DEFINITIONS['neutral-stage-2'],unitKind:'neutral' as const,monsterFamily:'future',initialMana:0,maxMana:0,baseAttackSpeedBps:8000,baseCritChanceBps:2500,baseCritMultiplierBps:14000};
const actor=()=>({...unit('a','player',2,2),...compileUnitInputs(resolveUnitStats(definition,1)),ability:resolveAbility('neutral-attack',1),attackDamage:85,attackDamageBase:85,attackRange:1,armor:0,magicResist:0,mana:0,maxMana:0,runtime:{...EMPTY_RUNTIME},statuses:[],shieldLayers:[],tasks:[],attackCone:{secondaryDamageBps:3500}});
describe('IF-AS/IF-CRIT actual neutral input consumers (no new monster content)',()=>{
 it('0/1/2/5 stack intervals25/22/20/15 use original8000 AS; current cooldown7 only advances to6',()=>{
  const p=actor();expect([0,1,2,5].map(n=>interval({...p,runtime:{...p.runtime,attackSpeedBps:n*1500}} as S13Unit,0))).toEqual([25,22,20,15]);
  const first=stepCombat(battle([{...p,cooldownTicks:7,runtime:{...p.runtime,attackSpeedBps:7500}},unit('e','enemy',3,2,{hp:10000,maxHp:10000,cooldownTicks:100})]));
  expect(first.state.units.find(u=>u.id==='a')?.cooldownTicks).toBe(6);
 });
 it('word0 (predecessor634785765, not seed0) gives85→119 plus two29 never packets, only1combat word',()=>{
  const p=actor();expect(p.spellCrit).toMatchObject({enabled:false,chanceBps:2500,multiplierBps:14000,itemSources:[],nonItemSources:[]});
  const enemy=(id:string,col:number,row:number)=>({...unit(id,'enemy',col,row,{hp:10000,maxHp:10000,armor:0,magicResist:0,cooldownTicks:100,moveCooldownTicks:100}),ability:resolveAbility('neutral-attack',1)});
  const initial={...battle([p,enemy('p',3,2),enemy('b',4,2),enemy('c',4,1)]),rngState:634785765};
  const r=stepCombat(initial);
  expect(r.events.flatMap(e=>e.type==='packetDamage'?[[e.unitId,e.raw,e.critical]]:[])).toEqual([['b',29,false],['c',29,false],['p',119,true]]);
  expect(r.state.rngDraws).toBe(1);expect(r.events.filter(e=>e.type==='attack')).toHaveLength(1);
  expect(stepCombat(JSON.parse(JSON.stringify(initial)))).toEqual(r);expect(stepCombat(JSON.parse(JSON.stringify(r.state)))).toEqual(stepCombat(r.state));
 });
 it('formal neutral input rejects missing probability, mismatchedAS interval and1/0 mana; old guard remains0crit',()=>{
  expect(()=>validateNeutralInputs({...definition,baseCritChanceBps:undefined})).toThrow();
  expect(()=>validateNeutralInputs({...definition,attackIntervalTicks:26})).toThrow();
  expect(()=>validateNeutralInputs({...definition,initialMana:1})).toThrow();
  expect(compileUnitInputs(resolveUnitStats(UNIT_DEFINITIONS['neutral-stage-2'],1)).spellCrit).toBeUndefined();
 });
});
