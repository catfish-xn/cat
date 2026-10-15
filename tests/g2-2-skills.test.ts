import { expect, it } from 'vitest';
import { stepCombat, type CombatUnit, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { battle, unit, freeze } from './combat-helpers';
import { packets, heals } from './helpers/replay2-views';
function hero(name:string,patch:Partial<CombatUnit>={}):CombatUnit{return unit('p','player',1,3,{definitionId:name,ability:resolveAbility(name+'-ability',1),hp:4000,maxHp:5000,armor:0,magicResist:0,mana:100,maxMana:100,attackDamage:100,attackRange:6,abilityPower:100,baseAttackSpeedBps:10000,runtime:{...EMPTY_RUNTIME},statuses:[],shieldLayers:[],tasks:[],mechanics:[],...patch});}
function dummy(id='e',patch:Partial<CombatUnit>={}):CombatUnit{return unit(id,'enemy',2,3,{definitionId:'neutral-stage-2',ability:resolveAbility('neutral-attack',1),hp:10000,maxHp:10000,mana:0,maxMana:1,attackDamage:0,cooldownTicks:1000,moveCooldownTicks:1000,runtime:{...EMPTY_RUNTIME},statuses:[],shieldLayers:[],tasks:[],...patch});}
function run(initial:CombatState,count:number){let state=initial;const events:CombatEvent[]=[];for(let n=0;n<count&&state.status==='running';n++){const r=stepCombat(state);state=r.state;events.push(...r.events);}return{state,events};}
const raw=(events:readonly CombatEvent[])=>packets(events).filter(x=>x.source.ownerId==='p').map(x=>x.raw);
it.each([
 ['camille',[260]],['vi',[600]],['akali',[80,276]],['sett',[270]],['heimerdinger',[50,50,50,50,50]],
 ['trundle',[322]],['ziggs',[180,90,90,90]],['steb',[260]],['vex',[220]],['twistedfate',[110,230]],
 ['jinx',[265]],['ambessa',[250]],['mordekaiser',[200]],
] as const)('%s independently sourced first-cast raw damage', (name,values)=>{const initial=freeze(battle([hero(name),dummy()],{rngState:42}));expect(raw(stepCombat(initial).events)).toEqual(values);expect(initial.tick).toBe(0);});
it('Camille heals actual mitigated damage, not raw damage',()=>{const r=stepCombat(battle([hero('camille'),dummy('e',{armor:100,magicResist:200})],{rngState:42}));expect(heals(r.events).find(x=>x.unitId==='p')?.actual).toBe(42);});
it('Vex samples a fixed zone at source delay; Morgana preserves all 525 DOT damage and shield mark',()=>{
 const vex=run(battle([hero('vex'),dummy()],{rngState:42}),17);expect(raw(vex.events).filter(x=>x===110)).toEqual([110]);
 const morgana=run(battle([hero('morgana',{baseAttackSpeedBps:1}),dummy()],{rngState:42}),201);
 expect(raw(morgana.events).reduce((a,b)=>a+b,0)).toBe(525);expect(morgana.state.units.find(x=>x.id==='e')!.g22?.reaveBps).toBe(5000);
});
it('Draven becomes an empowered basic attacker after casting; no cast damage invented',()=>{const r=run(battle([hero('draven'),dummy()],{rngState:42}),22);expect(raw(r.events)[0]).toBe(150);});
it('Steb shares only actual healing to two nearest allies and does not recurse',()=>{const r=stepCombat(battle([hero('steb'),dummy(),hero('steb',{id:'ally',mana:0,hp:3000,cell:{col:0,row:3},cooldownTicks:1000})],{rngState:42}));expect(heals(r.events).filter(x=>x.unitId==='ally').map(x=>x.actual)).toEqual([67]);});
it('Mordekaiser empowered attacks are magic and state is detached across steps',()=>{const first=stepCombat(battle([hero('mordekaiser'),dummy()],{rngState:42}));const saved=JSON.stringify(first.state);const r=run(freeze(first.state),22);expect(raw(r.events)).toContain(330);expect(JSON.stringify(first.state)).toBe(saved);});
it('Ambessa alternates chains and fists without leaking stance counters',()=>{const r=stepCombat(battle([hero('ambessa',{runtime:{...EMPTY_RUNTIME,castCount:1}}),dummy()],{rngState:42}));expect(raw(r.events)).toEqual([500]);});
