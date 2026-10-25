/** P-B4COMBAT 2026-10-25: opening snapshot, stable pair ties, source-local healing and shield refresh. */
import type { AbilityContext, S13Packet } from './combat-s13-abilities';
import type { CombatMechanic } from './combat-types';
import type { HealOutcome, TriggerDefinition } from './m8/contracts';
import { ad, ap, compareText, grantShield, sourceKey, type S13Unit } from './combat-s13-state';
import { hexDistance } from './board';
import { isAttackProxy } from './anomalies/availability';
import { modifier, stat } from './content/item-programs';
import { executeMechanismEffect } from './m8/s13-mechanisms';
import { asSource } from './m8/s13-definitions';
import { isEffective } from './m8/status';
import type { VampRate } from './m8/heal';

export function openingB4Combat(ctx:AbilityContext):void {
 if(ctx.tick!==1)return;
 for(const team of ['player','enemy'] as const){
  const allies=ctx.units.filter(u=>u.team===team&&u.alive&&u.hp>0&&!isAttackProxy(u)).sort((a,b)=>compareText(a.id,b.id));
  const holder=allies.find(u=>u.mechanics?.some(m=>m.mechanic==='longDistancePals'));
  const m=holder?.mechanics?.find(m=>m.mechanic==='longDistancePals');if(!holder||!m)continue;
  let pair:readonly [S13Unit,S13Unit]|undefined,distance=-1;
  for(let a=0;a<allies.length;a++)for(let b=a+1;b<allies.length;b++){
   const d=hexDistance(allies[a].startingCell??allies[a].cell,allies[b].startingCell??allies[b].cell);
   if(d>distance){distance=d;pair=[allies[a],allies[b]];}
  }
  if(!pair)continue;
  // Both sides sample before either grant; no recursive amplification.
  const sample=pair.map(u=>[ad(u),ap(u,ctx.tick,ctx.units),ctx.defenses?.(u,true,true)??u.armor,ctx.defenses?.(u,false,true)??u.magicResist]);
  pair.forEach((target,i)=>{(['attackDamage','abilityPower','armor','magicResist'] as const).forEach((key,j)=>{
   const effect={...stat(modifier(key,Math.floor(sample[1-i][j]*m.values.shareBps/10000))),stackPolicy:{kind:'independent-instances' as const}};
   executeMechanismEffect(ctx,holder,{...asSource(m.source),effectIndex:m.source.effectIndex+j},target,effect,0,j);
  });});
 }
}
export function castB4Combat(ctx:AbilityContext,unit:S13Unit,seq:number):void {
 const m=unit.mechanics?.find(m=>m.mechanic==='satedSpellweaver');if(!m)return;
 executeMechanismEffect(ctx,unit,asSource(m.source),unit,stat(modifier('omnivamp',m.values.omnivampBps,'bps'),m.values.durationTicks),seq);
}
function activeSated(unit:S13Unit,tick:number):CombatMechanic|undefined {
 const m=unit.mechanics?.find(m=>m.mechanic==='satedSpellweaver');
 return m&&unit.mechanismState?.statuses.some(g=>g.contributions.some(c=>c.source.definitionId===m.source.definitionId&&c.source.instanceId===m.source.instanceId&&c.source.ownerId===unit.id&&c.application.modifier?.stat==='omnivamp'&&isEffective(c,tick)))?m:undefined;
}
export function b4Vamp(unit:S13Unit,tick:number):VampRate[]{
 const m=activeSated(unit,tick);return m?[{source:asSource(m.source),bps:m.values.omnivampBps,allyBps:0}]:[];
}
export function attackB4Combat(ctx:AbilityContext,unit:S13Unit,target:S13Unit,seq:number):void {
 const m=unit.mechanics?.find(m=>m.mechanic==='overheal');if(!m||unit.runtime.attackCount%m.values.every!==0)return;
 ctx.packets.push({source:m.source,targetId:target.id,raw:Math.floor(ad(unit)*m.values.damageBps/10000),damageType:'physical',actionSeq:seq,ordinal:0,delivery:'attack-extra',critEligibility:'never',area:false,triggeringCastActionSeq:null});
}
/** Only the augment's bonus packet supplies its 50% heal; normal attack damage does not. */
export function damageB4Combat(ctx:AbilityContext,owner:S13Unit|undefined,packet:S13Packet,dealt:number):void {
 const m=owner?.mechanics?.find(m=>m.mechanic==='overheal'&&sourceKey(m.source)===sourceKey(packet.source));
 if(!owner||!m||dealt<=0)return;
 ctx.heals.push({source:m.source,targetId:owner.id,amount:Math.floor(dealt*m.values.healBps/10000)});
}
/** Each augment keeps one capped layer; conversion uses wound-adjusted excess, then normal shield reduction. */
export function overhealB4Combat(ctx:AbilityContext,target:S13Unit,outcome:HealOutcome):void {
 if(outcome.overheal<=0)return;
 const sated=activeSated(target,ctx.tick);
 const over=target.mechanics?.find(m=>m.mechanic==='overheal'&&outcome.shares.some(s=>sourceKey(s.source)===sourceKey(m.source)));
 for(const m of [over,sated])if(m){
  const excess=m===over?outcome.shares.filter(s=>sourceKey(s.source)===sourceKey(m.source)).reduce((n,s)=>n+s.overheal,0):outcome.overheal;
  if(excess<=0)continue;
  const old=target.shieldLayers.find(l=>sourceKey(l.source)===sourceKey(m.source)&&l.expiresAtTick>ctx.tick)?.remaining??0;
  grantShield(target,m.source,Math.min(m.values.maxShield,old+excess),ctx.tick+m.values.durationTicks,ctx.tick,ctx.events);
 }
}
/** Adapt only Hurricane declarations, retaining each item's packet source and proc permissions. */
export function categoryFiveTrigger(unit:Pick<S13Unit,'mechanics'>,definition:TriggerDefinition):TriggerDefinition {
 const m=unit.mechanics?.find(m=>m.mechanic==='categoryFive');
 if(!m||!['runaans-hurricane','TFT5_Item_RunaansHurricaneRadiant'].includes(definition.source.definitionId))return definition;
 return {...definition,selector:{...definition.selector,maxTargets:(definition.selector.maxTargets??1)+m.values.extraBolts},effects:definition.effects.map(e=>e.kind==='damage'?{...e,amount:{...e.amount,attackDamageBps:Math.floor(e.amount.attackDamageBps*m.values.damageBps/10000)}}:e)};
}
