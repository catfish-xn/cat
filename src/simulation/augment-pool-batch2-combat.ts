/** Trait-specific augment runtime. All coefficients come from the frozen 14.24 rows. */
import type { CombatUnit, CombatMechanic } from './combat-types';
import type { AbilityContext, S13Packet } from './combat-s13-abilities';
import { ap, ad, byDistance, enemies, type S13Unit, grantShield } from './combat-s13-state';
import { asSource } from './m8/s13-definitions';
import { hexDistance } from './board';
import { batch2Values } from './content/augment-pool-batch2';
export interface Batch2CombatRuntime {
 readonly rockets?:number;readonly familyQualified?:boolean;readonly kills?:number;
 readonly slamPeriods?:Readonly<Record<string,number>>;readonly executions?:number;readonly attacksTaken?:number;readonly spellsTaken?:number;
 /** Batch 3 (replay-authenticated): last Blazing Soul recipient, Noble Sacrifice spent, healing received for Wealthy Rehab. */
 readonly blazingLast?:string;readonly nobleSpent?:boolean;readonly healed?:number;
}
export function batch2Mechanic(u:Pick<CombatUnit,'mechanics'>,id:string):CombatMechanic|undefined {
 return u.mechanics?.find(m=>m.mechanic==='traitAugmentB2'&&m.source.definitionId===id);
}
export function batch2Bonus(u:Pick<CombatUnit,'batch2'|'mechanics'>,stat:'adBps'|'ap'|'resist'|'speed',tick=0):number {
 const r=u.batch2;
 if(stat==='adBps')return (r?.attacksTaken??0)*batch2Values('watcher-growth').IncreaseADByTakeAttack*100;
 if(stat==='ap')return (r?.spellsTaken??0)*batch2Values('watcher-growth').IncreaseAPByTakeSpell;
 if(stat==='resist')return (r?.executions??0)*batch2Values('noxian-guillotine').ArmorandMagicResist;
 const v=batch2Values('quickstriker-boost');
 return batch2Mechanic(u,'quickstriker-boost')&&tick%(v.TimeBetweenProcs*20)<v.BuffDuration*20?Math.round(v.AttackSpeed*10000):0;
}
/** The next attack consumes the current four-second period, never catches up missed periods. */
export function batch2Attack(ctx:AbilityContext,u:S13Unit,target:S13Unit,seq:number,resists:number):void {
 for(const id of ['heavy-hitters','sentinel-slam']){
  const m=batch2Mechanic(u,id);if(!m)continue;const v=batch2Values(id),period=Math.floor(ctx.tick/((v.RefreshSeconds??v.Interval)*20));
  if(period===0||period<=(u.batch2?.slamPeriods?.[id]??0))continue;
  u.batch2={...u.batch2,slamPeriods:{...u.batch2?.slamPeriods,[id]:period}};
  ctx.packets.push({source:m.source,targetId:target.id,raw:Math.floor(id==='heavy-hitters'?u.maxHp*Math.round(v.SlamPercentHealth*10000)/10000:resists*Math.round(v.ResistToDamageRatio*10000)/10000),damageType:id==='heavy-hitters'?'physical':'magic',actionSeq:seq,ordinal:200000,delivery:'attack-extra',critEligibility:'never',area:false,triggeringCastActionSeq:null});
 }
}
export function batch2Incoming(ctx:AbilityContext,target:S13Unit,packet:S13Packet,hit:boolean):void {
 const m=batch2Mechanic(target,'watcher-growth');if(!m||!hit)return;
 const basic=packet.delivery==='basic-attack',spell=packet.delivery==='ability-direct'||packet.delivery==='ability-periodic';
 if(!basic&&!spell)return;
 const before=basic?ad(target):ap(target,ctx.tick,ctx.units);
 target.batch2={...target.batch2,attacksTaken:(target.batch2?.attacksTaken??0)+(basic?1:0),spellsTaken:(target.batch2?.spellsTaken??0)+(spell?1:0)};
 ctx.events.push({type:'statChanged',tick:ctx.tick,unitId:target.id,source:asSource(m.source),stat:basic?'attackDamage':'abilityPower',before,after:basic?ad(target):ap(target,ctx.tick,ctx.units)});
}
export function batch2ExecuteReward(ctx:AbilityContext,u:S13Unit):void {
 const m=batch2Mechanic(u,'noxian-guillotine');if(!m)return;
 const beforeArmor=ctx.defenses?.(u,true)??u.armor+batch2Bonus(u,'resist'),beforeMr=ctx.defenses?.(u,false)??u.magicResist+batch2Bonus(u,'resist');u.batch2={...u.batch2,executions:(u.batch2?.executions??0)+1};
 for(const stat of ['armor','magicResist'] as const)ctx.events.push({type:'statChanged',tick:ctx.tick,unitId:u.id,source:asSource(m.source),stat,before:stat==='armor'?beforeArmor:beforeMr,after:ctx.defenses?.(u,stat==='armor')??(stat==='armor'?u.armor:u.magicResist)+batch2Bonus(u,'resist')});
}
export function batch2Kill(ctx:AbilityContext,owner:S13Unit|undefined,target:S13Unit,nextSeq:()=>number):void {
 if(owner&&owner.team!==target.team){
  if(batch2Mechanic(owner,'betrayal'))owner.batch2={...owner.batch2,kills:(owner.batch2?.kills??0)+1};
  const m=batch2Mechanic(owner,'dominate');
  if(m)for(const ally of ctx.units.filter(u=>u.team===owner.team&&u.alive&&(ctx.virtualHp?.get(u.id)??u.hp)>0&&batch2Mechanic(u,'dominate'))){
   const v=batch2Values('dominate');grantShield(ally,batch2Mechanic(ally,'dominate')!.source,v.ShieldAmount,ctx.tick+v.ShieldDuration*20,ctx.tick,ctx.events);
  }
 }
 const m=batch2Mechanic(target,'sorcerer-explosion');
 if(m){const raw=Math.floor(ap(target,ctx.tick,ctx.units)*batch2Values('sorcerer-explosion').DeathPercentage),seq=nextSeq();
  // Both client descriptions explicitly say all adjacent units, including friendly units.
  for(const victim of ctx.units.filter(u=>u.id!==target.id&&u.alive&&(ctx.virtualHp?.get(u.id)??u.hp)>0&&hexDistance(u.cell,target.cell)===1))
   ctx.packets.push({source:m.source,targetId:victim.id,raw,damageType:'magic',actionSeq:seq,ordinal:0,delivery:'attack-extra',critEligibility:'never',area:true,triggeringCastActionSeq:null});
 }
}
/** A second blast samples the nearest live enemy when the original blast is fired. */
export function batch2AutomataBlast(ctx:AbilityContext,u:S13Unit,raw:number,seq:number):void {
 const m=batch2Mechanic(u,'fractured-crystals');if(!m)return;
 const victim=byDistance(u,enemies(u,ctx.units))[0];if(!victim)return;
 u.tasks.push({key:JSON.stringify([u.id,seq,'fractured-crystals',ctx.tick,u.tasks.length]),kind:'g2Blast',source:m.source,executeAtTick:ctx.tick+1,targetId:victim.id,amount:Math.floor(raw*Math.round(batch2Values('fractured-crystals').Percentage*10000)/10000),actionSeq:seq,ordinal:1,total:1,cancellable:false});
}

