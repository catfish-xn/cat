import { CASSIOPEIA_BOLT_LAUNCH_TICKS, SEVIKA_PUNCH_HIT_TICKS, SWAIN_PULSE_TICKS, SWAIN_PULSES_PER_SECOND } from './cast-windup';
import { scheduleShot } from './ability-projectile';
import { splitTotal } from './m8/periodic';
import { recordAerialMovement } from './augment-pool-batch5-g3-combat';
import { CAST_WINDUP_TICKS, DRMUNDO_BLAST_AFTER_PULSE_TICKS, JAYCE_MAIN_HIT_TICKS, jayceCrystalBlastTick, jayceCrystalChainPlace, jayceCrystalLandTick, NUNU_SECOND_AFTER_PULSE_TICKS, RENNI_LIFT_TICKS, RENNI_SLAM_AFTER_STUN_TICKS, SMEECH_STAB_TICKS } from './cast-windup';
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
import { amount, applyStatus, byDistance, champion, compareText, enemies, grantShield, heroLive, origin, path, variable } from './combat-s13-state';
import { lineContains } from './combat-skill-lines';
import { rollG23HighRoller } from './g2-3-progress';
import { G23_POLICY } from './content/g2-3-policy';
import { G23_SUMMON_POLICY } from './content/g2-3-summons';
import { isSupportAuraInstance } from './g2-4-support';
import { knockAway } from './combat-displacement';

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
/** `rampBps` is Blue Flamethrower's per-second growth; the scheduled follow-up always keeps the unramped base. */
function flame(ctx:AbilityContext,u:S13Unit,t:S13Unit,raw:number,seq:number,ordinal:number,rampBps=0):string[]{
  const targets=enemies(u,ctx.units).filter(x=>x.id!==t.id&&hexDistance(t.cell,x.cell)<=1),now=Math.floor(raw*(10000+rampBps)/10000);
  hit(ctx,u,t,now,seq,ordinal,'true');
  for(const [i,x] of targets.entries())
    hit(ctx,u,x,Math.floor(now*(1-variable(u,'Spell1_ReducedDamagePercent'))),seq,ordinal+i+1,'physical',true);
  later(ctx,u,t,'g23Flame',20,raw,seq,ordinal+1,ordinal+2);
  return [t.id,...targets.map(x=>x.id)];
}
function split(total:number,n:number,i:number){return Math.floor(total/n)+(i<total%n?1:0);}
/** 约定值: instant leap to the nearest unoccupied adjacent hex; no movement animation. */
function leapG23(ctx:AbilityContext,u:S13Unit,t:S13Unit):void{
 if(hexDistance(u.cell,t.cell)<=1)return;
 const cells=Array.from({length:ctx.board.rows},(_,row)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row}))).flat().filter(c=>hexDistance(c,t.cell)===1&&!ctx.units.some(x=>occupiesCell(x,ctx.tick)&&x.cell.col===c.col&&x.cell.row===c.row)).sort((a,b)=>hexDistance(u.cell,a)-hexDistance(u.cell,b)||a.row-b.row||a.col-b.col);
 if(cells[0]){ctx.events.push({type:'movement',tick:ctx.tick,unitId:u.id,from:u.cell,to:cells[0]}); recordAerialMovement(ctx, u, cells[0]);u.cell=cells[0];}
}
const g23ItemCount=(u:S13Unit)=>new Set([...(u.sources??[]).filter(s=>s.source.sourceKind==='item').map(s=>s.source.sourceInstanceId),...(u.itemPrograms??[]).filter(p=>p.source.sourceKind==='item').map(p=>p.source.instanceId)].filter(id=>!isSupportAuraInstance(id))).size;
/** One leap's stabs: the first now, the rest SMEECH_STAB_TICKS apart (amounts taken now); SMEECH_STAB_TICKS after the last,
 * the re-leap check. A stab that finds its target dead runs that check at once instead (the re-leap comes one stab interval
 * after the death, not after the remaining stabs). leap 0 is the cast (packet ordinals 0..n-1); a re-leap numbers its packets
 * 2000+leap*n+i as before. */
