import type { AbilityContext } from './combat-s13-abilities';
import { amount, applyStatus, enemies, grantShield, origin, type S13Unit } from './combat-s13-state';
import { hexDistance } from './board';
import { UNIT_DEFINITIONS } from './units';
/** Binding is an activity gate, not invulnerability: opponents can break the chains by damage. */
export function g23Bound(u:S13Unit):boolean{return u.definitionId==='g23-sion'&&!u.runtime.buddyTriggered;}
export function advanceG23Summons(ctx:AbilityContext):void{
 for(const u of ctx.units.filter(u=>u.alive&&u.hp>0&&g23Bound(u))){
  const casts=ctx.units.filter(a=>a.team===u.team&&UNIT_DEFINITIONS[a.definitionId]?.traits.includes('black-rose')).reduce((n,a)=>n+a.runtime.castCount,0);
  if(casts<5&&u.hp*10000>=u.maxHp*6500)continue;
  u.runtime.buddyTriggered=true;
  const tier=u.mechanics?.find(m=>m.mechanic==='g23Sion')?.values.tier??3;
  if(tier>=5)ctx.heals.push({source:origin(u),targetId:u.id,amount:u.maxHp-u.hp});
  grantShield(u,origin(u),amount(u,ctx.tick,{ap:tier>=5?75:175}),ctx.tick+(tier>=5?60:100),ctx.tick,ctx.events);
  for(const foe of enemies(u,ctx.units).filter(e=>hexDistance(u.cell,e.cell)<=1))applyStatus(foe,origin(u),'stun',0,tier>=5?20:30,ctx.tick,ctx.events);
 }
}
/** A dead forge returns on Jayce's cast. Occupied corpses relocate to the first free hex. */
export function reviveG23Forge(ctx:AbilityContext,jayce:S13Unit):S13Unit|undefined{
 const forge=ctx.units.find(u=>u.id===jayce.id+':g23-forge');if(!forge)return;
 if(!forge.alive){
  const occupied=(col:number,row:number)=>ctx.units.some(u=>u.alive&&u.cell.col===col&&u.cell.row===row);
  if(occupied(forge.cell.col,forge.cell.row)){
   const cells=Array.from({length:ctx.board.rows},(_,localRow)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row:jayce.team==='player'?localRow:ctx.board.rows-1-localRow}))).flat();
   const cell=cells.find(c=>!occupied(c.col,c.row));if(!cell)return;
   ctx.events.push({type:'movement',tick:ctx.tick,unitId:forge.id,from:forge.cell,to:cell});forge.cell=cell;
  }
  forge.alive=true;forge.hp=forge.maxHp;
  ctx.events.push({type:'unitRevived',tick:ctx.tick,unitId:forge.id,source:origin(jayce),hp:forge.hp});
 }
 return forge;
}
