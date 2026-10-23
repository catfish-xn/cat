import { getNeighbors, sameCell } from './board';
import { CRAB_MOVE_TICKS, GIANT_CRAB_FIRST_JUMP_TICKS, GIANT_CRAB_JUMP_INTERVAL_TICKS, giantCrabDamage } from './content/opening-batch-b';
import { origin, type S13Unit } from './combat-s13-state';
import type { AbilityContext } from './combat-s13-abilities';
export const isOpeningCrab=(u:{definitionId:string})=>u.definitionId.startsWith('pve-scuttle-')||u.definitionId==='pve-giant-crab';
export function crabMove(ctx:AbilityContext,unit:S13Unit,occupied:Set<string>){
 if(unit.definitionId==='pve-giant-crab'||ctx.tick%CRAB_MOVE_TICKS!==0)return undefined;
 // Clockwise neighbor order, starting at a period-dependent direction; no RNG.
 const cells=getNeighbors(ctx.board,unit.cell),offset=Math.floor(ctx.tick/CRAB_MOVE_TICKS)%cells.length;
 return [...cells.slice(offset),...cells.slice(0,offset)].find(c=>!occupied.has(`${c.col},${c.row}`)&&!ctx.units.some(u=>u.alive&&sameCell(u.cell,c)));
}
export function crabJump(ctx:AbilityContext,unit:S13Unit,seq:()=>number):void {
 if(unit.definitionId!=='pve-giant-crab'||ctx.tick<GIANT_CRAB_FIRST_JUMP_TICKS||(ctx.tick-GIANT_CRAB_FIRST_JUMP_TICKS)%GIANT_CRAB_JUMP_INTERVAL_TICKS)return;
 const jump=++unit.runtime.castCount,actionSeq=seq();
 ctx.units.filter(u=>u.team!==unit.team&&u.alive).forEach((u,ordinal)=>ctx.packets.push({source:origin(unit),targetId:u.id,raw:giantCrabDamage(jump),damageType:'magic',actionSeq,ordinal,delivery:'ability-direct',critEligibility:'never',area:true,triggeringCastActionSeq:null}));
}
