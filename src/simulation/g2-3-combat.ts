import { occupiesCell } from './anomalies/availability';
import {scaleItemSummonHp} from './g2-4b-summons';
import {hexDistance} from './board';
import type { CombatUnit,G23State,CombatOrigin } from './combat-types';
import type { AbilityContext,S13Packet } from './combat-s13-abilities';
import { ad,ap,range,byDistance,enemies,compareText,type S13Unit } from './combat-s13-state';
import { executeMechanismEffect } from './m8/s13-mechanisms';
import { asSource } from './m8/s13-definitions';
import { modifier,stat } from './content/item-programs';
import { G23_ANOMALY_SOURCE } from './content/g2-3-anomaly-source';
export function g23State(u:S13Unit):G23State{return u.g23??={ascension:null,conquestTakedowns:[],experimentTakedowns:[],cuts:{},stationaryTicks:0,lastCell:{...u.cell},absorbed:[],highRoller:[]};}
export function g23Anomaly(u:Pick<CombatUnit,'mechanics'>,id:string):CombatOrigin|undefined{return u.mechanics?.find(m=>m.mechanic==='g23Anomaly'&&m.source.definitionId===id)?.source;}
export function recordG23Attack(ctx:AbilityContext,u:S13Unit,t:S13Unit,seq:number):void{
  const source=g23Anomaly(u,'one-thousand-cuts');if(!source)return;
  const s=g23State(u),count=s.cuts[t.id]??0,v=G23_ANOMALY_SOURCE['one-thousand-cuts'].values;

  ctx.packets.push({source,targetId:t.id,raw:v.BaseTrueDamage+count*v.BonusTrueDamage,damageType:'true',actionSeq:seq,ordinal:9000,
    delivery:'attack-extra',critEligibility:'never',area:false,triggeringCastActionSeq:null});
}
export function recordG23Damage(ctx:AbilityContext,u:S13Unit|undefined,actual:number,packet:S13Packet,absorbed=0,redirected=false):void{
  if(!redirected&&u&&packet.source.definitionId==='one-thousand-cuts'&&actual+absorbed>0){const s=g23State(u);s.cuts[packet.targetId]=(s.cuts[packet.targetId]??0)+1;}
  if(!u||actual<=0)return;
  const visionary=u.mechanics?.find(m=>m.mechanic==='visionary'&&m.values.allyHealingBps>0);
  if(visionary && ['ability-direct','ability-periodic'].includes(packet.delivery)) {
    const allies=ctx.units.filter(a=>a.id!==u.id&&a.team===u.team&&a.alive&&a.hp>0&&!a.definitionId.startsWith('g23-forge'))
      .sort((a,b)=>a.hp*b.maxHp-b.hp*a.maxHp||compareText(a.id,b.id));
    if(allies[0])ctx.heals.push({source:visionary.source,targetId:allies[0].id,amount:Math.floor(actual*visionary.values.allyHealingBps/10000)});
  }
  if(packet.source.definitionId==='slime-time')ctx.heals.push({source:packet.source,targetId:u.id,amount:actual});
}
export function advanceG23Anomalies(ctx:AbilityContext):void{
  for(const u of ctx.units.filter(u=>u.alive&&u.hp>0)){
    if(g23Anomaly(u,'deep-roots')){
      const t=byDistance(u,enemies(u,ctx.units))[0];
      if(t&&hexDistance(u.cell,t.cell)>range(u)&&!g23Anomaly(t,'deep-roots')){
       const cells=Array.from({length:ctx.board.rows},(_,row)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row}))).flat().filter(c=>hexDistance(u.cell,c)<=range(u)&&!ctx.units.some(other=>occupiesCell(other,ctx.tick)&&other.cell.col===c.col&&other.cell.row===c.row)).sort((a,b)=>hexDistance(t.cell,a)-hexDistance(t.cell,b)||a.row-b.row||a.col-b.col);
       if(cells[0]){ctx.events.push({type:'movement',tick:ctx.tick,unitId:t.id,from:t.cell,to:cells[0]});t.cell=cells[0];}
      }
    }
    const eagle=g23Anomaly(u,'eagle-eye');
    if(eagle){
      const s=g23State(u),v=G23_ANOMALY_SOURCE['eagle-eye'].values;
      s.stationaryTicks=s.lastCell.col===u.cell.col&&s.lastCell.row===u.cell.row?s.stationaryTicks+1:1;s.lastCell={...u.cell};
      if(s.stationaryTicks%(v.Time*20)===0)executeMechanismEffect(ctx,u,asSource(eagle),u,{...stat(modifier('attackDamage',Math.round(v.BonusAD*10000),'bps')),stackPolicy:{kind:'add-stacks',cap:10000}},0,0);
    }
    for(const id of ['power-absorption','energy-absorption']){
      const source=g23Anomaly(u,id);if(!source)continue;
      const s=g23State(u),power=id==='power-absorption';
      for(const ally of ctx.units.filter(a=>a.id!==u.id&&a.team===u.team&&!a.alive&&!s.absorbed.some(r=>r.unitId===a.id)).sort((a,b)=>compareText(a.id,b.id))){
        const value=Math.floor((power?ad(ally):ap(ally,ctx.tick))*(power?900:500)/10000);
        s.absorbed.push({unitId:ally.id,tick:ctx.tick,value});
        const bound={...source,instanceId:JSON.stringify([source.instanceId,'absorb',ally.id])};
        executeMechanismEffect(ctx,u,asSource(bound),u,stat({...modifier(power?'attackDamage':'abilityPower',0),value:{kind:'counter',counterId:'g23Absorb',perCount:1}}),0,0,undefined,undefined,undefined,undefined,{counters:{g23Absorb:value},applicationId:'source',area:false,triggeringCastActionSeq:null});
      }
    }
  }
}
/** Base conversion amounts are frozen at entry; ongoing expert multipliers use every live contribution. */
export function g23ConversionProgramValues(id:string,armor:number,magicResist:number){
  return id==='arcana-overwhelming'?{stat:'abilityPower' as const,amount:Math.floor(magicResist*2500/10000)}
    :id==='avalanche-of-armor'?{stat:'attackDamage' as const,amount:Math.floor(armor*3000/10000)}:null;
}
export function validateG23State(unit:CombatUnit,units:readonly CombatUnit[],tick:number,nextActionSeq:number):void{
  const s=unit.g23;if(!s)return;
  const check=(v:unknown)=>{if(!v)throw new RangeError('Invalid G23 combat state');};
  const integer=(n:number,max=1000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
  check(Object.keys(s).length===8&&s.cuts&&Array.isArray(s.absorbed)&&Array.isArray(s.highRoller)&&integer(s.stationaryTicks,tick));
  check(Array.isArray(s.experimentTakedowns)&&new Set(s.experimentTakedowns).size===s.experimentTakedowns.length&&s.experimentTakedowns.every(id=>units.some(u=>u.id===id&&u.team!==unit.team&&!u.alive))&&(!s.experimentTakedowns.length||unit.mechanics?.some(m=>m.mechanic==='g23Experiment'&&m.values.mundo>0)));
  check(s.ascension===null||unit.ability.kind==='s13'&&unit.ability.championId==='swain'&&Object.keys(s.ascension).length===4&&integer(s.ascension.untilTick,10000)&&integer(s.ascension.nextPulseTick,10000)&&integer(s.ascension.actionSeq,nextActionSeq-1)&&Array.isArray(s.ascension.takedowns)&&new Set(s.ascension.takedowns).size===s.ascension.takedowns.length&&s.ascension.takedowns.every(id=>units.some(u=>u.id===id&&u.team!==unit.team&&!u.alive)));
  check(Array.isArray(s.conquestTakedowns)&&new Set(s.conquestTakedowns).size===s.conquestTakedowns.length&&s.conquestTakedowns.every(id=>units.some(u=>u.id===id&&u.team!==unit.team&&!u.alive))&&(!s.conquestTakedowns.length||unit.sources?.some(s=>s.source.sourceDefinitionId==='conqueror')));
  check(s.lastCell&&integer(s.lastCell.col,6)&&integer(s.lastCell.row,7));
  check(Object.entries(s.cuts).every(([id,n])=>integer(n,unit.runtime?.attackCount??0)&&units.some(u=>u.id===id&&u.team!==unit.team))&&Object.values(s.cuts).reduce((n,v)=>n+v,0)<=(unit.runtime?.attackCount??0));
  check(!Object.keys(s.cuts).length||g23Anomaly(unit,'one-thousand-cuts'));
  check(!s.stationaryTicks||g23Anomaly(unit,'eagle-eye'));
  check(new Set(s.absorbed.map(r=>r.unitId)).size===s.absorbed.length);
  check(!s.absorbed.length||g23Anomaly(unit,'energy-absorption')||g23Anomaly(unit,'power-absorption'));
  check(s.absorbed.every(r=>Object.keys(r).length===3&&integer(r.value)&&integer(r.tick,tick)&&r.tick>0&&units.some(a=>a.id===r.unitId&&a.id!==unit.id&&a.team===unit.team&&!a.alive)));
  check(s.highRoller.length<=(unit.runtime?.castCount??0)&&(!s.highRoller.length||unit.definitionId==='sevika'));
  check(new Set(s.highRoller.map(r=>r.actionSeq)).size===s.highRoller.length&&s.highRoller.every(r=>Object.keys(r).sort().join(',')==='actionSeq,enhanced,gold,mod,spell'&&integer(r.actionSeq,nextActionSeq-1)&&integer(r.spell,2)&&typeof r.enhanced==='boolean'&&(r.enhanced?['blue-flamethrower','knockout-punch','quadruple-chomp','jackpot']:['rocket','shield','coin']).includes(r.mod)&&r.gold===(r.mod==='coin'||r.mod==='jackpot'?3:0)));
}
/** Flat Laboratory growth retains a unique victim receipt and adjusts current HP by the max delta. */
export function settleG23ExperimentKills(ctx:AbilityContext,killed:ReadonlyMap<string,CombatOrigin>):void{
 for(const [id,source] of killed){
  const u=ctx.units.find(u=>u.id===source.ownerId&&u.hp>0),m=u?.mechanics?.find(m=>m.mechanic==='g23Experiment');
  if(!u||!m?.values.mundo||g23State(u).experimentTakedowns.includes(id))continue;
  g23State(u).experimentTakedowns.push(id);
  const basis=u.maxHpBasis??{base:u.maxHp,flat:0,bps:0,bonusBps:0},updated={...basis,flat:basis.flat+m.values.mundo};
  const afterMax=scaleItemSummonHp(u,Math.floor((updated.base+updated.flat)*(10000+updated.bps+updated.bonusBps)/10000)),beforeMax=u.maxHp,beforeHp=u.hp;
  u.maxHpBasis=updated;u.maxHp=afterMax;u.hp=Math.min(afterMax,beforeHp+afterMax-beforeMax);
  ctx.events.push({type:'maxHpChanged',tick:ctx.tick,unitId:u.id,source:asSource(m.source),beforeMax,afterMax,beforeHp,afterHp:u.hp,countsAsHeal:false});
 }
}

export function recordG23Conquest(ctx:AbilityContext,id:string,contributors:readonly string[]):void{
 const victim=ctx.units.find(u=>u.id===id);if(!victim||victim.anomalySummon||victim.definitionId.startsWith('g23-'))return;
 for(const u of ctx.units.filter(u=>contributors.includes(u.id)&&u.sources?.some(s=>s.source.sourceDefinitionId==='conqueror'))){
  const ids=g23State(u).conquestTakedowns;if(!ids.includes(id))ids.push(id);
 }
}
