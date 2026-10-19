import type { Board } from '../board';
import { isPresent, isSelectable } from '../anomalies/availability';
import type { CombatUnit } from '../combat-types';
import type { TargetEnvironment, TargetUnit } from './targeting';
import { isEffective } from './status';
import { isG23NonCombatant, isG23Summon } from '../g2-3-summons';
/** Always projects the supplied board and live unit state; opening rosters have no role here. */
export function targetUnit(unit:CombatUnit,tick:number):TargetUnit{
  return{id:unit.id,team:unit.team,cell:unit.cell,hp:unit.hp,maxHp:unit.maxHp,alive:isPresent(unit,tick),
    untargetable:!isSelectable(unit,tick),
    burnSources:(unit.mechanismState?.statuses??[]).filter(g=>g.kind==='burn').flatMap(g=>g.contributions.filter(c=>isEffective(c,tick)).map(c=>c.source)),
    ...(isG23Summon(unit)||isG23NonCombatant(unit)?{summon:true}:{})};
}
export function targetingEnvironment(board:Board,units:readonly CombatUnit[],holder:CombatUnit,tick:number,patch:Partial<TargetEnvironment>={}):TargetEnvironment{
  return{board,units:units.map(u=>targetUnit(u,tick)),holderId:holder.id,primaryId:holder.targetId,tick,...patch};
}
