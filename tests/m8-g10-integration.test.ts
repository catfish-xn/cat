import {describe,it,expect} from 'vitest';
import {stepCombat,type CombatUnit} from '../src/simulation/combat';
import {resolveAbility} from '../src/simulation/combat-abilities';
import {source,amount,trigger} from './fixtures/m8-contract-cases';
import {battle,unit} from './combat-helpers';
import {applyStatusContribution} from '../src/simulation/m8/status';
import {effectIdentity} from '../src/simulation/m8/identity';
import {EMPTY_MECHANISMS} from '../src/simulation/m8/runtime-types';
import {packetView} from './helpers/replay2-views';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
const dummy=(id:string,team:'player'|'enemy',col:number,row:number,patch:Partial<CombatUnit>={}):CombatUnit=>({...unit(id,team,col,row,{hp:1000,maxHp:1000,armor:0,magicResist:0,attackDamage:0,attackRange:6,cooldownTicks:1000,moveCooldownTicks:1000}),ability:resolveAbility('neutral-attack',1),...patch});
const def={kind:'path-charge' as const,source:{...source('finite-charge','h','h'),sourceKind:'ability' as const},effects:[{kind:'damage' as const,damageType:'magic' as const,delivery:'ability-direct' as const,critEligibility:'never' as const,amount:amount(0,{maxHpBps:1500,hpBasis:'target',cap:300,sample:'packet'})}]};
describe('G10 actual opening hook and finite delayed execution',()=>{
 it('tick1 control cancels delayed opening damage but cannot retroactively block the tick0 movement',()=>{
  const from={...source('finite-open','h','h'),sourceKind:'ability' as const};
  // B9: the same stun (source finite-open, ticks [1,3)) as a frozen contribution; legacy-only statuses are rejected by S13.
  const stun=applyStatusContribution([],effectIdentity('g10-control',from,'h'),{kind:'stun',magnitudeBps:0,activation:'immediate',duration:{kind:'ticks',ticks:2},stackPolicy:{kind:'independent-instances'},removable:true,polarity:'harmful',damageFilter:null,onEnd:null},1).groups;
  if(stun[0]?.contributions[0]?.appliedAtTick!==1||stun[0].contributions[0].expiresAtTick!==3)throw new Error('fixture status mismatch');
  const h=dummy('h','enemy',3,1,{cell:{col:3,row:1},mechanismState:{...EMPTY_MECHANISMS,combatId:'g10-control',statuses:stun}});
  const p=dummy('p','player',3,4,{cell:{col:3,row:4}});
  const start={...battle([h,p]),openingDefinitions:[{kind:'path-charge' as const,source:from,effects:[{kind:'damage' as const,damageType:'magic' as const,delivery:'ability-direct' as const,critEligibility:'never' as const,amount:amount(150)}]}]};
  const step=stepCombat(start);
  expect(step.events.find(e=>e.type==='movement')).toMatchObject({tick:0,unitId:'h',to:{col:2,row:5}});
  expect(step.state.openingState?.plans[0].task?.status).toBe('cancelled');
  expect(step.events.filter(e=>e.type==='packetDamage')).toEqual([]);
  expect(step.state.units.find(u=>u.id==='h')?.cell).toEqual({col:2,row:5});
 });

 it('starting-row listener stays frozen after movement while target positions remain current',()=>{
  const d=trigger({source:source('row-rule','i','p'),condition:{kind:'starting-rows',rows:'front-two'},effects:[{kind:'grant-mana',amount:1,reason:'attack',bypassLock:'none'}]});
  const p=dummy('p','player',1,4,{cooldownTicks:0,mana:0,maxMana:1000,mechanismDefinitions:{periodicTasks:[],vamp:[],survivalTriggers:[],eventTriggers:[d]}});
  const first=stepCombat(battle([p,dummy('e','enemy',2,4)]));expect(first.state.units.find(u=>u.id==='p')?.mana).toBe(1);
  const second=stepCombat({...first.state,units:first.state.units.map(u=>u.id==='p'?{...u,cell:{col:1,row:7},cooldownTicks:0}:u)});expect(second.state.units.find(u=>u.id==='p')?.mana).toBe(2);
 });
 it('commits movement at0 then150 damage in normaltick1 batch; restored state never repositions',()=>{
  const start={...battle([dummy('h','enemy',3,1),dummy('p','player',3,4)]),openingDefinitions:[def]};
  const first=stepCombat(start);
  expect(first.events.find(e=>e.type==='movement')).toMatchObject({tick:0,unitId:'h',from:{col:3,row:1},to:{col:2,row:5}});
  expect(packetView(first.events.find(e=>e.type==='packetDamage')!)).toMatchObject({tick:1,unitId:'p',raw:150,hpDamage:150});
  expect(first.state.openingState?.plans[0].task?.status).toBe('executed');
  const next=stepCombat(JSON.parse(JSON.stringify(first.state)));expect(next.events.filter(e=>e.type==='movement'||e.type==='packetDamage')).toEqual([]);
 });
});
