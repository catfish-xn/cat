import {expect,it} from 'vitest';
import {createMatch} from '../src/simulation/match';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {ANOMALY_DEFINITIONS} from '../src/simulation/content/anomalies';
import {createCombatWithEvents,stepCombat,type CombatState} from '../src/simulation/combat';
import {attackDamageCandidates,withItemRestoreCache} from '../src/simulation/m8/item-restore';
import {validateMechanisms} from '../src/simulation/m8/restore';
import {packets} from './helpers/replay2-views';
function start(id:string,definitionId='lux',starLevel:1|2|3=1){
 const s=createMatch(42),preparation={...s.preparation,units:[{id:'p',definitionId,starLevel,team:'player' as const,location:{kind:'board' as const,cell:{col:1,row:4}}},{id:'e',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:1,row:3}}}]};
 const strategy=buildStrategySnapshot({...s,preparation,anomalyBinding:{definitionId:id,unitId:'p',choiceId:'test',boundRound:1}});
 return createCombatWithEvents(preparation,strategy,'g23-anomaly').state;
}
function validate(state:CombatState){withItemRestoreCache(()=>{for(const u of state.units)validateMechanisms(u,state.units,state.tick,'g23-anomaly',state.status==='finished',state.nextActionSeq!);});}
// Non-P4 anomalies: 30 historical + 7 P3; the 11 P4 IDs use the TFT13_GoopBuff_ prefix.
it('admits thirty historical and seven P3 anomalies and excludes Cosmic Rhythm/PBE-only entries',()=>{
 expect(Object.keys(ANOMALY_DEFINITIONS).filter(id=>!id.startsWith('TFT13_GoopBuff_'))).toHaveLength(37);
 for(const id of ['cosmic-rhythm','essence-of-navori','miniaturize','hivemind'])expect(ANOMALY_DEFINITIONS[id]).toBeUndefined();
 expect(ANOMALY_DEFINITIONS['defense-expert'].name).toBeTruthy();
});
it.each(Object.keys(ANOMALY_DEFINITIONS).filter(id=>!id.startsWith('TFT13_GoopBuff_')))('%s compiles and validates its detached combat-start program',id=>{
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
it('Hypervelocity adds exactly fifteen percent speed per completed cast and validates both stacks',()=>{
 let state=start('hypervelocity');
 const holder=()=>state.units.find(u=>u.id==='p')!;
 // Lux base 0.70 attacks/s, +10% at start, then +15% per completed cast.
 expect(holder().runtime!.castCount).toBe(0);
 expect(holder().baseAttackSpeedBps).toBe(7000);
 expect(readCombatStats(holder(),state).attackIntervalTicks).toBe(26);
 for(const [count,interval] of [[1,23],[2,21]] as const){
   state={...state,units:state.units.map(u=>u.id==='p'?{...u,mana:u.maxMana}:u)};
   let casts=0;
   for(let steps=0;steps<100&&holder().runtime!.castCount<count;steps++){
     const result=stepCombat(state);state=result.state;
     casts+=result.events.filter(e=>e.type==='cast'&&('receipt' in e?e.receipt.source.ownerId==='p':e.sourceId==='p')).length;
   }
   expect(casts).toBe(1);
   expect(holder().runtime!.castCount).toBe(count);
   // Newly queued stats become effective on the next tick.
   state=stepCombat(state).state;
   expect(readCombatStats(holder(),state).attackIntervalTicks).toBe(interval);
   validate(state);
   const copy=structuredClone(state);validate(copy);expect(copy).toEqual(state);
 }
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
it('Power Absorption adds fixed AD after percentage AD, once per dead ally, and restores its contribution',()=>{
 const base=createMatch(42),preparation={...base.preparation,units:[
  {id:'p',definitionId:'lux',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:1,row:4}}},
  {id:'ally',definitionId:'darius',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:2,row:4}}},
  {id:'e',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:1,row:0}}}]};
 const strategy=buildStrategySnapshot({...base,preparation,items:[{id:'db',definitionId:'deathblade',location:{kind:'unit',unitId:'p',slot:0}}],anomalyBinding:{definitionId:'power-absorption',unitId:'p',choiceId:'test',boundRound:1}});
 let state=createCombatWithEvents(preparation,strategy,'g23-anomaly').state;
 // Lux 30 AD + Deathblade 55% + anomaly 30% = floor(55.5)=55. Darius gives floor(55*9%)=4.
 state={...state,units:state.units.map(u=>u.id==='ally'?{...u,hp:0,alive:false,mana:0,targetId:null}: {...u,cooldownTicks:1000,moveCooldownTicks:1000,mana:0,maxMana:0})};
 const initial=readCombatStats(state.units.find(u=>u.id==='p')!,state).attackDamage;
 const allyAd=readCombatStats(state.units.find(u=>u.id==='ally')!,state).attackDamage;
 expect(initial).toBe(55);expect(allyAd).toBe(55);
 state=stepCombat(state).state;
 expect(readCombatStats(state.units.find(u=>u.id==='p')!,state).attackDamage).toBe(59);
 validate(state);
 state=stepCombat(state).state;
 expect(readCombatStats(state.units.find(u=>u.id==='p')!,state).attackDamage).toBe(59);
 expect(state.units.find(u=>u.id==='p')!.g23?.absorbed).toHaveLength(1);
 expect(attackDamageCandidates(state.units.find(u=>u.id==='p')!,state.tick,'g23-anomaly').has(59)).toBe(true);
});

it('Slow Cooker uses the holder maximum HP, not the target HP, at each one-second pulse',()=>{
 let state=start('slow-cooker');
 // Unequal HP makes a target-basis implementation observably wrong: Lux 500 vs three-star Garen.
 const holder=state.units.find(u=>u.id==='p')!;
 expect(holder.maxHp).toBe(500);
 expect(state.units.find(u=>u.id==='e')!.maxHp).toBeGreaterThan(500);
 state={...state,units:state.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000,attackDamage:0,mana:0,maxMana:0}))};
 const pulses:{tick:number;raw:number}[]=[];
 for(let tick=0;tick<40;tick++){const result=stepCombat(state);state=result.state;pulses.push(...packets(result.events).filter(p=>p.source.definitionId==='slow-cooker').map(p=>({tick:state.tick,raw:p.raw})));}
 // Independent source arithmetic: floor(500 * 3 / 100) = 15, at 20 and 40 ticks.
 expect(pulses).toEqual([{tick:20,raw:15},{tick:40,raw:15}]);
 validate(state);
});
