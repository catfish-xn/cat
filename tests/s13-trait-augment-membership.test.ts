import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { readCombatStats } from '../src/simulation/combat-s13';
import { settleAugmentDeaths } from '../src/simulation/combat-augment-effects';
import { validateMechanisms } from '../src/simulation/m8/restore';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import type { TraitProjectionContext, TraitProjectionSource } from '../src/simulation/traits/effective-membership';
import type { TraitSnapshot } from '../src/simulation/strategy-types';

const lifetime={activeFromRound:4,expiresBeforeRound:6};
const ctx=(sources:readonly TraitProjectionSource[],round=4):TraitProjectionContext=>({round,sources});
function inputs(names:string[],augment:string,round=4){
  const base=createMatch(42);
  return {...base,round,augments:[{definitionId:augment,choiceId:'test-augment',acquiredRound:1}],preparation:{...base.preparation,
    units:[...names.map((definitionId,i)=>({id:'p'+i,definitionId,starLevel:1 as const,team:'player' as const,
      location:{kind:'board' as const,cell:{col:i%7,row:4+Math.floor(i/7)}}})),
    {id:'enemy',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:3,row:0}}}]}};
}
function battle(names:string[],context?:TraitProjectionContext):CombatState{
  const state=inputs(names,'climb-the-ladder-i',context?.round??4);
  const strategy=buildStrategySnapshot(state,undefined,context);
  const started=createCombatWithEvents(state.preparation,strategy,'trait-climb',42,context).state;
  return stepCombat({...started,units:started.units.map(u=>({...u,cooldownTicks:2000,moveCooldownTicks:2000}))}).state;
}
function death(state:CombatState,id:string,traits:readonly TraitSnapshot[]|null=state.strategy?.traits??null):CombatState{
  const units=structuredClone(state.units) as S13Unit[],fallen=units.find(u=>u.id===id)!;
  fallen.hp=0;fallen.alive=false;fallen.statuses=[];fallen.mechanismState={...fallen.mechanismState!,statuses:[]};
  const context:AbilityContext={tick:state.tick,combatId:state.combatId,board:state.board,units,events:[],packets:[],heals:[],draw:()=>0};
  // Extra optional argument is the authenticated opening strategy, not candidate state.
  settleAugmentDeaths(context,[fallen],traits??undefined);
  return {...state,units};
}
function validate(state:CombatState):void{
  for(const u of state.units)validateMechanisms(u,state.units,state.tick,state.combatId!,false,state.nextActionSeq!,new Set(),false,state.strategy?.traits);
}
const recipient=(state:CombatState,id:string)=>state.units.find(u=>u.id===id)!;
function assertGrowth(before:CombatState,after:CombatState,id:string,grants:number){
  const a=readCombatStats(recipient(before,id),before),b=readCombatStats(recipient(after,id),after);
  expect(b.abilityPower-a.abilityPower).toBe(grants*3);
  expect(b.armor-a.armor).toBe(grants*3);
  expect(b.magicResist-a.magicResist).toBe(grants*3);
  const amounts=recipient(after,id).mechanismState!.statuses.flatMap(g=>g.contributions)
    .filter(c=>c.source.definitionId==='climb-the-ladder-i'&&c.application.modifier?.stat==='attackDamage')
    .map(c=>c.application.modifier!.value.kind==='constant'?c.application.modifier!.value.amount:0);
  expect(amounts).toEqual(Array(grants).fill(300));
}

