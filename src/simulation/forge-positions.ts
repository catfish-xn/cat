import type {MatchState} from './match-types';
import {readSeatMechanic,writeSeatMechanic} from './seat-mechanics/state';
/**
 * Drops the saved Hextech Forge cell (g24ItemPositions `unit-N`, keyed by its Jayce) of a Jayce this seat no longer owns:
 * sold, or consumed by a star-up. A Jayce held aside by D14 still owns its cell. Voidspawn keys (`item-N`) belong to
 * item instances and are left alone. Called where unit removals settle (match commands, mechanic grants, round settlement).
 */
export function pruneForgePositions(state:MatchState):MatchState {
 const positions=readSeatMechanic<Record<string,{col:number;row:number}>>(state,'g24ItemPositions');
 if(!positions)return state;
 const owned=new Set([...state.preparation.units,...state.d14?.held?[state.d14.held.unit]:[]].map(u=>u.id));
 const kept=Object.entries(positions).filter(([id])=>!id.startsWith('unit-')||owned.has(id));
 if(kept.length===Object.keys(positions).length)return state;
 return writeSeatMechanic(state,'g24ItemPositions',kept.length?Object.fromEntries(kept.map(([id,c])=>[id,{col:c.col,row:c.row}])):undefined);
}
