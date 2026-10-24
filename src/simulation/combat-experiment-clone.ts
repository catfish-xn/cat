/** Experiment emblem copy bonus ("After 8 seconds or on death, summon a copy of this unit").
 * Project conventions P-EX1..P-EX8 (docs/S13_RULES_GAP.md, 2026-10-24); 14.24 gives only the
 * trigger text, SplitTime=8, NumCopies=1, PercentMaxHealth=0.6 and the tier Scaling. */
import type { CombatUnit, CombatMechanic } from './combat-types';
import type { AbilityContext } from './combat-s13-abilities';
import type { HexCell } from './board';
import { EMPTY_RUNTIME, type S13Unit } from './combat-s13-state';
import { g23FormStats } from './g2-3-forms';
import { resolveAbility } from './combat-abilities';
import { effectKey, resolveEffects, initializeEffectRuntime } from './effects';
import { compileCombatInitialInputs } from './combat-initialization';
import { nearestItemCell } from './g2-4b-item-kernel';
import { spawnCombatUnit } from './seat-mechanics/combat-events';
import { initializeBornUnits } from './combat-g2-4b-trench';
import { occupiesCell } from './anomalies/availability';
import { scaleItemSummonHp, type ItemSummonOrigin } from './g2-4b-summons';
import type { CombatState } from './combat-types';
import { compareUnitIds } from './unit-id-order';

export const experimentCloneMechanic=(u:Pick<CombatUnit,'mechanics'|'itemSummon'|'anomalySummon'>):CombatMechanic|undefined=>
 u.itemSummon||u.anomalySummon?undefined:u.mechanics?.find(m=>m.mechanic==='g23ExperimentClone');
const laboratory=(s:{readonly source:{readonly sourceKind:string}})=>{
 const source=s.source as {readonly sourceKind:string;readonly definitionId?:string;readonly instanceId?:string};
 return source.sourceKind==='trait'&&source.definitionId==='experiment'&&!!source.instanceId?.endsWith(':laboratory');
};

/** P-EX2: sampled once after every opening effect, as the "combat-start snapshot". */
export function startExperimentClones(units:readonly CombatUnit[]):void {
 for(const u of units)if(experimentCloneMechanic(u))(u as {experimentClone?:CombatUnit['experimentClone']}).experimentClone={openingMaxHp:u.maxHp,triggeredAtTick:null,cloneId:null};
}

/** P-EX4/5: same star and form, active non-Laboratory trait declarations only; no items,
 * item programs, augments, Laboratory bonus or copy bonus; mana 0; not a trait member. */
export function createExperimentClone(holder:CombatUnit,m:CombatMechanic,cell:HexCell,tick:number):CombatUnit {
 const id=JSON.stringify(['g23-experiment-clone',holder.id]);
 const formCell=holder.startingCell??holder.cell;
 const sources=(holder.sources??[]).filter(s=>s.source.sourceKind==='trait'&&!laboratory(s)).map(s=>{const source={...s.source,ownerId:id};return {...s,source,key:effectKey(source)};});
 const base=g23FormStats(holder.definitionId,holder.starLevel,holder.team,formCell.row);
 const resolved=resolveEffects(base,resolveAbility(base.abilityId,holder.starLevel),sources);
 const mechanics=[...resolved.mechanics??[],...(holder.mechanics??[]).filter(x=>x.source.sourceKind==='ability').map(x=>({...x,source:{...x.source,ownerId:id,instanceId:x.source.instanceId===holder.id?id:x.source.instanceId}}))]
  .filter(x=>x.mechanic!=='g23ExperimentClone'&&x.mechanic!=='g23Experiment');
 const declarations={...resolved,mechanics};
 const opening=holder.experimentClone!.openingMaxHp;
 const itemSummon:ItemSummonOrigin={kind:'experiment',ownerId:holder.id,itemInstanceId:m.source.instanceId,
  unit:{id,definitionId:holder.definitionId,team:holder.team,starLevel:holder.starLevel,location:{kind:'board',cell:{...cell}}},
  formCell:{...formCell},healthBps:m.values.healthBps,spawnedAtTick:tick,copyOrdinal:0};
 const maxHp=scaleItemSummonHp({itemSummon},opening),stats=resolved.stats;
 return {
  ...compileCombatInitialInputs(id,stats,resolved.ability,declarations),
  id,definitionId:holder.definitionId,team:holder.team,starLevel:holder.starLevel,
  ...(holder.form?{form:holder.form}:{}),cell:{...cell},startingCell:{...cell},itemSummon,
  itemSummonOpeningMaxHp:opening,maxHp,hp:maxHp,maxHpBasis:{base:opening,flat:0,bps:0,bonusBps:0},
  attackDamage:stats.attack,attackRange:stats.attackRange,attackIntervalTicks:stats.attackIntervalTicks,
  attackDamageBase:resolved.attackDamageBase,attackDamagePercentBps:resolved.attackDamagePercentBps,
  baseAttackSpeedBps:stats.baseAttackSpeedBps??Math.floor(200000/stats.attackIntervalTicks),attackSpeedBonusBps:stats.attackSpeedBonusBps??0,
  armor:stats.armor,magicResist:stats.magicResist,cooldownTicks:0,moveCooldownTicks:0,mana:0,
  ability:resolved.ability,sources:resolved.sources,triggers:resolved.triggers,effectRuntime:initializeEffectRuntime(resolved.triggers),
  mechanics,shield:0,shieldExpiresAtTick:null,shieldLayers:[],statuses:[],tasks:[],runtime:{...EMPTY_RUNTIME},alive:true,targetId:null,
 };
}

/** Runs after death cleanup, before elimination. P-EX3: whichever of tick 160 or death comes first
 * fires once; the other is void; same-tick triggers resolve in numeric unit id order (unit-9 before
 * unit-10, as Sion attribution). P-EX6: original cell first, else nearest empty cell anywhere on
 * the board (distance, row, column); a trigger with no empty cell is consumed without a copy. */
export function splitExperimentClones(ctx:AbilityContext,state:CombatState,roster:S13Unit[]):void {
 const holders=ctx.units.filter(u=>experimentCloneMechanic(u)&&u.experimentClone&&u.experimentClone.triggeredAtTick===null&&(!u.alive||ctx.tick>=experimentCloneMechanic(u)!.values.splitTick)).sort(compareUnitIds);
 if(!holders.length)return;
 let membership:CombatState={...state,units:roster};
 const born:CombatUnit[]=[];
 for(const holder of holders){
  const m=experimentCloneMechanic(holder)!;
  const cells=Array.from({length:ctx.board.rows},(_,row)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row}))).flat();
  const free=cells.filter(c=>!membership.units.some(u=>occupiesCell(u,ctx.tick)&&u.cell.col===c.col&&u.cell.row===c.row));
  const cell=nearestItemCell(holder.cell,free);
  const clone=cell?createExperimentClone(holder,m,cell,ctx.tick):null;
  holder.experimentClone={...holder.experimentClone!,triggeredAtTick:ctx.tick,cloneId:clone?.id??null};
  if(!clone)continue;
  const spawned=spawnCombatUnit(membership,clone,m.source,ctx.tick);membership=spawned.state;ctx.events.push(...spawned.events);born.push(clone);
 }
 for(const unit of born){roster.push(unit as S13Unit);if(roster!==ctx.units)ctx.units.push(unit as S13Unit);}
 if(born.length)initializeBornUnits(ctx,born);
}
