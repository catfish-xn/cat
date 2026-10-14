import { createMatch, enableMultiplayerSettlement, startMatchCombat, type MatchState,
  type MatchCommandResult, type MultiplayerCommandResult } from '../src/server-entry';
import type { Unit, UnitLocation } from '../src/simulation/units';
export const bench = (slot: number): UnitLocation => ({kind:'bench',slot});
export const board = (col: number, row = 4): UnitLocation => ({kind:'board',cell:{col,row}});
export const hero = (id: string, location: UnitLocation, definitionId = 'maddie', starLevel: 1|2|3 = 1): Unit =>
  ({id,location,definitionId,starLevel,team:'player'});
export function accepted(result: MatchCommandResult | MultiplayerCommandResult): MatchState {
  if (!result.ok) throw new Error(result.reason); return result.state;
}
export function prepared(): MatchState {
  const base = accepted(enableMultiplayerSettlement(createMatch(5),'A'));
  return {...base,gold:100,level:3,xp:0,nextUnitSerial:10,nextItemSerial:3,
    items:[{id:'item-1',definitionId:'sword',location:{kind:'inventory'}},{id:'item-2',definitionId:'bow',location:{kind:'inventory'}}],
    preparation:{...base.preparation,units:[...base.preparation.units,hero('unit-2',bench(0)),hero('unit-3',bench(2),'tristana')]}};
}
/** Phase guard vectors reuse a real frozen PvE battle; choice/settlement fixtures are not offline saves. */
export function operating(phase: 'combat'|'choice'|'settlement'): MatchState {
  const state = accepted(startMatchCombat(prepared()));
  return phase === 'combat' ? state : {...state,phase,combat:null} as MatchState;
}
