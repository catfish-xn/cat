import { expect } from 'vitest';
import { createMatch, nextRound, startMatchCombat, type MatchEvent, type MatchState } from '../../src/simulation/match';
import type { LedgerCombatEvent } from '../../src/simulation/combat-types';
import type { BattleHistory } from '../../src/replay/history';
import { accepted, emptyBoard, resolveM5Choices } from '../match-helpers';

/** Observe committed public commands, preserving the recorder's independent replay inputs. */
export function recordCommand<T extends { state: MatchState; events?: readonly MatchEvent[]; ok?: boolean }>(history: BattleHistory, before: MatchState, result: T): T {
  if (result.ok === false) return result;
  history.observe({ before, after: result.state,
    events: (result.events ?? []).filter((event): event is LedgerCombatEvent => event.domain === 'combat'),
    reason: before.phase === 'combat' ? 'tick' : 'command' });
  return result;
}

/** Early empty-board route, including its genuine instant terminal battles. */
export function recordedEmptyRoute(seed: number, roundId: string, history: BattleHistory): MatchState {
  let state = createMatch(seed);
  while (state.roundDefinitionId !== roundId) {
    state = emptyBoard(resolveM5Choices(state));
    state = accepted(recordCommand(history, state, startMatchCombat(state)));
    expect(state.phase).not.toBe('combat');
    state = accepted(nextRound(resolveM5Choices(state), state.round));
  }
  return state;
}
