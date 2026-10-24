import { teamup } from './combat-v20-traits';
import { occupiesCell } from './anomalies/availability';
import { isAttackProxy } from './anomalies/availability';
import { reviveG23Forge } from './combat-g2-3-summons';
import { g23State } from './g2-3-combat';
/** Fixed-form, finite hex execution. All delayed work is part of the combat snapshot. */
import { contains, hexDistance, type HexCell } from './board';
import type { CombatTask } from './combat-types';
import type { S13Unit } from './combat-s13-state';
import type { AbilityContext, S13Packet } from './combat-s13-abilities';
import { amount, applyStatus, byDistance, champion, compareText, enemies, grantShield, origin, path, variable } from './combat-s13-state';
import { rollG23HighRoller } from './g2-3-progress';
import { G23_POLICY } from './content/g2-3-policy';
import { G23_SUMMON_POLICY } from './content/g2-3-summons';
import { isSupportAuraInstance } from './g2-4-support';

function hit(ctx:AbilityContext,u:S13Unit,t:S13Unit,raw:number,seq:number,ordinal:number,type:S13Packet['damageType']='magic',area=false){
  ctx.packets.push({source:origin(u),targetId:t.id,raw,damageType:type,actionSeq:seq,ordinal,
    delivery:'ability-direct',critEligibility:'requires-spell-authorization',area,triggeringCastActionSeq:seq});
}
function later(ctx:AbilityContext,u:S13Unit,t:S13Unit,kind:CombatTask['kind'],delay:number,raw:number,seq:number,ordinal:number,total:number){
  u.tasks.push({key:JSON.stringify([u.id,seq,kind,ordinal,t.id]),kind,source:origin(u),executeAtTick:ctx.tick+delay,targetId:t.id,
    amount:raw,actionSeq:seq,ordinal,total,cancellable:kind==='g23Flame'||kind==='g23Chomp'});
}
/** One bite keeps its cast identity; executions and resets use the damage ledger. */
function chomp(ctx:AbilityContext,u:S13Unit,t:S13Unit,raw:number,seq:number,ordinal:number):void{
  hit(ctx,u,t,raw,seq,ordinal,'physical');ctx.packets.at(-1)!.sevikaChomp=true;
  applyStatus(t,origin(u),'stun',0,Math.round(variable(u,'Spell3_StunDuration')*20),ctx.tick,ctx.events);
}
function flame(ctx:AbilityContext,u:S13Unit,t:S13Unit,raw:number,seq:number,ordinal:number):string[]{
  const targets=enemies(u,ctx.units).filter(x=>x.id!==t.id&&hexDistance(t.cell,x.cell)<=1);
  hit(ctx,u,t,raw,seq,ordinal,'true');
  for(const [i,x] of targets.entries())
    hit(ctx,u,x,Math.floor(raw*(1-variable(u,'Spell1_ReducedDamagePercent'))),seq,ordinal+i+1,'physical',true);
  later(ctx,u,t,'g23Flame',20,raw,seq,ordinal+1,ordinal+2);
  return [t.id,...targets.map(x=>x.id)];
}
function split(total:number,n:number,i:number){return Math.floor(total/n)+(i<total%n?1:0);}
/** 约定值: instant leap to the nearest unoccupied adjacent hex; no movement animation. */
function leapG23(ctx:AbilityContext,u:S13Unit,t:S13Unit):void{
 if(hexDistance(u.cell,t.cell)<=1)return;
 const cells=Array.from({length:ctx.board.rows},(_,row)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row}))).flat().filter(c=>hexDistance(c,t.cell)===1&&!ctx.units.some(x=>occupiesCell(x,ctx.tick)&&x.cell.col===c.col&&x.cell.row===c.row)).sort((a,b)=>hexDistance(u.cell,a)-hexDistance(u.cell,b)||a.row-b.row||a.col-b.col);
 if(cells[0]){ctx.events.push({type:'movement',tick:ctx.tick,unitId:u.id,from:u.cell,to:cells[0]});u.cell=cells[0];}
}
const g23ItemCount=(u:S13Unit)=>new Set([...(u.sources??[]).filter(s=>s.source.sourceKind==='item').map(s=>s.source.sourceInstanceId),...(u.itemPrograms??[]).filter(p=>p.source.sourceKind==='item').map(p=>p.source.instanceId)].filter(id=>!isSupportAuraInstance(id))).size;
function smeechTarget(ctx:AbilityContext,u:S13Unit):S13Unit|undefined{
 return enemies(u,ctx.units).filter(x=>hexDistance(u.cell,x.cell)<=variable(u,'LeapHexRange')).sort((a,b)=>g23ItemCount(a)-g23ItemCount(b)||hexDistance(u.cell,a.cell)-hexDistance(u.cell,b.cell)||compareText(a.id,b.id))[0];
}
export function planG23Cast(ctx:AbilityContext,u:S13Unit,t:S13Unit,seq:number):string[]{
  const v=(k:string)=>variable(u,k),mag=(k:string)=>amount(u,ctx.tick,{ap:v(k)}),physical=(k:string,a?:string)=>amount(u,ctx.tick,{ad:v(k),ap:a?v(a):0});
  const ids:string[]=[],strike=(x:S13Unit,n:number,type:S13Packet['damageType']='magic',area=false)=>{hit(ctx,u,x,n,seq,ids.length,type,area);ids.push(x.id);};
  const heal=(n:number)=>ctx.heals.push({source:origin(u),targetId:u.id,amount:n});
  const foes=()=>byDistance(u,enemies(u,ctx.units));
  switch(champion(u)){
    case 'g23-sion':{
      const tier=u.mechanics?.find(m=>m.mechanic==='g23Sion')?.values.tier??3;
      grantShield(u,origin(u),amount(u,ctx.tick,{ap:tier>=5&&tier<7?G23_SUMMON_POLICY.sion.tier5ShieldAp:v('Shield')}),ctx.tick+Math.round(v('ShieldDuration')*20),ctx.tick,ctx.events);
      const cells=path(ctx.board,u.cell,t.cell);
      for(const x of foes().filter(x=>cells.some(c=>c.col===x.cell.col&&c.row===x.cell.row))){strike(x,physical('PercentAttackDamage'),'physical',true);applyStatus(x,origin(u),'stun',0,Math.round(v('StunDuration')*20),ctx.tick,ctx.events);}break;
    }
    case 'silco':{
      strike(t,mag('Damage'));const targets=foes();
      for(let minion=0;minion<v('MinionsSpawned');minion++){
        const target=minion<v('MinionsThatAttackCurrentTarget')?t:targets[(minion-v('MinionsThatAttackCurrentTarget')+1)%targets.length];
        for(let i=0;i<v('MinionNumAttacks');i++)later(ctx,u,target,'g23Magic',Math.round((i+1)*v('MinionDuration')*20/v('MinionNumAttacks')),mag('MinionDamage'),seq,minion*v('MinionNumAttacks')+i,v('MinionsSpawned')*v('MinionNumAttacks'));
      }break;
    }
    case 'renata':{
      const cells=path(ctx.board,u.cell,t.cell);
      for(const ally of ctx.units.filter(x=>x.alive&&x.hp>0&&!isAttackProxy(x)&&x.team===u.team&&cells.some(c=>c.col===x.cell.col&&c.row===x.cell.row)))
        grantShield(ally,origin(u),mag('Shield'),ctx.tick+Math.round(v('ShieldDuration')*20),ctx.tick,ctx.events);
      strike(t,mag('TargetDamage'));
      for(const x of foes().filter(x=>x.id!==t.id&&hexDistance(t.cell,x.cell)<=1))strike(x,mag('ExplosionDamage'),'magic',true);break;
    }
    case 'cassiopeia':
      strike(t,mag('Damage'));
      if(u.runtime.castCount%v('NumCasts')===0)for(const x of byDistance(t,foes()).filter(x=>x.id!==t.id&&hexDistance(t.cell,x.cell)<=v('HexRadius')).slice(0,v('BonusNumEnemies')))strike(x,mag('MiasmaDamage'),'magic',true);break;
    case 'nunu':{
      const ticks=Math.round(v('DamageDuration')*v('DamageTicksPerSecond'));
      applyStatus(u,origin(u),'damageReduction',Math.round(v('Durability')*10000),Math.round(v('DamageDuration')*20),ctx.tick,ctx.events,true);
      for(let n=0;n<ticks;n++)for(const x of foes().filter(x=>hexDistance(u.cell,x.cell)<=v('HexRadius')))
        later(ctx,u,x,'g23Magic',Math.round((n+1)*20/v('DamageTicksPerSecond')),mag('Damage'),seq,n,ticks);
      for(const x of foes().filter(x=>hexDistance(u.cell,x.cell)<=v('HexRadius')))later(ctx,u,x,'g23Magic',Math.round(v('DamageDuration')*20),mag('SecondDamage'),seq,ticks,ticks+1);break;
    }
    case 'renni':{
      const n=Math.round(v('StunDuration')*20),healing=amount(u,ctx.tick,{ap:v('APHeal'),hp:v('MaxHealthHealingPercent')}),damage=physical('ADPercent');
      applyStatus(t,origin(u),'stun',0,n,ctx.tick,ctx.events);
      for(let i=0;i<n;i++){
        later(ctx,u,u,'g23Heal',i+1,split(healing,n,i),seq,i,n);
        later(ctx,u,t,'g23Physical',i+1,split(damage,n,i),seq,i,n);
      }
      for(const x of foes().filter(x=>hexDistance(t.cell,x.cell)<=1))later(ctx,u,x,'g23Physical',n,physical('FinalADPercent'),seq,n,n+1);break;
    }
    case 'drmundo':{
      const total=amount(u,ctx.tick,{ap:v('APHeal'),hp:v('PercentHealthHeal')}),initial=Math.floor(total*v('PercentofHealImmediately')),seconds=Math.round(v('Duration'));
      heal(initial);
      for(let i=0;i<seconds;i++){
        later(ctx,u,u,'g23Heal',(i+1)*20,split(total-initial,seconds,i),seq,i,seconds);
        later(ctx,u,t,'g23Magic',(i+1)*20,mag('APDamage'),seq,i,seconds);
      }
      for(const x of foes().filter(x=>hexDistance(u.cell,x.cell)<=2))later(ctx,u,x,'g23Magic',seconds*20,amount(u,ctx.tick,{hp:v('PercentHealthDamage')}),seq,seconds,seconds+1);break;
    }
    case 'elise':
      heal(mag('FlatHealth'));
      for(const x of foes().filter(x=>hexDistance(t.cell,x.cell)<=v('HexRadius'))){strike(x,mag('Damage'),'magic',true);applyStatus(x,origin(u),'stun',0,Math.round(v('StunDuration')*20),ctx.tick,ctx.events);}break;
    case 'elise-ranged':{
      const targets=foes().slice(0,v('NumOfSpiders'));
      for(const center of targets){strike(center,mag('MagicDamage'));for(const x of foes().filter(x=>x.id!==center.id&&hexDistance(center.cell,x.cell)<=1))strike(x,mag('SecondaryDamage'),'magic',true);}break;
    }
    case 'swain':{
      heal(mag('Heal'));g23State(u).ascension={untilTick:ctx.tick+Math.round(v('Duration')*20),nextPulseTick:ctx.tick+20,actionSeq:seq,takedowns:[]};break;
    }
    case 'swain-ranged':
      strike(t,mag('MagicDamage'));
      for(const x of byDistance(t,foes()).filter(x=>x.id!==t.id).slice(0,v('NumOfNearbyTargets')))strike(x,mag('SecondaryDamage'),'magic',true);break;
    case 'gangplank':{
      heal(mag('Heal'));const cells=path(ctx.board,u.cell,t.cell),targets=foes().filter(x=>cells.some(c=>c.col===x.cell.col&&c.row===x.cell.row));
      for(const x of targets)strike(x,Math.floor(physical('PercentAttackDamage')*(targets.length===1?1+v('SingleTargetDamageIncrease'):1)),'physical',true);break;
    }
    case 'gangplank-ranged':{
      const centers=foes().slice(0,v('NumOfBarrels')),raw=physical('PercentAttackDamage','APDamage');
      for(const center of centers){strike(center,raw,'physical',true);for(const x of foes().filter(x=>x.id!==center.id&&hexDistance(center.cell,x.cell)<=1))strike(x,Math.floor(raw*v('PercentToAdjacentUnits')),'physical',true);}break;
    }
    case 'smeech':{
      const target=smeechTarget(ctx,u)??t;
      leapG23(ctx,u,target);
      const n=v('BaseNumStabs'),raw=physical('PercentAttackDamage','APDamage');
      for(let i=0;i<n;i++)strike(target,split(raw,n,i),'physical');
      later(ctx,u,target,'g23Smeech',1,raw,seq,1,28);break;
    }
    case 'jayce':{
      const forge=reviveG23Forge(ctx,u)??u;
      for(const ally of byDistance(forge,ctx.units.filter(x=>x.alive&&x.hp>0&&!isAttackProxy(x)&&x.team===u.team)).slice(0,v('NumAlliesShield')))
        grantShield(ally,origin(u),mag('Shield'),ctx.tick+Math.round(v('ShieldDuration')*20),ctx.tick,ctx.events);
      strike(t,physical('PercentAttackDamage'),'physical');applyStatus(t,origin(u),'stun',0,Math.round(v('EnemyFlightDuration')*20),ctx.tick,ctx.events);
      // P (user 2026-10-23): the target is knocked to the gate 3 hexes behind it (away from Jayce, cut at the board edge)
      // and flies back to its own cell; other enemies within 1 hex of that flight path take the secondary hit once.
      const cells=path(ctx.board,jayceGate(ctx.board,u.cell,t.cell),t.cell);
      for(const x of foes().filter(x=>x.id!==t.id&&cells.some(c=>hexDistance(c,x.cell)<=1)))strike(x,physical('PercentADSecondaryDamage'),'physical',true);break;
    }
    case 'jayce-ranged':{
      const forge=reviveG23Forge(ctx,u)??u;
      const targets=foes();for(let i=0;i<v('NumOfCrystals');i++)strike(targets[i%targets.length],physical(i===0?'ClosestEnemyPercentAD':'PercentAttackDamage'),'physical');
      for(const ally of byDistance(forge,ctx.units.filter(x=>x.alive&&x.hp>0&&!isAttackProxy(x)&&x.team===u.team)).slice(0,v('NumAlliesAS')))
        applyStatus(ally,origin(u),'attackSpeed',Math.round(v('AttackSpeed')*10000),Math.round(v('ASDuration')*20),ctx.tick,ctx.events,true);break;
    }
    case 'sevika':{
      const initialSpell=Math.floor(ctx.draw()*3/2**32),mod=rollG23HighRoller(ctx.draw,!!teamup(u,'unlikely-duo')),spell=mod.mod==='blue-flamethrower'?0:mod.mod==='knockout-punch'?1:mod.mod==='quadruple-chomp'?2:initialSpell;
      ctx.events.push({type:'castOutcome',tick:ctx.tick,unitId:u.id,abilityKey:u.ability.id,outcome:mod.mod,subOutcomes:mod.enhanced?[mod.mod]:[],
        castVariant:{actionSeq:seq,move:spell===0?'flamethrower':spell===1?'punch':'chomp',channelTicks:spell===0?Math.round(v('Spell1_MinDuration'))*20:0,enhanced:mod.enhanced,heroAugmentIds:[]}});
      g23State(u).highRoller.push({actionSeq:seq,spell,...mod,gold:mod.mod==='coin'||mod.mod==='jackpot'?3:0});
      applyStatus(u,origin(u),'damageReduction',G23_POLICY.highRoller.durabilityBps,G23_POLICY.highRoller.durabilityTicks,ctx.tick,ctx.events,true);
      const base=physical('Spell1_ADPercent','APBonusDamage'),scaled=(key:string)=>Math.floor(base*Math.round(v(key)*10000)/10000);
      if(spell===0){
       ids.push(...flame(ctx,u,t,base,seq,0));
       applyStatus(u,origin(u),'channel',0,Math.round(v('Spell1_MinDuration')*20),ctx.tick,ctx.events,true,'',seq);
      }
      else if(spell===1){strike(t,scaled('Spell2_Modifier'),'physical');leapG23(ctx,u,t);for(const x of foes().filter(x=>hexDistance(t.cell,x.cell)<=v('Spell2_HexRadius'))){strike(x,scaled('Spell2_SecondaryModifier'),'physical',true);applyStatus(x,origin(u),'stun',0,Math.round(v('Spell2_StunDuration')*20),ctx.tick,ctx.events);}}
      else {chomp(ctx,u,t,scaled('Spell3_Modifier'),seq,0);ids.push(t.id);}
      if(mod.mod==='rocket'||mod.mod==='jackpot')for(let i=0;i<G23_POLICY.highRoller.rockets*(mod.enhanced?3:1);i++)strike(t,G23_POLICY.highRoller.rocketPhysicalDamage,'physical');
      if(mod.mod==='shield'||mod.mod==='jackpot')grantShield(u,origin(u),G23_POLICY.highRoller.shield*(mod.enhanced?3:1),ctx.tick+G23_POLICY.highRoller.shieldTicks,ctx.tick,ctx.events);
      // Gold is committed by the battle settlement receipt, never by the combat tick.
      break;
    }
  }
  return ids;
}
export function executeG23Task(ctx:AbilityContext,u:S13Unit,task:CombatTask):void{
  if(task.kind==='g23Chomp'){
   const previous=ctx.units.find(x=>x.id===task.targetId);if(!previous)return;
   const next=enemies(u,ctx.units).filter(x=>hexDistance(previous.cell,x.cell)<=variable(u,'Spell3_ResetDashRange'))
     .sort((a,b)=>a.hp-b.hp||compareText(a.id,b.id))[0];
   if(next){leapG23(ctx,u,next);chomp(ctx,u,next,task.amount,task.actionSeq,task.ordinal);}return;
  }
  if(task.kind==='g23Flame'){
   const target=ctx.units.find(x=>x.id===task.targetId&&x.alive&&x.hp>0);
   const activity=u.mechanismState!.activities.find(a=>a.kind==='channel'&&a.actionSeq===task.actionSeq&&a.lifecycle==='active');
   if(!target||!activity)return;
   const refreshed={...activity,expiresAtTick:ctx.tick+Math.round(variable(u,'Spell1_MinDuration')*20)};
   u.mechanismState={...u.mechanismState!,activities:u.mechanismState!.activities.map(a=>a.key===activity.key?refreshed:a)};
   u.statuses=u.statuses.map(s=>s.activity?.key===activity.key?{...s,expiresAtTick:refreshed.expiresAtTick,activity:refreshed}:s);
   ctx.events.push({type:'activityChanged',tick:ctx.tick,reason:'refreshed',activity:refreshed});
   flame(ctx,u,target,task.amount,task.actionSeq,task.ordinal);return;
  }
  if(task.kind==='g23Smeech'){
   const previous=ctx.units.find(x=>x.id===task.targetId);if(!previous||previous.alive||task.ordinal>=task.total)return;
   const next=smeechTarget(ctx,u);if(!next)return;
   leapG23(ctx,u,next);const raw=Math.floor(task.amount*(1-variable(u,'DamageReductionOnLeap'))),n=variable(u,'BaseNumStabs');
   for(let i=0;i<n;i++)hit(ctx,u,next,split(raw,n,i),task.actionSeq,2000+task.ordinal*n+i,'physical');
   later(ctx,u,next,'g23Smeech',1,raw,task.actionSeq,task.ordinal+1,task.total);return;
  }
  const target=ctx.units.find(x=>x.id===task.targetId&&x.alive&&x.hp>0);if(!target)return;
  if(task.kind==='g23Heal')ctx.heals.push({source:task.source,targetId:target.id,amount:task.amount});
  else hit(ctx,u,target,task.amount,task.actionSeq,1000+task.ordinal,task.kind==='g23Physical'?'physical':task.kind==='g23True'?'true':'magic');
}

