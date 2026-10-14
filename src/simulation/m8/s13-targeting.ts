import type { Board } from '../board';
import type { CombatUnit } from '../combat-types';
import type { TargetEnvironment, TargetUnit } from './targeting';
import { effectiveStatuses, isEffective } from './status';
/** Always projects the supplied board and live unit state; opening rosters have no role here. */
export function targetUnit(unit:CombatUnit,tick:number):TargetUnit{
  return{id:unit.id,team:unit.team,cell:unit.cell,hp:unit.hp,maxHp:unit.maxHp,alive:unit.alive,
    untargetable:effectiveStatuses(unit.mechanismState?.statuses??[],tick).some(g=>g.kind==='untargetable'),
    burnSources:(unit.mechanismState?.statuses??[]).filter(g=>g.kind==='burn').flatMap(g=>g.contributions.filter(c=>isEffective(c,tick)).map(c=>c.source))};
}
export function targetingEnvironment(board:Board,units:readonly CombatUnit[],holder:CombatUnit,tick:number,patch:Partial<TargetEnvironment>={}):TargetEnvironment{
  return{board,units:units.map(u=>targetUnit(u,tick)),holderId:holder.id,primaryId:holder.targetId,tick,...patch};
}