it('Built Different: only the emblem Lux loses +300 HP/+45% AS; the other same-definition copy keeps both',()=>{
  const s=inputs(['darius','lux','lux'],'built-different');
  const context=ctx([{...lifetime,sourceId:'lux-emblem',kind:'emblem',unitId:'p1',traitId:'conqueror',itemInstanceId:'emblem'}]);
  const strategy=buildStrategySnapshot(s,undefined,context),luxA=strategy.units.find(u=>u.unitId==='p1')!,luxB=strategy.units.find(u=>u.unitId==='p2')!;
  expect(strategy.traits.find(t=>t.traitId==='conqueror'&&t.team==='player')).toMatchObject({tier:2,memberUnitIds:['p0','p1']});
  expect(luxA.stats.health).toBe(500);expect(luxA.stats.attackSpeedBonusBps).toBe(0);
  expect(luxB.stats.health).toBe(800);expect(luxB.stats.attackSpeedBonusBps).toBe(4500);
});
it('Built Different: removing native membership grants the bonus to one copy while the other still activates Conqueror',()=>{
  const s=inputs(['darius','darius','draven'],'built-different');
  const context=ctx([{...lifetime,sourceId:'remove-darius',kind:'remove-trait',unitId:'p0',traitId:'conqueror'}]);
  const strategy=buildStrategySnapshot(s,undefined,context);
  // Two Darius copies alone are only one Bruiser; p1 + Draven keep Conqueror2.
  const a=strategy.units.find(u=>u.unitId==='p0')!,b=strategy.units.find(u=>u.unitId==='p1')!;
  expect(a.stats.health-b.stats.health).toBe(300);
  expect(a.stats.attackSpeedBonusBps! - b.stats.attackSpeedBonusBps!).toBe(4500);
});
it('Built Different: temporary member/whole-unit entry and removal affect only the effective board, expire at the boundary',()=>{
  const s=inputs(['darius','lux','lux'],'built-different');
  const source:TraitProjectionSource={...lifetime,sourceId:'membership',kind:'add-trait',unitId:'p1',traitId:'conqueror'};
  for(const round of [3,6]){
    const snapshot=buildStrategySnapshot({...s,round},undefined,ctx([source],round));
    const control=buildStrategySnapshot({...s,round});expect(snapshot).toEqual(control);
  }
  const membershipRemoval:TraitProjectionSource={...lifetime,sourceId:'absence',kind:'remove-unit',unitId:'p0'};
  const strategy=buildStrategySnapshot(s,undefined,ctx([source,membershipRemoval]));
  expect(strategy.units.some(u=>u.unitId==='p0')).toBe(false);
  expect(strategy.units.find(u=>u.unitId==='p1')?.stats.health).toBe(800); // only one Conqueror remains
});
it('Climb: a temporary emblem shares an otherwise inactive trait with the dead unit; unrelated same-definition Lux gets no grant',()=>{
  const context=ctx([{...lifetime,sourceId:'lux-emblem',kind:'emblem',unitId:'p1',traitId:'conqueror',itemInstanceId:'emblem'}]);
  const before=battle(['darius','lux','lux'],context),after=death(before,'p0');
  assertGrowth(before,after,'p1',1);assertGrowth(before,after,'p2',0);
  validate(after);
  expect(death(after,'p0')).toEqual(after); // same death cannot pay again
});
it('Climb: temporary trait entry works even below the activation tier',()=>{
  const context=ctx([{...lifetime,sourceId:'lux-rebel',kind:'add-trait',unitId:'p1',traitId:'rebel'}]);
  const before=battle(['irelia','lux','lux'],context),after=death(before,'p0');
  expect(before.strategy!.traits.find(t=>t.traitId==='rebel'&&t.team==='player')).toMatchObject({count:2,tier:0});
  assertGrowth(before,after,'p1',1);assertGrowth(before,after,'p2',0);validate(after);
});
it('Climb: removal on the fallen member prevents native shared-trait grants',()=>{
  const context=ctx([{...lifetime,sourceId:'remove-owner',kind:'remove-trait',unitId:'p0',traitId:'conqueror'}]);
  const before=battle(['darius','draven'],context),after=death(before,'p0');
  assertGrowth(before,after,'p1',0);validate(after);
});
it('Climb: removal on only one Lux suppresses its shared Sorcerer grant; the other copy receives it',()=>{
  // Swain and Lux share Sorcerer; Lux Academy is not a second match.
  const context=ctx([{...lifetime,sourceId:'remove-recipient',kind:'remove-trait',unitId:'p1',traitId:'sorcerer'}]);
  const before=battle(['swain','lux','lux'],context),after=death(before,'p0');
  assertGrowth(before,after,'p1',0);assertGrowth(before,after,'p2',1);validate(after);
});
it('Climb: expired membership restores native numerical eligibility',()=>{
  const source:TraitProjectionSource={...lifetime,sourceId:'emblem',kind:'emblem',unitId:'p1',traitId:'conqueror',itemInstanceId:'emblem'};
  const before=battle(['darius','lux','lux'],ctx([source],6)),after=death(before,'p0');
  assertGrowth(before,after,'p1',0);assertGrowth(before,after,'p2',0);validate(after);
});
it('Climb: the actual lethal combat tick uses frozen instance membership and JSON continuation stays exact',()=>{
  const context=ctx([{...lifetime,sourceId:'lux-emblem',kind:'emblem',unitId:'p1',traitId:'conqueror',itemInstanceId:'emblem'}]);
  const started=battle(['darius','lux','lux'],context);
  const before={...started,units:started.units.map(u=>u.id==='enemy'?{...u,cell:{col:0,row:3},attackDamage:10000,attackDamageBase:10000,attackDamagePercentBps:0,attackRange:20,baseCritChanceBps:0,cooldownTicks:0}
    :{...u,hp:u.id==='p0'?1:u.hp,cooldownTicks:2000,moveCooldownTicks:2000})};
  const next=stepCombat(before);
  expect(recipient(next.state,'p0').alive).toBe(false);
  assertGrowth(before,next.state,'p1',1);assertGrowth(before,next.state,'p2',0);
  expect(stepCombat(JSON.parse(JSON.stringify(before)))).toEqual(next);
});
it('No context: frozen snapshots keep native Built Different and Climb totals, including inactive shared traits',()=>{
  for(const names of [['darius','lux','lux'],['lux','leona','ezreal','darius'],['swain','lux','lux'],['darius','draven']]){
    const s=inputs(names,'built-different');expect(buildStrategySnapshot(s,undefined,ctx([]))).toEqual(buildStrategySnapshot(s));
    const before=battle(names),projected=death(before,'p0'),native=death(before,'p0',null);
    // Explicit old/native eligibility, independent of snapshot projection.
    const same=names[0]==='lux'?['p1','p2']:names[0]==='swain'?['p1','p2']:names[1]==='draven'?['p1']:[];
    for(let i=1;i<names.length;i++)assertGrowth(before,projected,'p'+i,same.includes('p'+i)?1:0);
    expect(projected).toEqual(native);validate(projected);
  }
});

it('Climb restore requires complete dynamic grants and rejects grants to a removed member',()=>{
  const addition=ctx([{...lifetime,sourceId:'emblem',kind:'emblem',unitId:'p1',traitId:'conqueror',itemInstanceId:'emblem'}]);
  const genuine=death(battle(['darius','lux','lux'],addition),'p0');validate(genuine);
  const missing=structuredClone(genuine),holder=recipient(missing,'p1') as S13Unit;
  holder.statuses=[];holder.mechanismState={...holder.mechanismState!,statuses:[]};
  expect(()=>validate(missing)).toThrow('augment climb complete death grant');
  const native=death(battle(['swain','lux','lux']),'p0');
  const removal=ctx([{...lifetime,sourceId:'remove',kind:'remove-trait',unitId:'p1',traitId:'sorcerer'}]);
  const frozen=battle(['swain','lux','lux'],removal).strategy;
  expect(()=>validate({...native,strategy:frozen})).toThrow('augment shared trait');
});
