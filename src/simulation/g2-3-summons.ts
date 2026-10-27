import type { GameState } from './game';
import type { Unit } from './unit-types';
import {deriveEffectiveTrait,projectEffectiveMembership} from './traits/effective-membership';
import type { TraitSnapshot } from './strategy-types';
import { sameCell, contains, type Board, type HexCell, type Team } from './board';
import { nearestItemCell } from './g2-4b-item-kernel';
import { compareUnitIds } from './unit-id-order';
export const isG23Summon=(unit:{readonly definitionId:string})=>unit.definitionId==='g23-sion'||unit.definitionId==='g23-forge';
/** Forge and the reserved barrel identity are skill bodies, never an army's last fighter. */
export const isG23NonCombatant=(unit:{readonly definitionId:string})=>unit.definitionId==='g23-forge'||unit.definitionId==='g23-barrel'||unit.definitionId==='v20-silco-minion';
/** 约定值: only surviving roster units add player damage; combat summons never add it. */
export const countsG23SurvivorDamage=(unit:{readonly definitionId:string;readonly alive:boolean;readonly itemSummon?:unknown;readonly anomalySummon?:unknown})=>unit.alive&&unit.definitionId!=='b5-voidling'&&unit.definitionId!=='trainer-golem'&&!unit.itemSummon&&!unit.anomalySummon&&!isG23Summon(unit)&&!isG23NonCombatant(unit);
/** Placed forge id of a Jayce (one forge per Jayce; the forge's own definition is `g23-forge`). */
export const g23ForgeId=(jayceId:string)=>jayceId+':g23-forge';
/** Reserved combat-only identities never enter assets, the shop or the shared pool.
 * `forgeCells` (P, user 2026-10-24): a player-placed forge cell per Jayce id, in that team's own preparation rows
 * (mirrored for 'enemy' like the defaults). A placed forge is laid out before every other summon and takes the free
 * cell nearest its saved one; without a saved cell the forge keeps the default placement behind its Jayce. */
export function projectG23Summons(preparation:GameState,traits?:readonly TraitSnapshot[],forgeCells?:Readonly<Record<string,HexCell>>):GameState{
 const units=[...preparation.units],added:Unit[]=[];
 for(const team of ['player','enemy'] as const){
  const army=preparation.units.filter(u=>u.team===team&&u.location.kind==='board'&&!isG23Summon(u)).sort(compareUnitIds);
  const rose=traits?traits.find(t=>t.team===team&&t.traitId==='black-rose'):deriveEffectiveTrait(projectEffectiveMembership(preparation),team,'black-rose');
  const roses=army.filter(u=>rose?.memberUnitIds?rose.memberUnitIds.includes(u.id):rose?.memberDefinitionIds.includes(u.definitionId));
  const forges=army.filter(u=>u.definitionId==='jayce').map(u=>({id:g23ForgeId(u.id),definitionId:'g23-forge',placed:forgeCells&&Object.hasOwn(forgeCells,u.id)?forgeCells[u.id]:undefined,row:u.location.kind==='board'?Math.min(7,(team==='player'?u.location.cell.row:7-u.location.cell.row)+1):7,col:u.location.kind==='board'?u.location.cell.col:3}));
  const requests=[...forges.filter(f=>f.placed).map(f=>({...f,row:f.placed!.row,col:f.placed!.col})),...((rose?.tier??0)>=3?[{id:roses[0].id+':g23-sion',definitionId:'g23-sion',row:4,col:3,placed:undefined}]:[]),...forges.filter(f=>!f.placed)];
  for(const request of requests){
   if(units.some(u=>u.id===request.id)||added.some(u=>u.id===request.id))continue;
   const preferred={col:request.col,row:team==='player'?request.row:7-request.row};
   const cells=[preferred,...[4,5,6,7].flatMap(row=>Array.from({length:7},(_,col)=>({col,row:team==='player'?row:7-row})))];
   const free=(c:HexCell)=>!units.concat(added).some(u=>u.location.kind==='board'&&sameCell(u.location.cell,c));
   const cell=request.placed?nearestItemCell(preferred,cells.filter(free))??undefined:cells.find(free);
   if(!cell)continue;
   added.push({id:request.id,definitionId:request.definitionId,team,starLevel:1,location:{kind:'board',cell}});
  }
 }
 return added.length?{...preparation,units:[...units,...added]}:preparation;
}
export function g23SionTeam(preparation:GameState,team:Team,traits?:readonly TraitSnapshot[],promotedUnitId?:string){
 const rose=traits?traits.find(t=>t.team===team&&t.traitId==='black-rose'):deriveEffectiveTrait(projectEffectiveMembership(preparation),team,'black-rose');
 const roses=preparation.units.filter(u=>u.team===team&&u.location.kind==='board'&&(rose?.memberUnitIds?rose.memberUnitIds.includes(u.id):rose?.memberDefinitionIds.includes(u.definitionId)));
 return {tier:rose?.tier??0,stars:roses.reduce((n,u)=>n+(u.id===promotedUnitId?4:u.starLevel),0)};
}

/** Skill bodies use owner-relative placement; full boards never overlap or displace units. */
export function g23ForgeCell(owner:{readonly team:Team;readonly cell:HexCell},board:Board,occupied:readonly HexCell[]):HexCell|undefined {
 const localRow=owner.team==='player'?owner.cell.row:board.rows-1-owner.cell.row;
 const row=Math.min(board.rows-1,localRow+1);
 const preferred={col:owner.cell.col,row:owner.team==='player'?row:board.rows-1-row};
 const zone=board.deploymentZones[owner.team];
 const rows=Array.from({length:zone.lastRow-zone.firstRow+1},(_,i)=>owner.team==='player'?zone.firstRow+i:zone.lastRow-i);
 const cells=[preferred,...rows.flatMap(row=>Array.from({length:board.columns},(_,col)=>({col,row})))];
 return cells.find(cell=>contains(board,cell)&&!occupied.some(other=>sameCell(other,cell)));
}