function smeechStabs(ctx:AbilityContext,u:S13Unit,target:S13Unit,raw:number,seq:number,leap:number,total:number):void{
 const n=variable(u,'BaseNumStabs'),ordinal=(i:number)=>leap===0?i:2000+leap*n+i;
 hit(ctx,u,target,split(raw,n,0),seq,ordinal(0),'physical');
 for(let i=1;i<n;i++)later(ctx,u,target,'g23Stab',i*SMEECH_STAB_TICKS,split(raw,n,i),seq,ordinal(i),n);
 later(ctx,u,target,'g23Smeech',n*SMEECH_STAB_TICKS,raw,seq,leap+1,total);
}
function smeechTarget(ctx:AbilityContext,u:S13Unit):S13Unit|undefined{
 return enemies(u,ctx.units).filter(x=>hexDistance(u.cell,x.cell)<=variable(u,'LeapHexRange')).sort((a,b)=>g23ItemCount(a)-g23ItemCount(b)||hexDistance(u.cell,a.cell)-hexDistance(u.cell,b.cell)||compareText(a.id,b.id))[0];
}
/** The rolled High Roller spell, once the slot machine has stopped. */
function sevikaSpell(ctx:AbilityContext,u:S13Unit,t:S13Unit,seq:number,spell:number,mod:string,mods=true):void{
  const v=(k:string)=>variable(u,k),physical=(k:string,a?:string)=>amount(u,ctx.tick,{ad:v(k),ap:a?v(a):0});
  let n=0;const strike=(x:S13Unit,raw:number,type:S13Packet['damageType']='magic',area=false)=>hit(ctx,u,x,raw,seq,n++,type,area);
  const foes=()=>byDistance(u,enemies(u,ctx.units));
  const base=physical('Spell1_ADPercent','APBonusDamage'),scaled=(key:string)=>Math.floor(base*Math.round(v(key)*10000)/10000);
  if(spell===0){
   flame(ctx,u,t,base,seq,0);
   applyStatus(u,origin(u),'channel',0,Math.round(v('Spell1_MinDuration')*20),ctx.tick,ctx.events,true,'',seq);
  }
  else if(spell===1){
    strike(t,scaled('Spell2_Modifier'),'physical');knockAway(ctx,u,t,v('Spell2_HexKnockback'),'sevika-knockback');
    if(mod==='knockout-punch')strike(t,physical('Spell2_Bonus_KnockbackDamage'),'physical');
    leapG23(ctx,u,t);for(const x of foes().filter(x=>hexDistance(t.cell,x.cell)<=v('Spell2_HexRadius'))){strike(x,scaled('Spell2_SecondaryModifier'),'physical',true);applyStatus(x,origin(u),'stun',0,Math.round(v('Spell2_StunDuration')*20),ctx.tick,ctx.events);}}
  else if(spell===2){
    const bites=mod==='quadruple-chomp'?v('Spell3_BonusNumChomps'):1;
    for(let i=0;i<bites;i++)chomp(ctx,u,t,scaled('Spell3_Modifier'),seq,i);
    if(mod==='quadruple-chomp'){const seconds=Math.round(v('Spell3_BleedDuration')),bleed=physical('Spell3_Bonus_BleedADPercent');
      for(let i=0;i<seconds;i++)later(ctx,u,t,'g23Physical',(i+1)*20,split(bleed,seconds,i),seq,10+i,10+seconds);}
  }
  else {
    // Spell4 Jackpot: Durability for its own duration, and coins at random living enemies, one per interval; loot is not modelled.
    const {jackpotCoins:count,jackpotCoinAdBps,durabilityBps,durabilityTicks}=G23_POLICY.highRoller,interval=Math.floor(durabilityTicks/count);
    applyStatus(u,origin(u),'damageReduction',durabilityBps,durabilityTicks,ctx.tick,ctx.events,true);
    const coin=amount(u,ctx.tick,{ad:jackpotCoinAdBps/10000,ap:v('APBonusDamage')}),pool=[...foes()].sort((a,b)=>compareText(a.id,b.id));
    for(let i=0;i<count&&pool.length;i++){const x=pool[Math.floor(ctx.draw()*pool.length/2**32)];later(ctx,u,x,'g23Physical',interval*(i+1),coin,seq,20+i,20+count);}
  }
  if(mods)sevikaMods(ctx,u,t,seq,mod);
}
/** The High Roller's rocket or shield mod: on the slot machine's stop, whichever spell came up. */
function sevikaMods(ctx:AbilityContext,u:S13Unit,t:S13Unit,seq:number,mod:string):void{
  if(mod==='rocket')for(let i=0;i<G23_POLICY.highRoller.rockets;i++)hit(ctx,u,t,G23_POLICY.highRoller.rocketPhysicalDamage,seq,100+i,'physical');
  if(mod==='shield')grantShield(u,origin(u),G23_POLICY.highRoller.shield,ctx.tick+G23_POLICY.highRoller.shieldTicks,ctx.tick,ctx.events);
}
export function planG23Cast(ctx:AbilityContext,u:S13Unit,t:S13Unit,seq:number):string[]{
  const v=(k:string)=>variable(u,k),mag=(k:string)=>amount(u,ctx.tick,{ap:v(k)}),physical=(k:string,a?:string)=>amount(u,ctx.tick,{ad:v(k),ap:a?v(a):0});
  const ids:string[]=[],strike=(x:S13Unit,n:number,type:S13Packet['damageType']='magic',area=false)=>{hit(ctx,u,x,n,seq,ids.length,type,area);ids.push(x.id);};
  const heal=(n:number)=>ctx.heals.push({source:origin(u),targetId:u.id,amount:n});
  const foes=()=>byDistance(u,enemies(u,ctx.units));
  switch(champion(u)){
    case 'g23-sion':{
      const tier=u.mechanics?.find(m=>m.mechanic==='g23Sion')?.values.tier??3;
      grantShield(u,origin(u),amount(u,ctx.tick,{ap:tier>=5?G23_SUMMON_POLICY.sion.tier5PlusShieldAp:v('Shield')}),ctx.tick+Math.round(v('ShieldDuration')*20),ctx.tick,ctx.events);
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
      // Wind-up batch 3: the missiles' damage lands CAST_WINDUP_TICKS.renata after the cast (g2Landing; ordinal 0 is the target,
      // the rest its neighbours, area); the shields above stay on the cast. Targets and amounts are taken now.
      const struck=[t,...foes().filter(x=>x.id!==t.id&&hexDistance(t.cell,x.cell)<=1)];
      struck.forEach((x,n)=>{u.tasks.push({key:JSON.stringify([u.id,seq,'g2Landing',n,x.id]),kind:'g2Landing',source:origin(u),executeAtTick:ctx.tick+CAST_WINDUP_TICKS.renata,
        targetId:x.id,amount:mag(n===0?'TargetDamage':'ExplosionDamage'),actionSeq:seq,ordinal:n,total:struck.length,cancellable:false});ids.push(x.id);});break;
    }
    case 'cassiopeia': {
      // One read decides the splash and the branch reported (display output only).
      const splash=u.runtime.castCount%v('NumCasts')===0;ctx.castBranch=splash?'splash':'single';
      // The main bolt (11-24, authorization ②, timing only): it leaves CASSIOPEIA_BOLT_LAUNCH_TICKS after the cast and settles
      // where it lands, cassiopeiaBoltFlightTicks(hexes to the target then) later (abilityProjectile 'cassiopeia-bolt'); its amount
      // and target are taken now, and she stands still until it leaves (channel, self-chosen). The splash still settles on the cast
      // (its timing is pending).
      applyStatus(u,origin(u),'channel',0,CASSIOPEIA_BOLT_LAUNCH_TICKS,ctx.tick,ctx.events,true,'',seq);
      scheduleShot(u,'cassiopeia-bolt',ctx.tick+CASSIOPEIA_BOLT_LAUNCH_TICKS,t.id,mag('Damage'),seq,0,1);ids.push(t.id);
      if(splash)for(const x of byDistance(t,foes()).filter(x=>x.id!==t.id&&hexDistance(t.cell,x.cell)<=v('HexRadius')).slice(0,v('BonusNumEnemies')))strike(x,mag('MiasmaDamage'),'magic',true);break;}
    case 'nunu':{
      const ticks=Math.round(v('DamageDuration')*v('DamageTicksPerSecond'));
      applyStatus(u,origin(u),'damageReduction',Math.round(v('Durability')*10000),Math.round(v('DamageDuration')*20),ctx.tick,ctx.events,true);
      // 用户 2026-11-11 批准（自定，非原版数据）：施法期间锁定 DamageDuration 秒，原地不动、不普攻（channel：禁移动/普攻/施法，被控打断）。
      applyStatus(u,origin(u),'channel',0,Math.round(v('DamageDuration')*20),ctx.tick,ctx.events,true,'',seq);
      // The second damage lands NUNU_SECOND_AFTER_PULSE_TICKS after the last periodic one (wind-up batch 2); amounts taken now.
      for(let n=0;n<ticks;n++)for(const x of foes().filter(x=>hexDistance(u.cell,x.cell)<=v('HexRadius')))
        later(ctx,u,x,'g23Magic',Math.round((n+1)*20/v('DamageTicksPerSecond')),mag('Damage'),seq,n,ticks);
      for(const x of foes().filter(x=>hexDistance(u.cell,x.cell)<=v('HexRadius')))later(ctx,u,x,'g23Magic',Math.round(v('DamageDuration')*20)+NUNU_SECOND_AFTER_PULSE_TICKS,mag('SecondDamage'),seq,ticks,ticks+1);break;
    }
    case 'renni':{
      // Savage Revenge (P): pounce on the farthest enemy within PounceRange (else the target); enemies on the straight line
      // before it take ChargeBps × ADPercent; the pounce target and the closing splash deal MainBps × their damage.
      // Renni's position is not changed; the heal and stun are kept.
      const hero=heroLive(u),pounce=hero?byDistance(u,foes(),true).find(x=>hexDistance(u.cell,x.cell)<=hero.pounceRange)??t:t;
      if(hero){for(const x of foes().filter(x=>x.id!==pounce.id&&hexDistance(u.cell,x.cell)<hexDistance(u.cell,pounce.cell)&&lineContains(u.cell,pounce.cell,x.cell,1)))
        later(ctx,u,x,'g23Physical',1,Math.floor(physical('ADPercent')*hero.chargeBps/10000),seq,0,1);t=pounce;}
      const main=hero?.mainBps??10000;
      const n=Math.round(v('StunDuration')*20),healing=amount(u,ctx.tick,{ap:v('APHeal'),hp:v('MaxHealthHealingPercent')}),damage=Math.floor(physical('ADPercent')*main/10000);
      // Wind-up batch 4: she lifts the target (stun start) RENNI_LIFT_TICKS after the cast (g23RenniLift); the stun's per-tick
      // damage and her self-heal move with it, and the closing slam on the target and its neighbours (taken now, wherever
      // they are then) lands RENNI_SLAM_AFTER_STUN_TICKS after the stun ends. Amounts are taken now.
      const w=RENNI_LIFT_TICKS;
      // User-approved (2026-11-17): from her cast until the slam lands she holds the target and does not attack (channel: no
      // move, attack or cast; a control on her cancels it), as Nunu and Sevika do. Nothing else changes.
      applyStatus(u,origin(u),'channel',0,w+n+RENNI_SLAM_AFTER_STUN_TICKS,ctx.tick,ctx.events,true,'',seq);
      later(ctx,u,t,'g23RenniLift',w,n,seq,0,1);
      for(let i=0;i<n;i++){
        later(ctx,u,u,'g23Heal',w+i+1,split(healing,n,i),seq,i,n);
        later(ctx,u,t,'g23Physical',w+i+1,split(damage,n,i),seq,i,n);
      }
      for(const x of foes().filter(x=>hexDistance(t.cell,x.cell)<=1))later(ctx,u,x,'g23Physical',w+n+RENNI_SLAM_AFTER_STUN_TICKS,Math.floor(physical('FinalADPercent')*main/10000),seq,n,n+1);break;
    }
    case 'drmundo':{
      const total=amount(u,ctx.tick,{ap:v('APHeal'),hp:v('PercentHealthHeal')}),initial=Math.floor(total*v('PercentofHealImmediately')),seconds=Math.round(v('Duration'));
      // Everything lands CAST_WINDUP_TICKS after the cast (the first heal too); amounts and the pulse target are taken now. The
      // closing blast lands DRMUNDO_BLAST_AFTER_PULSE_TICKS after the last pulse.
      const w=CAST_WINDUP_TICKS.drmundo;
      later(ctx,u,u,'g23Heal',w,initial,seq,0,seconds+1);
      for(let i=0;i<seconds;i++){
        later(ctx,u,u,'g23Heal',w+(i+1)*20,split(total-initial,seconds,i),seq,i+1,seconds+1);
        later(ctx,u,t,'g23Magic',w+(i+1)*20,mag('APDamage'),seq,i,seconds);
      }
      for(const x of foes().filter(x=>hexDistance(u.cell,x.cell)<=2))later(ctx,u,x,'g23Magic',w+seconds*20+DRMUNDO_BLAST_AFTER_PULSE_TICKS,amount(u,ctx.tick,{hp:v('PercentHealthDamage')}),seq,seconds,seconds+1);break;
    }
    case 'elise':
      heal(mag('FlatHealth'));
      for(const x of foes().filter(x=>hexDistance(t.cell,x.cell)<=v('HexRadius'))){strike(x,mag('Damage'),'magic',true);applyStatus(x,origin(u),'stun',0,Math.round(v('StunDuration')*20),ctx.tick,ctx.events);}break;
    case 'elise-ranged':{
      const targets=foes().slice(0,v('NumOfSpiders'));
      for(const center of targets){strike(center,mag('MagicDamage'));for(const x of foes().filter(x=>x.id!==center.id&&hexDistance(center.cell,x.cell)<=1))strike(x,mag('SecondaryDamage'),'magic',true);}break;
    }
    case 'swain':{
      heal(mag('Heal'));g23State(u).ascension={untilTick:ctx.tick+Math.round(v('Duration')*20),nextPulseTick:ctx.tick+SWAIN_PULSE_TICKS,actionSeq:seq,takedowns:[],pulse:0};break;
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
      smeechStabs(ctx,u,target,physical('PercentAttackDamage','APDamage'),seq,0,28);break;
    }
    case 'jayce':{
      // User 2026-11-15: the forge measures "the nearest allies" but is not one of them (as g2-3-combat.ts's heal excludes it).
      const forge=reviveG23Forge(ctx,u)??u;
      for(const ally of byDistance(forge,ctx.units.filter(x=>x.alive&&x.hp>0&&!isAttackProxy(x)&&x.team===u.team&&!x.definitionId.startsWith('g23-forge'))).slice(0,v('NumAlliesShield')))
        grantShield(ally,origin(u),mag('Shield'),ctx.tick+Math.round(v('ShieldDuration')*20),ctx.tick,ctx.events);
      strike(t,physical('PercentAttackDamage'),'physical');applyStatus(t,origin(u),'stun',0,Math.round(v('EnemyFlightDuration')*20),ctx.tick,ctx.events,false,'',undefined,true);
      // P (user 2026-10-23): the target is knocked to the gate 3 hexes behind it (away from Jayce, cut at the board edge)
      // and flies back to its own cell; other enemies within 1 hex of that flight path take the secondary hit once.
      const cells=path(ctx.board,jayceGate(ctx.board,u.cell,t.cell),t.cell);
      for(const x of foes().filter(x=>x.id!==t.id&&cells.some(c=>hexDistance(c,x.cell)<=1)))strike(x,physical('PercentADSecondaryDamage'),'physical',true);break;
    }
    case 'jayce-ranged':{
      const forge=reviveG23Forge(ctx,u)??u;
      // 11-21 (authorization ②): one crystal per nearest enemy (round robin from the nearest when there are fewer) lands on its
      // cell and stays; the main hit lands on the nearest, then the crystals explode one after another in chain order around their
      // cells (cast-windup.ts). Where the tooltip is silent the reading is self-chosen, not original data: the nearest takes no
      // explosion of its own crystal; an enemy's later explosions this cast take the chain falloff once, not compounded. Who is hit and how much
      // are taken now, from where everyone stands; a target that dies first takes nothing.
      const targets=foes(),count=v('NumOfCrystals'),nearest=targets[0];
      if(nearest){
        const hitsSoFar=new Map<string,number>(),blast=physical('PercentAttackDamage'),hits:[S13Unit,number,number][]=[];
        // Crystals in chain order, so "first explosion" follows the order they go off.
        for(const i of Array.from({length:count},(_,k)=>k).sort((a,b)=>jayceCrystalChainPlace(a,count)-jayceCrystalChainPlace(b,count))){
          const aim=targets[i%targets.length]!,cell={...aim.cell};
          const at=jayceCrystalBlastTick(jayceCrystalChainPlace(i,count));
          for(const [kind,when] of [['g23CrystalLand',jayceCrystalLandTick(i)],['g23CrystalBlast',at]] as const)
            u.tasks.push({key:JSON.stringify([u.id,seq,kind,i]),kind,source:origin(u),executeAtTick:ctx.tick+when,targetId:aim.id,amount:0,actionSeq:seq,ordinal:i,total:count,cancellable:false,cell});
          for(const x of foes().filter(x=>hexDistance(cell,x.cell)<=1&&!(x.id===nearest.id&&aim.id===nearest.id)).sort((a,b)=>compareText(a.id,b.id))){
            const before=hitsSoFar.get(x.id)??0;hitsSoFar.set(x.id,before+1);hits.push([x,at,before?Math.floor(blast*(1-v('FalloffDamagePct'))):blast]);
          }
        }
        // Packet 0 is the main hit, then the explosions in order.
        later(ctx,u,nearest,'g23Physical',JAYCE_MAIN_HIT_TICKS,physical('ClosestEnemyPercentAD'),seq,0,hits.length+1);ids.push(nearest.id);
        hits.forEach(([x,at,raw],k)=>later(ctx,u,x,'g23Physical',at,raw,seq,k+1,hits.length+1));
      }
      for(const ally of byDistance(forge,ctx.units.filter(x=>x.alive&&x.hp>0&&!isAttackProxy(x)&&x.team===u.team&&!x.definitionId.startsWith('g23-forge'))).slice(0,v('NumAlliesAS')))
        applyStatus(ally,origin(u),'attackSpeed',Math.round(v('AttackSpeed')*10000),Math.round(v('ASDuration')*20),ctx.tick,ctx.events,true);break;
    }
    case 'sevika':{
      // 14.24b: roll 1 of 3 spells, then the High Roller mod. Triple enhances (and fixes) the spell;
      // Jackpot replaces the spell with Spell4 (coins). Enhanced semantics are 约定值 G24-SEVIKA-TRIPLE-01.
      // The rolled spell lands only once the slot machine has stopped; she stands still meanwhile (G24-SEVIKA-SLOTS-01).
      const initialSpell=Math.floor(ctx.draw()*3/2**32),mod=rollG23HighRoller(ctx.draw,!!teamup(u,'unlikely-duo'));
      const spell=mod.mod==='jackpot'?3:mod.mod==='blue-flamethrower'?0:mod.mod==='knockout-punch'?1:mod.mod==='quadruple-chomp'?2:initialSpell;
      ctx.events.push({type:'castOutcome',tick:ctx.tick,unitId:u.id,abilityKey:u.ability.id,outcome:mod.mod,subOutcomes:mod.enhanced?[mod.mod]:[],
        castVariant:{actionSeq:seq,move:spell===0?'flamethrower':spell===1?'punch':spell===2?'chomp':'jackpot',channelTicks:spell===0?Math.round(v('Spell1_MinDuration'))*20:0,enhanced:mod.enhanced,heroAugmentIds:[]}});
      g23State(u).highRoller.push({actionSeq:seq,spell,...mod,gold:mod.mod==='coin'?G23_POLICY.highRoller.gold:0});
      applyStatus(u,origin(u),'damageReduction',G23_POLICY.highRoller.durabilityBps,G23_POLICY.highRoller.durabilityTicks,ctx.tick,ctx.events,true);
      const wait=G23_POLICY.highRoller.slotTicks;
      // The punch (11-24, authorization ②, timing only): the slot machine stops on `wait` (its rocket/shield mod there) and the fist
      // lands SEVIKA_PUNCH_HIT_TICKS later, where the punch's damage, knock-back, leap, area damage and stun all settle together;
      // she stands still until then (self-chosen). The other spells settle on the stop as before.
      const punch=spell===1,hold=wait+(punch?SEVIKA_PUNCH_HIT_TICKS:0);
      applyStatus(u,origin(u),'channel',0,hold,ctx.tick,ctx.events,true,'',seq);
      if(punch){later(ctx,u,t,'g23Roll',wait,0,seq,0,2);later(ctx,u,t,'g23Roll',hold,0,seq,1,2);}
      else later(ctx,u,t,'g23Roll',wait,0,seq,0,1);
      ids.push(t.id);
      // Gold is committed by the battle settlement receipt, never by the combat tick.
      break;
    }
  }
  return ids;
}
export function executeG23Task(ctx:AbilityContext,u:S13Unit,task:CombatTask):void{
  if(task.kind==='g23Roll'){
   const roll=g23State(u).highRoller.find(r=>r.actionSeq===task.actionSeq);
   const target=ctx.units.find(x=>x.id===task.targetId&&x.alive&&x.hp>0&&x.team!==u.team)??byDistance(u,enemies(u,ctx.units))[0];
   if(!roll||!target||!u.alive||u.hp<=0)return;
   // The punch's two steps (task.total 2): the stop (its mod, and a display marker naming the coming hit tick), then the fist.
   if(task.total===2&&task.ordinal===0){
    sevikaMods(ctx,u,target,task.actionSeq,roll.mod);
    ctx.events.push({type:'abilityMarker',tick:ctx.tick,unitId:u.id,marker:'sevika-punch-thrown',cell:{...target.cell},arrivalTick:ctx.tick+SEVIKA_PUNCH_HIT_TICKS});
    return;
   }
   sevikaSpell(ctx,u,target,task.actionSeq,roll.spell,roll.mod,task.total!==2);return;
  }
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
   const blue=g23State(u).highRoller.some(r=>r.actionSeq===task.actionSeq&&r.mod==='blue-flamethrower');
   flame(ctx,u,target,task.amount,task.actionSeq,task.ordinal,blue?Math.round(variable(u,'Spell1_Bonus_DamagePercentPerSecond')*10000)*task.ordinal:0);return;
  }
  if(task.kind==='g23Smeech'){
   const previous=ctx.units.find(x=>x.id===task.targetId);if(!previous||previous.alive||task.ordinal>=task.total)return;
   const next=smeechTarget(ctx,u);if(!next)return;
   leapG23(ctx,u,next);
   // Display only (authorization ①): marks this tick's movement as the re-leap, so the renderer plays a leap, not a walk.
   ctx.events.push({type:'abilityMarker',tick:ctx.tick,unitId:u.id,marker:'smeech-leap-again',cell:{...u.cell},arrivalTick:ctx.tick});
   smeechStabs(ctx,u,next,Math.floor(task.amount*(1-variable(u,'DamageReductionOnLeap'))),task.actionSeq,task.ordinal,task.total);return;
  }
  // Jayce's crystals (display only): one lands, or one explodes, at its cell.
  if(task.kind==='g23CrystalLand'||task.kind==='g23CrystalBlast'){
   ctx.events.push({type:'jayceCrystal',tick:ctx.tick,unitId:u.id,phase:task.kind==='g23CrystalLand'?'landed':'exploded',crystal:task.ordinal,count:task.total,cell:{...task.cell!}});return;
  }
  // Renni's lift: the stun starts now on her target, if it still lives (display: she lifts it, carryChanged).
  if(task.kind==='g23RenniLift'){
   const target=ctx.units.find(x=>x.id===task.targetId&&x.alive&&x.hp>0);if(!target)return;
   applyStatus(target,origin(u),'stun',0,task.amount,ctx.tick,ctx.events);
   ctx.events.push({type:'carryChanged',tick:ctx.tick,holderId:u.id,targetId:target.id,carried:true});return;
  }
  // A later stab: its target, if still alive, takes the amount taken on the cast (a dead one takes nothing; no other is picked).
  if(task.kind==='g23Stab'){
   const target=ctx.units.find(x=>x.id===task.targetId&&x.alive&&x.hp>0);
   if(target){hit(ctx,u,target,task.amount,task.actionSeq,task.ordinal,'physical');return;}
   const round=(x:CombatTask)=>x.actionSeq===task.actionSeq&&x.targetId===task.targetId&&(x.kind==='g23Stab'||x.kind==='g23Smeech');
   const check=u.tasks.find(x=>round(x)&&x.kind==='g23Smeech');if(!check)return;
   u.tasks=u.tasks.filter(x=>!round(x));executeG23Task(ctx,u,check);return;
  }
  const target=ctx.units.find(x=>x.id===task.targetId&&x.alive&&x.hp>0);if(!target)return;
  if(task.kind==='g23Heal')ctx.heals.push({source:task.source,targetId:target.id,amount:task.amount});
  else hit(ctx,u,target,task.amount,task.actionSeq,1000+task.ordinal,task.kind==='g23Physical'?'physical':task.kind==='g23True'?'true':'magic');
  // Display only: Renni puts her target down with the stun's last pulse.
  if(task.kind==='g23Physical'&&champion(u)==='renni'&&task.total===Math.round(variable(u,'StunDuration')*20)&&task.ordinal===task.total-1)ctx.events.push({type:'carryChanged',tick:ctx.tick,holderId:u.id,targetId:task.targetId!,carried:false});
  // Display only: Dr. Mundo's heal over time paid its last part.
  if(task.kind==='g23Heal'&&champion(u)==='drmundo'&&task.ordinal===task.total-1)ctx.events.push({type:'abilityEffectEnded',tick:ctx.tick,unitId:u.id,effect:'drmundo-heal',targetIds:[]});
}

