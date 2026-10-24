import { occupiesCell } from './anomalies/availability';
import type { AbilityContext } from './combat-s13-abilities';
import { amount, applyStatus, byDistance, enemies, origin, path, variable, type S13Unit } from './combat-s13-state';
import { getNeighbors, hexDistance, sameCell, type Board, type HexCell } from './board';
import {isCombatTraitMember} from './traits/effective-membership';
import type { CombatUnit } from './combat-types';
import { getUnitStats } from './unit-stats';
import { resolveAbility } from './combat-abilities';
import { compileCombatInitialInputs } from './combat-initialization';
import { freezeCombatDeclarations } from './combat-static';
import { EMPTY_RUNTIME } from './combat-s13-state';
import { g23ForgeCell } from './g2-3-summons';
import { G23_SUMMON_POLICY } from './content/g2-3-summons';
import { V19_MECHANICS } from './content/v19-mechanics';
import { status } from './content/item-programs';
import { MAX_COMBAT_TICKS } from './combat-types';
import { markRoseV19, v19Stat } from './combat-v19';
import { executeMechanismEffect } from './m8/s13-mechanisms';
import { asSource } from './m8/s13-definitions';

/** Fresh combat-only skill body for either form of an original or copied Jayce.
 * The owner's star/form belongs to Jayce; native forges remain one-star 1000 HP.
 * Caller appends through the membership ledger and initializes mechanisms at birth.
 * No inventory, original forge state, item effects, or accumulated buffs are copied. */
export function createG23Forge(jayce:CombatUnit,units:readonly CombatUnit[],board:Board,tick=0):CombatUnit|undefined {
 if(jayce.definitionId!=='jayce'||units.some(u=>u.id===jayce.id+':g23-forge'))return;
 const cell=g23ForgeCell(jayce,board,units.filter(u=>occupiesCell(u,tick)).map(u=>u.cell));if(!cell)return;
 const stats=getUnitStats('g23-forge',1),ability=resolveAbility(stats.abilityId,1);
 return freezeCombatDeclarations({
  ...compileCombatInitialInputs(jayce.id+':g23-forge',stats,ability),
  id:jayce.id+':g23-forge',definitionId:'g23-forge',team:jayce.team,starLevel:1,
  cell:{...cell},startingCell:{...cell},attackDamage:stats.attack,attackRange:stats.attackRange,
  attackIntervalTicks:stats.attackIntervalTicks,cooldownTicks:0,moveCooldownTicks:0,
  armor:stats.armor,magicResist:stats.magicResist,shield:0,shieldExpiresAtTick:null,ability,
  attackDamageBase:stats.attack,attackDamagePercentBps:0,
  baseAttackSpeedBps:stats.baseAttackSpeedBps??Math.floor(200000/stats.attackIntervalTicks),attackSpeedBonusBps:0,
  maxHpBasis:{base:stats.health,flat:0,bps:0,bonusBps:0},
  sources:[],triggers:[],effectRuntime:[],mechanics:[],shieldLayers:[],statuses:[],tasks:[],
  runtime:{...EMPTY_RUNTIME},alive:true,targetId:null,
 },false,true);
}

/** Binding is an activity gate, not invulnerability: opponents can break the chains by damage. */
export function g23Bound(u:S13Unit):boolean{return u.definitionId==='g23-sion'&&!u.runtime.buddyTriggered;}
const sionTier=(u:S13Unit)=>u.mechanics?.find(m=>m.mechanic==='g23Sion')?.values.tier??3;
export function advanceG23Summons(ctx:AbilityContext,nextSeq:()=>number):void{
 for(const u of ctx.units.filter(u=>u.alive&&u.hp>0&&u.g23Sion?.reviveAtTick===ctx.tick&&!u.g23Sion.revived))reviveG23Sion(ctx,u,nextSeq());
 for(const u of ctx.units.filter(u=>u.alive&&u.hp>0&&g23Bound(u))){
  const casts=ctx.units.filter(a=>a.team===u.team&&isCombatTraitMember(a,'black-rose')).reduce((n,a)=>n+a.runtime.castCount,0);
  // A Sion revived while still chained has crossed its health threshold by dying.
  if(casts<5&&u.hp*10000>=u.maxHp*6500&&!u.g23Sion?.revived)continue;
  u.runtime.buddyTriggered=true;
  ctx.events.push({type:'bindingChanged',tick:ctx.tick,unitId:u.id,bound:false,reason:casts>=5?'casts':'hp-threshold'});
  const tier=sionTier(u);
  if(tier>=5){
   ctx.heals.push({source:origin(u),targetId:u.id,amount:u.maxHp-u.hp});
   v19Stat(ctx,u,origin(u,2),'abilityPower',Math.round(variable(u,'NovaAbilityPower')));
  }
  chargeG23Sion(ctx,u,tier,nextSeq());
 }
}
/** P (user 2026-10-24): the unshackle charge picks the nearest enemy (distance, then id), hits every enemy on the
 * hex path to it for 100% AD and a 0.5s knockup (a stun), then lands on the free hex next to that enemy farthest
 * from Sion's start (then row, column). No free hex: Sion stays put. Only charge-hit enemies take the Black Rose amp. */
