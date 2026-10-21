import type { CombatOrigin, CombatUnit } from './combat-types';
import type { AbilityContext } from './combat-s13-abilities';
import { type S13Unit, champion, applyStatus } from './combat-s13-state';
import { asSource } from './m8/s13-definitions';
import { modifier, stat } from './content/item-programs';
import { executeMechanismEffect } from './m8/s13-mechanisms';
import { V19_MECHANICS as V } from './content/v19-mechanics';
import { isAbsent, isAttackProxy } from './anomalies/availability';
import { UNIT_DEFINITIONS } from './units';

export const chainblade=(u:Pick<CombatUnit,'mechanics'>|undefined)=>u?.mechanics?.filter(m=>m.mechanic==='v19Chainblade').sort((a,b)=>a.source.instanceId<b.source.instanceId?-1:1)[0];
export function v19Stat(ctx:AbilityContext,u:S13Unit,source:CombatOrigin,name:Parameters<typeof modifier>[0],value:number,unit:Parameters<typeof modifier>[2]='flat',ticks:number|null=null,stack=false):void {
  executeMechanismEffect(ctx,u,asSource(source),u,{...stat(modifier(name,value,unit),ticks),...(stack?{stackPolicy:{kind:'independent-instances'} as const}:{})},0,0,
    undefined,undefined,undefined,undefined,{applicationId:'v19:'+name+(stack?':cast:'+u.runtime.castCount:''),area:false,triggeringCastActionSeq:null});
}
export function v19DominatorCast(ctx:AbilityContext,u:S13Unit,spent:number):void {
  const m=u.mechanics?.find(m=>m.mechanic==='g23Trait'&&m.source.definitionId==='dominator');
  if(!m)return;
  const rate=V.dominator[m.values.tier as keyof typeof V.dominator];
  v19Stat(ctx,u,m.source,'abilityPower',Math.floor(spent*rate/10000),'flat',null,true);
}
function addHealth(ctx:AbilityContext,u:S13Unit,value:number,source:CombatOrigin):void {
  const basis=u.maxHpBasis??{base:u.maxHp,flat:0,bps:0,bonusBps:0};
  // A shared amount is actual HP, not a flat base multiplied by the recipient's health bonuses.
  const beforeMax=u.maxHp,beforeHp=u.hp;
  u.v19={...u.v19,sharedHealth:(u.v19?.sharedHealth??0)+value};
  u.maxHpBasis=basis;
  // Keep the additive award outside percentage multipliers, including future max-HP changes.
  u.maxHp=beforeMax+value;u.hp=Math.min(u.maxHp,beforeHp+value);
  ctx.events.push({type:'maxHpChanged',tick:ctx.tick,unitId:u.id,source:asSource(source),beforeMax,afterMax:u.maxHp,beforeHp,afterHp:u.hp,countsAsHeal:false});
}
export function startV19(ctx:AbilityContext):void {
  const frozen=ctx.units.filter(u=>u.alive&&!isAbsent(u,0)&&u.mechanics?.some(m=>m.mechanic==='v19Garen')).map(u=>({
    u,health:u.maxHp,source:u.mechanics!.find(m=>m.mechanic==='v19Garen')!.source,
    targets:ctx.units.filter(t=>t.alive&&!isAbsent(t,0)&&t.team===u.team&&t.cell.row===u.cell.row&&Math.abs(t.cell.col-u.cell.col)<=1),
  }));
  for(const {u,health,source,targets} of frozen){
    u.v19={...u.v19,garenSample:health};
    for(const t of targets)addHealth(ctx,t,Math.floor(health*V.garen.healthBps/10000),source);
  }
}
/** Forced smoke shares one team clock. Permanent power is awarded once; subsequent signals refresh burst/control. */
export function smokeV19(ctx:AbilityContext):void {
  if(ctx.tick%V.rebel10.periodTicks!==0)return;
  for(const team of ['player','enemy'] as const){
    const members=ctx.units.filter(u=>u.team===team&&u.alive&&u.hp>0&&!isAbsent(u,ctx.tick)&&u.mechanics?.some(m=>m.mechanic==='rebel'&&m.values.forcedPeriodTicks>0));
    if(!members.length)continue;
    const leader=members[0],ordinal=ctx.tick/V.rebel10.periodTicks;
    if(leader.v19?.smokeOrdinal===ordinal)continue;
    for(const u of members){
      const m=u.mechanics!.find(m=>m.mechanic==='rebel')!;
      if(!u.v19?.smokePermanent){
        v19Stat(ctx,u,m.source,'attackDamage',m.values.adApBps,'bps');
        v19Stat(ctx,u,m.source,'abilityPower',m.values.adApBps/100);
        executeMechanismEffect(ctx,u,asSource(m.source),u,{kind:'change-max-hp',bonusBps:m.values.bonusHpBps,currentHp:'add-max-delta',countsAsHeal:false},0);
      }
      v19Stat(ctx,u,m.source,'attackSpeed',m.values.attackSpeedBps,'bps',m.values.durationTicks);
      u.v19={...u.v19,smokePermanent:true,smokeOrdinal:ordinal};
    }
    const m=leader.mechanics!.find(m=>m.mechanic==='rebel')!;
    for(const enemy of ctx.units.filter(u=>u.team!==team&&u.alive&&u.hp>0&&!isAbsent(u,ctx.tick)&&!isAttackProxy(u)))applyStatus(enemy,m.source,'stun',0,m.values.stunTicks,ctx.tick,ctx.events,ctx.tick===0);
  }
}
export function sistersV19(ctx:AbilityContext,contributors:readonly string[]):void {
  for(const u of ctx.units.filter(u=>contributors.includes(u.id))){
    const m=u.mechanics?.find(m=>m.mechanic==='sisters');if(!m)continue;
    for(const partner of ctx.units.filter(t=>t.team===u.team&&t.alive&&t.hp>0&&!isAbsent(t,ctx.tick)&&t.id!==u.id&&t.definitionId===(u.definitionId==='jinx'?'vi':'jinx')&&t.mechanics?.some(m=>m.mechanic==='sisters')))
      v19Stat(ctx,partner,{...m.source,ownerId:partner.id,instanceId:'sisters:'+partner.id},u.definitionId==='jinx'?'attackDamage':'attackSpeed',u.definitionId==='jinx'?V.sisters.adBps:V.sisters.speedBps,'bps',u.definitionId==='jinx'?V.sisters.adTicks:V.sisters.speedTicks);
  }
}
export function markRoseV19(owner:S13Unit|undefined,target:S13Unit,positive:number):void {
  if(positive<=0||!owner||champion(owner)!=='g23-sion'||!owner.mechanics?.some(m=>m.mechanic==='g23Sion'&&m.values.tier>=V.blackRose.minimumTier))return;
  target.v19={...target.v19,roseTeams:[...new Set([...(target.v19?.roseTeams??[]),owner.team])]};
}
export function roseAmpV19(owner:S13Unit|undefined,target:S13Unit):boolean {
  return !!owner&&target.v19?.roseTeams?.includes(owner.team)===true&&owner.mechanics?.some(m=>m.mechanic==='g23Trait'&&m.source.definitionId==='black-rose')===true;
}
export function chainbladeGoldTarget(u:S13Unit,target:S13Unit):boolean {
  return !!chainblade(u)?.values.pvp&&u.team!==target.team&&!target.itemSummon&&!target.anomalySummon&&target.unitKind!=='neutral'&&!!UNIT_DEFINITIONS[target.definitionId]&&!UNIT_DEFINITIONS[target.definitionId].summon;
}
export function chainbladeKill(ctx:AbilityContext,u:S13Unit):void {
  const m=chainblade(u);if(!m)return;
  v19Stat(ctx,u,m.source,'damageAmp',V.chainblade.ampBps,'bps',V.chainblade.buffTicks);
  v19Stat(ctx,u,m.source,'damageReduction',V.chainblade.reductionBps,'bps',V.chainblade.buffTicks);
}