/** Timed Swain pulses sample current adjacency; takedown extensions remain in the snapshot. */
export function advanceG23Skills(ctx:AbilityContext):void{
 for(const u of ctx.units.filter(u=>u.alive&&u.hp>0)){
  const a=u.g23?.ascension;
  // Display only: the demon form is over on the first tick past untilTick (takedowns may have moved it later).
  if(a&&ctx.tick===a.untilTick+1)ctx.events.push({type:'abilityEffectEnded',tick:ctx.tick,unitId:u.id,effect:'swain-ascension',targetIds:[]});
  if(!a||ctx.tick>a.untilTick||ctx.tick<a.nextPulseTick)continue;
  // 11-20 (user-approved): SWAIN_PULSE_TICKS apart, each pulse a 1/SWAIN_PULSES_PER_SECOND part of the per-second heal and
  // damage (splitTotal: the parts of each second add up to the per-second value); adjacency is taken every pulse.
  const part=a.pulse%SWAIN_PULSES_PER_SECOND;a.pulse++;a.nextPulseTick+=SWAIN_PULSE_TICKS;
  ctx.heals.push({source:origin(u),targetId:u.id,amount:splitTotal(amount(u,ctx.tick,{ap:variable(u,'HealPerSecond')}),SWAIN_PULSES_PER_SECOND)[part]!});
  for(const t of enemies(u,ctx.units).filter(t=>hexDistance(u.cell,t.cell)<=1))hit(ctx,u,t,splitTotal(amount(u,ctx.tick,{ap:variable(u,'DamagePerSecond')}),SWAIN_PULSES_PER_SECOND)[part]!,a.actionSeq,10000+ctx.tick,'magic',true);
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
  if(a&&a.untilTick>=ctx.tick&&!a.takedowns.includes(victimId)){const before=a.untilTick;a.takedowns.push(victimId);a.untilTick+=Math.round(variable(u,'BonusDuration')*20);
   // Display only: the takedown extended the demon form (once per victim).
   ctx.events.push({type:'swainAscensionExtended',tick:ctx.tick,unitId:u.id,victimId,beforeUntilTick:before,untilTick:a.untilTick});}
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
