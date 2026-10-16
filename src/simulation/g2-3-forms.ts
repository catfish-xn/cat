import { G23_UNITS } from './content/g2-3-units';
import { getUnitStats,resolveUnitStats } from './unit-stats';
import type { StarLevel } from './unit-types';
import type { Team } from './board';
import { startingRows } from './m8/targeting';
/** Forms are frozen at combat entry, while acquisition/upgrade identity stays canonical. */
export function g23FormDefinitionId(id:string,team:Team,row:number):string {
  return Object.hasOwn(G23_UNITS,id+'-ranged')&&startingRows(team,row)==='back-two'?id+'-ranged':id;
}
export function g23FormStats(id:string,star:StarLevel,team:Team,row:number){
  const form=g23FormDefinitionId(id,team,row);return form===id?getUnitStats(id,star):resolveUnitStats(G23_UNITS[form],star);
}
