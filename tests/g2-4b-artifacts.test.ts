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
import {G24_MECHANISM_ITEMS} from '../src/simulation/content/g2-4b-mechanism-items';
import {G23_POLICY} from '../src/simulation/content/g2-3-policy';
import {healView,packets} from './helpers/replay2-views';
import {hexDistance} from '../src/simulation/board';
import {getCatalogRoundByOrdinal} from '../src/simulation/round-selectors';
import {getMultiplayerRoundById} from '../src/simulation/multiplayer-round';

const IMPLEMENTED=['TFT4_Item_OrnnAnimaVisage','TFT4_Item_OrnnInfinityForce','TFT4_Item_OrnnZhonyasParadox','TFT9_Item_OrnnDeathfireGrasp','TFT_Item_Artifact_Mittens','TFT_Item_Artifact_TalismanOfAscension',
 'TFT_Item_Artifact_RapidFirecannon','TFT_Item_Artifact_SeekersArmguard','TFT_Item_Artifact_SilvermereDawn',
 'TFT9_Item_OrnnHorizonFocus','TFT9_Item_OrnnHullbreaker','TFT_Item_Artifact_HorizonFocus','TFT_Item_Artifact_UnendingDespair','TFT_Item_Artifact_InnervatingLocket','TFT4_Item_OrnnMuramana',
 'TFT_Item_Artifact_LudensTempest','TFT_Item_Artifact_BlightingJewel','TFT_Item_Artifact_LightshieldCrest','TFT_Item_Artifact_ProwlersClaw','TFT_Item_Artifact_WitsEnd','TFT_Item_Artifact_LichBane'];
/** The eight artifacts that need new combat mechanisms (gold drops, clones, random targets, delayed damage, teleports). */
const NEW_MECHANISM=['TFT4_Item_OrnnDeathsDefiance','TFT4_Item_OrnnTheCollector','TFT9_Item_OrnnTrickstersGlass','TFT7_Item_ShimmerscaleGamblersBlade','TFT7_Item_ShimmerscaleMogulsMail',
 'TFT_Item_Artifact_Fishbones','TFT_Item_Artifact_SuspiciousTrenchCoat','TFT_Item_Artifact_SpectralCutlass'];
const COMBAT='g24-artifact';
/** Holder p (Lux) faces one 3-star Garen; `item` is equipped on p unless null. */
function start(item:string|readonly string[]|null,patch:{enemyCell?:{col:number;row:number}}={}){
 const s=createMatch(42),preparation={...s.preparation,units:[{id:'p',definitionId:'lux',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:1,row:4}}},
  {id:'e',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:patch.enemyCell??{col:1,row:3}}}]};
 const items=(item===null?[]:typeof item==='string'?[item]:item).map((definitionId,slot)=>({id:`item-${slot+1}`,definitionId,location:{kind:'unit' as const,unitId:'p',slot}}));
 return createCombatWithEvents(preparation,buildStrategySnapshot({...s,preparation,items}),COMBAT).state;
}
const frozen=(state:CombatState,ids:readonly string[])=>({...state,units:state.units.map(u=>ids.includes(u.id)?{...u,cooldownTicks:5000,moveCooldownTicks:5000,mana:0,maxMana:0}:u)});
function run(initial:CombatState,count:number){let state=initial;const events:CombatEvent[]=[];for(let n=0;n<count&&state.status==='running';n++){const r=stepCombat(state);state=r.state;events.push(...r.events);}return {state,events};}
function validate(state:CombatState){withItemRestoreCache(()=>{for(const u of state.units)validateMechanisms(u,state.units,state.tick,COMBAT,state.status==='finished',state.nextActionSeq!);});}
const unit=(state:CombatState,id:string)=>state.units.find(u=>u.id===id)!;

