import type { CombatTask, CombatOrigin, CombatUnit } from './combat-types';
import type { AbilityContext, S13Packet } from './combat-s13-abilities';
import { ad, amount, ap, byDistance, enemies, variable, type S13Unit, EMPTY_RUNTIME } from './combat-s13-state';
import { hexDistance } from './board';
import { occupiesCell, isAbsent } from './anomalies/availability';
import { asSource } from './m8/s13-definitions';
import { initializeMechanisms } from './m8/s13-mechanisms';
import { canMove } from './combat-movement';

export interface V20TraitsState {
  moveTenths?:number;
  quickDashAtTick?:number;
  nextDashTick?:number;
  dashUntilTick?:number;
  mentorshipAdSample?:number;
  mentorshipGranted?:number;
  silcoSample?:{star:1|2|3;abilityPower:number;damage:number;attacks:number;durationTicks:number};
  detonations?:number[];
  minion?:{ownerId:string;rootActionSeq:number;nextAttackTick:number;remaining:number;periodTicks:number;untilTick:number;damage:number};
}
export const teamup=(u:Pick<CombatUnit,'mechanics'|'itemSummon'>,id:string)=>u.itemSummon?undefined:u.mechanics?.find(m=>m.mechanic==='v20Teamup'&&m.source.definitionId===id&&m.targetId!==undefined);
const live=(u:S13Unit|undefined,tick:number):u is S13Unit=>!!u&&u.alive&&u.hp>0&&!isAbsent(u,tick);
export function startV20Traits(ctx:AbilityContext):void {
  // Freeze all samples after ordinary opening stats, before applying any partner AD share.
  const samples=ctx.units.flatMap(u=>{
    const m=teamup(u,'mentorship'),partner=m&&ctx.units.find(t=>t.id===m.targetId);
    return u.definitionId==='ambessa'&&partner?[{u,m:m!,value:ad(partner)}]:[];
  });
  for(const {u,m,value} of samples){const before=ad(u),granted=Math.floor(value*2500/10000);u.v20Traits={...u.v20Traits,mentorshipAdSample:value,mentorshipGranted:granted};ctx.events.push({type:'statChanged',tick:0,unitId:u.id,source:asSource(m.source),stat:'attackDamage',before,after:ad(u)});}
  for(const u of ctx.units)if(u.definitionId==='powder'){
    const m=teamup(u,'menaces'),silco=m&&ctx.units.find(t=>t.id===m.targetId);
    if(silco)u.v20Traits={...u.v20Traits,silcoSample:{star:silco.starLevel,abilityPower:ap(silco,0),damage:amount(silco,0,{ap:variable(silco,'MinionDamage')}),
      attacks:variable(silco,'MinionNumAttacks'),durationTicks:Math.round(variable(silco,'MinionDuration')*20)},detonations:[]};
  }
}
function derived(ctx:AbilityContext,_u:S13Unit,target:S13Unit,raw:number,seq:number,ordinal:number,source:CombatOrigin,type:S13Packet['damageType']='magic',area=false):void {
  ctx.packets.push({source,targetId:target.id,raw,actionSeq:seq,rootActionSeq:seq,ordinal,damageType:type,delivery:'attack-extra',critEligibility:'never',area,triggeringCastActionSeq:null});
}
/** Called only for real cast receipts. Queue on the emitter so ordering cannot depend on which partner acts first. */
export function castV20Teamups(ctx:AbilityContext,u:S13Unit,target:S13Unit,seq:number):void {
  if(u.itemSummon)return;
  for(const m of u.mechanics?.filter(m=>m.mechanic==='v20Teamup')??[]){
    const partner=ctx.units.find(t=>t.id===m.targetId);if(!live(partner,ctx.tick))continue;
    if(m.source.definitionId==='unlikely-duo'){
      (ctx.manaRequests??=[]).push({source:asSource(m.source),targetId:partner.id,amount:10,reason:'periodic',bypassLock:'none',castActionSeq:null});continue;
    }
    const id=m.source.definitionId;
    if(id==='menaces'||id==='mentorship'&&u.definitionId!=='ambessa')continue;
    const kind=id==='mentorship'?'attack':partner.definitionId==='heimerdinger'?'missiles':partner.definitionId==='vi'?'wave':'echo';
    const count=kind==='echo'||kind==='missiles'?3:1;
    const source={...m.source,ownerId:partner.id,instanceId:JSON.stringify([m.source.instanceId,u.id,seq])};
    for(let n=0;n<count;n++)partner.tasks.push({key:JSON.stringify(['v20-teamup',u.id,seq,id,n]),kind:'v20Teamup',source,
      executeAtTick:ctx.tick+1,targetId:target.id,cell:{...target.cell},amount:kind==='echo'?(id==='geniuses'?3300:5000):kind==='wave'?15000:kind==='missiles'?12000:22500,
      actionSeq:seq,ordinal:n,total:count,cancellable:false,teamupKind:kind});
  }
}
export function executeV20Teamup(ctx:AbilityContext,u:S13Unit,task:CombatTask):void {
  if(!live(u,ctx.tick))return;
  const ordinalBase=task.source.definitionId==='geniuses'?31000:task.source.definitionId==='mentorship'?32000:30000;
  const target=enemies(u,ctx.units).find(t=>t.id===task.targetId);
  if(task.teamupKind==='missiles'){
    const foes=byDistance(u,enemies(u,ctx.units));if(!foes.length)return;
    const selected=foes[Math.floor(ctx.draw()*foes.length/2**32)];
    derived(ctx,u,selected,Math.floor(amount(u,ctx.tick,{ap:variable(u,'Damage')})*task.amount/10000),task.actionSeq,ordinalBase+task.ordinal,task.source);
  }else if(task.teamupKind==='wave'){
    const raw=Math.floor(amount(u,ctx.tick,{ad:variable(u,'PercentAttackDamage_SecondaryDamage')})*task.amount/10000);
    for(const [n,t] of enemies(u,ctx.units).filter(t=>t.cell.row===task.cell!.row).entries())derived(ctx,u,t,raw,task.actionSeq,ordinalBase+n,task.source,'physical',true);
  }else if(target){
    const raw=task.teamupKind==='attack'?Math.floor(ad(u)*task.amount/10000):Math.floor(amount(u,ctx.tick,{ap:variable(u,'TargetDamage')})*task.amount/10000);
    derived(ctx,u,target,raw,task.actionSeq,ordinalBase+task.ordinal,task.source,task.teamupKind==='attack'?'physical':'magic');
  }
}
/** Stable actor order plus current occupancy reserves every dash destination once. */
export function quickDashV20(ctx:AbilityContext,u:S13Unit):void {
  if(u.v20Traits?.quickDashAtTick!==ctx.tick)return;
  const {quickDashAtTick,...rest}=u.v20Traits;u.v20Traits=rest;
  if(!canMove(u,ctx.tick))return;
  const target=byDistance(u,enemies(u,ctx.units))[0];if(!target)return;
  const cells=Array.from({length:ctx.board.rows},(_,row)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row}))).flat()
    .filter(c=>hexDistance(c,target.cell)===1&&!ctx.units.some(t=>t.id!==u.id&&occupiesCell(t,ctx.tick)&&hexDistance(c,t.cell)===0))
    .sort((a,b)=>hexDistance(u.cell,a)-hexDistance(u.cell,b)||a.row-b.row||a.col-b.col);
  if(u.targetId!==target.id)ctx.events.push({type:'targetChanged',tick:ctx.tick,unitId:u.id,before:u.targetId,after:target.id});u.targetId=target.id;
  if(cells[0]&&hexDistance(cells[0],u.cell)>0){ctx.events.push({type:'movement',tick:ctx.tick,unitId:u.id,from:u.cell,to:cells[0]});u.cell=cells[0];}
}
/** Menaces monsters use the existing Silco attack-agent convention: no health/body collision or jar hit. */
export function detonateMenaces(ctx:AbilityContext,powder:S13Unit,seq:number,cell:import('./board').HexCell):void {
  const sample=powder.v20Traits?.silcoSample;if(!sample||powder.v20Traits?.detonations?.includes(seq))return;
  powder.v20Traits={...powder.v20Traits,detonations:[...powder.v20Traits?.detonations??[],seq]};
  for(let n=0;n<3;n++){
    const id=JSON.stringify(['v20-menaces',powder.id,seq,n]);if(ctx.units.some(u=>u.id===id))continue;
    const periodTicks=Math.floor(sample.durationTicks/sample.attacks);
    const u:S13Unit={id,definitionId:'v20-silco-minion',team:powder.team,starLevel:sample.star,cell:{...cell},startingCell:{...cell},hp:1,maxHp:1,mana:0,maxMana:0,
      alive:true,targetId:null,attackDamage:sample.damage,attackDamageBase:sample.damage,attackDamagePercentBps:0,abilityPower:sample.abilityPower,
      armor:0,magicResist:0,attackRange:100,attackIntervalTicks:periodTicks,cooldownTicks:0,moveCooldownTicks:0,
      baseAttackSpeedBps:Math.floor(200000/periodTicks),attackSpeedBonusBps:0,maxHpBasis:{base:1,flat:0,bps:0,bonusBps:0},
      ability:{kind:'s13',id:'v20-silco-minion-ability',championId:'v20-silco-minion',amount:0,variables:{}},
      sources:[],mechanics:[],itemPrograms:[],triggers:[],effectRuntime:[],tasks:[],statuses:[],shieldLayers:[],shield:0,shieldExpiresAtTick:null,
      runtime:{...EMPTY_RUNTIME},
      v20Traits:{minion:{ownerId:powder.id,rootActionSeq:seq,nextAttackTick:ctx.tick+periodTicks,remaining:sample.attacks,periodTicks,untilTick:ctx.tick+sample.durationTicks,damage:sample.damage}}};
    initializeMechanisms({...ctx,units:[u]});ctx.units.push(u);
    ctx.events.push({type:'unitSpawned',tick:ctx.tick,unitId:id,definitionId:u.definitionId,team:u.team,cell:u.cell,source:teamup(powder,'menaces')!.source});
  }
}
export function advanceV20Minions(ctx:AbilityContext):void {
  for(const u of ctx.units){const m=u.v20Traits?.minion;if(!m||!u.alive)continue;
    if(m.remaining>0&&ctx.tick>=m.nextAttackTick){
      const t=byDistance(u,enemies(u,ctx.units))[0];
      if(t)derived(ctx,u,t,m.damage,m.rootActionSeq,40000+(5-m.remaining),{ownerId:u.id,sourceKind:'trait',definitionId:'menaces',instanceId:u.id,effectIndex:0});
      u.v20Traits={minion:{...m,remaining:m.remaining-1,nextAttackTick:m.nextAttackTick+m.periodTicks}};
    }
    if(ctx.tick>=m.untilTick){u.alive=false;u.hp=0;ctx.events.push({type:'death',tick:ctx.tick,unitId:u.id});}
  }
}
