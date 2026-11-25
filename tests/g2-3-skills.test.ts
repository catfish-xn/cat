import { expect,it } from 'vitest';
import { stepCombat,type CombatUnit,type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, variable } from '../src/simulation/combat-s13-state';
import { battle,unit,freeze } from './combat-helpers';
import { packets,heals } from './helpers/replay2-views';
import { CASSIOPEIA_BOLT_LAUNCH_TICKS, cassiopeiaBoltFlightTicks, JAYCE_MAIN_HIT_TICKS, jayceCrystalBlastTick } from '../src/simulation/cast-windup';
function hero(name:string,patch:Partial<CombatUnit>={}):CombatUnit{return unit('p','player',1,3,{definitionId:name,ability:resolveAbility(name+'-ability',1),hp:4000,maxHp:5000,armor:0,magicResist:0,mana:100,maxMana:100,attackDamage:100,attackRange:6,abilityPower:100,baseAttackSpeedBps:1,runtime:{...EMPTY_RUNTIME},statuses:[],shieldLayers:[],tasks:[],mechanics:[],...patch});}
function dummy(id='e',patch:Partial<CombatUnit>={}):CombatUnit{return unit(id,'enemy',2,3,{definitionId:'neutral-stage-2',ability:resolveAbility('neutral-attack',1),hp:10000,maxHp:10000,mana:0,maxMana:1,attackDamage:0,cooldownTicks:1000,moveCooldownTicks:1000,runtime:{...EMPTY_RUNTIME},statuses:[],shieldLayers:[],tasks:[],...patch});}
const raw=(events:readonly CombatEvent[])=>packets(events).filter(x=>x.source.ownerId==='p').map(x=>x.raw);
it.each([
 ['elise',[120]],['elise-ranged',[200]],['swain-ranged',[310]],
 ['gangplank',[680]],['gangplank-ranged',[305]],['smeech',[190]],['jayce',[500]],
] as const)('%s source-backed first-cast coefficients',(name,expected)=>{
 const initial=freeze(battle([hero(name),dummy()],{rngState:42})),saved=JSON.stringify(initial);
 expect(raw(stepCombat(initial).events)).toEqual(expected);expect(JSON.stringify(initial)).toBe(saved);
});
// Cassiopeia's main bolt (11-24): it leaves CASSIOPEIA_BOLT_LAUNCH_TICKS after the cast and lands cassiopeiaBoltFlightTicks(1)
// later on the dummy one hex away (was [230] on the cast, in the table above).
it('cassiopeia source-backed first-cast coefficients: the main bolt lands after its launch and flight',()=>{
 let state=freeze(battle([hero('cassiopeia'),dummy()],{rngState:42}));const at:[number,number][]=[],land=CASSIOPEIA_BOLT_LAUNCH_TICKS+cassiopeiaBoltFlightTicks(1);
 for(let i=0;i<=land+1;i++){const step=stepCombat(freeze(state));state=step.state;for(const p of packets(step.events).filter(p=>p.source.ownerId==='p'))at.push([i,p.raw]);}
 expect(at).toEqual([[land,230]]);
});
// Jayce's ranged cast (11-21): the main hit lands JAYCE_MAIN_HIT_TICKS after the cast and the crystals explode later, one after
// another (cast-windup.ts). Against one enemy every crystal is thrown at it, and the nearest enemy takes no explosion of its own
// crystal, so only the main hit lands (was [625,400,400], all on the cast, as single hits on the nearest enemies in turn).
it('jayce-ranged source-backed first-cast coefficients: the main hit only, against a lone enemy, JAYCE_MAIN_HIT_TICKS after the cast',()=>{
 let state=freeze(battle([hero('jayce-ranged'),dummy()],{rngState:42}));const at:[number,number][]=[];
 for(let i=0;i<=jayceCrystalBlastTick(2)+1;i++){const step=stepCombat(freeze(state));state=step.state;for(const p of packets(step.events).filter(p=>p.source.ownerId==='p'&&p.source.sourceKind==='ability'))at.push([i,p.raw]);}
 expect(at).toEqual([[JAYCE_MAIN_HIT_TICKS,625]]);
});
// Wind-up batch 3 (2026-11-17): Renata's missiles land CAST_WINDUP_TICKS.renata after her cast; her shields stay on the cast.
it('renata source-backed first-cast coefficients, landing CAST_WINDUP_TICKS.renata after the cast',()=>{
 let state=freeze(battle([hero('renata'),dummy()],{rngState:42}));const at:[number,number][]=[];
 for(let i=0;i<=CAST_WINDUP_TICKS.renata;i++){const step=stepCombat(freeze(state));state=step.state;for(const p of packets(step.events).filter(p=>p.source.ownerId==='p'))at.push([i,p.raw]);}
 expect(at).toEqual([[CAST_WINDUP_TICKS.renata,310]]);
});
it('Cassiopeia every third cast splashes only two other targets',()=>{
 // Cassiopeia's main bolt (11-24, window only): the splash settles on the cast, the main bolt after its launch and flight; the window
 // runs to its landing and keeps every event.
 let first=stepCombat(battle([hero('cassiopeia',{runtime:{...EMPTY_RUNTIME,castCount:2}}),dummy(),dummy('a',{cell:{col:3,row:3}}),dummy('b',{cell:{col:2,row:2}}),dummy('c',{cell:{col:3,row:2}})],{rngState:42}));
 const all=[...first.events];for(let i=0;i<CASSIOPEIA_BOLT_LAUNCH_TICKS+cassiopeiaBoltFlightTicks(1);i++){first=stepCombat(first.state);all.push(...first.events);}
 const r={state:first.state,events:all};
 // targeting-p1 (8106acee): e and b are both adjacent, so the equal-distance tie now draws the combat lcg32 stream.
 // With rngState 42 the draw picks e (v25 always took b, giving [230 on b, 160 on c, 160 on e]). The primary still
 // takes 230 (ordinal 0) and exactly two other targets 160; events list the packets in target order.
 expect(r.state.units.find(u=>u.id==='p')!.targetId).toBe('e');
 expect(packets(r.events).filter(x=>x.source.ownerId==='p').map(x=>[x.unitId,x.raw,x.packetOrdinal])).toEqual([['a',160,1],['b',160,2],['e',230,0]]);
 expect(raw(r.events)).toEqual([160,160,230]);
});
it('Mundo splits the complete 1550 healing without truncation or duplicate pulses',()=>{
 let state=battle([hero('drmundo'),dummy()],{rngState:42});const events:CombatEvent[]=[];
 // 2026-11-16: the whole heal and pulses start CAST_WINDUP_TICKS.drmundo after the cast; the window grows by as much.
 // Wind-up batch 2: the closing blast lands DRMUNDO_BLAST_AFTER_PULSE_TICKS after the last pulse; the window grows by as much.
 for(let i=0;i<41+CAST_WINDUP_TICKS.drmundo+DRMUNDO_BLAST_AFTER_PULSE_TICKS;i++){const step=stepCombat(freeze(state));state=step.state;events.push(...step.events);}
 expect(heals(events).filter(e=>e.unitId==='p').map(e=>e.requested)).toEqual([620,465,465]);
 expect(raw(events)).toEqual([120,120,350]);
 const ticks=packets(events).filter(x=>x.source.ownerId==='p').map(x=>x.tick);
 expect(ticks[2]!-ticks[1]!).toBe(DRMUNDO_BLAST_AFTER_PULSE_TICKS);
});
it('Renni delayed damage and healing conserve complete source amounts',()=>{
 let state=battle([hero('renni'),dummy()],{rngState:42});const events:CombatEvent[]=[];
 // Wind-up batch 4: the lift starts RENNI_LIFT_TICKS after the cast and the slam lands RENNI_SLAM_AFTER_STUN_TICKS after the stun.
 for(let i=0;i<31+RENNI_LIFT_TICKS+RENNI_SLAM_AFTER_STUN_TICKS;i++){const step=stepCombat(freeze(state));state=step.state;events.push(...step.events);}
 expect(raw(events).reduce((a,b)=>a+b,0)).toBe(700);
 expect(heals(events).filter(e=>e.unitId==='p').reduce((n,e)=>n+e.requested,0)).toBe(1050);
});
it('Silco accounts for all four monstrosities and twenty delayed attacks',()=>{
 let state=battle([hero('silco'),dummy()],{rngState:42});const events:CombatEvent[]=[];
 for(let i=0;i<=240;i++){const r=stepCombat(state);state=r.state;events.push(...r.events);}
 expect(raw(events)).toEqual([100,...Array(20).fill(36)]);
});
it('Swain pulses follow live adjacency and a killing contribution extends ascension once',()=>{
 let state=battle([hero('swain'),dummy('weak',{hp:1,maxHp:1}),dummy('far',{cell:{col:6,row:0}})],{rngState:42});
 for(let i=0;i<22;i++)state=stepCombat(state).state;
 const swain=state.units.find(u=>u.id==='p')!;
 expect(swain.g23?.ascension?.takedowns).toEqual(['weak']);
 expect(swain.g23!.ascension!.untilTick).toBeGreaterThan(121);
});
it('Rumble3 self-destruct deals20000% resists before last-unit elimination',()=>{
 const player=hero('rumble',{starLevel:3,hp:1,maxHp:1,mana:0,maxMana:150,armor:40,magicResist:60,cooldownTicks:1000,mechanics:[{source:{ownerId:'p',sourceKind:'trait',definitionId:'junker-king',instanceId:'test',effectIndex:0},mechanic:'g23Junker',values:{flame:0,rod:0,repair:0,death:1,tank:0,titan:0}}]});
 const enemy=dummy('e',{hp:10000,maxHp:10000,attackDamage:1000,cooldownTicks:0});
 const r=stepCombat(battle([player,enemy],{rngState:42}));
 const explosion=packets(r.events).find(p=>p.source.definitionId==='junker-king');expect(explosion?.raw).toBe(20000);expect(r.state.result).toBe('draw');
});
// Wind-up batch 2 (2026-11-16): the three stabs land SMEECH_STAB_TICKS apart. Re-leap (2026-11-25, user decision, replaces the
// 11-16 "next stab slot"): a target killed by his stab is followed by the re-leap SMEECH_RELEAP_AFTER_KILL_TICKS after the kill,
// whichever stab killed it; he stands still meanwhile.
it('Smeech stabs three times, SMEECH_STAB_TICKS apart, each 190 taken on the cast',()=>{
 let state=battle([hero('smeech'),dummy()],{rngState:42});const at:[number,number][]=[];
 for(let i=0;i<=2*SMEECH_STAB_TICKS;i++){const step=stepCombat(freeze(state));state=step.state;
  for(const p of packets(step.events).filter(p=>p.source.ownerId==='p'&&p.source.sourceKind==='ability'))at.push([i,p.raw]);}
 expect(at).toEqual([[0,190],[SMEECH_STAB_TICKS,190],[2*SMEECH_STAB_TICKS,190]]);
});
it('Smeech leaps again SMEECH_RELEAP_AFTER_KILL_TICKS after a kill, with the next three slashes reduced by source30%',()=>{
 let state=battle([hero('smeech'),dummy('e',{hp:1,maxHp:1}),dummy('far',{cell:{col:5,row:3}})],{rngState:42});
 const first=stepCombat(state);state=first.state;
 expect(state.units.find(u=>u.id==='e')!.alive).toBe(false);
 expect(state.units.find(u=>u.id==='p')!.tasks?.some(t=>t.kind==='g23Smeech')).toBe(true);
 const later:CombatEvent[]=[];
 for(let i=0;i<4*SMEECH_STAB_TICKS;i++){const step=stepCombat(state);state=step.state;later.push(...step.events);}
 const hits=packets(later).filter(p=>p.source.ownerId==='p'&&p.source.sourceKind==='ability');
 // The target dies on the cast's first stab; the re-leap follows SMEECH_RELEAP_AFTER_KILL_TICKS later, its three stabs 133 each.
 // (11-25 re-pin: was [1,2,3]*SMEECH_STAB_TICKS, the next stab slot.)
 expect(hits.map(p=>[p.unitId,p.raw])).toEqual([['far',133],['far',133],['far',133]]);
 // (v2: plus SMEECH_RELEAP_FLIGHT_TICKS, the stabs start on landing.)
 expect(hits.map(p=>p.tick-first.state.tick)).toEqual([0,1,2].map(i=>SMEECH_RELEAP_AFTER_KILL_TICKS+SMEECH_RELEAP_FLIGHT_TICKS+i*SMEECH_STAB_TICKS));
 expect(later.some(e=>e.type==='movement'&&e.unitId==='p')).toBe(true);
});

