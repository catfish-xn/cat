import {expect,it} from 'vitest';
import {createMatch} from '../src/simulation/match';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {ANOMALY_DEFINITIONS} from '../src/simulation/content/anomalies';
import {createCombatWithEvents,stepCombat,type CombatState} from '../src/simulation/combat';
import {validateMechanisms} from '../src/simulation/m8/restore';
import {packets} from './helpers/replay2-views';
function start(id:string,definitionId='lux',starLevel:1|2|3=1){
 const s=createMatch(42),preparation={...s.preparation,units:[{id:'p',definitionId,starLevel,team:'player' as const,location:{kind:'board' as const,cell:{col:1,row:4}}},{id:'e',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:1,row:3}}}]};
 const strategy=buildStrategySnapshot({...s,preparation,anomalyBinding:{definitionId:id,unitId:'p',choiceId:'test',boundRound:1}});
 return createCombatWithEvents(preparation,strategy,'g23-anomaly').state;
}
function validate(state:CombatState){for(const u of state.units)validateMechanisms(u,state.units,state.tick,'g23-anomaly',state.status==='finished',state.nextActionSeq!);}
it('admits thirty historically selected anomalies and excludes Cosmic Rhythm/PBE-only entries',()=>{
 expect(Object.keys(ANOMALY_DEFINITIONS)).toHaveLength(30);
 for(const id of ['cosmic-rhythm','essence-of-navori','miniaturize','hivemind'])expect(ANOMALY_DEFINITIONS[id]).toBeUndefined();
 expect(ANOMALY_DEFINITIONS['defense-expert'].name).toBeTruthy();
});
it.each(Object.keys(ANOMALY_DEFINITIONS))('%s compiles and validates its detached combat-start program',id=>{
 const state=start(id);expect(()=>validate(state)).not.toThrow();const text=JSON.stringify(state);stepCombat(state);expect(JSON.stringify(state)).toBe(text);
});
it('Fortified applies twelve percent health at start and again at four seconds',()=>{
 let state=start('fortified');const base=state.units.find(u=>u.id==='p')!.maxHp;
 // Freeze activity so the deterministic enemy cannot end this test before the scheduled growth.
 state={...state,units:state.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000,attackDamage:0,mana:0,maxMana:0}))};
 for(let n=0;n<80;n++)state=stepCombat(state).state;
 const p=state.units.find(u=>u.id==='p')!;expect(base).toBe(560);expect(p.maxHp).toBe(620);validate(state);
});
it('Heavy Hitter adds twenty percent holder HP with a 2.5-second cooldown',()=>{
 const state=start('heavy-hitter'),step=stepCombat({...state,units:state.units.map(u=>({...u,mana:0,maxMana:0}))});
 expect(packets(step.events).filter(p=>p.source.definitionId==='heavy-hitter').map(p=>p.raw)).toEqual([100]);validate(step.state);
});

import {readCombatStats} from '../src/simulation/combat-s13';
it('expert multipliers read resolved combat values, including dynamic contributions',()=>{
 const magic=start('magic-expert'),attack=start('attack-expert'),defense=start('defense-expert');
 expect(readCombatStats(magic.units.find(u=>u.id==='p')!,magic).abilityPower).toBe(140);
 expect(readCombatStats(attack.units.find(u=>u.id==='p')!,attack).attackDamage).toBe(46);
 expect(readCombatStats(defense.units.find(u=>u.id==='p')!,defense).armor).toBe(33);
});
it('One Thousand Cuts counts hits separately for each target',()=>{
 let state=start('one-thousand-cuts');state={...state,units:state.units.map(u=>({...u,mana:0,maxMana:0}))};const damage:number[]=[];
 for(let i=0;i<65&&state.status==='running';i++){const step=stepCombat(state);state=step.state;damage.push(...packets(step.events).filter(p=>p.source.definitionId==='one-thousand-cuts').map(p=>p.raw));}
 expect(damage.slice(0,2)).toEqual([30,42]);
});
it('Hypervelocity stacking survives generic program restoration after multiple casts',()=>{
 let state=start('hypervelocity');
 for(let i=0;i<2;i++){state={...state,units:state.units.map(u=>u.id==='p'?{...u,mana:u.maxMana}:u)};state=stepCombat(state).state;validate(state);}
 expect(readCombatStats(state.units.find(u=>u.id==='p')!,state).attackIntervalTicks).toBeLessThan(33);
});
it('Comeback Story uses the frozen player HP, not unit health',()=>{
 const s=createMatch(42),preparation={...s.preparation,units:[{id:'p',definitionId:'lux',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:1,row:4}}}]};
 const strategy=buildStrategySnapshot({...s,playerHp:64,preparation,anomalyBinding:{definitionId:'comeback-story',unitId:'p',choiceId:'a',boundRound:1}});
 expect(strategy.units[0].mechanics?.find(m=>m.mechanic==='damageAmp')?.values.bps).toBe(1500);
});

it('Protective Shielding restores the exact carried fractional shield at its second pulse',()=>{
 let state=start('protective-shielding','zoe',2);
 state={...state,units:state.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000,attackDamage:0,mana:0,maxMana:0}))};
 for(let tick=0;tick<320;tick++)state=stepCombat(state).state;
 expect(state.units.find(u=>u.id==='p')!.shieldLayers!.find(l=>l.source.definitionId==='protective-shielding')!.granted).toBe(173);
 validate(state);
 const bad=structuredClone(state),layer=bad.units.find(u=>u.id==='p')!.shieldLayers![0];
 Object.assign(layer,{granted:174,remaining:174});Object.assign(layer.m8State!,{granted:174,remaining:174});
 expect(()=>validate(bad)).toThrow();
});
