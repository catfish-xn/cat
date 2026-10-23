import { expect, it } from 'vitest';
import { DEFAULT_BOARD, type HexCell } from '../src/simulation/board';
import { stepCombat, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, type S13Unit } from '../src/simulation/combat-s13-state';
import { lineContains, lineDirections } from '../src/simulation/combat-skill-lines';
import { planG22Cast } from '../src/simulation/combat-g2-2';
import { planG2Cast } from '../src/simulation/combat-g2';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { battle, freeze, unit } from './combat-helpers';

function hero(name:string, star:1|2|3=3, cell:HexCell={col:3,row:4}):S13Unit {
  return unit('p','player',cell.col,cell.row,{definitionId:name,starLevel:star,ability:resolveAbility(name+'-ability',star),
    hp:10000,maxHp:10000,mana:100,maxMana:100,attackDamage:100,abilityPower:100,attackRange:30,
    baseAttackSpeedBps:1,cooldownTicks:1000,moveCooldownTicks:1000,runtime:{...EMPTY_RUNTIME,castCount:1},
    statuses:[],tasks:[],shieldLayers:[],mechanics:[]}) as S13Unit;
}
function foe(id:string,col:number,row:number):S13Unit {
  return unit(id,'enemy',col,row,{definitionId:'neutral-stage-2',ability:resolveAbility('neutral-attack',1),
    hp:100000,maxHp:100000,attackDamage:0,mana:0,maxMana:0,cooldownTicks:1000,moveCooldownTicks:1000,
    runtime:{...EMPTY_RUNTIME},statuses:[],tasks:[],shieldLayers:[],mechanics:[]}) as S13Unit;
}
function context(units:S13Unit[]):AbilityContext {
  return {tick:1,combatId:'geometry',board:{...DEFAULT_BOARD,columns:20,rows:20},units,events:[],packets:[],heals:[],draw:()=>{throw Error('geometry must not draw RNG');}};
}
const damage=(events:readonly CombatEvent[])=>events.flatMap(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p'?[e.outcome]:[]);

it('three-star Zap pierces the target, includes length 14, excludes 15, sides and rear',()=>{
  const p=hero('jinx',3,{col:2,row:4}),t=foe('target',4,4);
  const ctx=context([p,t,foe('front',3,4),foe('end',16,4),foe('past',17,4),foe('side',5,5),foe('rear',1,4)]);
  expect(planG22Cast(ctx,p,t,1)).toEqual(['front','target','end']);
  expect(ctx.packets.map(p=>p.raw)).toEqual([2000,2000,2000]);
  for(const id of ['front','target','end']) {
    const stun=ctx.units.find(u=>u.id===id)!.statuses.find(s=>s.kind==='stun')!;
    expect(stun.expiresAtTick-stun.startsAtTick).toBe(200);
  }
});
it.each([1,2] as const)('Zap %s star retains its old target-ended path',(star)=>{
  const p=hero('jinx',star,{col:2,row:4}),t=foe('target',4,4),ctx=context([p,t,foe('past',5,4)]);
  expect(planG22Cast(ctx,p,t,1)).toEqual(['target']);expect(ctx.packets.map(p=>p.raw)).toEqual([265]);
});
it('Zap follows an oblique caster-target direction rather than a row or bent shortest path',()=>{
  const p=hero('jinx',3,{col:1,row:1}),t=foe('target',2,2),ctx=context([p,t,foe('beyond',3,4),foe('off',3,2)]);
  expect(planG22Cast(ctx,p,t,1)).toEqual(['target','beyond']);
});
it('integer line boundary vectors: full width 3, length 8, no rear or beyond-end hits',()=>{
  const from={col:2,row:4},east={col:3,row:4};
  for(const cell of [{col:3,row:3},{col:3,row:4},{col:3,row:5},{col:10,row:4}])expect(lineContains(from,east,cell,3,8)).toBe(true);
  for(const cell of [{col:3,row:2},{col:3,row:6},{col:11,row:4},{col:1,row:4}])expect(lineContains(from,east,cell,3,8)).toBe(false);
  expect(lineContains(from,from,from,1,14)).toBe(false);
  // Direction vectors stay correct even when the first step lies outside the board.
  const edge={col:0,row:0};
  expect(lineDirections(edge)).toEqual([{col:1,row:0},{col:0,row:1},{col:-1,row:1},{col:-1,row:0},{col:-1,row:-1},{col:0,row:-1}]);
  expect(lineContains(edge,{col:0,row:-1},{col:0,row:1},3,8)).toBe(false);
});
it.each([1,2,3] as const)('Mordekaiser %s star picks more enemies over the current-target line',(star)=>{
  const p=hero('mordekaiser',star),t=foe('target',4,4),ctx=context([p,t,foe('a',0,3),foe('b',0,4),foe('c',0,5)]);
  expect(planG22Cast(ctx,p,t,1)).toEqual(['a','b','c']);
  expect(ctx.packets.map(p=>p.raw)).toEqual(Array(3).fill([200,300,1000][star-1]));
});
it('Mordekaiser ties prefer a line containing current target, then E before W',()=>{
  const p=hero('mordekaiser'),east=foe('east',6,4),west=foe('west',0,4);
  let ctx=context([p,east,west]);expect(planG22Cast(ctx,p,west,1)).toEqual(['west']);
  const under=foe('under',3,4);ctx=context([p,east,west,under]);
  expect(planG22Cast(ctx,p,under,2)).toEqual(['under','east']);
});
it('Mordekaiser bonus stays limited to the globally nearest four, not four new targets per line',()=>{
  const p=hero('mordekaiser',1,{col:2,row:4}),t=foe('a',3,4);
  const ctx=context([p,t,foe('b',4,4),foe('c',5,4),foe('d',6,4),foe('e',7,4)]);
  expect(planG22Cast(ctx,p,t,1)).toEqual(['a','b','c','d','e']);
  expect(ctx.packets.map(p=>p.raw)).toEqual([200,200,200,200,160]);
});
it.each([1,2,3,4,5])('Malzahar divides exactly five stacks across %s hits in hit order',(count)=>{
  const p=hero('malzahar',1),targets=Array.from({length:count},(_,i)=>foe(String.fromCharCode(97+i),i+1,3));
  const ctx=context([p,...targets.slice().reverse()]);
  expect(planG2Cast(ctx,p,foe('center',3,3),1)).toEqual(targets.map(t=>t.id));
  expect(p.tasks).toHaveLength(5);
  const vectors=[[5],[3,2],[2,2,1],[2,1,1,1],[1,1,1,1,1]];
  expect(targets.map(t=>p.tasks.filter(task=>task.targetId===t.id).length)).toEqual(vectors[count-1]);
  expect(p.tasks.map(t=>t.amount)).toEqual([14,14,14,14,14]);
  expect(p.tasks.map(t=>t.ordinal)).toEqual([0,1,2,3,4]);
  expect(p.tasks.every(t=>t.executeAtTick===21)).toBe(true);
});
it.each(['jinx','mordekaiser','malzahar'])('%s whole-step packets/state/RNG survive JSON checkpoint and input permutation',(name)=>{
  const p=hero(name);p.runtime.castCount=0;
  const initial=battle([p,foe('a',4,4),foe('b',5,4),foe('c',5,5)],{rngState:42});
  const first=stepCombat(freeze(initial));expect(damage(first.events).length).toBeGreaterThan(0);expect(first.state.rngDraws).toBe(0);
  expect(stepCombat({...initial,units:[...initial.units].reverse()})).toEqual(first);
  expect(stepCombat(JSON.parse(JSON.stringify(first.state)))).toEqual(stepCombat(first.state));
});
