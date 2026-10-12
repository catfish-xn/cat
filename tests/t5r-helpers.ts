import { createMatch, startMatchCombat, stepMatch, claimOrDiscardLoot, enableMultiplayerSettlement,
  applyRoundSettlement, ROUND_SETTLEMENT_VERSION, type MatchState, type MultiplayerCommandResult,
  type BattleResult, type SideProposal } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';
export const accepted = (result: MultiplayerCommandResult) => {
  if (!result.ok) throw new Error(result.reason); return result.state;
};
/** Late-game transaction fixture: a real opening record, then synthetic contiguous settled history.
 * Isolates advancement from 37 battles; deliberately not an offline restorable save. */
export function finalSettlement(base?: MatchState): MatchState {
  let state = accepted(enableMultiplayerSettlement(createMatch(5), 'A'));
  state = accepted(startMatchCombat(state));
  while (state.phase === 'combat') state = stepMatch(state).state;
  state = accepted(claimOrDiscardLoot(state, state.round));
  const record = state.roundResults[0], round = getCatalogRoundById('6-7');
  const source = base ?? state;
  return { ...source, round: round.ordinal, roundDefinitionId: round.roundId,
    phase: 'settlement', combat: null, pendingChoice: null, combatInputBasis: null,
    gold: 19, level: 8, xp: 0, playerHp: 100, streak: {kind:null,count:0},
    m8: {...source.m8, round, loot:prepareMatchLoot(source.seed, round.ordinal),
      preparation:{...source.m8.preparation,roundId:round.roundId,encounterId:null,enemies:[]}},
    preparation:{...source.preparation,units:source.preparation.units.filter(u=>u.team==='player')},
    roundResults:Array.from({length:round.ordinal},(_,i)=>({...record,round:i+1})) };
}
export function settle(state: MatchState, battle: BattleResult, proposal: SideProposal) {
  return accepted(applyRoundSettlement(state, {version:ROUND_SETTLEMENT_VERSION,
    settlementId:`${battle.battleId}:${proposal.seatId}`,battleId:battle.battleId,seatId:proposal.seatId,
    round:state.round,roundId:state.roundDefinitionId,settlementEligible:proposal.settlementEligible,
    result:proposal.result,damage:proposal.damage,baseDamage:proposal.baseDamage,
    opposingSurvivors:proposal.opposingSurvivors,growth:proposal.growth,
    combatTicks:battle.terminal.tick,combatEventCount:battle.events.length}));
}
