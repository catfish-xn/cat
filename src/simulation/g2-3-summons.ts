import type { GameState } from './game';
import type { Unit } from './unit-types';
import { UNIT_DEFINITIONS } from './units';
import { sameCell, contains, type Board, type HexCell, type Team } from './board';
export const isG23Summon=(unit:{readonly definitionId:string})=>unit.definitionId==='g23-sion'||unit.definitionId==='g23-forge';
/** Forge and the reserved barrel identity are skill bodies, never an army's last fighter. */
export const isG23NonCombatant=(unit:{readonly definitionId:string})=>unit.definitionId==='g23-forge'||unit.definitionId==='g23-barrel';
/** 约定值: only surviving roster units add player damage; combat summons never add it. */
export const countsG23SurvivorDamage=(unit:{readonly definitionId:string;readonly alive:boolean;readonly itemSummon?:unknown;readonly anomalySummon?:unknown})=>unit.alive&&!unit.itemSummon&&!unit.anomalySummon&&!isG23Summon(unit)&&!isG23NonCombatant(unit);
/** Reserved combat-only identities never enter assets, the shop or the shared pool. */
export function projectG23Summons(preparation:GameState):GameState{
 const units=[...preparation.units],added:Unit[]=[];
 for(const team of ['player','enemy'] as const){
  const army=preparation.units.filter(u=>u.team===team&&u.location.kind==='board'&&!isG23Summon(u)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const roses=army.filter(u=>UNIT_DEFINITIONS[u.definitionId].traits.includes('black-rose'));
  const requests=[...(new Set(roses.map(u=>u.definitionId)).size>=3?[{id:roses[0].id+':g23-sion',definitionId:'g23-sion',row:4,col:3}]:[]),...army.filter(u=>u.definitionId==='jayce').map(u=>({id:u.id+':g23-forge',definitionId:'g23-forge',row:u.location.kind==='board'?Math.min(7,(team==='player'?u.location.cell.row:7-u.location.cell.row)+1):7,col:u.location.kind==='board'?u.location.cell.col:3}))];
  for(const request of requests){
   if(units.some(u=>u.id===request.id)||added.some(u=>u.id===request.id))continue;
   const preferred={col:request.col,row:team==='player'?request.row:7-request.row};
   const cells=[preferred,...[4,5,6,7].flatMap(row=>Array.from({length:7},(_,col)=>({col,row:team==='player'?row:7-row})))];
   const cell=cells.find(c=>!units.concat(added).some(u=>u.location.kind==='board'&&sameCell(u.location.cell,c)));
   if(!cell)continue;
   added.push({id:request.id,definitionId:request.definitionId,team,starLevel:1,location:{kind:'board',cell}});
  }
 }
 return added.length?{...preparation,units:[...units,...added]}:preparation;
}
export function g23SionTeam(preparation:GameState,team:Team){
 const roses=preparation.units.filter(u=>u.team===team&&u.location.kind==='board'&&UNIT_DEFINITIONS[u.definitionId].traits.includes('black-rose'));
 const count=new Set(roses.map(u=>u.definitionId)).size;
 return {tier:count>=7?7:count>=5?5:count>=4?4:count>=3?3:0,stars:roses.reduce((n,u)=>n+u.starLevel,0)};
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