export function batch2Tick(ctx:AbilityContext):void {
 for(const team of ['player','enemy'] as const){
  const members=ctx.units.filter(u=>u.team===team&&batch2Mechanic(u,'welcome-to-the-playground'));
  if(ctx.tick===batch2Values('welcome-to-the-playground').TimeRequirement*20&&members.filter(u=>u.alive&&u.hp>0).length>=batch2Values('welcome-to-the-playground').MinNumFamilyMembers)
   for(const u of members)u.batch2={...u.batch2,familyQualified:true};
 }
}
export function batch2Rocket(u:S13Unit,raw:number):number {
 const id=batch2Mechanic(u,'rocket-collection')?'rocket-collection':batch2Mechanic(u,'rocket-collection-plus')?'rocket-collection-plus':null;
 if(!id)return raw;
 u.batch2={...u.batch2,rockets:(u.batch2?.rockets??0)+1};
 return Math.floor(raw*(10000+Math.round(batch2Values(id).IncreasedRocketDamage*10000))/10000);
}
export function batch2Target(u:S13Unit,units:readonly S13Unit[]):S13Unit|undefined {
 if(u.definitionId!=='maddie'||!batch2Mechanic(u,'betrayal'))return undefined;
 const ambessa=units.filter(a=>a.team===u.team&&a.alive&&a.hp>0&&a.definitionId==='ambessa').sort((a,b)=>a.id<b.id?-1:1)[0];
 return ambessa?enemies(u,units).find(e=>e.id===ambessa.targetId):undefined;
}
