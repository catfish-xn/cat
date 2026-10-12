import type { ClientCommand } from '../../server/protocol';
import { sameCell, type HexCell } from '../board';
import { getDeploymentCap } from '../match';
import type { MatchState } from '../match-types';
import { UNIT_DEFINITIONS } from '../units';
import type { Unit } from '../unit-types';
import { getUnitSellPrice } from '../unit-stats';
import { legal } from './preflight';

export const byId = (a: {readonly id:string}, b: {readonly id:string}) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const strength = (unit: Unit) => unit.starLevel * 100 + UNIT_DEFINITIONS[unit.definitionId].cost * 10;
export const strongest = (a: Unit, b: Unit) => strength(b) - strength(a) || byId(a,b);
export const cheapest = (a: Unit, b: Unit) => getUnitSellPrice(a) - getUnitSellPrice(b) || byId(a,b);

/** Fixed target assignment prevents repeated calls from moving a unit back and forth. */
export function formationAction(state: MatchState, roster: readonly Unit[]): ClientCommand | undefined {
  const selected = [...roster].sort(strongest).slice(0, getDeploymentCap(state));
  const selectedIds = new Set(selected.map(u=>u.id));
  const excess = roster.filter(u=>u.location.kind==='board' && !selectedIds.has(u.id)).sort(cheapest);
  const freeBench = Array.from({length:state.preparation.benchSize},(_,slot)=>slot)
    .find(slot=>!roster.some(u=>u.location.kind==='bench' && u.location.slot===slot));
  if (excess.length) {
    if (freeBench !== undefined) {
      const action: ClientCommand = {type:'deploy',unitId:excess[0].id,target:{kind:'bench',slot:freeBench}};
      if (legal(state,action)) return action;
    } else {
      // Make one slot for a stronger reserve; never sell a selected unit to rearrange it.
      for (const unit of roster.filter(u=>!selectedIds.has(u.id)).sort(cheapest)) {
        const action: ClientCommand = {type:'sell',unitId:unit.id};
        if (legal(state,action)) return action;
      }
    }
    return undefined;
  }
  const board=state.preparation.board, zone=board.deploymentZones.player;
  const cells: HexCell[]=[];
  for(let row=zone.firstRow;row<=zone.lastRow;row++)
    for(let col=0;col<board.columns;col++) cells.push({col,row});
  const assigned=new Set<string>(), key=(cell:HexCell)=>`${cell.row}:${cell.col}`;
  const targets=selected.map(unit=>{
    const melee=UNIT_DEFINITIONS[unit.definitionId].attackRange<=1;
    const cell=[...cells].sort((a,b)=>(melee?a.row-b.row:b.row-a.row)
      || Math.abs(2*a.col-board.columns+1)-Math.abs(2*b.col-board.columns+1) || a.col-b.col)
      .find(cell=>!assigned.has(key(cell)))!;
    assigned.add(key(cell)); return {unit,cell};
  });
  const unsettled=targets.filter(({unit,cell})=>unit.location.kind!=='board'||!sameCell(unit.location.cell,cell));
  for(const {unit,cell} of unsettled) {
    const action:ClientCommand={type:'deploy',unitId:unit.id,target:{kind:'board',cell}};
    if(legal(state,action)) return action;
  }
  // Break an occupied-target cycle using an empty non-target board cell, then settle normally.
  for(const {unit} of unsettled.filter(t=>t.unit.location.kind==='board')) {
    for(const cell of cells.filter(cell=>!assigned.has(key(cell)))) {
      const action:ClientCommand={type:'deploy',unitId:unit.id,target:{kind:'board',cell}};
      if(legal(state,action)) return action;
    }
  }
  return undefined;
}
