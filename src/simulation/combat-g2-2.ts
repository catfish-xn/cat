import { isAttackProxy } from './anomalies/availability';
/** G2-2 finite skill execution. All counters, zones and marks live in Combat JSON. */
import { hexDistance, type HexCell } from './board';
import type { CombatTask, G22State, CombatOrigin } from './combat-types';
import type { AbilityContext, S13Packet, S13Heal } from './combat-s13-abilities';
import { amount, ap, applyStatus, byDistance, champion, enemies, grantShield, origin, path, variable, type S13Unit } from './combat-s13-state';
import { asSource } from './m8/s13-definitions';
import { executeMechanismEffect } from './m8/s13-mechanisms';
import { modifier, stat } from './content/item-programs';
import { lineContains, lineDirections } from './combat-skill-lines';
export function g22(unit: S13Unit): G22State { return unit.g22 ??= {initialized:false,rebelTriggered:false,wanted:[],wantedDeaths:0,mordeUntilTick:0,reaveUntilTick:0,reaveBps:0,exposureFromTick:0,exposureUntilTick:0,exposureBps:0}; }
function hit(ctx:AbilityContext,u:S13Unit,t:S13Unit,raw:number,seq:number,ordinal:number,type:S13Packet['damageType']='magic',area=false,basic=false,source=origin(u)) {
  ctx.packets.push({source:basic?{...source,sourceKind:'attack'}:source,targetId:t.id,raw,damageType:type,actionSeq:seq,ordinal,
    delivery:basic?'basic-attack':'ability-direct',critEligibility:basic?'basic':'requires-spell-authorization',area,triggeringCastActionSeq:basic?null:seq});
}
function change(ctx:AbilityContext,u:S13Unit,t:S13Unit,source:CombatOrigin,name:Parameters<typeof modifier>[0],value:number,unit:Parameters<typeof modifier>[2]='flat',duration:number|null=null) {
  executeMechanismEffect(ctx,u,asSource(source),t,stat(modifier(name,value,unit),duration),0,0,undefined,undefined,undefined,undefined,{applicationId:'g22:'+name,area:false,triggeringCastActionSeq:null});
}
function schedule(u:S13Unit,kind:CombatTask['kind'],at:number,target:S13Unit,value:number,seq:number,n=0,total=1,cell?:HexCell) {
  u.tasks.push({key:JSON.stringify([u.id,seq,kind,n,target.id]),kind,source:origin(u),executeAtTick:at,targetId:target.id,amount:value,actionSeq:seq,ordinal:n,total,cancellable:false,...(cell?{cell:{...cell}}:{}),...(kind==='g22Curse'?{attachedDot:true}:{})});
}
export function planG22Cast(ctx:AbilityContext,u:S13Unit,t:S13Unit,seq:number):string[] {
  const v=(k:string)=>variable(u,k),mag=(k:string)=>amount(u,ctx.tick,{ap:v(k)}),ad=(k:string,a?:string)=>amount(u,ctx.tick,{ad:v(k),ap:a?v(a):0});
  const ids:string[]=[],strike=(target:S13Unit,value:number,type:S13Packet['damageType']='magic',area=false)=>{hit(ctx,u,target,value,seq,ids.length,type,area);ids.push(target.id);};
  const heal=(value:number)=>ctx.heals.push({source:origin(u),targetId:u.id,amount:value});
  const foes=()=>byDistance(u,enemies(u,ctx.units));
  switch(champion(u)) {
    case 'camille': strike(t,ad('PercentAttackDamage','APDamage'),t.armor<t.magicResist?'physical':'magic');break;
    case 'vi':
      grantShield(u,origin(u),mag('Shield'),ctx.tick+Math.round(v('ShieldDuration')*20),ctx.tick,ctx.events);
      strike(t,ad('PercentAttackDamage'),'physical');applyStatus(t,origin(u),'stun',0,Math.round(v('StunDuration')*20),ctx.tick,ctx.events);
      for(const other of foes().filter(x=>x.id!==t.id&&x.cell.row===t.cell.row)) {strike(other,ad('PercentAttackDamage_SecondaryDamage'),'physical',true);applyStatus(other,origin(u),'stun',0,5,ctx.tick,ctx.events);}break;
    case 'akali':
      strike(t,mag('Damage'));strike(t,Math.floor(mag('SecondaryDamage')*(10000+Math.round(v('TargetDamageAmp')*10000))/10000));
      Object.assign(g22(t),{exposureFromTick:ctx.tick+1,exposureUntilTick:ctx.tick+1+Math.round(v('Duration')*20),exposureBps:Math.round(v('TargetDamageAmp')*10000)});break;
    case 'sett': {
      const targets=foes().slice(0,2),mult=targets.length===1?1+v('SoloBonus'):1;
      for(const x of targets){strike(x,Math.floor(mag('Damage')*mult),'magic',true);applyStatus(x,origin(u),'stun',0,Math.round(v('StunDuration')*mult*20),ctx.tick,ctx.events);}break;
    }
    case 'draven':ids.push(u.id);break;
    case 'heimerdinger': {
      const n=v('StartingRockets')+Math.max(0,u.runtime.castCount-1)*v('MissileIncreasePerCast'),targets=foes();
      for(let i=0;i<n;i++)strike(targets[Math.floor(ctx.draw()/2**32*targets.length)],mag('Damage'));break;
    }
    case 'trundle': {
      const bps=10000+Math.floor((u.maxHp-u.hp)*Math.round(v('AmountIncreaseMax')*10000)/u.maxHp);
      heal(Math.floor(mag('GainHealth')*bps/10000));strike(t,Math.floor(ad('PercentAttackDamage')*bps/10000),'physical');break;
    }
    case 'ziggs': {
      strike(t,mag('Damage'));const targets=foes();for(let i=0;i<v('NumBombs');i++)strike(targets[Math.floor(ctx.draw()/2**32*targets.length)],mag('MinibombDamage'));break;
    }
    case 'steb':heal(mag('Heal'));strike(t,mag('Damage'));break;
    case 'vex':strike(t,mag('Damage'));schedule(u,'g22Vex',ctx.tick+Math.round(v('DOTDuration')*20),t,mag('SecondaryDamage'),seq,0,1,t.cell);break;
    case 'twistedfate': {
      const ally=ctx.units.filter(x=>x.alive&&x.hp>0&&!isAttackProxy(x)&&x.team===u.team).sort((a,b)=>a.hp-b.hp||(a.id<b.id?-1:1))[0];
      if(ally)ctx.heals.push({source:origin(u),targetId:ally.id,amount:mag('BlueHeal')});
      const targets=foes(),center=[...targets].sort((a,b)=>targets.filter(x=>hexDistance(b.cell,x.cell)<=1).length-targets.filter(x=>hexDistance(a.cell,x.cell)<=1).length||(a.id<b.id?-1:1))[0];
      for(const x of targets.filter(x=>hexDistance(center.cell,x.cell)<=1))strike(x,mag('RedDamage'),'magic',true);
      strike(t,mag('YellowDamage'));applyStatus(t,origin(u),'stun',0,Math.round(v('StunDuration')*20),ctx.tick,ctx.events);break;
    }
    case 'jinx': {
      const phase=(u.runtime.castCount-1)%3;
      if(phase===0){const cells=u.starLevel===3?null:path(ctx.board,u.cell,t.cell);for(const x of foes().filter(x=>cells?cells.some(c=>c.col===x.cell.col&&c.row===x.cell.row):lineContains(u.cell,t.cell,x.cell,1,14))){strike(x,ad('ZapPercentAD'),'physical',true);applyStatus(x,origin(u),'stun',0,Math.round(v('ZapStunDuration')*20),ctx.tick,ctx.events);}}
      else if(phase===1){const centers=foes().slice(0,v('NumOfFlameChompers'));for(const x of foes().filter(x=>centers.some(c=>hexDistance(c.cell,x.cell)<=1)))strike(x,ad('FlameChompersPercentAD'),'physical',true);}
      else {const center={col:Math.floor((ctx.board.columns-1)/2),row:Math.floor((ctx.board.rows-1)/2)};for(const x of foes())strike(x,Math.floor(ad('DeathRocketPercentAD','DeathRocketAP')*Math.max(0,10000-Math.round(v('FalloffPercent')*10000)*hexDistance(center,x.cell))/10000),'physical',true);}break;
    }
    case 'ambessa':
      if(u.runtime.castCount%2===1){for(const x of foes().filter(x=>hexDistance(t.cell,x.cell)<=1))strike(x,ad('PercentStrikeAD'),'physical',true);}
      else {strike(t,ad('SlamDamageAD'),'physical');applyStatus(t,origin(u),'stun',0,5,ctx.tick,ctx.events);}break;
    case 'mordekaiser': {
      g22(u).mordeUntilTick=ctx.tick+Math.round(v('EmpowerDuration')*20);
      applyStatus(u,origin(u),'damageReduction',Math.round(v('DR')*10000),20,ctx.tick,ctx.events,true);
      const targets=foes();
      const lines=lineDirections(u.cell).map(direction=>({hits:targets.filter(x=>lineContains(u.cell,direction,x.cell,3,8)),target:lineContains(u.cell,direction,t.cell,3,8)}));
      // Stable sort preserves direction order after count and current-target ties.
      lines.sort((a,b)=>b.hits.length-a.hits.length||Number(b.target)-Number(a.target));
      for(const x of lines[0].hits)strike(x,Math.floor(mag('Damage')*(targets.indexOf(x)<v('NearestEnemies')?1+v('DamageBonus'):1)),'magic',true);break;
    }
    case 'morgana': {
      const target=foes().find(x=>(x.g22?.reaveUntilTick??0)<=ctx.tick)??t,total=mag('Damage'),pulses=Math.round(v('Duration'));
      const state=g22(target);state.reaveUntilTick=ctx.tick+pulses*20;state.reaveBps=Math.round(v('ShieldReavePercent')*10000);
      u.tasks=u.tasks.filter(task=>task.kind!=='g22Curse'||task.targetId!==target.id);
      for(let n=0;n<pulses;n++)schedule(u,'g22Curse',ctx.tick+(n+1)*20,target,Math.floor(total/pulses)+(n<total%pulses?1:0),seq,n,pulses);
      ids.push(target.id);break;
    }
  }
  return ids;
}
export function planG22Attack(ctx:AbilityContext,u:S13Unit,t:S13Unit,seq:number):boolean {
  const n=champion(u),v=(k:string)=>variable(u,k);
  if(n==='draven'&&u.runtime.castCount>0){hit(ctx,u,t,amount(u,ctx.tick,{ad:v('PercentAD'),flat:v('BaseDamage')}),seq,0,'physical',false,true);return true;}
  if(n==='ambessa'&&(u.runtime.castCount===0||u.runtime.castCount%2===1)){hit(ctx,u,t,amount(u,ctx.tick,{ad:v('PercentChainAttackAD')}),seq,0,'physical',false,true);return true;}
  if(n==='mordekaiser'&&(u.g22?.mordeUntilTick??0)>ctx.tick){
    hit(ctx,u,t,amount(u,ctx.tick,{ap:v('TargetDamage')}),seq,0,'magic',false,true);
    for(const [i,x] of byDistance(t,enemies(u,ctx.units)).filter(x=>x.id!==t.id&&hexDistance(t.cell,x.cell)<=v('AttackHexRadius')).entries())hit(ctx,u,x,amount(u,ctx.tick,{ap:v('SlamDamage')}),seq,i+1,'magic',true,true);
    return true;
  }
  return false;
}
export function executeG22Task(ctx:AbilityContext,u:S13Unit,task:CombatTask):void {
  if(task.kind==='g22Vex') {for(const [i,t] of enemies(u,ctx.units).filter(t=>task.cell&&hexDistance(t.cell,task.cell)<=1).entries())hit(ctx,u,t,task.amount,task.actionSeq,100+i,'magic',true);}
  else {const t=ctx.units.find(t=>t.id===task.targetId&&t.alive&&t.hp>0);if(t)hit(ctx,u,t,task.amount,task.actionSeq,100+task.ordinal);}
}
export function recordG22Damage(ctx:AbilityContext,u:S13Unit|undefined,actual:number,packet:S13Packet):void {
  if(!u||actual<=0)return;
  const name=champion(u);
  const rate=name==='camille'&&packet.source.definitionId==='camille-ability'?variable(u,'HealPercent')
    :name==='ambessa'&&u.runtime.castCount>0&&u.runtime.castCount%2===0?variable(u,'PercentOmnivamp')*ap(u,ctx.tick)/100
    :name==='mordekaiser'&&(u.g22?.mordeUntilTick??0)>ctx.tick?variable(u,'OmnivampPercent'):0;
  if(rate)ctx.heals.push({source:origin(u),targetId:u.id,amount:Math.floor(actual*Math.round(rate*10000)/10000)});
}
export function shareStebHeal(ctx:AbilityContext,entry:S13Heal,target:S13Unit|undefined,actual:number):void {
  if(!target||champion(target)!=='steb'||entry.g22Shared||actual<=0)return;
  for(const ally of byDistance(target,ctx.units.filter(u=>u.id!==target.id&&u.team===target.team&&!isAttackProxy(u)&&u.alive&&u.hp>0)).slice(0,variable(target,'NumAlliesToShare')))
    ctx.heals.push({source:origin(target),targetId:ally.id,amount:Math.floor(actual*variable(target,'PercentAlliedHealShare')),g22Shared:true});
}
export function startG22Traits(ctx:AbilityContext):void {
  for(const u of ctx.units.filter(u=>u.alive))for(const m of u.mechanics??[]){
    if(m.mechanic==='enforcer'){
      const state=g22(u);if(state.initialized)continue;state.initialized=true;
      state.wanted=enemies(u,ctx.units).sort((a,b)=>b.maxHp-a.maxHp||(a.id<b.id?-1:1)).slice(0,m.values.wanted).map(x=>x.id);
      grantShield(u,m.source,Math.floor(u.maxHp*m.values.shieldBps/10000),1201,ctx.tick,ctx.events);
    }else if(m.mechanic==='scrap'&&m.values.shieldPerComponent)grantShield(u,m.source,m.values.shieldPerComponent*(m.values.componentCount??0),ctx.tick+m.values.durationTicks,ctx.tick,ctx.events);
  }
}
export function advanceG22Traits(ctx:AbilityContext):void {
  for(const u of ctx.units.filter(u=>u.alive&&u.hp>0))for(const m of u.mechanics??[]){
    if(m.mechanic==='enforcer'){
      const state=g22(u),count=state.wanted.filter(id=>ctx.units.some(x=>x.id===id&&!x.alive)).length;
      if(count>state.wantedDeaths){change(ctx,u,u,m.source,'attackSpeed',count*m.values.attackSpeedBps,'bps');state.wantedDeaths=count;}
    }
    if(m.mechanic==='rebel'&&!m.values.forcedPeriodTicks&&!g22(u).rebelTriggered){
      const team=ctx.units.filter(x=>x.team===u.team&&!isAttackProxy(x)),max=team.reduce((n,x)=>n+x.maxHp,0),hp=team.reduce((n,x)=>n+x.hp,0);
      if((max-hp)*10000<max*m.values.thresholdBps)continue;
      // Mark every member before any max-HP effect changes the shared trigger sample.
      const members=team.filter(x=>x.alive&&x.hp>0&&x.mechanics?.some(y=>y.mechanic==='rebel'));
      for(const x of members)g22(x).rebelTriggered=true;
      for(const x of members){
        const src=x.mechanics!.find(y=>y.mechanic==='rebel')!.source;
        change(ctx,x,x,src,'attackDamage',m.values.adApBps,'bps');change(ctx,x,x,src,'abilityPower',m.values.adApBps/100);
        change(ctx,x,x,src,'attackSpeed',m.values.attackSpeedBps,'bps',m.values.durationTicks);
        if(m.values.bonusHpBps)executeMechanismEffect(ctx,x,asSource(src),x,{kind:'change-max-hp',bonusBps:m.values.bonusHpBps,currentHp:'add-max-delta',countsAsHeal:false},0,0);
      }
      if(m.values.stunTicks)for(const x of enemies(u,ctx.units))applyStatus(x,m.source,'stun',0,m.values.stunTicks,ctx.tick,ctx.events);
    }
  }
}