it('Smeech: a target killed by a later stab is followed by the re-leap SMEECH_RELEAP_AFTER_KILL_TICKS after the kill, on the second or the last stab',()=>{
 // 11-25 re-pin: the re-leap was the next stab slot (2 and 3 stab intervals); it is now that many stabs on the target, then
 // SMEECH_RELEAP_AFTER_KILL_TICKS after the killing stab. The stab count is now given with each case instead of derived from leapAt.
 for(const [hp,stabs] of [[380,2],[570,3]] as const){const leapAt=(stabs-1)*SMEECH_STAB_TICKS+SMEECH_RELEAP_AFTER_KILL_TICKS+SMEECH_RELEAP_FLIGHT_TICKS; // v2: + flight
  let state=battle([hero('smeech'),dummy('e',{hp,maxHp:hp}),dummy('far',{cell:{col:5,row:3}})],{rngState:42});const start=state.tick;const all:CombatEvent[]=[];
  for(let i=0;i<=4*SMEECH_STAB_TICKS;i++){const step=stepCombat(state);state=step.state;all.push(...step.events);}
  const hits=packets(all).filter(p=>p.source.ownerId==='p'&&p.source.sourceKind==='ability').map(p=>[p.unitId,p.tick-start-1]);
  const onE=hits.filter(([id])=>id==='e'),onFar=hits.filter(([id])=>id==='far');
  expect(onE.map(([,t])=>t),String(hp)).toEqual(Array.from({length:stabs},(_,i)=>i*SMEECH_STAB_TICKS));
  expect(onFar[0]?.[1],String(hp)).toBe(leapAt);
 }
});

