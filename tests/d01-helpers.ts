import { createMatch, startMatchCombat, stepMatch, nextRound, claimOrDiscardLoot, forfeitPendingChoice } from '../src/simulation/match';
import { applyRoundSettlement, enableMultiplayerSettlement, ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import type { RoundSettlementReceipt, MultiplayerCommandResult } from '../src/simulation/round-settlement';
import type { MatchCommandResult, MatchState } from '../src/simulation/match-types';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { createRoundEnemies } from '../src/simulation/round-enemies';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';

export function accept(result: MatchCommandResult | MultiplayerCommandResult): MatchState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

/** Real opening history, before the first PvP. D1 cannot be selected until D5 registers it. */
export function opening(): MatchState {
  let state = accept(enableMultiplayerSettlement(createMatch(5), 'D1'));
  while (state.roundDefinitionId !== '2-1' || state.phase === 'choice') {
    if (state.phase === 'choice') state = accept(forfeitPendingChoice(state, state.round, state.pendingChoice!.choiceId, state.pendingChoice!.generation));
    else if (state.phase === 'preparation') state = accept(startMatchCombat(state));
    else if (state.phase === 'combat') state = stepMatch(state).state;
    else state = accept(nextRound(accept(claimOrDiscardLoot(state, state.round)), state.round));
  }
  return state;
}

/** Isolated transaction vector, not an untrusted restorable save or an offered-card route. */
export function atRound(state: MatchState, roundId: string): MatchState {
  const round = getCatalogRoundById(roundId), enemies = createRoundEnemies(round.ordinal);
  return { ...state, round: round.ordinal, roundDefinitionId: roundId, phase: 'preparation', combat: null, pendingChoice: null,
    m8: { ...state.m8, round, loot: prepareMatchLoot(state.seed, round.ordinal),
      preparation: { ...state.m8.preparation, roundId, encounterId: round.encounterId, enemies } },
    preparation: { ...state.preparation, units: [...state.preparation.units.filter(u => u.team === 'player'), ...enemies] } };
}

export function receipt(state: MatchState, extra: Partial<RoundSettlementReceipt> = {}): RoundSettlementReceipt {
  return { version: ROUND_SETTLEMENT_VERSION, settlementId: `${state.round}:D1`, battleId: `battle:${state.round}`,
    seatId: state.multiplayer!.seatId, round: state.round, roundId: state.roundDefinitionId, settlementEligible: true,
    result: 'win', damage: 0, damageDealt: 0, baseDamage: 2, opposingSurvivors: 0, growth: [], combatTicks: 88, combatEventCount: 20, ...extra };
}

export const settle = (state: MatchState, extra: Partial<RoundSettlementReceipt> = {}) => accept(applyRoundSettlement(state, receipt(state, extra)));
