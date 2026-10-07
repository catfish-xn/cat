import {describe,it,expect} from 'vitest';
import {compileTemporaryPrograms,projectTemporaryEquipment} from '../src/simulation/m8/equipment';
import {stepCombat,type CombatUnit} from '../src/simulation/combat';
import {resolveAbility} from '../src/simulation/combat-abilities';
import {EMPTY_RUNTIME} from '../src/simulation/combat-s13-state';
import type {Effect} from '../src/simulation/m8/contracts';
import {trigger,source,modifier} from './fixtures/m8-contract-cases';
import {battle,unit} from './combat-helpers';
const roll={parentItemInstanceId:'parent',roundId:'r',playerLevelSnapshot:7,poolVersion:'tg-01-v1' as const,children:['x','y'] as const,rngDrawStart:0,rngDrawEnd:2};
const dummy=(id:string,team:'player'|'enemy',col:number,row:number,patch:Partial<CombatUnit>={}):CombatUnit=>unit(id,team,col,row,{ability:resolveAbility('neutral-attack',1),unitKind:'neutral',baseAttackSpeedBps:8000,attackIntervalTicks:25,baseCritChanceBps:0,baseCritMultiplierBps:14000,hp:1000,maxHp:1000,armor:0,magicResist:0,attackDamage:10,attackRange:6,cooldownTicks:1000,moveCooldownTicks:1000,mana:0,maxMana:0,runtime:{...EMPTY_RUNTIME},...patch});
function definitions(effect:Effect){
 const program=compileTemporaryPrograms(projectTemporaryEquipment(roll,'p'),{x:{modifiers:[],effects:[effect]},y:{modifiers:[],effects:[]}});
 const d=trigger({source:program.effects[0].source,event:'combat-start',maxPerCombat:1,effects:[program.effects[0].effect]});
 return{periodicTasks:[],vamp:[],survivalTriggers:[],eventTriggers:[d]};
}
describe('G12 bound temporary programs use the common combat-start consumers',()=>{
 it('next-tick temporary AS bound at0 is effective for the first attack at1:8000×1.15→22ticks',()=>{
  const effect:Effect={kind:'modify-stat',modifier:modifier('attackSpeed',1500,{unit:'bps'}),activation:'next-tick',duration:{kind:'combat'},stackPolicy:{kind:'independent-instances'}};
  const p=dummy('p','player',1,3,{cooldownTicks:0,mechanismDefinitions:definitions(effect)}),e=dummy('e','enemy',2,3);
  const result=stepCombat(battle([p,e]));expect(result.state.units.find(u=>u.id==='p')?.cooldownTicks).toBe(22);
  const contribution=result.state.units.find(u=>u.id==='p')?.mechanismState?.statuses[0].contributions[0];
  expect(contribution).toMatchObject({appliedAtTick:1,source:{parentItemInstanceId:'parent',instanceId:JSON.stringify(['parent','r',1])}});
  expect(stepCombat(JSON.parse(JSON.stringify(result.state)))).toEqual(stepCombat(result.state));
 });
 it('clearing aggro through a temporary status dispatches the same target-changed occurrence to listeners',()=>{
  const effect:Effect={kind:'apply-status',status:{kind:'untargetable',magnitudeBps:10000,duration:{kind:'ticks',ticks:20},activation:'immediate',stackPolicy:{kind:'independent-instances'},removable:false,polarity:'beneficial',damageFilter:null,onEnd:null}};
  const listener=trigger({source:source('listener','i','e'),event:'target-changed',effects:[{kind:'modify-stat',modifier:modifier('attackSpeed',1500,{unit:'bps'}),activation:'immediate',duration:{kind:'combat'},stackPolicy:{kind:'add-stacks',cap:null}}]});
  const p=dummy('p','player',1,3,{mechanismDefinitions:definitions(effect)}),e=dummy('e','enemy',2,3,{targetId:'p',mechanismDefinitions:{periodicTasks:[],vamp:[],survivalTriggers:[],eventTriggers:[listener]}});
  const result=stepCombat(battle([p,e]));
  expect(result.events.filter(e=>e.type==='targetChanged'&&e.unitId==='e')).toHaveLength(1);
  expect(result.state.units.find(u=>u.id==='e')?.runtime?.attackSpeedBps).toBe(1500);
 });
 it('initial temporary status freezes before the shared opening selection, without a movement or reroll',()=>{
  const effect:Effect={kind:'apply-status',status:{kind:'untargetable',magnitudeBps:10000,duration:{kind:'ticks',ticks:20},activation:'immediate',stackPolicy:{kind:'independent-instances'},removable:false,polarity:'beneficial',damageFilter:null,onEnd:null}};
  const p=dummy('p','player',3,4,{mechanismDefinitions:definitions(effect)}),h=dummy('h','enemy',3,1);
  const result=stepCombat({...battle([p,h]),openingDefinitions:[{kind:'path-charge',source:{...source('open','h','h'),sourceKind:'ability'},effects:[]}]});
  expect(result.events.filter(e=>e.type==='movement')).toEqual([]);expect(result.state.openingState?.plans[0].result).toBe('no-target');
  expect(result.state.units.find(u=>u.id==='p')?.mechanismState?.statuses[0].contributions[0]).toMatchObject({appliedAtTick:0,expiresAtTick:20});
  expect(result.state.rngDraws).toBe(0);
 });
});
