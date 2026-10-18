import type {CombatState,CombatUnit,CombatMechanic} from './combat-types';
import type {HexCell} from './board';
import type {AbilityContext} from './combat-s13-abilities';
import {EMPTY_RUNTIME,type S13Unit} from './combat-s13-state';
import {g23FormStats} from './g2-3-forms';
import {resolveAbility} from './combat-abilities';
import {effectKey,resolveEffects,initializeEffectRuntime} from './effects';
import {compileCombatInitialInputs} from './combat-initialization';
import {nearestItemCell} from './g2-4b-item-kernel';
import {spawnCombatUnit,removeCombatUnit} from './seat-mechanics/combat-events';
import {initializeMechanisms} from './m8/s13-mechanisms';
import {compileMechanismDefinitions} from './m8/s13-definitions';
import {createG23Forge} from './combat-g2-3-summons';
import {freezeCombatDeclarations} from './combat-static';

/** New identity, static declarations only. Never clone a mutable combat body. */
export function createTrenchCopy(holder:CombatUnit,item:CombatMechanic,ordinal:number,cell:HexCell,tick:number,maximum=holder.maxHp):CombatUnit {
 const id=JSON.stringify(['g24-summon','trench',holder.id,item.source.instanceId,ordinal]);
 const formCell=holder.itemSummon?.formCell??holder.startingCell??holder.cell;
 const sources=(holder.sources??[]).map(s=>{const source={...s.source,ownerId:id};return {...s,source,key:effectKey(source)};});
 const base=g23FormStats(holder.definitionId,holder.starLevel,holder.team,formCell.row);
 const resolved=resolveEffects(base,resolveAbility(base.abilityId,holder.starLevel),sources);
 const mechanics=[...resolved.mechanics??[],...(holder.mechanics??[]).filter(m=>m.source.sourceKind==='ability').map(m=>({...m,source:{...m.source,ownerId:id,instanceId:m.source.instanceId===holder.id?id:m.source.instanceId}}))].filter(m=>m.mechanic!=='g24Trench');
 const itemPrograms=holder.itemPrograms?.map(p=>({...p,source:{...p.source,ownerId:id}}));
 const declarations={...resolved,mechanics,...(itemPrograms?{itemPrograms}:{})};
 const stats=resolved.stats,maxHp=Math.max(1,Math.floor(maximum*item.values.healthBps/10000));
 return {
  ...compileCombatInitialInputs(id,stats,resolved.ability,declarations),
  id,definitionId:holder.definitionId,team:holder.team,starLevel:holder.starLevel,
  ...(holder.form?{form:holder.form}:{}),cell:{...cell},startingCell:{...cell},
  itemSummon:{kind:'trench',ownerId:holder.id,itemInstanceId:item.source.instanceId,
   unit:{id,definitionId:holder.definitionId,team:holder.team,starLevel:holder.starLevel,location:{kind:'board',cell:{...cell}}},
   formCell:{...formCell},healthBps:item.values.healthBps,spawnedAtTick:tick,copyOrdinal:ordinal},
  itemSummonOpeningMaxHp:maximum,maxHp,hp:maxHp,maxHpBasis:{base:maximum,flat:0,bps:0,bonusBps:0},
  attackDamage:stats.attack,attackRange:stats.attackRange,attackIntervalTicks:stats.attackIntervalTicks,
  attackDamageBase:resolved.attackDamageBase,attackDamagePercentBps:resolved.attackDamagePercentBps,
  baseAttackSpeedBps:stats.baseAttackSpeedBps??Math.floor(200000/stats.attackIntervalTicks),attackSpeedBonusBps:stats.attackSpeedBonusBps??0,
  armor:stats.armor,magicResist:stats.magicResist,cooldownTicks:0,moveCooldownTicks:0,
  ability:resolved.ability,sources:resolved.sources,triggers:resolved.triggers,effectRuntime:initializeEffectRuntime(resolved.triggers),
  mechanics,shield:0,shieldExpiresAtTick:null,shieldLayers:[],statuses:[],tasks:[],runtime:{...EMPTY_RUNTIME},alive:true,targetId:null,
  ...(mechanics.some(m=>m.mechanic==='g24Mogul')?{itemMogulHits:[]}:{}),
  ...(mechanics.some(m=>m.mechanic==='g24DeathsDefiance')?{deferredItemDamage:[]}:{}),
  ...(holder.openingItemBankGold===undefined?{}:{openingItemBankGold:holder.openingItemBankGold,currentItemBankGold:holder.currentItemBankGold}),
 };
}

