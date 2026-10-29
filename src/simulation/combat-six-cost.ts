import { recordAerialMovement } from './augment-pool-batch5-g3-combat';
import type { AbilityContext, S13Packet } from './combat-s13-abilities';
import type { CombatOrigin, ShieldLayer } from './combat-types';
import { ad, ap, byDistance, enemies, origin, variable, grantShield, applyStatus, attackSpeedBonus, type S13Unit } from './combat-s13-state';
import { getNeighbors, hexDistance, type HexCell } from './board';
import { occupiesCell, isAbsent, isAttackProxy } from './anomalies/availability';
import { v19Stat } from './combat-v19';
import { executeMechanismEffect, commitMechanismHeal } from './m8/s13-mechanisms';
import { asSource } from './m8/s13-definitions';
import { resolveMana } from './m8/mana';
import { SIX_COST_POLICY as P } from './content/v19-six-cost';

export interface SixCostState {
  energy:number; convertedMana:number; frenzyUntil:number; permanentFrenzy:boolean; nextFrenzyPulse:number;
  kills:number; devoured:string[]; pendingDevour:string|null; storedEnergy:number; absorbedRemainder:number;
  storm:{due:number;targetIds:string[];actionSeq:number}|null;
}
export type SixCostEvent = {readonly tick:number;readonly unitId:string} & (
  | {readonly type:'chaosEnergyChanged'|'melEnergyChanged';readonly before:number;readonly after:number}
  | {readonly type:'bloodFrenzyChanged';readonly active:boolean;readonly permanent:boolean}
  | {readonly type:'devoured';readonly targetId:string}
);
export const isSixCost=(u:Pick<S13Unit,'definitionId'>)=>['warwick','viktor','mel'].includes(u.definitionId);
export function sixState(u:S13Unit):SixCostState {
  return u.sixCost??={energy:u.definitionId==='viktor'?3:0,convertedMana:0,frenzyUntil:0,permanentFrenzy:false,nextFrenzyPulse:0,kills:0,devoured:[],pendingDevour:null,storedEnergy:0,absorbedRemainder:0,storm:null};
}
export function startSixCost(ctx:AbilityContext):void {
  for(const u of ctx.units.filter(isSixCost)){
    const s=sixState(u);
    if(u.definitionId==='viktor'){
      s.convertedMana=Math.max(0,u.sources?u.sources.reduce((n,s)=>n+(s.effect.kind==='statFlat'&&s.effect.stat==='initialMana'?s.effect.amount:0),0):u.mana);u.mana=3;u.maxMana=8;
      ctx.events.push({type:'chaosEnergyChanged',tick:ctx.tick,unitId:u.id,before:0,after:3});
    }
  }
}
function packet(ctx:AbilityContext,u:S13Unit,t:S13Unit,raw:number,type:S13Packet['damageType'],seq:number,ordinal:number,delivery:S13Packet['delivery']='ability-direct'):S13Packet {
  const p:S13Packet={source:origin(u),targetId:t.id,raw,damageType:type,actionSeq:seq,ordinal,delivery,critEligibility:delivery==='basic-attack'?'never':'requires-spell-authorization',area:true,triggeringCastActionSeq:delivery==='basic-attack'?null:seq};
  ctx.packets.push(p);return p;
}
function frenzy(ctx:AbilityContext,u:S13Unit,permanent=false):void {
  const s=sixState(u),active=s.permanentFrenzy||s.frenzyUntil>0&&s.frenzyUntil>=ctx.tick;
  s.permanentFrenzy ||= permanent;s.frenzyUntil=ctx.tick+P.warwick.frenzyTicks;
  if(!active)s.nextFrenzyPulse=ctx.tick+20;
  v19Stat(ctx,u,origin(u),'attackSpeed',P.warwick.speedBps,'bps',s.permanentFrenzy?null:P.warwick.frenzyTicks);
  ctx.events.push({type:'bloodFrenzyChanged',tick:ctx.tick,unitId:u.id,active:true,permanent:s.permanentFrenzy});
}
export function sixCostCast(ctx:AbilityContext,u:S13Unit,_target:S13Unit,seq:number):string[]|null {
  if(!isSixCost(u))return null;
  const s=sixState(u);
  if(u.definitionId==='warwick'){frenzy(ctx,u);return [u.id];}
  if(u.definitionId==='viktor'){
    const targets=enemies(u,ctx.units),ticks=Math.round(variable(u,'StunSeconds')*20);
    for(const t of targets)applyStatus(t,origin(u),'stun',0,ticks,ctx.tick,ctx.events,false,'',undefined,true); // knocks up every enemy
    s.storm={due:ctx.tick+ticks,targetIds:targets.map(t=>t.id),actionSeq:seq};
    ctx.events.push({type:'chaosEnergyChanged',tick:ctx.tick,unitId:u.id,before:s.energy,after:0});s.energy=0;
    return targets.map(t=>t.id);
  }
  const free:HexCell[]=[];
  for(let row=0;row<ctx.board.rows;row++)for(let col=0;col<ctx.board.columns;col++){
    const cell={col,row};if(hexDistance(u.cell,cell)<=P.mel.dashRadius&&!ctx.units.some(t=>t.id!==u.id&&occupiesCell(t,ctx.tick)&&hexDistance(t.cell,cell)===0))free.push(cell);
  }
  const coverage=(cell:HexCell)=>ctx.units.filter(t=>t.id!==u.id&&t.team===u.team&&t.alive&&t.hp>0&&!isAbsent(t,ctx.tick)&&!isAttackProxy(t)&&hexDistance(cell,t.cell)<=2).length;
  free.sort((a,b)=>Math.min(2,coverage(b))-Math.min(2,coverage(a))||hexDistance(u.cell,a)-hexDistance(u.cell,b)||a.row-b.row||a.col-b.col);
  const destination=free[0];if(destination&&hexDistance(destination,u.cell)>0){ctx.events.push({type:'movement',tick:ctx.tick,unitId:u.id,from:u.cell,to:destination}); recordAerialMovement(ctx, u, destination);u.cell=destination;}
  const allies=byDistance(u,ctx.units.filter(t=>t.id!==u.id&&t.team===u.team&&t.alive&&t.hp>0&&!isAbsent(t,ctx.tick)&&!isAttackProxy(t)&&hexDistance(u.cell,t.cell)<=2)).slice(0,2);
  for(const t of [u,...allies])grantShield(t,origin(u),variable(u,'Shield'),ctx.tick+P.mel.shieldTicks,ctx.tick,ctx.events);
  if(u.runtime.castCount%3===0){
    const targets=byDistance(u,enemies(u,ctx.units)).slice(0,5),total=s.storedEnergy+Math.floor(variable(u,'ThirdDamage')*ap(u,ctx.tick,ctx.units)/100);
    if(targets.length){
      const ids=[...targets].sort((a,b)=>a.id<b.id?-1:1),base=Math.floor(total/targets.length),remainder=total%targets.length;
      for(const t of targets){const value=base+(ids.indexOf(t)<remainder?1:0);bolts(ctx,u,t,value,seq);}
    }
    ctx.events.push({type:'melEnergyChanged',tick:ctx.tick,unitId:u.id,before:s.storedEnergy,after:0});s.storedEnergy=0;s.absorbedRemainder=0;
    return targets.map(t=>t.id);
  }
  const targets=byDistance(u,enemies(u,ctx.units)).slice(0,3);
  for(const t of targets)bolts(ctx,u,t,Math.floor(variable(u,'Damage')*ap(u,ctx.tick,ctx.units)/100),seq);
  return targets.map(t=>t.id);
}
function bolts(ctx:AbilityContext,u:S13Unit,t:S13Unit,total:number,seq:number):void {
  for(let i=0;i<10;i++)packet(ctx,u,t,Math.floor(total/10)+(i<total%10?1:0),'magic',seq,i);
}
export function sixCostAttack(ctx:AbilityContext,u:S13Unit,t:S13Unit,seq:number):boolean {
  if(u.definitionId!=='viktor')return false;
  // Custom hex mapping: primary cell plus one cell behind it, aligned with the caster-to-target cube vector.
  const aq=u.cell.col-Math.floor(u.cell.row/2),tq=t.cell.col-Math.floor(t.cell.row/2),dq=tq-aq,dr=t.cell.row-u.cell.row;
  const alignment=(c:HexCell)=>{const q=c.col-Math.floor(c.row/2)-tq,r=c.row-t.cell.row;return q*dq+r*dr+(q+r)*(dq+dr);};
  const behind=getNeighbors(ctx.board,t.cell).filter(c=>hexDistance(u.cell,c)>hexDistance(u.cell,t.cell)).sort((a,b)=>alignment(b)-alignment(a)||a.row-b.row||a.col-b.col)[0];
  const line=ctx.units.filter(e=>e.team!==u.team&&e.alive&&e.hp>0&&!isAbsent(e,ctx.tick)&&!isAttackProxy(e)
    &&(hexDistance(t.cell,e.cell)===0||behind&&hexDistance(behind,e.cell)===0));
  if(!line.includes(t))line.push(t);
  for(const e of line){
    packet(ctx,u,e,Math.floor(variable(u,'RayMagic')*ap(u,ctx.tick,ctx.units)/100),'magic',seq,0,'basic-attack');
    packet(ctx,u,e,variable(u,'RayTrue'),'true',seq,1,'attack-extra').critEligibility='never';
    applyStatus(e,origin(u),'armorReduction',3000,100,ctx.tick,ctx.events);
    executeMechanismEffect(ctx,u,asSource(origin(u)),e,{kind:'apply-status',status:{activation:'next-tick',kind:'shred',magnitudeBps:3000,duration:{kind:'ticks',ticks:100},stackPolicy:{kind:'strongest-category',category:'shred',retainSuppressed:true},polarity:'harmful',removable:true,damageFilter:null,onEnd:null}},seq);
  }
  const s=sixState(u),before=s.energy;s.energy=Math.min(8,s.energy+1);u.mana=s.energy;
  ctx.events.push({type:'chaosEnergyChanged',tick:ctx.tick,unitId:u.id,before,after:s.energy});return true;
}
/** External resource gains convert to AP without changing chaos energy. */
export function convertViktorMana(ctx:AbilityContext,u:S13Unit,value:number):void {
  if(value<=0)return;const s=sixState(u),before=s.convertedMana;s.convertedMana+=value;
  ctx.events.push({type:'statChanged',tick:ctx.tick,unitId:u.id,source:asSource(origin(u)),stat:'abilityPower',before:100+before,after:100+s.convertedMana});
}
export function recordMelAbsorption(ctx:AbilityContext,layer:ShieldLayer,taken:number):void {
  if(taken<=0||layer.source.definitionId!=='mel-ability')return;
  const owner=ctx.units.find(u=>u.id===layer.source.ownerId&&u.definitionId==='mel');if(!owner)return;
  const s=sixState(owner),before=s.storedEnergy,n=taken+s.absorbedRemainder;s.storedEnergy+=Math.floor(n/2);s.absorbedRemainder=n%2;
  ctx.events.push({type:'melEnergyChanged',tick:ctx.tick,unitId:owner.id,before,after:s.storedEnergy});
}
export function advanceSixCost(ctx:AbilityContext,nextSeq:()=>number):void {
  for(const u of ctx.units.filter(isSixCost)){
    const s=sixState(u);
    if(u.definitionId==='viktor'&&s.storm&&s.storm.due<=ctx.tick){
      for(const id of s.storm.targetIds){const t=ctx.units.find(t=>t.id===id&&t.alive&&t.hp>0);if(t)packet(ctx,u,t,Math.floor(variable(u,'StormDamage')*ap(u,ctx.tick,ctx.units)/100+t.maxHp*variable(u,'StormHp')),'magic',s.storm.actionSeq,2);}
      s.storm=null;
    }
    if(!u.alive||u.hp<=0||u.definitionId!=='warwick')continue;
    const active=s.permanentFrenzy||s.frenzyUntil>0&&s.frenzyUntil>=ctx.tick;
    if(!active&&s.frenzyUntil){ctx.events.push({type:'bloodFrenzyChanged',tick:ctx.tick,unitId:u.id,active:false,permanent:false});s.frenzyUntil=0;}
    if(active&&s.nextFrenzyPulse<=ctx.tick){
      const speed=Math.floor((u.baseAttackSpeedBps??9000)*(10000+attackSpeedBonus(u,ctx.tick,ctx.units))/10000);
      const total=variable(u,'BaseDamage')+Math.floor(Number(BigInt(u.ability.kind==='s13'?u.ability.variables.ADRatio:0)*BigInt(ad(u))*BigInt(speed)/100000000n));
      for(const t of enemies(u,ctx.units).filter(t=>hexDistance(u.cell,t.cell)<=1))packet(ctx,u,t,total,'physical',nextSeq(),0,'ability-periodic');
      s.nextFrenzyPulse=ctx.tick+20;
    }
    s.pendingDevour=null;
    const targets=enemies(u,ctx.units).filter(t=>BigInt(t.hp)*10000n<BigInt(t.maxHp)*1500n).sort((a,b)=>a.hp*b.maxHp-b.hp*a.maxHp||hexDistance(u.cell,a.cell)-hexDistance(u.cell,b.cell)||(a.id<b.id?-1:1));
    const target=targets[0];if(!target)continue;
    const cells=getNeighbors(ctx.board,target.cell).filter(c=>!ctx.units.some(t=>t.id!==u.id&&occupiesCell(t,ctx.tick)&&hexDistance(c,t.cell)===0)).sort((a,b)=>hexDistance(u.cell,a)-hexDistance(u.cell,b)||a.row-b.row||a.col-b.col);
    if(!cells.length)continue;
    if(hexDistance(u.cell,cells[0])>0){ctx.events.push({type:'movement',tick:ctx.tick,unitId:u.id,from:u.cell,to:cells[0]}); recordAerialMovement(ctx, u, cells[0]);u.cell=cells[0];}
    s.pendingDevour=target.id;const p=packet(ctx,u,target,target.hp,'true',nextSeq(),0);p.devour=true;p.source={...p.source,effectIndex:99};p.critEligibility='never';
  }
}
/** Runs after survival and resurrection adjudication; no reward for a prevented/revived victim. */
export function settleSixCostDeaths(ctx:AbilityContext,killed:ReadonlyMap<string,CombatOrigin>):void {
  for(const [id,source] of killed){
    const victim=ctx.units.find(u=>u.id===id),u=ctx.units.find(u=>u.id===source.ownerId&&u.definitionId==='warwick');
    if(!u||!victim||victim.hp>0)continue;const s=sixState(u);s.kills++;
    if(source.effectIndex===99&&s.pendingDevour===id&&!s.devoured.includes(id)){
      s.devoured.push(id);ctx.events.push({type:'devoured',tick:ctx.tick,unitId:u.id,targetId:id});
      if(u.hp>0){commitMechanismHeal(ctx,{source:origin(u),targetId:u.id,amount:400});const outcome=resolveMana({unitId:u.id,current:u.mana,maximum:u.maxMana,lockedUntilTick:u.manaLockedUntilTick??0},{source:asSource(origin(u)),targetId:u.id,amount:50,reason:'kill',bypassLock:'none',castActionSeq:null},ctx.tick);u.mana=outcome.after;ctx.events.push({type:'manaChanged',tick:ctx.tick,outcome});}
    }
    if(s.kills>=5&&!s.permanentFrenzy&&u.hp>0)frenzy(ctx,u,true);
  }
  for(const [id,source] of killed){const victim=ctx.units.find(t=>t.id===id),owner=ctx.units.find(t=>t.id===source.ownerId);if(!victim||victim.hp>0||!owner)continue;
    const ticks=owner.mechanics?.find(m=>m.mechanic==='g23Experiment')?.values.warwick??0;
    if(ticks)for(const t of enemies(owner,ctx.units).filter(t=>hexDistance(victim.cell,t.cell)===1))applyStatus(t,origin(owner),'stun',0,ticks,ctx.tick,ctx.events);
  }
}
