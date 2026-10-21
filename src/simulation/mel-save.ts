import type { MatchState, MatchEvent } from './match-types';
import type { G23BattleFacts } from './g2-3-economy';
import { readG23Progress, writeG23Progress } from './g2-3-state';

/** Account-scoped passive; the current PvP cast count is included before lethal settlement. PVE and mirrors never qualify. */
export function melCanSave(state:MatchState,facts:G23BattleFacts|undefined,hpAfter:number):boolean {
  const p=readG23Progress(state);
  return hpAfter===0&&state.playerHp>0&&facts?.roundKind==='pvp'&&!p?.mel?.savedBattleId&&(p?.mel?.pvpCasts??0)+(facts.melCasts??0)>=12;
}
export function commitMelSave(state:MatchState,battleId:string,events:MatchEvent[]):MatchState {
  const p=readG23Progress(state);
  if(!p?.mel||p.mel.pvpCasts<12||p.mel.savedBattleId)throw new RangeError('Invalid Mel player save');
  events.push({type:'playerSaved',battleId,playerHp:1,source:'mel'});
  return writeG23Progress(state,{...p,mel:{...p.mel,savedBattleId:battleId},economyReceipts:[...p.economyReceipts,{kind:'mel-save',battleId,round:state.round}]});
}
