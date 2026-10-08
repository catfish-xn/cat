import {describe,it,expect} from 'vitest';
import {stepCombat,type CombatUnit} from '../src/simulation/combat';
import {resolveAbility} from '../src/simulation/combat-abilities';
import {EMPTY_MECHANISMS} from '../src/simulation/m8/runtime-types';
import {EMPTY_RUNTIME} from '../src/simulation/combat-s13-state';
import {applyStatusContribution} from '../src/simulation/m8/status';
import {effectIdentity} from '../src/simulation/m8/identity';
import {selectAbilityTargets} from '../src/simulation/m8/targeting';
import {DEFAULT_BOARD} from '../src/simulation/board';
import {trigger,source,selector} from './fixtures/m8-contract-cases';
import {battle,unit} from './combat-helpers';
const dummy=(id:string,team:'player'|'enemy',col:number,patch:Partial<CombatUnit>={}):CombatUnit=>unit(id,team,col,3,{ability:resolveAbility('neutral-attack',1),hp:1000,maxHp:1000,armor:0,magicResist:0,attackDamage:100,cooldownTicks:1000,moveCooldownTicks:1000,attackRange:6,mana:0,maxMana:0,runtime:{...EMPTY_RUNTIME},...patch});
const status=(kind:'untargetable'|'damage-prevention',until=3)=>applyStatusContribution([],effectIdentity('standalone',{...source('phase','i','e'),effectIndex:kind==='damage-prevention'?1:0},'e'),{kind,magnitudeBps:10000,duration:{kind:'ticks',ticks:until},activation:'immediate',stackPolicy:{kind:'refresh-same-instance',magnitude:'replace',phase:'preserve'},removable:false,polarity:'beneficial',damageFilter:null,onEnd:null},0).groups;
describe('G11 current eligibility independent from already-bound damage and prevention',()=>{
 it('ordinary target and current aggro clear while untargetable; expiry tick reselects before actions',()=>{
  const p=dummy('p','player',1,{targetId:'e',cooldownTicks:0});const e=dummy('e','enemy',2,{mechanismState:{...EMPTY_MECHANISMS,statuses:status('untargetable')}});
  const first=stepCombat(battle([p,e]));expect(first.state.units.find(u=>u.id==='p')?.targetId).toBeNull();expect(first.events.filter(e=>e.type==='attack')).toEqual([]);
  const expired=stepCombat({...first.state,tick:2});expect(expired.events.find(e=>e.type==='attack')).toMatchObject({targetId:'e'});
 });
 it('already attached DOT ignores untargetability; independent prevention absorbs neitherHP nor shield',()=>{
  const task={key:'dot',kind:'bleed' as const,source:{...source('dot','p','p'),sourceKind:'ability' as const},executeAtTick:1,targetId:'e',amount:100,ordinal:0,total:1,cancellable:false,actionSeq:0,attachedDot:true};
  const p=dummy('p','player',1,{tasks:[task]});const e=dummy('e','enemy',2,{mechanismState:{...EMPTY_MECHANISMS,statuses:status('untargetable')}});
  const hit=stepCombat(battle([p,e]));expect(hit.events.find(e=>e.type==='packetDamage')).toMatchObject({hpDamage:100});
  const blocked=stepCombat(battle([p,{...e,mechanismState:{...EMPTY_MECHANISMS,statuses:[...status('untargetable'),...status('damage-prevention')]}}]));
  expect(blocked.events.find(e=>e.type==='packetDamage')).toMatchObject({hpDamage:0,absorbed:0});
 });
 it('area members can be untargetable while new chain/single centers exclude them',()=>{
  const units=[{id:'h',team:'player' as const,cell:{col:3,row:4},hp:100,maxHp:100,alive:true},{id:'p',team:'enemy' as const,cell:{col:3,row:3},hp:100,maxHp:100,alive:true},{id:'a',team:'enemy' as const,cell:{col:3,row:2},hp:100,maxHp:100,alive:true,untargetable:true}];
  const env={board:DEFAULT_BOARD,units,holderId:'h',primaryId:'p',tick:1};
  const area=selectAbilityTargets({kind:'area-around-selected',center:selector({primary:'first-required',relation:'enemy'}),radius:1,relation:'enemy',order:'id'},env);
  expect(area.targetIds).toEqual(['a','p']);
  expect(selectAbilityTargets({kind:'chain',primaryId:'p',radius:1,additionalTargets:1,tieBreak:'id',order:'nearest-previous',distinctSecondary:true},env).targetIds).toEqual(['p']);
  expect(selectAbilityTargets({kind:'fixed',targetIds:['a','p','a'],ifMissing:'skip'},env).targetIds).toEqual(['a','p','a']);
 });
 it('existing random-center ability excludes untargetable centers but its area still deals100 to them',()=>{
  const task={key:'area',kind:'caitlyn' as const,source:{...source('area','p','p'),sourceKind:'ability' as const},executeAtTick:1,targetId:null,amount:100,ordinal:0,total:1,cancellable:false,actionSeq:0};
  const p=dummy('p','player',1,{tasks:[task]}),visible=dummy('v','enemy',3),hidden=dummy('e','enemy',3,{cell:{col:3,row:4},mechanismState:{...EMPTY_MECHANISMS,statuses:status('untargetable')}});
  const result=stepCombat(battle([p,visible,hidden]));
  expect(result.events.find(e=>e.type==='packetDamage'&&e.unitId==='e')).toMatchObject({raw:100,hpDamage:100});
  expect(result.state.rngDraws).toBe(1);
 });
 it('finite shield-end area keeps its generic selector and hits an untargetable neighbor for20',()=>{
  const p=dummy('p','player',1,{mana:1,maxMana:1,ability:{id:'synthetic-shield',kind:'s13',championId:'irelia',amount:0,variables:{ShieldHealth:1000000,ShieldDuration:500,StrikeBaseDamage:200000,PercentShieldDamage:0}}});
  const v=dummy('v','enemy',2,{cell:{col:2,row:4}}),e=dummy('e','enemy',2,{mechanismState:{...EMPTY_MECHANISMS,statuses:status('untargetable')}});
  const first=stepCombat(battle([p,v,e]));
  const end=stepCombat(first.state);
  expect(end.events.find(e=>e.type==='packetDamage'&&e.unitId==='e')).toMatchObject({raw:20,hpDamage:20});
 });
 it('night-like cleanse removes hostile attachedDOT, keeps benign buff/lock, and clears enemies targeting holder',()=>{
  const d=trigger({source:source('cleanse','i','p'),event:'post-damage-survival',listener:{subject:'target',relationToHolder:'self',withinHexes:null},maxPerCombat:1,effects:[{kind:'cleanse',remove:'removable-hostile-control-dot-debuff',retarget:true},{kind:'apply-status',status:{kind:'untargetable',magnitudeBps:10000,duration:{kind:'ticks',ticks:20},activation:'immediate',stackPolicy:{kind:'refresh-same-instance',magnitude:'replace',phase:'preserve'},removable:false,polarity:'beneficial',damageFilter:null,onEnd:null}}]});
  const retained=applyStatusContribution([],effectIdentity('standalone',source('own-benefit','buff','p'),'p'),{kind:'stat-buff',magnitudeBps:0,modifier:{stat:'abilityPower',unit:'flat',value:{kind:'constant',amount:10},condition:{kind:'always'},damageFilter:null},duration:{kind:'combat'},activation:'immediate',stackPolicy:{kind:'independent-instances'},removable:true,polarity:'beneficial',damageFilter:null,onEnd:null},0).groups;
  const p=dummy('p','player',1,{manaLockedUntilTick:50,mechanismState:{...EMPTY_MECHANISMS,statuses:retained},mechanismDefinitions:{periodicTasks:[],vamp:[],survivalTriggers:[d]}});
  const e=dummy('e','enemy',2,{cooldownTicks:0,targetId:'p',tasks:[{key:'dot',kind:'bleed',source:{...source('dot','e','e'),sourceKind:'ability'},executeAtTick:20,targetId:'p',amount:100,ordinal:0,total:1,cancellable:false,actionSeq:0,attachedDot:true}]});
  const r=stepCombat(battle([p,e]));expect(r.state.units.find(u=>u.id==='e')?.tasks).toEqual([]);expect(r.state.units.find(u=>u.id==='e')?.targetId).toBeNull();expect(r.state.units.find(u=>u.id==='p')?.manaLockedUntilTick).toBe(50);expect(r.state.units.find(u=>u.id==='p')?.mechanismState?.statuses.some(g=>g.kind==='stat-buff')).toBe(true);
 });
});
