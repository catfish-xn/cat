import {describe,it,expect} from 'vitest';
import {stepCombat,type CombatUnit} from '../src/simulation/combat';
import {resolveAbility} from '../src/simulation/combat-abilities';
import {EMPTY_RUNTIME} from '../src/simulation/combat-s13-state';
import {EMPTY_MECHANISMS} from '../src/simulation/m8/runtime-types';
import {applyStatusContribution} from '../src/simulation/m8/status';
import {effectIdentity} from '../src/simulation/m8/identity';
import {source,trigger,selector,amount} from './fixtures/m8-contract-cases';
import {battle,unit} from './combat-helpers';
const dummy=(id:string,team:'player'|'enemy',col:number,patch:Partial<CombatUnit>={}):CombatUnit=>unit(id,team,col,3,{ability:resolveAbility('neutral-attack',1),hp:10000,maxHp:10000,armor:0,magicResist:0,attackDamage:0,cooldownTicks:1000,moveCooldownTicks:1000,attackRange:6,mana:0,maxMana:1000,runtime:{...EMPTY_RUNTIME},...patch});
const defs=(eventTriggers:readonly ReturnType<typeof trigger>[])=>({periodicTasks:[],survivalTriggers:[],vamp:[],eventTriggers});
describe('G09 S13 event consumers',()=>{
 it('one completed Kog attack with two packets grants extra5 once and ordinary10 once',()=>{
  const d=trigger({source:source('mana','i','p'),effects:[{kind:'grant-mana',amount:5,reason:'attack',bypassLock:'none'}]});
  const p=dummy('p','player',1,{ability:resolveAbility('kogmaw-ability',1),cooldownTicks:0,attackDamage:100,mechanismDefinitions:defs([d])});
  const r=stepCombat(battle([p,dummy('e','enemy',2)]));
  expect(r.events.filter(e=>e.type==='packetDamage')).toHaveLength(2);expect(r.state.units.find(u=>u.id==='p')?.mana).toBe(15);
  expect(r.state.units.find(u=>u.id==='p')?.triggerLedger?.runtimes[0].triggerCount).toBe(1);
  expect(stepCombat(JSON.parse(JSON.stringify(r.state)))).toEqual(stepCombat(r.state));
 });
 it('enemy completed receipt spends80; two independent ion-like listeners request128 each, no extra attacks',()=>{
  const one=trigger({source:source('penalty','i1','p'),event:'cast-completed',listener:{subject:'actor',relationToHolder:'enemy',withinHexes:2},selector:selector({candidates:'event-actor',relation:'enemy'}),effects:[{kind:'damage',damageType:'magic',delivery:'equipment-proc',critEligibility:'never',amount:amount(0,{actualManaSpentBps:16000})}]});
  const r=stepCombat(battle([dummy('p','player',1,{mechanismDefinitions:defs([one,{...one,source:{...one.source,instanceId:'i2'}}])}),dummy('e','enemy',2,{ability:resolveAbility('zyra-ability',1),mana:80,maxMana:80})]));
  expect(r.events.flatMap(e=>e.type==='packetDamage'&&e.source.sourceKind==='item'?[[e.unitId,e.raw]]:[])).toEqual([['e',128],['e',128]]);
  expect(r.events.filter(e=>e.type==='attack')).toHaveLength(0);
 });
 it('shield-hit grants immediate damage amplification only to later packets; counters still count occurrences',()=>{
  const d=trigger({source:source('shield-response','i','p'),event:'shield-hit',effects:[{kind:'modify-stat',activation:'immediate',duration:{kind:'ticks',ticks:60},stackPolicy:{kind:'refresh-same-instance',magnitude:'replace',phase:'preserve'},modifier:{stat:'damageAmp',unit:'bps',value:{kind:'constant',amount:2000},condition:{kind:'always'},damageFilter:null}}]});
  const ability=resolveAbility('kogmaw-ability',1);if(ability.kind!=='s13')throw Error('fixture');
  const p=dummy('p','player',1,{ability:{...ability,variables:{...ability.variables,DamageOnAttack:1000000}},cooldownTicks:0,attackDamage:100,mechanismDefinitions:defs([d])});
  const e=dummy('e','enemy',2,{shield:50,shieldExpiresAtTick:100,shieldLayers:[{key:'shield',source:source('shield','e','e'),granted:50,remaining:50,absorbed:0,expiresAtTick:100}]});
  const r=stepCombat({...battle([p,e]),rngState:42});
  expect(r.events.flatMap(e=>e.type==='packetDamage'?[[e.absorbed,e.hpDamage]]:[])).toEqual([[50,50],[0,120]]);
 });
 it('IF-DEATH two same-family deaths pay134 then44 at t+1 after wound, with per-request current missingHP',()=>{
  const s={...source('reaction','a','a'),sourceKind:'ability' as const};
  const wound=applyStatusContribution([],effectIdentity('standalone',source('wound','w','p'),'a'),{kind:'wound',magnitudeBps:3300,duration:{kind:'ticks',ticks:100},stackPolicy:{kind:'strongest-category',category:'wound',retainSuppressed:true},activation:'immediate',polarity:'harmful',removable:true,damageFilter:null,onEnd:null},0).groups;
  const member=(id:string,col:number,hp:number)=>dummy(id,'enemy',col,{hp,maxHp:1000,unitKind:'neutral',encounterId:'enc',monsterFamily:'family'});
  const ability=resolveAbility('scar-ability',1);if(ability.kind!=='s13')throw Error('fixture');
  const p=dummy('p','player',0,{ability:{...ability,variables:{...ability.variables,Damage:1000000,StunDuration:500}},mana:1000});
  const a={...member('a',1,900),mechanismState:{...EMPTY_MECHANISMS,statuses:wound},companionDefinitions:[{source:s,effects:[{kind:'heal' as const,amount:amount(0,{missingHpBps:10000})}]}]};
  const first=stepCombat({...battle([p,a,member('b',2,100),member('c',3,100)]),tick:9});
  expect(first.events.filter(e=>e.type==='death').map(e=>e.unitId)).toEqual(['b','c']);
  expect(first.state.companionState?.reactions.map(r=>r.status)).toEqual(['pending','pending']);
  const next=stepCombat(first.state);expect(next.events.flatMap(e=>e.type==='heal'&&e.unitId==='a'?[[e.requested,e.actual]]:[])).toEqual([[200,134],[66,44]]);
  expect(stepCombat(JSON.parse(JSON.stringify(first.state)))).toEqual(next);
  const killed=stepCombat({...first.state,units:first.state.units.map(u=>u.id==='p'?{...u,cooldownTicks:0,attackDamage:1000}:u)});
  expect(killed.events.filter(e=>e.type==='heal'&&e.unitId==='a')).toEqual([]);
 });
});
