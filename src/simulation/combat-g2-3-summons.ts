import { occupiesCell } from './anomalies/availability';
import type { AbilityContext } from './combat-s13-abilities';
import { amount, applyStatus, enemies, grantShield, origin, type S13Unit } from './combat-s13-state';
import { hexDistance, type Board } from './board';
import { UNIT_DEFINITIONS } from './units';
import type { CombatUnit } from './combat-types';
import { getUnitStats } from './unit-stats';
import { resolveAbility } from './combat-abilities';
import { compileCombatInitialInputs } from './combat-initialization';
import { freezeCombatDeclarations } from './combat-static';
import { EMPTY_RUNTIME } from './combat-s13-state';
import { g23ForgeCell } from './g2-3-summons';

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
export function advanceG23Summons(ctx:AbilityContext):void{
 for(const u of ctx.units.filter(u=>u.alive&&u.hp>0&&g23Bound(u))){
  const casts=ctx.units.filter(a=>a.team===u.team&&UNIT_DEFINITIONS[a.definitionId]?.traits.includes('black-rose')).reduce((n,a)=>n+a.runtime.castCount,0);
  if(casts<5&&u.hp*10000>=u.maxHp*6500)continue;
  u.runtime.buddyTriggered=true;
  ctx.events.push({type:'bindingChanged',tick:ctx.tick,unitId:u.id,bound:false,reason:casts>=5?'casts':'hp-threshold'});
  const tier=u.mechanics?.find(m=>m.mechanic==='g23Sion')?.values.tier??3;
  if(tier>=5)ctx.heals.push({source:origin(u),targetId:u.id,amount:u.maxHp-u.hp});
  grantShield(u,origin(u),amount(u,ctx.tick,{ap:tier>=5?75:175}),ctx.tick+(tier>=5?60:100),ctx.tick,ctx.events);
  for(const foe of enemies(u,ctx.units).filter(e=>hexDistance(u.cell,e.cell)<=1))applyStatus(foe,origin(u),'stun',0,tier>=5?20:30,ctx.tick,ctx.events);
 }
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