/** Birth-relative periodic clocks; old counters, debts and temporary states never enter. */
function initializeBornUnits(ctx:AbilityContext,born:readonly CombatUnit[]):void {
 const fresh=born as S13Unit[];
 for(const unit of fresh){
  const definitions=compileMechanismDefinitions(unit,ctx.combatId??'standalone');
  unit.mechanismDefinitions={...definitions,periodicTasks:definitions.periodicTasks.map(t=>({...t,nextPulseAtTick:t.nextPulseAtTick+ctx.tick,endsAtTick:t.endsAtTick===null?null:t.endsAtTick+ctx.tick}))};
 }
 initializeMechanisms({...ctx,units:fresh,tick:ctx.tick+1});
 for(const unit of fresh){unit.mechanismState={...unit.mechanismState!,sampledAtTick:ctx.tick};freezeCombatDeclarations(unit);}
}

/** Threshold eligibility freezes at the surviving-damage barrier. Membership
 * commits after old actors' tick bookkeeping; fresh bodies act next tick. */
export function splitTrenchHolders(ctx:AbilityContext,state:CombatState,eligible:ReadonlyMap<string,number>):Pick<CombatState,'removedUnitIds'|'trenchSplits'> {
 if(!eligible.size)return {};
 let membership:CombatState={...state,units:ctx.units};
 const receipts=[...state.trenchSplits??[]];
 for(const [id,maximum] of eligible){
  const holder=membership.units.find(u=>u.id===id),item=holder?.mechanics?.find(m=>m.mechanic==='g24Trench');
  if(!holder||!item||!holder.alive||holder.hp<=0)continue;
  const cells=Array.from({length:ctx.board.rows},(_,row)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row}))).flat();
  const zone=ctx.board.deploymentZones[holder.team];
  const available=cells.filter(c=>c.row>=zone.firstRow&&c.row<=zone.lastRow&&!membership.units.some(u=>u.id!==holder.id&&u.alive&&u.cell.col===c.col&&u.cell.row===c.row));
  // Atomic replacement: defer if three legal cells cannot be reserved.
  if(available.length<3)continue;
  const selected:HexCell[]=[];
  for(let i=0;i<3;i++){const cell=nearestItemCell(holder.cell,available.filter(c=>!selected.some(s=>s.col===c.col&&s.row===c.row)))!;selected.push(cell);}
  const removed=removeCombatUnit(membership,holder.id,'trench-split',ctx.tick);membership=removed.state;ctx.events.push(...removed.events);
  if(membership.units.some(u=>u.id===holder.id+':g23-forge')){const forgeRemoved=removeCombatUnit(membership,holder.id+':g23-forge','trench-owner-replaced',ctx.tick);membership=forgeRemoved.state;ctx.events.push(...forgeRemoved.events);}
  const copies=selected.map((cell,ordinal)=>createTrenchCopy(holder,item,ordinal,cell,ctx.tick,maximum)),born:CombatUnit[]=[];
  for(const copy of copies){const spawned=spawnCombatUnit(membership,copy,item.source,ctx.tick);membership=spawned.state;ctx.events.push(...spawned.events);born.push(copy);}
  for(const copy of copies){const forge=createG23Forge(copy,membership.units,ctx.board);if(!forge)continue;const spawned=spawnCombatUnit(membership,forge,{ownerId:copy.id,sourceKind:'ability',definitionId:copy.ability.id,instanceId:copy.id,effectIndex:0},ctx.tick);membership=spawned.state;ctx.events.push(...spawned.events);born.push(forge);}
  initializeBornUnits(ctx,born);
  receipts.push({ownerId:holder.id,itemInstanceId:item.source.instanceId,tick:ctx.tick,maxHp:maximum,permanentAdBps:holder.runtime?.permanentAdBps??0,copyIds:copies.map(c=>c.id),...(holder.g23?{g23:{conquestTakedowns:[...holder.g23.conquestTakedowns],highRoller:structuredClone(holder.g23.highRoller)}}:{})});
 }
 ctx.units.splice(0,ctx.units.length,...membership.units as S13Unit[]);
 return {...(membership.removedUnitIds?{removedUnitIds:membership.removedUnitIds}:{}),...(receipts.length?{trenchSplits:receipts}:{})};
}
