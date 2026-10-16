import type {AbilityContext} from './combat-s13-abilities';
import {amount,byDistance,enemies,origin,type S13Unit} from './combat-s13-state';
import {hexDistance} from './board';
import {G23_POLICY} from './content/g2-3-policy';
export function advanceG23Junker(ctx:AbilityContext,nextSeq:()=>number):void{
 for(const u of ctx.units.filter(u=>u.alive&&u.hp>0)){
 const m=u.mechanics?.find(m=>m.mechanic==='g23Junker');if(!m)continue;
 const packet=(target:S13Unit,raw:number,damageType:'magic'|'true',seq:number,ordinal=0)=>ctx.packets.push({source:m.source,targetId:target.id,raw,damageType,actionSeq:seq,ordinal,delivery:'equipment-proc',critEligibility:'never',area:false,triggeringCastActionSeq:null});
 if(m.values.flame&&ctx.tick%20===0){const seq=nextSeq();for(const t of enemies(u,ctx.units).filter(t=>hexDistance(u.cell,t.cell)<=1))packet(t,amount(u,ctx.tick,{ap:[30,45,600][u.starLevel-1]}),'magic',seq);}
 if(m.values.repair&&ctx.tick%60===0)ctx.heals.push({source:m.source,targetId:u.id,amount:Math.floor(u.maxHp*[600,600,2500][u.starLevel-1]/10000)});
 if(m.values.tank&&ctx.tick%60===0){const target=enemies(u,ctx.units).sort((a,b)=>b.armor+b.magicResist-a.armor-a.magicResist||(a.id<b.id?-1:1))[0];if(target)packet(target,amount(u,ctx.tick,{ap:[120,180,1600][u.starLevel-1]}),'true',nextSeq());}
 if(m.values.rod&&ctx.tick%100===0){
  const target=byDistance(u,enemies(u,ctx.units).filter(t=>hexDistance(u.cell,t.cell)<=4)).reverse()[0];
  if(target){const total=amount(u,ctx.tick,{ap:[350,525,6000][u.starLevel-1]}),seq=nextSeq();
   for(let i=0;i<15;i++)u.tasks.push({key:JSON.stringify([u.id,'junker-rod',seq,i]),kind:'g23Magic',source:origin(u),executeAtTick:ctx.tick+20*(i+1),targetId:target.id,amount:Math.floor(total/15)+(i<total%15?1:0),actionSeq:seq,ordinal:i,total:15,cancellable:false});
  }
 }
 }
}
/** Appended to this tick's damage queue before elimination, even when Rumble is the last ally. */
export function g23RumbleDeath(ctx:AbilityContext,u:S13Unit,seq:number,resists:number):void{
 const m=u.mechanics?.find(m=>m.mechanic==='g23Junker'&&m.values.death);if(!m)return;
 const raw=Math.floor(resists*G23_POLICY.rumble.selfDestructResistBps[u.starLevel-1]/10000);
 for(const [ordinal,t] of enemies(u,ctx.units).filter(t=>hexDistance(u.cell,t.cell)<=2).entries())ctx.packets.push({source:m.source,targetId:t.id,raw,damageType:'magic',actionSeq:seq,ordinal:20000+ordinal,delivery:'equipment-proc',critEligibility:'never',area:true,triggeringCastActionSeq:null});
}