/** Timed Swain pulses sample current adjacency; takedown extensions remain in the snapshot. */
export function advanceG23Skills(ctx:AbilityContext):void{
 for(const u of ctx.units.filter(u=>u.alive&&u.hp>0)){
  const a=u.g23?.ascension;if(!a||ctx.tick>a.untilTick||ctx.tick<a.nextPulseTick)continue;
  a.nextPulseTick+=20;
  ctx.heals.push({source:origin(u),targetId:u.id,amount:amount(u,ctx.tick,{ap:variable(u,'HealPerSecond')})});
  for(const t of enemies(u,ctx.units).filter(t=>hexDistance(u.cell,t.cell)<=1))hit(ctx,u,t,amount(u,ctx.tick,{ap:variable(u,'DamagePerSecond')}),a.actionSeq,10000+ctx.tick,'magic',true);
 }
}
export function recordG23SkillDamage(ctx:AbilityContext,u:S13Unit|undefined,t:S13Unit,actual:number,packet:S13Packet):void{
 if(!u||actual<=0)return;
 const lab=u.mechanics?.find(m=>m.mechanic==='g23Experiment');
 if(lab?.values.zyra&&packet.delivery==='ability-direct'&&packet.damageType!=='true'){
  const total=Math.floor(actual*lab.values.zyra/10000);
  for(let i=0;i<2;i++)later(ctx,u,t,'g23True',(i+1)*20,split(total,2,i),packet.actionSeq,packet.ordinal*2+i,packet.ordinal*2+2);
 }
}
export function extendG23Swain(ctx:AbilityContext,victimId:string,contributors:readonly string[]):void{
 for(const u of ctx.units.filter(u=>u.hp>0&&contributors.includes(u.id))){
  const a=u.g23?.ascension;
  if(a&&a.untilTick>=ctx.tick&&!a.takedowns.includes(victimId)){a.takedowns.push(victimId);a.untilTick+=Math.round(variable(u,'BonusDuration')*20);}
 }
}

/** The hex 3 steps past the target on the line from Jayce, stepped back toward the target until it is on the board. */
export function jayceGate(board:import('./board').Board,from:HexCell,target:HexCell):HexCell{
  const q=(c:HexCell)=>c.col-Math.floor(c.row/2),n=Math.max(1,hexDistance(from,target)),dq=q(target)-q(from),dr=target.row-from.row;
  for(let k=3;k>0;k--){
    const r=target.row+Math.round(dr*k/n),cell={col:q(target)+Math.round(dq*k/n)+Math.floor(r/2),row:r};
    if(contains(board,cell))return cell;
  }
  return target;
}
