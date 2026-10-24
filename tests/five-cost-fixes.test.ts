import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { nextRandom } from '../src/simulation/rng';
import { applyStatus, grantShield, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { battle, freeze, unit } from './combat-helpers';

function hero(name: string, star: 1|2|3 = 1, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p','player',1,3,{definitionId:name,starLevel:star,ability:resolveAbility(name+'-ability',star),
    hp:10000,maxHp:10000,mana:100,maxMana:100,attackDamage:100,abilityPower:100,attackRange:20,
    baseAttackSpeedBps:1,cooldownTicks:1000,moveCooldownTicks:1000,
    runtime:{...EMPTY_RUNTIME},statuses:[],tasks:[],shieldLayers:[],mechanics:[],...patch});
}
function dummy(id='e',patch:Partial<CombatUnit>={}):CombatUnit {
  return unit(id,'enemy',2,3,{definitionId:'neutral-stage-2',ability:resolveAbility('neutral-attack',1),
    hp:100000,maxHp:100000,mana:0,maxMana:0,attackDamage:0,cooldownTicks:1000,moveCooldownTicks:1000,
    runtime:{...EMPTY_RUNTIME},statuses:[],tasks:[],shieldLayers:[],...patch});
}
// Select each existing move with the existing shield modifier. No test stubs the production RNG.
function seedFor(move:number):number {
  for(let seed=0;seed<100000;seed++){
    const a=nextRandom(seed),b=nextRandom(a.state),roll=Math.floor(b.word*10000/2**32);
    if(Math.floor(a.word*3/2**32)===move&&roll>=3500&&roll<7000)return seed;
  }
  throw Error('seed');
}
const seed=[0,1,2].map(seedFor);
function advance(initial:CombatState,count:number){
  let state=initial;const events:CombatEvent[]=[];
  for(let i=0;i<count&&state.status==='running';i++){const next=stepCombat(state);state=next.state;events.push(...next.events);}
  return {state,events};
}
const damage=(events:readonly CombatEvent[])=>events.flatMap(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p'?[e.outcome]:[]);
const raw=(events:readonly CombatEvent[])=>damage(events).map(d=>d.raw);
const get=(s:CombatState,id='p')=>s.units.find(u=>u.id===id)!;

describe('14.24b five-cost independent vectors; AD100/AP100, zero resists',()=>{
  it.each([
    [1,260,780,338,832], [2,270,810,351,864], [3,2000,6000,2600,6400],
  ] as const)('Sevika %s star: flame base and both multipliers, same two RNG words',(star,base,punch,splash,bite)=>{
    const flame=stepCombat(battle([hero('sevika',star),dummy()],{rngState:seed[0]}));
    const fist=stepCombat(battle([hero('sevika',star),dummy(),dummy('e2',{cell:{col:3,row:3}})],{rngState:seed[1]}));
    // Chomp uses a high-HP target to expose its raw damage separately from the execution packet.
    const chomp=stepCombat(battle([hero('sevika',star),dummy()],{rngState:seed[2]}));
    expect(raw(flame.events)).toEqual([base]);
    expect(raw(fist.events)).toEqual([punch,splash,splash]);
    expect(damage(chomp.events)[0].raw).toBe(bite);
    for(const r of [flame,fist,chomp])expect(r.state.rngDraws).toBe(2);
  });
  it('flamethrower continues beyond two seconds, samples live adjacency, and stops when its target dies',()=>{
    let state=battle([hero('sevika'),dummy('e',{hp:1000,maxHp:1000}),dummy('side',{cell:{col:3,row:3}})],{rngState:seed[0]});
    const before=advance(freeze(state),41);state=before.state;
    expect(damage(before.events).filter(d=>d.context.targetId==='e').map(d=>d.raw)).toEqual([260,260,260]);
    expect(damage(before.events).filter(d=>d.context.targetId==='side').map(d=>d.raw)).toEqual([130,130,130]);
    expect(get(state).statuses?.some(s=>s.kind==='channel')).toBe(true);
    const after=advance(state,20);
    expect(get(after.state,'e').alive).toBe(false);
    expect(get(after.state).tasks?.some(t=>t.kind==='g23Flame')).toBe(false);
    expect(get(after.state).statuses?.some(s=>s.kind==='channel')).toBe(false);
    expect(after.events).toContainEqual(expect.objectContaining({type:'activityChanged',tick:61,reason:'expired'}));
    expect(after.state.rngDraws).toBe(2);
  });
  it.each(['control','death'] as const)('flamethrower stops on caster %s and cannot resume from its task',(stop)=>{
    const start=stepCombat(battle([hero('sevika'),dummy()],{rngState:seed[0]})).state;
    const state=structuredClone(start),p=get(state) as S13Unit;
    if(stop==='control')applyStatus(p,origin(p),'stun',0,50,state.tick,[]);
    else {p.hp=0;p.alive=false;}
    const r=advance(state,40);
    expect(raw(r.events)).toEqual([]);
    expect(get(r.state).tasks?.some(t=>t.kind==='g23Flame')).toBe(false);
  });
  it.each([1,2] as const)('Chomp %s star uses strict 15-percent threshold after damage and preserves the boundary',(star)=>{
    const bite=star===1?832:864;
    for(const [remaining,dead] of [[300,false],[299,true]] as const){
      const r=stepCombat(battle([hero('sevika',star),dummy('e',{hp:bite+remaining,maxHp:2000}),dummy('far',{cell:{col:6,row:0}})],{rngState:seed[2]}));
      expect(get(r.state,'e').alive).toBe(!dead);
      expect(raw(r.events)).toEqual(dead?[bite,299]:[bite]);
    }
  });
  it('three-star Chomp executes and jumps to lowest current HP in 10 hexes, retaining 80% per bite',()=>{
    const initial=battle([hero('sevika',3),dummy('e',{hp:10000,maxHp:10000}),
      dummy('low',{hp:20000,maxHp:20000,cell:{col:6,row:0}}),dummy('high',{hp:30000,maxHp:30000,cell:{col:5,row:2}})],{rngState:seed[2]});
    const r=advance(freeze(initial),3);
    expect(damage(r.events).map(d=>[d.context.targetId,d.raw])).toEqual([
      ['e',6400],['e',3600],['low',5120],['low',14880],['high',4096],['high',25904],
    ]);
    expect(r.state.result).toBe('playerWin');expect(r.state.rngDraws).toBe(2);
    expect(new Set(damage(r.events).map(d=>d.context.packetId)).size).toBe(6);
    expect(new Set(damage(r.events).map(d=>d.context.triggeringCastActionSeq)).size).toBe(1);
    expect(r.events.filter(e=>e.type==='movement')).toHaveLength(2);
  });
  it('one-star Chomp cannot reset to a target more than two hexes from the victim',()=>{
    const r=advance(battle([hero('sevika'),dummy('e',{hp:900,maxHp:1000}),dummy('far',{cell:{col:6,row:0}})],{rngState:seed[2]}),2);
    expect(raw(r.events)).toEqual([832,68]);expect(get(r.state,'far').hp).toBe(100000);
  });
  it('execution bypasses remaining shields once without duplicating death',()=>{
    let state=stepCombat(battle([hero('sevika',1,{mana:0}),dummy('e',{hp:140,maxHp:1000}),dummy('far',{cell:{col:6,row:0}})],{rngState:seed[2]})).state;
    state=structuredClone(state);const p=get(state) as S13Unit,e=get(state,'e') as S13Unit;
    p.mana=100;grantShield(e,origin(e),2000,100,state.tick,[]);
    const r=stepCombat(state);
    expect(raw(r.events)).toEqual([832,140]);expect(damage(r.events).map(d=>d.hpDamage)).toEqual([0,140]);
    expect(r.events.filter(e=>e.type==='death'&&e.unitId==='e')).toHaveLength(1);
  });
  it.each([1,2,3] as const)('Malzahar %s star gate hits five cells across target, not cells in front',(star)=>{
    const enemies=[0,1,2,3,4,5,6].map(col=>dummy(col===3?'a':`e${col}`,{cell:{col,row:2}}));
    enemies.push(dummy('front',{cell:{col:3,row:5}}));
    const r=stepCombat(battle([hero('malzahar',star,{cell:{col:3,row:3},targetId:'a'}),...enemies],{rngState:42}));
    expect(damage(r.events).map(d=>d.context.targetId)).toEqual(['a','e1','e2','e4','e5']);
    expect(raw(r.events)).toEqual(Array(5).fill([80,120,1000][star-1]));
    expect(get(r.state).tasks?.map(t=>t.targetId)).toEqual(['a','e1','e2','e4','e5']);
  });
  it.each([1,2,3] as const)('Malzahar %s star all five stacks survive death and retain their pulse clock',(star)=>{
    const opening=stepCombat(battle([hero('malzahar',star),dummy('e',{hp:1,maxHp:1}),
      dummy('a',{cell:{col:2,row:2}}),dummy('b',{cell:{col:2,row:4}})],{rngState:42}));
    const tasks=get(opening.state).tasks!;
    expect(tasks).toHaveLength(5);expect(tasks.map(t=>[t.targetId,t.executeAtTick])).toEqual(Array(5).fill(['a',21]));
    const r=advance(opening.state,20);
    const pulses=damage(r.events).filter(d=>d.context.targetId==='a');
    expect(pulses.map(d=>d.raw)).toEqual(Array(5).fill([14,21,400][star-1]));
    expect(pulses.every(d=>d.context.rootActionSeq===tasks[0].actionSeq)).toBe(true);
  });
  it('infection moves again when its new host dies, even if Malzahar has died',()=>{
    const opening=stepCombat(battle([hero('malzahar',3),unit('ally','player',0,7,{cooldownTicks:1000,moveCooldownTicks:1000}),
      dummy('e',{hp:1,maxHp:1}),dummy('a',{hp:1000,maxHp:1000,cell:{col:2,row:2}}),dummy('b',{cell:{col:6,row:0}})],{rngState:42}));
    const state=structuredClone(opening.state),p=get(state) as S13Unit;p.hp=0;p.alive=false;
    const r=advance(state,40);
    expect(get(r.state,'a').alive).toBe(false);
    expect(get(r.state).tasks).toHaveLength(5);
    expect(damage(r.events).filter(d=>d.context.targetId==='b').map(d=>d.raw)).toEqual([400,400,400,400,400]);
  });
  it.each([1,2,3] as const)('Jinx %s star existing stun is exactly 25/30/200 ticks',(star)=>{
    const r=stepCombat(battle([hero('jinx',star),dummy()],{rngState:42}));
    const stun=get(r.state,'e').statuses!.find(s=>s.kind==='stun')!;
    expect(stun.expiresAtTick-stun.startsAtTick).toBe([25,30,200][star-1]);
    expect(raw(r.events)).toEqual([265,265,2000].slice(star-1,star));
  });
  it.each([['sevika',0],['sevika',2],['malzahar',0]] as const)('%s move %s keeps full state/events/RNG across JSON checkpoints and input permutations',(name,move)=>{
    const initial=battle([hero(name,3),dummy(),dummy('second',{cell:{col:3,row:3}})],{rngState:seed[move]});
    const first=advance(freeze(initial),21),saved=JSON.stringify(first.state),expected=advance(first.state,80);
    expect(advance(JSON.parse(saved),80)).toEqual(expected);expect(JSON.stringify(first.state)).toBe(saved);
    expect(advance({...initial,units:[...initial.units].reverse()},101)).toEqual(advance(initial,101));
  });
});
