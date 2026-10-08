import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import { resolveEffects, makeSourcedEffects } from '../../src/simulation/effects';
import { resolveAbility } from '../../src/simulation/combat-abilities';
import { getUnitStats } from '../../src/simulation/unit-stats';
import { EMPTY_RUNTIME } from '../../src/simulation/combat-s13-state';
import { compileItemCrit } from '../../src/simulation/m8/item-program';
import { battle, unit } from '../combat-helpers';
import { stepCombat, type CombatState, type CombatUnit, type CombatEvent } from '../../src/simulation/combat';
/** Real catalogue + strategy primitives; independent AD100/HP1000/AS1.0 fixture.
 * Never copies a trigger from the test fixtures into the runtime catalogue. */
export function wearing(id:string|readonly string[],patch:Partial<CombatUnit>={}):CombatUnit {
 const ids=typeof id==='string'?[id]:id,items=ids.map(id=>ITEM_DEFINITIONS[id]),effects=items.flatMap(i=>i.effects);
 const programs=items.flatMap((item,index)=>item.combatProgram?[{source:{ownerId:'p',sourceKind:'item' as const,definitionId:item.id,instanceId:`i${index}`,effectIndex:(item.effects.length+1)*1024,parentItemInstanceId:null},program:item.combatProgram}]:[]);
 const resolved=resolveEffects({...getUnitStats('zyra',1),health:1000,attack:100,armor:0,magicResist:0,initialMana:0,maxMana:1000,baseAttackSpeedBps:10000,attackRange:6},resolveAbility('zyra-ability',1),items.flatMap((item,index)=>makeSourcedEffects('p','item',item.id,`i${index}`,item.effects)));
 const p=unit('p','player',1,4,{definitionId:'zyra',ability:resolved.ability,hp:resolved.stats.health,maxHp:resolved.stats.health,armor:resolved.stats.armor,magicResist:resolved.stats.magicResist,attackDamage:resolved.stats.attack,attackDamageBase:resolved.attackDamageBase,attackDamagePercentBps:resolved.attackDamagePercentBps,abilityPower:resolved.abilityPower,attackRange:6,baseAttackSpeedBps:10000,attackSpeedBonusBps:resolved.stats.attackSpeedBonusBps,attackIntervalTicks:resolved.stats.attackIntervalTicks,mana:resolved.stats.initialMana,maxMana:1000,mechanics:resolved.mechanics,sources:resolved.sources,startingCell:{col:1,row:4},maxHpBasis:{base:1000,flat:effects.reduce((n,e)=>n+(e.kind==='statFlat'&&e.stat==='maxHp'?e.amount:0),0),bps:effects.reduce((n,e)=>n+(e.kind==='statPercentBps'&&e.stat==='maxHp'?e.bps:0),0),bonusBps:0},runtime:{...EMPTY_RUNTIME},...(programs.length?{itemPrograms:programs}:{}),...patch});
 return {...p,spellCrit:compileItemCrit(p)};
}
export const enemy=(id='e',col=1,row=3,patch:Partial<CombatUnit>={}):CombatUnit=>unit(id,'enemy',col,row,{ability:resolveAbility('neutral-attack',1),hp:10000,maxHp:10000,armor:0,magicResist:0,mana:0,maxMana:0,attackDamage:0,cooldownTicks:1000,moveCooldownTicks:1000,attackRange:6,runtime:{...EMPTY_RUNTIME},...patch});
export function run(p:CombatUnit,ticks=1,others:readonly CombatUnit[]=[enemy()],patch:Partial<CombatState>={}) {
 let state=battle([p,...others],{rngState:42,...patch});const events:CombatEvent[]=[];
 for(let i=0;i<ticks&&state.status==='running';i++){const r=stepCombat(state);state=r.state;events.push(...r.events);}
 return{state,events,p:state.units.find(u=>u.id==='p')!};
}
export const packets=(events:readonly CombatEvent[],owner='p')=>events.filter((e):e is Extract<CombatEvent,{type:'packetDamage'}>=>e.type==='packetDamage'&&e.source.ownerId===owner);
export const heals=(events:readonly CombatEvent[])=>events.filter((e):e is Extract<CombatEvent,{type:'heal'}>=>e.type==='heal');
