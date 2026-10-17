import {expect,it} from 'vitest';
import {createMatch} from '../src/simulation/match';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {createCombatWithEvents,stepCombat,type CombatState} from '../src/simulation/combat';
import type {CombatEvent} from '../src/simulation/combat-types';
import {readCombatStats} from '../src/simulation/combat-s13';
import {withItemRestoreCache} from '../src/simulation/m8/item-restore';
import {validateMechanisms} from '../src/simulation/m8/restore';
import {validateItemProgram} from '../src/simulation/m8/item-program';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
import {G23_SPECIAL_ITEM_POOLS} from '../src/simulation/content/g2-3-special-item-source';
import {G24_ARTIFACT_SOURCE} from '../src/simulation/content/g2-4-artifact-source';
import {G24_ARTIFACT_ITEMS,G24_ARTIFACT_PENDING} from '../src/simulation/content/g2-4-artifacts';
import {G23_POLICY} from '../src/simulation/content/g2-3-policy';
import {healView,packets} from './helpers/replay2-views';

const IMPLEMENTED=['TFT4_Item_OrnnAnimaVisage','TFT4_Item_OrnnInfinityForce','TFT4_Item_OrnnZhonyasParadox','TFT9_Item_OrnnDeathfireGrasp','TFT_Item_Artifact_Mittens','TFT_Item_Artifact_TalismanOfAscension'];
const COMBAT='g24-artifact';
/** Holder p (Lux) faces one 3-star Garen; `item` is equipped on p unless null. */
function start(item:string|null,patch:{enemyCell?:{col:number;row:number}}={}){
 const s=createMatch(42),preparation={...s.preparation,units:[{id:'p',definitionId:'lux',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:1,row:4}}},
  {id:'e',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:patch.enemyCell??{col:1,row:3}}}]};
 const items=item?[{id:'item-1',definitionId:item,location:{kind:'unit' as const,unitId:'p',slot:0}}]:[];
 return createCombatWithEvents(preparation,buildStrategySnapshot({...s,preparation,items}),COMBAT).state;
}
const frozen=(state:CombatState,ids:readonly string[])=>({...state,units:state.units.map(u=>ids.includes(u.id)?{...u,cooldownTicks:5000,moveCooldownTicks:5000,mana:0,maxMana:0}:u)});
function run(initial:CombatState,count:number){let state=initial;const events:CombatEvent[]=[];for(let n=0;n<count&&state.status==='running';n++){const r=stepCombat(state);state=r.state;events.push(...r.events);}return {state,events};}
function validate(state:CombatState){withItemRestoreCache(()=>{for(const u of state.units)validateMechanisms(u,state.units,state.tick,COMBAT,state.status==='finished',state.nextActionSeq!);});}
const unit=(state:CombatState,id:string)=>state.units.find(u=>u.id===id)!;

