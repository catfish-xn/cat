import { readyMatch } from '../match-helpers';
import { deployMatchUnit,startMatchCombat } from '../../src/simulation/match';
import type { MatchState } from '../../src/simulation/match-types';
export function itemMatch(id:string|readonly string[],unitId='unit-1'):MatchState {
 let s=readyMatch();s={...s,items:[...s.items,...(typeof id==='string'?[id]:id).map((id,index)=>({id:`item-${s.nextItemSerial+index}`,definitionId:id,location:{kind:'unit' as const,unitId,slot:index}}))],nextItemSerial:s.nextItemSerial+(typeof id==='string'?1:id.length)};
 const d=deployMatchUnit(s,unitId,{kind:'board',cell:{col:unitId==='unit-1'?1:5,row:4}});if(!d.ok)throw new Error(d.reason);
 const r=startMatchCombat(d.state);if(!r.ok)throw new Error(r.reason);return r.state;
}