import {reviveG23Forge} from '../src/simulation/combat-g2-3-summons';
import type {AbilityContext} from '../src/simulation/combat-s13-abilities';
import type {S13Unit} from '../src/simulation/combat-s13-state';
import {DEFAULT_BOARD} from '../src/simulation/board';
import { CAST_WINDUP_TICKS, DRMUNDO_BLAST_AFTER_PULSE_TICKS, RENNI_LIFT_TICKS, RENNI_SLAM_AFTER_STUN_TICKS, SMEECH_RELEAP_AFTER_KILL_TICKS, SMEECH_RELEAP_FLIGHT_TICKS, SMEECH_STAB_TICKS } from '../src/simulation/cast-windup';
it('forge revival relocates in owner coordinates, mirrors on the enemy side, and never duplicates or draws RNG',()=>{
 for(const team of ['player','enemy'] as const){
  const row=(value:number)=>team==='player'?value:7-value;
  const jayce=hero('jayce',{id:'j',team,cell:{col:2,row:row(4)}}) as S13Unit;
  const forge=hero('jayce',{id:'j:g23-forge',definitionId:'g23-forge',team,alive:false,hp:0,maxHp:1000,cell:{col:2,row:row(5)}}) as S13Unit;
  const blocker=dummy('blocker',{team,cell:{col:2,row:row(5)}}) as S13Unit;
  const ctx:AbilityContext={tick:10,combatId:'forge',board:DEFAULT_BOARD,units:[jayce,forge,blocker],events:[],packets:[],heals:[],draw:()=>{throw Error('forge must not draw');}};
  expect(reviveG23Forge(ctx,jayce)).toBe(forge);
  expect(forge.cell).toEqual({col:0,row:row(0)});expect(forge.hp).toBe(1000);expect(forge.alive).toBe(true);
  expect(ctx.events.map(e=>e.type)).toEqual(['movement','unitRevived']);
  expect(reviveG23Forge(ctx,jayce)).toBe(forge);expect(ctx.events).toHaveLength(2);expect(ctx.units).toHaveLength(3);
 }
});

// Display only (2026-11-17): Renni's lift for the renderer's carry, start on her cast, end on her stun's last pulse.
it('Renni lifts her target RENNI_LIFT_TICKS after the cast and puts it down with the stun\'s last pulse (carryChanged, display only)', () => {
  let state = battle([hero('renni'), dummy()], { rngState: 42 }); const carry: [number, string, string, boolean][] = []; let castTick = -1;
  for (let i = 0; i < 80; i++) { const step = stepCombat(state); state = step.state;
    for (const e of step.events) { if (e.type === 'cast' && castTick < 0) castTick = e.tick; if (e.type === 'carryChanged') carry.push([e.tick, e.holderId, e.targetId, e.carried]); } }
  const n = Math.round(variable(state.units.find(u => u.id === 'p')!, 'StunDuration') * 20); // her stun, in ticks
  expect(carry).toEqual([[castTick + RENNI_LIFT_TICKS, 'p', 'e', true], [castTick + RENNI_LIFT_TICKS + n, 'p', 'e', false]]);
});