it('source records cover the 29-artifact pool; only the existing-vocabulary subset is registered',()=>{
 expect(Object.keys(G24_ARTIFACT_SOURCE)).toEqual([...G23_SPECIAL_ITEM_POOLS.ORNNARTIFACTS_SET6]);
 expect(Object.keys(G24_ARTIFACT_ITEMS).sort()).toEqual([...IMPLEMENTED].sort());
 expect(G24_ARTIFACT_PENDING).toHaveLength(23);
 expect(G23_POLICY.revision).toBe('g2-4b-artifacts-v1');
 for(const [id,item] of Object.entries(G24_ARTIFACT_ITEMS)){
  expect(ITEM_DEFINITIONS[id]).toBe(item);
  expect(item).toMatchObject({apiName:id,kind:'completed',slotCost:1,unique:G24_ARTIFACT_SOURCE[id as keyof typeof G24_ARTIFACT_SOURCE].unique,conventionIds:['G24-ARTIFACT-SUBSET-01']});
  expect(item.recipe).toBeUndefined();
  if(item.combatProgram)expect(()=>validateItemProgram(item.combatProgram!)).not.toThrow();
 }
 for(const id of G24_ARTIFACT_PENDING)expect(ITEM_DEFINITIONS[id]).toBeUndefined();
 expect(G24_ARTIFACT_ITEMS.TFT4_Item_OrnnZhonyasParadox.name).toBe('中娅悖论');
});
it('Infinity Force carries every 14.24 source stat and nothing else',()=>{
 expect(G24_ARTIFACT_ITEMS.TFT4_Item_OrnnInfinityForce.effects).toEqual([{kind:'statFlat',stat:'maxHp',amount:250},{kind:'statFlat',stat:'abilityPower',amount:25},{kind:'statFlat',stat:'armor',amount:25},
  {kind:'statFlat',stat:'magicResist',amount:25},{kind:'statFlat',stat:'initialMana',amount:25},{kind:'statPercentBps',stat:'attackDamage',bps:2500},{kind:'attackSpeedBps',bps:2500}]);
 expect(G24_ARTIFACT_ITEMS.TFT4_Item_OrnnInfinityForce.combatProgram).toBeUndefined();
 const plain=start(null),state=start('TFT4_Item_OrnnInfinityForce');
 const before=readCombatStats(unit(plain,'p'),plain),after=readCombatStats(unit(state,'p'),state);
 expect(after.abilityPower-before.abilityPower).toBe(25);expect(after.armor-before.armor).toBe(25);expect(unit(state,'p').maxHp-unit(plain,'p').maxHp).toBe(250);
});
it.each(IMPLEMENTED)('%s compiles a detached combat-start program that restores',id=>{
 const state=start(id);expect(()=>validate(state)).not.toThrow();const text=JSON.stringify(state);stepCombat(state);expect(JSON.stringify(state)).toBe(text);
});
it('Anima Visage heals 3.5% max health every second',()=>{
 let state=start('TFT4_Item_OrnnAnimaVisage');
 state=frozen({...state,units:state.units.map(u=>u.id==='p'?{...u,hp:100}:u)},['p','e']);
 const {events,state:after}=run(state,41),heals=events.filter(e=>e.type==='heal').map(healView).filter(h=>h.source.definitionId==='TFT4_Item_OrnnAnimaVisage');
 const max=unit(after,'p').maxHp;
 expect(heals.map(h=>h.tick)).toEqual([20,40]);
 expect(heals.map(h=>h.actual).reduce((a,b)=>a+b)).toBe(Math.floor(max*350*2/10000));
 validate(after);
});
it('Zhonya\'s Paradox grants three seconds of invulnerability and untargetability once, at 40% health',()=>{
 let state=start('TFT4_Item_OrnnZhonyasParadox');
 // The holder never acts; Garen keeps attacking until combat ends.
 state=frozen(state,['p']);
 const {events,state:after}=run(state,1200);
 const applied=events.flatMap(e=>e.type==='statusChanged'&&e.reason==='applied'&&e.group.targetId==='p'?e.group.contributions.filter(c=>c.source.definitionId==='TFT4_Item_OrnnZhonyasParadox').map(c=>({kind:e.group.kind,tick:e.tick,until:c.expiresAtTick})):[]);
 expect(applied.map(a=>a.kind).sort()).toEqual(['damage-prevention','untargetable']);
 const at=applied[0].tick;expect(applied.every(a=>a.tick===at&&a.until===at+60)).toBe(true);
 const hits=packets(events).filter(p=>p.unitId==='p');
 const trigger=hits.filter(p=>p.tick<=at).at(-1)!;
 expect(trigger.hpDamage).toBeGreaterThan(0);
 const hpAt=(tick:number)=>unit(run(state,tick).state,'p').hp;
 expect(hpAt(at)*10000).toBeLessThanOrEqual(unit(state,'p').maxHp*4000);
 expect(hits.filter(p=>p.tick>at&&p.tick<at+60).every(p=>p.hpDamage===0&&p.absorbed===0)).toBe(true);
 validate(run(state,at+10).state);
 expect(after.status).toBe('finished');
});
it('Deathfire Grasp blasts the nearest enemy at combat start for 40% max health, then its current target every 13 seconds',()=>{
 let state=start('TFT9_Item_OrnnDeathfireGrasp');
 state=frozen(state,['e']);
 const {events,state:after}=run(state,300),blasts=packets(events).filter(p=>p.source.definitionId==='TFT9_Item_OrnnDeathfireGrasp');
 const garen=unit(state,'e');
 expect(blasts.map(b=>[b.tick,b.unitId,b.damageType])).toEqual([[1,'e','magic'],[260,'e','magic']]); // combat-start packets settle in the first step
 expect(blasts[0].raw).toBe(Math.floor(garen.maxHp*4000/10000));
 expect(blasts.every(b=>!b.critical)).toBe(true);
 // Decoded StatDamageAmp: Lux's own first attack lands 25% harder than without the artifact.
 const attack=(s:CombatState)=>packets(run(s,300).events).find(p=>p.source.sourceKind==='attack'&&p.unitId==='e')!;
 const plain=attack(frozen(start(null),['e'])),amped=attack(state);
 expect(amped.raw).toBe(plain.raw);expect(Math.abs(amped.hpDamage+amped.absorbed-Math.round((plain.hpDamage+plain.absorbed)*1.25))).toBeLessThanOrEqual(1);
 expect(G24_ARTIFACT_ITEMS.TFT9_Item_OrnnDeathfireGrasp.combatProgram!.modifiers).toEqual([expect.objectContaining({stat:'damageAmp',unit:'bps',value:{kind:'constant',amount:2500}})]);
 validate(after);
});
it('Talisman of Ascension doubles max health and adds 120% damage amp once, at 22 seconds',()=>{
 let state=start('TFT_Item_Artifact_TalismanOfAscension');
 state=frozen(state,['p','e']);
 const base=unit(state,'p').maxHp,{events,state:after}=run(state,460);
 const growth=events.filter(e=>e.type==='maxHpChanged'&&e.unitId==='p');
 expect(growth.map(e=>e.type==='maxHpChanged'&&[e.tick,e.beforeMax,e.afterMax,e.afterHp-e.beforeHp])).toEqual([[440,base,base*2,base]]);
 expect(unit(after,'p').maxHp).toBe(base*2);
 const amp=after.units.find(u=>u.id==='p')!.mechanismState!.statuses.flatMap(g=>g.kind==='stat-buff'?g.contributions:[]).filter(c=>c.source.definitionId==='TFT_Item_Artifact_TalismanOfAscension');
 expect(amp.map(c=>[c.application.modifier!.stat,c.application.modifier!.value,c.expiresAtTick])).toEqual([['damageAmp',{kind:'constant',amount:12000},null]]);
 // Restoration accepts both sides of the single pulse.
 validate(run(state,439).state);validate(run(state,440).state);validate(run(state,441).state);validate(after);
});
it('Mittens reduces incoming physical and magic damage by 25%',()=>{
 const hit=(item:string|null)=>{const state=frozen(start(item),['p']);return packets(run(state,200).events).find(p=>p.unitId==='p'&&p.hpDamage>0)!;};
 const plain=hit(null),mittens=hit('TFT_Item_Artifact_Mittens');
 expect(mittens.raw).toBe(plain.raw);
 expect(mittens.hpDamage).toBeLessThan(plain.hpDamage);
 expect(Math.abs(mittens.hpDamage-Math.round(plain.hpDamage*0.75))).toBeLessThanOrEqual(1);
 expect(G24_ARTIFACT_ITEMS.TFT_Item_Artifact_Mittens.effects).toEqual([{kind:'attackSpeedBps',bps:6000}]);
});