it('source records cover the 29-artifact pool across declarative and new-mechanism registries',()=>{
 expect(Object.keys(G24_ARTIFACT_SOURCE)).toEqual([...G23_SPECIAL_ITEM_POOLS.ORNNARTIFACTS_SET6]);
 expect(Object.keys(G24_ARTIFACT_ITEMS).sort()).toEqual([...IMPLEMENTED].sort());
 expect([...G24_ARTIFACT_PENDING]).toEqual([...NEW_MECHANISM].sort());
 expect(G23_POLICY.revision).toBe('g2-4b-artifacts-v4');
 for(const [id,item] of Object.entries(G24_ARTIFACT_ITEMS)){
  expect(ITEM_DEFINITIONS[id]).toBe(item);
  expect(item).toMatchObject({apiName:id,kind:'completed',slotCost:1,unique:G24_ARTIFACT_SOURCE[id as keyof typeof G24_ARTIFACT_SOURCE].unique,conventionIds:['G24-ARTIFACT-SUBSET-01']});
  expect(item.recipe).toBeUndefined();
  if(item.combatProgram)expect(()=>validateItemProgram(item.combatProgram!)).not.toThrow();
 }
 // Pending means outside the declarative subset; PR150 supplies all eight mechanism artifacts.
 for(const id of G24_ARTIFACT_PENDING){
  expect(G24_ARTIFACT_ITEMS[id]).toBeUndefined();
  expect(G24_MECHANISM_ITEMS[id]).toBeDefined();
  expect(ITEM_DEFINITIONS[id]).toBe(G24_MECHANISM_ITEMS[id]);
 }
 expect(Object.keys(G24_ARTIFACT_ITEMS).filter(id=>Object.hasOwn(G24_MECHANISM_ITEMS,id))).toEqual([]);
 expect([...IMPLEMENTED,...NEW_MECHANISM].sort()).toEqual([...G23_SPECIAL_ITEM_POOLS.ORNNARTIFACTS_SET6].sort());
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

type Spot={id:string;definitionId:string;cell:{col:number;row:number};hp?:number};
/** Several units per side; `item` sits on p. Optional hp patches let a short fight produce kills and assists. */
function arena(item:string|null,players:Spot[],enemies:Spot[]){
 const s=createMatch(42),place=(team:'player'|'enemy')=>(u:Spot)=>({id:u.id,definitionId:u.definitionId,starLevel:1 as const,team,location:{kind:'board' as const,cell:u.cell}});
 const preparation={...s.preparation,units:[...players.map(place('player')),...enemies.map(place('enemy'))]};
 const items=item?[{id:'item-1',definitionId:item,location:{kind:'unit' as const,unitId:'p',slot:0}}]:[];
 const state=createCombatWithEvents(preparation,buildStrategySnapshot({...s,preparation,items}),COMBAT).state;
 const hp=new Map([...players,...enemies].flatMap(u=>u.hp?[[u.id,u.hp] as const]:[]));
 return {...state,units:state.units.map(u=>hp.has(u.id)?{...u,hp:hp.get(u.id)!}:u)};
}
/** Kills by the holder, and takedowns where it only contributed positive damage (the engine's assist rule). */
/** Steps while the combat still runs and p lives: combat end clears every status, so growth is read before it. */
function runLive(initial:CombatState,count=1200){let state=initial;const events:CombatEvent[]=[];for(let n=0;n<count;n++){const r=stepCombat(state);if(r.state.status!=='running'||!unit(r.state,'p').alive)break;state=r.state;events.push(...r.events);}return {state,events};}
function takedowns(events:readonly CombatEvent[],holder='p'){
 const hits=packets(events),kills=events.flatMap(e=>e.type==='kill'?[e]:[]);
 const contributed=(victim:string,tick:number)=>hits.some(h=>h.unitId===victim&&h.source.ownerId===holder&&h.tick<=tick&&h.absorbed+h.hpDamage>0);
 return {kills:kills.filter(k=>k.source.ownerId===holder).length,assists:kills.filter(k=>k.source.ownerId!==holder&&contributed(k.unitId,k.tick)).length};
}
const KILL_FIGHT=[[{id:'p',definitionId:'lux',cell:{col:2,row:4}},{id:'a',definitionId:'garen',cell:{col:3,row:4}}],
 [{id:'e1',definitionId:'garen',cell:{col:2,row:3},hp:120},{id:'e2',definitionId:'garen',cell:{col:3,row:3},hp:120},{id:'e3',definitionId:'garen',cell:{col:4,row:3},hp:120},{id:'e4',definitionId:'garen',cell:{col:1,row:3},hp:120}]] as const;
it('Rapid Firecannon adds one range, then one more per killing blow by the holder only',()=>{
 const initial=arena('TFT_Item_Artifact_RapidFirecannon',[...KILL_FIGHT[0]],[...KILL_FIGHT[1]]),plain=arena(null,[...KILL_FIGHT[0]],[...KILL_FIGHT[1]]);
 expect(readCombatStats(unit(initial,'p'),initial).attackRange).toBe(readCombatStats(unit(plain,'p'),plain).attackRange+1);
 const {events,state}=runLive(initial),{kills}=takedowns(events);
 expect(kills).toBeGreaterThan(0);expect(events.some(e=>e.type==='kill'&&e.source.ownerId!=='p')).toBe(true);
 expect(readCombatStats(unit(state,'p'),state).attackRange).toBe(readCombatStats(unit(plain,'p'),plain).attackRange+1+kills);
 validate(state);
});
it('Seeker\'s Armguard grows 15 resists/AP per assist and 20 per killing blow',()=>{
 const initial=arena('TFT_Item_Artifact_SeekersArmguard',[...KILL_FIGHT[0]],[...KILL_FIGHT[1]]);
 const before=readCombatStats(unit(initial,'p'),initial);
 const {state,events}=runLive(initial),{kills,assists}=takedowns(events),after=readCombatStats(unit(state,'p'),state),gain=kills*20+assists*15;
 expect(kills).toBeGreaterThan(0);expect(assists).toBeGreaterThan(0);
 expect([after.armor-before.armor,after.magicResist-before.magicResist,after.abilityPower-before.abilityPower]).toEqual([gain,gain,gain]);
 validate(state);
});
it('Silvermere Dawn locks attacks to one per 40 ticks, stuns each attack target 16 ticks and grants control immunity',()=>{
 const plain=start(null),initial=start('TFT_Item_Artifact_SilvermereDawn');
 expect(readCombatStats(unit(initial,'p'),initial).attackIntervalTicks).toBe(40);
 expect(readCombatStats(unit(plain,'p'),plain).attackIntervalTicks).toBeLessThan(40);
 const lux=unit(initial,'p').mechanismState!.statuses.find(g=>g.kind==='control-immunity');
 expect(lux?.contributions.map(c=>c.source.definitionId)).toEqual(['TFT_Item_Artifact_SilvermereDawn']);
 const {events,state}=run({...initial,units:initial.units.map(u=>u.id==='p'?{...u,mana:0,maxMana:10000}:u)},200);
 const attacks=packets(events).filter(p=>p.source.ownerId==='p'&&p.source.sourceKind==='attack').map(p=>p.tick);
 expect(attacks.length).toBeGreaterThan(2);
 expect(attacks.slice(1).map((t,i)=>t-attacks[i])).toEqual(Array(attacks.length-1).fill(40));
 const stuns=events.flatMap(e=>e.type==='statusChanged'&&e.group.kind==='stun'&&e.group.targetId==='e'&&e.reason!=='expired'?e.group.contributions.filter(c=>c.source.definitionId==='TFT_Item_Artifact_SilvermereDawn').map(c=>c.expiresAtTick!-c.appliedAtTick):[]);
 expect(stuns.length).toBeGreaterThan(0);expect(new Set(stuns)).toEqual(new Set([16]));
 validate(state);
});
const fromItem=(id:string)=>(p:{source:{definitionId:string}})=>p.source.definitionId===id;
const manaFrom=(events:readonly CombatEvent[],id:string)=>events.flatMap(e=>e.type==='manaChanged'&&'outcome' in e&&e.outcome.source.definitionId===id?[{tick:e.tick,amount:e.outcome.amount,target:e.outcome.targetId}]:[]);
it('Sniper\'s Focus adds two range and 9% damage amp per hex to the target',()=>{
 const plain=frozen(start(null,{enemyCell:{col:1,row:1}}),['e']),initial=frozen(start('TFT9_Item_OrnnHorizonFocus',{enemyCell:{col:1,row:1}}),['e']);
 expect(readCombatStats(unit(initial,'p'),initial).attackRange).toBe(readCombatStats(unit(plain,'p'),plain).attackRange+2);
 const first=(s:CombatState)=>packets(run(s,200).events).find(p=>p.source.sourceKind==='attack'&&p.unitId==='e')!;
 const a=first(plain),b=first(initial),hexes=hexDistance(unit(initial,'p').cell,unit(initial,'e').cell);
 // The artifact's own 15% AD raises raw; the per-hex amp scales what armor lets through.
 expect(hexes).toBe(3);expect(b.raw).toBeGreaterThan(a.raw);
 expect(Math.abs(b.hpDamage+b.absorbed-(a.hpDamage+a.absorbed)*b.raw/a.raw*(10000+900*hexes)/10000)).toBeLessThanOrEqual(2);
});
it('Hullcrusher grants 600 health, 20% AD and 20 AP only without an adjacent ally at placement',()=>{
 const alone=start('TFT9_Item_OrnnHullbreaker'),plain=start(null);
 const pair=(item:string|null)=>arena(item,[{id:'p',definitionId:'lux',cell:{col:1,row:4}},{id:'a',definitionId:'garen',cell:{col:2,row:4}}],[{id:'e',definitionId:'garen',cell:{col:1,row:3}}]);
 expect(unit(alone,'p').maxHp-unit(plain,'p').maxHp).toBe(600);
 const [x,y]=[readCombatStats(unit(alone,'p'),alone),readCombatStats(unit(plain,'p'),plain)];
 expect(x.abilityPower-y.abilityPower).toBe(20);expect(x.attackDamage).toBe(Math.floor(unit(plain,'p').attackDamage*12000/10000));
 const crowded=pair('TFT9_Item_OrnnHullbreaker'),bare=pair(null);
 expect(unit(crowded,'p').maxHp).toBe(unit(bare,'p').maxHp);
 expect(readCombatStats(unit(crowded,'p'),crowded).abilityPower).toBe(readCombatStats(unit(bare,'p'),bare).abilityPower);
});
it('Horizon Focus strikes each enemy the holder stuns for 30% of its max health',()=>{
 const initial=start(['TFT_Item_Artifact_SilvermereDawn','TFT_Item_Artifact_HorizonFocus']);
 const {events,state}=runLive({...initial,units:initial.units.map(u=>u.id==='p'?{...u,mana:0,maxMana:10000}:u)},200);
 const stuns=events.flatMap(e=>e.type==='statusChanged'&&e.group.kind==='stun'&&(e.reason==='applied'||e.reason==='refreshed')?e.group.contributions.map(()=>e.tick):[]);
 const bolts=packets(events).filter(fromItem('TFT_Item_Artifact_HorizonFocus'));
 expect(stuns.length).toBeGreaterThan(1);
 expect(bolts.map(b=>b.tick)).toEqual(stuns);
 expect(bolts.every(b=>b.unitId==='e'&&b.damageType==='magic'&&b.raw===Math.floor(unit(initial,'e').maxHp*3000/10000))).toBe(true);
 validate(state);
});
it('Unending Despair deals 150% of a broken shield\'s initial value to the nearest enemy',()=>{
 const state=frozen(start(['crownguard','TFT_Item_Artifact_UnendingDespair']),['p']);
 const {events,state:after}=runLive(state,160);
 const granted=(unit(state,'p').shieldLayers??[]).map(l=>l.granted); // combat-start grant settles before the first step
 const broken=events.flatMap(e=>e.type==='shieldLayerChanged'&&e.reason==='depleted'&&e.layer.targetId==='p'?[e.tick]:[]);
 const bolts=packets(events).filter(fromItem('TFT_Item_Artifact_UnendingDespair'));
 expect(granted).toHaveLength(1);expect(broken).toHaveLength(1);
 expect(bolts.map(b=>[b.tick,b.unitId,b.damageType,b.raw])).toEqual([[broken[0],'e','magic',Math.floor(granted[0]*15000/10000)]]);
 validate(after);
});
const casts=(events:readonly CombatEvent[],id='p')=>events.flatMap(e=>e.type==='cast'&&'receipt' in e&&e.receipt.source.ownerId===id?[e.tick]:[]);
it('Innervating Locket returns 2% max mana per attack taken and heals 20% max health over three seconds after each cast',()=>{
 const initial=start('TFT_Item_Artifact_InnervatingLocket');
 const lux=unit(initial,'p'),state={...initial,units:initial.units.map(u=>u.id==='p'?{...u,hp:Math.floor(u.maxHp/2),mana:u.maxMana}:u)};
 const {events,state:after}=runLive(state,300);
 const hits=packets(events).filter(p=>p.unitId==='p'&&p.source.sourceKind==='attack').map(p=>p.tick);
 const share=Math.floor((lux.maxMana*200+5000)/10000),mana=manaFrom(events,'TFT_Item_Artifact_InnervatingLocket');
 expect(share).toBeGreaterThan(0);expect(hits.length).toBeGreaterThan(0);
 expect(mana.map(m=>[m.tick,m.amount])).toEqual(hits.map(t=>[t,share]));
 const cast=casts(events),heals=events.filter(e=>e.type==='heal').map(healView).filter(fromItem('TFT_Item_Artifact_InnervatingLocket'));
 expect(cast.length).toBeGreaterThan(0);
 const total=Math.floor(lux.maxHp*2000/10000),per=[0,1,2].map(i=>Math.floor(total/3)+(i<total%3?1:0));
 const expected=cast.flatMap(t=>per.map((n,i)=>[t+20*(i+1),n])).filter(([t])=>t<=after.tick);
 expect(heals.map(h=>[h.tick,h.requested])).toEqual(expected);
 validate(run(state,cast[0]+10).state);validate(after);
});
it('Manazane returns 120 mana over five seconds after the first cast only',()=>{
 const initial=start('TFT4_Item_OrnnMuramana'),state={...initial,units:initial.units.map(u=>u.id==='p'?{...u,mana:u.maxMana}:u)};
 const {events,state:after}=runLive(state,400),cast=casts(events),mana=manaFrom(events,'TFT4_Item_OrnnMuramana');
 expect(cast.length).toBeGreaterThan(1);
 expect(mana.map(m=>[m.tick,m.amount])).toEqual([1,2,3,4,5].map(i=>[cast[0]+20*i,24]));
 validate(run(state,cast[0]+30).state);validate(after);
});
it('Luden\'s Tempest sends overkill plus 100 magic damage to the three enemies nearest each target the holder kills',()=>{
 const initial=arena('TFT_Item_Artifact_LudensTempest',[...KILL_FIGHT[0]],[...KILL_FIGHT[1]]);
 // The deciding kill ends the fight, so read the whole run, including its final step.
 const {events,state}=run(initial,1200),hits=events.flatMap(e=>e.type==='packetDamage'?[e.outcome]:[]);
 const kills=hits.filter(o=>o.killingPacket&&o.context.source.ownerId==='p'&&o.context.source.definitionId!=='TFT_Item_Artifact_LudensTempest');
 expect(kills.length).toBeGreaterThan(0);
 for(const kill of kills){
  const bolts=hits.filter(o=>o.context.source.definitionId==='TFT_Item_Artifact_LudensTempest'&&o.context.parentPacketId===kill.context.packetId);
  expect(bolts.length).toBeGreaterThan(0);expect(bolts.length).toBeLessThanOrEqual(3);
  expect(bolts.every(b=>b.raw===100+kill.overkill&&b.context.damageType==='magic'&&b.context.targetId!==kill.context.targetId)).toBe(true);
 }
 validate(state);
});
it('Blighting Jewel shreds 4 magic resist per magic hit, then grants 5 mana per hit once the target has none',()=>{
 const initial=frozen(start('TFT_Item_Artifact_BlightingJewel'),['e']),state={...initial,units:initial.units.map(u=>u.id==='e'?{...u,magicResist:10}:u)};
 const {events,state:after}=runLive(state,600);
 const magic=packets(events).filter(p=>p.source.ownerId==='p'&&p.unitId==='e'&&p.damageType==='magic'&&p.hpDamage+p.absorbed>0);
 expect(magic.length).toBeGreaterThan(3);
 expect(readCombatStats(unit(after,'e'),after).magicResist).toBe(0);
 // 10 resist: the first three hits shred (10→6→2→0); every later hit grants mana instead.
 expect(manaFrom(events,'TFT_Item_Artifact_BlightingJewel').map(m=>[m.tick,m.amount,m.target])).toEqual(magic.slice(3).map(p=>[p.tick,5,'p']));
 validate(after);
});
it('Lightshield Crest shields the lowest-health ally for 70% of the holder\'s resists every 3 seconds, and every ally when it dies',()=>{
 const initial=arena('TFT_Item_Artifact_LightshieldCrest',[{id:'p',definitionId:'lux',cell:{col:1,row:4}},{id:'a',definitionId:'garen',cell:{col:5,row:5}},{id:'b',definitionId:'garen',cell:{col:6,row:5}}],[{id:'e',definitionId:'garen',cell:{col:1,row:3}}]);
 const lux=readCombatStats(unit(initial,'p'),initial),amount=Math.floor((lux.armor+lux.magicResist)*7000/10000);
 const state=frozen({...initial,units:initial.units.map(u=>u.id==='a'?{...u,hp:20}:u.id==='p'?{...u,hp:120}:u)},['p','a','b']);
 const {events}=run(state,400);
 const grants=events.flatMap(e=>e.type==='shieldLayerChanged'&&e.reason==='granted'&&e.layer.source.definitionId==='TFT_Item_Artifact_LightshieldCrest'?[{tick:e.tick,target:e.layer.targetId,granted:e.layer.granted,lasts:e.layer.expiresAtTick-e.tick}]:[]);
 const death=events.find(e=>e.type==='death'&&e.unitId==='p')!.tick;
 expect(grants.filter(g=>g.tick<death)).toEqual(Array.from({length:Math.floor((death-1)/60)},(_,i)=>({tick:60*(i+1),target:'a',granted:amount,lasts:100})));
 expect(grants.filter(g=>g.tick===death).map(g=>g.target).sort()).toEqual(['a','b']);
 expect(grants.filter(g=>g.tick>death)).toEqual([]);
 validate(run(state,61).state);validate(run(state,death).state);
});
it('Prowler\'s Claw cleanses and leaps after a killing blow',()=>{
 expect(G24_ARTIFACT_ITEMS.TFT_Item_Artifact_ProwlersClaw.combatProgram!.modifiers![0]).toMatchObject({stat:'critChance',value:{kind:'constant',amount:5000}});
 const initial=arena('TFT_Item_Artifact_ProwlersClaw',[...KILL_FIGHT[0]],[...KILL_FIGHT[1]]);
 const {events,state}=run(initial,1200);
 const kills=events.flatMap(e=>e.type==='kill'&&e.source.ownerId==='p'?[e.tick]:[]);
 expect(kills.length).toBeGreaterThan(0);
 // The leap is the holder's movement that follows its kill within the same step.
 let pending=-1;const leaps:Extract<CombatEvent,{type:'movement'}>[]=[];
 for(const e of events){if(e.type==='kill'&&e.source.ownerId==='p')pending=e.tick;else if(e.type==='movement'&&e.unitId==='p'&&e.tick===pending){leaps.push(e);pending=-1;}}
 expect(leaps.length).toBeGreaterThan(0);
 for(const leap of leaps)expect(hexDistance(leap.from,leap.to)).toBeGreaterThan(0);
 const ledger=unit(state,'p').triggerLedger!.runtimes.find(r=>r.source.definitionId==='TFT_Item_Artifact_ProwlersClaw'&&r.counters.charges!==undefined);
 expect(ledger?.counters.charges??0).toBeLessThanOrEqual(2);
 validate(state);
});
it('Prowler\'s Claw adds 60% crit damage to the two critical attacks after each killing blow',()=>{
 // Every attack crits and Lux never casts, so each kill is followed by charged crits on the next targets.
 const initial=arena('TFT_Item_Artifact_ProwlersClaw',[{id:'p',definitionId:'lux',cell:{col:2,row:4}}],[{id:'e1',definitionId:'garen',cell:{col:2,row:2},hp:150},{id:'e2',definitionId:'garen',cell:{col:3,row:1},hp:400},{id:'e3',definitionId:'garen',cell:{col:1,row:1},hp:400}]);
 const state=frozen({...initial,units:initial.units.map(u=>u.id==='p'?{...u,mana:0,maxMana:100000,spellCrit:{...u.spellCrit!,chanceBps:10000}}:u)},['e1','e2','e3']);
 const {events}=run(state,1200);
 let charges=0;const crits:{charged:boolean;k:number;target:string}[]=[];
 for(const e of events){
  if(e.type==='kill'&&e.source.ownerId==='p')charges=2;
  if(e.type==='packetDamage'&&e.outcome.context.source.ownerId==='p'&&e.outcome.context.delivery==='basic-attack'&&e.outcome.hit){
   expect(e.outcome.critical).toBe(true);
   crits.push({charged:charges>0,k:(e.outcome.mitigated+e.outcome.prevented)/e.outcome.raw,target:e.outcome.context.targetId});charges=Math.max(0,charges-1);
  }
 }
 const charged=crits.filter(r=>r.charged),plain=crits.filter(r=>!r.charged);
 expect(charged.length).toBeGreaterThan(0);
 const pairs=charged.flatMap(c=>plain.filter(q=>q.target===c.target).map(q=>c.k/q.k));
 expect(pairs.length).toBeGreaterThan(0);
 for(const r of pairs)expect(Math.abs(r-20000/14000)).toBeLessThan(0.05);
});
/** The first catalogue round of each stage, for stage-scaled artifacts. */
const roundOfStage=(stage:number)=>{for(let n=1;n<200;n++){try{if(getCatalogRoundByOrdinal(n).stage===stage)return n;}catch{/* gap */}}throw new Error('no round');};
const boundFlat=(id:string,round:number)=>{
 const s={...createMatch(42),round},preparation={...s.preparation,units:[{id:'p',definitionId:'lux',starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:1,row:4}}}]};
 const snapshot=buildStrategySnapshot({...s,preparation,items:[{id:'item-1',definitionId:id,location:{kind:'unit' as const,unitId:'p',slot:0}}]});
 const program=snapshot.units[0].itemPrograms![0].program;expect(program.byStage).toBeUndefined();
 return program.triggers!.flatMap(t=>t.effects.flatMap(e=>e.kind==='damage'?[e.amount.flat]:[]));
};
it.each([['TFT_Item_Artifact_WitsEnd',[42,42,60,75,90,100,100,100]],['TFT_Item_Artifact_LichBane',[200,200,270,340,410,480,480,480]]] as const)('%s binds its stage table at the strategy snapshot',(id,table)=>{
 const stages=[1,2,3,4,5,6,7].filter(stage=>{try{roundOfStage(stage);return true;}catch{return false;}});
 expect(stages.length).toBeGreaterThan(3);
 for(const stage of stages)expect(boundFlat(id,roundOfStage(stage))).toEqual([table[stage-1]]);
});
it.each([['TFT_Item_Artifact_WitsEnd',100],['TFT_Item_Artifact_LichBane',480]] as const)('%s binds the stage after the catalogue in multiplayer overtime',(id,value)=>{
 // Overtime ordinals lie past the catalogue (6-7); they read as stage 7, the same rule as G2-4b support items.
 for(const roundId of ['overtime-1','overtime-5'])expect(boundFlat(id,getMultiplayerRoundById(roundId).ordinal)).toEqual([value]);
});
it('Wit\'s End adds stage magic damage to each attack and heals 35% of magic damage dealt',()=>{
 const initial=frozen(start('TFT_Item_Artifact_WitsEnd'),['e']),state={...initial,units:initial.units.map(u=>u.id==='p'?{...u,hp:100,mana:0,maxMana:100000}:u)};
 const {events,state:after}=runLive(state,300);
 const hits=packets(events),attacks=hits.filter(p=>p.source.ownerId==='p'&&p.source.sourceKind==='attack'),bonus=hits.filter(fromItem('TFT_Item_Artifact_WitsEnd'));
 expect(attacks.length).toBeGreaterThan(2);
 expect(bonus.map(b=>[b.tick,b.unitId,b.damageType,b.raw])).toEqual(attacks.map(a=>[a.tick,'e','magic',42]));
 const heals=events.filter(e=>e.type==='heal').map(healView).filter(fromItem('TFT_Item_Artifact_WitsEnd'));
 expect(heals.map(h=>[h.tick,h.requested])).toEqual(bonus.map(b=>[b.tick,Math.floor((b.hpDamage+b.absorbed)*3500/10000)]).filter(([,n])=>n>0));
 validate(after);
});
it('Lich Bane adds stage magic damage to the first attack after each cast only',()=>{
 const initial=frozen(start('TFT_Item_Artifact_LichBane'),['e']),state={...initial,units:initial.units.map(u=>u.id==='p'?{...u,mana:u.maxMana}:u)};
 const {events,state:after}=runLive(state,600),cast=casts(events);
 const attacks=packets(events).filter(p=>p.source.ownerId==='p'&&p.source.sourceKind==='attack').map(p=>p.tick);
 const empowered=cast.flatMap(t=>{const next=attacks.find(a=>a>t);return next!==undefined&&!cast.some(c=>c>t&&c<next)?[next]:[];});
 expect(cast.length).toBeGreaterThan(1);expect(empowered.length).toBeGreaterThan(1);
 expect(packets(events).filter(fromItem('TFT_Item_Artifact_LichBane')).map(b=>[b.tick,b.unitId,b.damageType,b.raw])).toEqual(empowered.map(t=>[t,'e','magic',200]));
 validate(after);
});