function chargeG23Sion(ctx:AbilityContext,u:S13Unit,tier:number,seq:number):void{
 const target=byDistance(u,enemies(u,ctx.units))[0];if(!target)return;
 const start=u.cell,cells=path(ctx.board,start,target.cell),source=origin(u,1);
 const hits=byDistance(u,enemies(u,ctx.units).filter(x=>cells.some(c=>sameCell(c,x.cell))));
 const raw=amount(u,ctx.tick,{ad:variable(u,'ChargeADPercent')}),knockup=Math.round(variable(u,'ChargeKnockupDuration')*20);
 for(const [ordinal,x] of hits.entries()){
  ctx.packets.push({source,targetId:x.id,raw,damageType:'physical',actionSeq:seq,ordinal,delivery:'ability-direct',
   critEligibility:'requires-spell-authorization',area:x.id!==target.id,triggeringCastActionSeq:null});
  applyStatus(x,source,'stun',0,knockup,ctx.tick,ctx.events,false,'',undefined,true);
  if(tier>=V19_MECHANICS.blackRose.minimumTier)markRoseV19(u,x);
 }
 const occupied=(c:HexCell)=>ctx.units.some(x=>x.id!==u.id&&occupiesCell(x,ctx.tick)&&sameCell(x.cell,c));
 const landing=getNeighbors(ctx.board,target.cell).filter(c=>!occupied(c)).sort((a,b)=>hexDistance(start,b)-hexDistance(start,a)||a.row-b.row||a.col-b.col)[0];
 if(landing&&!sameCell(landing,start)){ctx.events.push({type:'movement',tick:ctx.tick,unitId:u.id,from:start,to:landing});u.cell=landing;}
}
/** P (user 2026-10-24): 7 Black Rose Sion revives once per combat. At the death barrier it stays a living, absent
 * roster unit (so its team is not eliminated) holding its revive health; it returns 1s later. */
export function deathG23Sion(ctx:AbilityContext):void{
 for(const u of ctx.units.filter(u=>u.alive&&u.hp===0&&u.definitionId==='g23-sion'&&!u.g23Sion&&sionTier(u)>=7)){
  u.g23Sion={reviveAtTick:ctx.tick+G23_SUMMON_POLICY.sion.reviveDelayTicks,revived:false};
  u.hp=Math.max(1,Math.floor(u.maxHp*Math.round(variable(u,'PercentReviveHealth')*10000)/10000));
  u.targetId=null;u.cooldownTicks=0;u.moveCooldownTicks=0;
  u.tasks=u.tasks.filter(t=>!t.cancellable);
 }
}
/** Returns with hostile control cleansed, then 300% attack speed, 40% omnivamp and control immunity to combat end. */
function reviveG23Sion(ctx:AbilityContext,u:S13Unit,seq:number):void{
 u.g23Sion={...u.g23Sion!,revived:true};
 ctx.events.push({type:'unitRevived',tick:ctx.tick,unitId:u.id,source:origin(u,3),hp:u.hp});
 const context={applicationId:'g23-sion:revive',area:false,triggeringCastActionSeq:null};
 executeMechanismEffect(ctx,u,asSource(origin(u,3)),u,{kind:'cleanse',remove:'removable-hostile-control-dot-debuff',retarget:true},seq,0,undefined,undefined,undefined,undefined,context);
 executeMechanismEffect(ctx,u,asSource(origin(u,3)),u,status('control-immunity',0,MAX_COMBAT_TICKS,{activation:'immediate'}),seq,1,undefined,undefined,undefined,undefined,context);
 v19Stat(ctx,u,origin(u,3),'attackSpeed',Math.round(variable(u,'PercentAttackSpeed')*10000),'bps');
}
/** A dead forge returns on Jayce's cast. Occupied corpses relocate to the first free hex. */
export function reviveG23Forge(ctx:AbilityContext,jayce:S13Unit):S13Unit|undefined{
 const forge=ctx.units.find(u=>u.id===jayce.id+':g23-forge');if(!forge)return;
 if(!forge.alive){
  const occupied=(col:number,row:number)=>ctx.units.some(u=>occupiesCell(u,ctx.tick)&&u.cell.col===col&&u.cell.row===row);
  if(occupied(forge.cell.col,forge.cell.row)){
   const cells=Array.from({length:ctx.board.rows},(_,localRow)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row:jayce.team==='player'?localRow:ctx.board.rows-1-localRow}))).flat();
   const cell=cells.find(c=>!occupied(c.col,c.row));if(!cell)return;
   ctx.events.push({type:'movement',tick:ctx.tick,unitId:forge.id,from:forge.cell,to:cell});forge.cell=cell;
  }
  forge.alive=true;forge.hp=forge.maxHp;
  ctx.events.push({type:'unitRevived',tick:ctx.tick,unitId:forge.id,source:origin(jayce),hp:forge.hp});
 }
 return forge;
}
