import { selectChoice, selectAnomalyTarget, type MatchState } from '../src/simulation/match';
import { accepted } from './match-helpers';
/** Completes actual scheduled choices in old lifecycle regressions; never changes phase directly. */
export function resolveChoices(initial: MatchState): MatchState {
  let state = initial;
  while (state.phase === 'choice') {
    const choice = state.pendingChoice!;
    if (choice.step === 'target') state = accepted(selectAnomalyTarget(state, choice.choiceId, choice.generation,
      state.preparation.units.find(unit => unit.team === 'player')!.id));
    else state = accepted(selectChoice(state, choice.choiceId, choice.generation, choice.offers[0]));
  }
  return state;
}
