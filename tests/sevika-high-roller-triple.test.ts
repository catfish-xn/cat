import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { nextRandom } from '../src/simulation/rng';
import { battle, freeze, unit } from './combat-helpers';

// 14.24b High Roller Triple: the enhanced spell's bonus is applied, and Jackpot is Spell4 coins (G24-SEVIKA-TRIPLE-01 / JACKPOT-01).
function hero(patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p','player',1,3,{definitionId:'sevika',starLevel:1,ability:resolveAbility('sevika-ability',1),
    hp:10000,maxHp:10000,mana:100,maxMana:100,attackDamage:100,abilityPower:100,attackRange:20,
    baseAttackSpeedBps:1,cooldownTicks:1000,moveCooldownTicks:1000,
    runtime:{...EMPTY_RUNTIME},statuses:[],tasks:[],shieldLayers:[],mechanics:[],...patch});
}
function dummy(id='e',patch:Partial<CombatUnit>={}):CombatUnit {
  return unit(id,'enemy',2,3,{definitionId:'neutral-stage-2',ability:resolveAbility('neutral-attack',1),
    hp:100000,maxHp:100000,mana:0,maxMana:0,attackDamage:0,cooldownTicks:1000,moveCooldownTicks:1000,
    runtime:{...EMPTY_RUNTIME},statuses:[],tasks:[],shieldLayers:[],...patch});
}
/** Third word picks the Triple row: [0,4000) blue, [4000,7500) knockout, [7500,9950) quadruple, [9950,10000) jackpot. */
function seedFor(lo:number,hi:number):number {
  for(let seed=0;seed<2000000;seed++){
    const a=nextRandom(seed),b=nextRandom(a.state),c=nextRandom(b.state);
    const first=Math.floor(b.word*10000/2**32),triple=Math.floor(c.word*10000/2**32);
    if(first>=9000&&triple>=lo&&triple<hi)return seed;
  }
  throw Error('seed');
}
function advance(initial:CombatState,count:number){
  let state=initial;const events:CombatEvent[]=[];
  for(let i=0;i<count&&state.status==='running';i++){const next=stepCombat(state);state=next.state;events.push(...next.events);}
  return {state,events};
}
const damage=(events:readonly CombatEvent[],target='e')=>events.flatMap(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p'&&e.outcome.context.targetId===target?[e.outcome.raw]:[]);
const outcome=(events:readonly CombatEvent[])=>events.find(e=>e.type==='castOutcome');
/** The spell lands when the slot machine stops (G24-SEVIKA-SLOTS-01). */
const SLOT=25;

describe('Sevika High Roller Triple (AD100/AP100, 1 star)',()=>{
  it('Blue Flamethrower grows 20% per second of channel',()=>{
    const r=advance(freeze(battle([hero(),dummy()],{rngState:seedFor(0,4000)})),41+SLOT);
    expect(outcome(r.events)).toMatchObject({outcome:'blue-flamethrower',castVariant:{move:'flamethrower',enhanced:true}});
    expect(damage(r.events)).toEqual([260,312,364]);
  });
  it('Knockout Punch adds 400% AD to the punched target',()=>{
    const r=advance(freeze(battle([hero(),dummy()],{rngState:seedFor(4000,7500)})),1+SLOT);
    expect(outcome(r.events)).toMatchObject({outcome:'knockout-punch',castVariant:{move:'punch'}});
    expect(damage(r.events)).toEqual([780,400,338]);
  });
  it('Quadruple Chomp bites four times and bleeds 400% AD over 5 seconds',()=>{
    const r=advance(freeze(battle([hero(),dummy()],{rngState:seedFor(7500,9950)})),101+SLOT);
    expect(outcome(r.events)).toMatchObject({outcome:'quadruple-chomp',castVariant:{move:'chomp'}});
    expect(damage(r.events)).toEqual([832,832,832,832,80,80,80,80,80]);
  });
  it('Jackpot casts no spell: six 250% AD + 20% AP coins over 1.5 s, no rockets, shield or gold',()=>{
    const r=advance(freeze(battle([hero(),dummy()],{rngState:seedFor(9950,10000)})),31+SLOT);
    expect(outcome(r.events)).toMatchObject({outcome:'jackpot',castVariant:{move:'jackpot',channelTicks:0,enhanced:true}});
    expect(damage(r.events)).toEqual([270,270,270,270,270,270]);
    const p=r.state.units.find(u=>u.id==='p')!;
    expect(p.g23?.highRoller).toEqual([expect.objectContaining({mod:'jackpot',spell:3,gold:0})]);
    expect(p.shieldLayers??[]).toEqual([]);
  });
  it('rolls at the pull and lands the spell only when the slot machine stops, standing still meanwhile',()=>{
    const start=freeze(battle([hero(),dummy()],{rngState:seedFor(4000,7500)}));
    const waiting=advance(start,SLOT);
    expect(outcome(waiting.events)).toMatchObject({outcome:'knockout-punch'});
    expect(damage(waiting.events)).toEqual([]);
    expect(waiting.events.some(e=>e.type==='attack'&&e.attackerId==='p')).toBe(false);
    expect(waiting.state.units.find(u=>u.id==='p')!.tasks).toEqual([expect.objectContaining({kind:'g23Roll',targetId:'e'})]);
    expect(damage(advance(waiting.state,1).events)).toEqual([780,400,338]);
  });
});
