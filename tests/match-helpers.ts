import { expect } from 'vitest';
import { createMatch, selectChoice, selectAnomalyTarget, deployMatchUnit, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState } from '../src/simulation/match';

export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function accepted(result: MatchCommandResult): MatchState {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
export function deployed(): MatchState {
  let state = readyMatch();
  for (const [index, id] of ['unit-1', 'unit-2', 'unit-3'].entries()) {
    state = accepted(deployMatchUnit(state, id, { kind: 'board', cell: { col: 1 + index * 2, row: 4 } }));
  }
  return state;
}
export function finish(input: MatchState): MatchState {
  let state = input;
  for (let i = 0; i < 1201 && state.phase === 'combat'; i++) state = stepMatch(state).state;
  expect(['settlement', 'gameOver', 'choice']).toContain(state.phase);
  if (state.phase === 'choice') expect(state.pendingChoice?.returnPhase).toBe('settlement');
  return state;
}
export function battle(): MatchState { return accepted(startMatchCombat(deployed())); }

/** Completes only publicly offered opening/round choices, without injecting any resource. */
export function resolveM5Choices(initial: MatchState): MatchState {
  let state = initial;
  while (state.phase === 'choice') {
    const c = state.pendingChoice!;
    state = accepted(c.step === 'target' ? selectAnomalyTarget(state,c.choiceId,c.generation,state.preparation.units.find(u=>u.team==='player')!.id)
      : selectChoice(state,c.choiceId,c.generation,c.kind === 'augment' ? c.offers.find(id=>id !== 'placebo' && id !== 'glass-cannon-i')! : c.offers[0]));
  }
  return state;
}
export function readyMatch(seed = 42): MatchState { return resolveM5Choices(createMatch(seed)); }
export function emptyBoard(initial = readyMatch()): MatchState {
  let state = initial;
  for (const [slot,unit] of state.preparation.units.filter(u=>u.team==='player').entries()) state=accepted(deployMatchUnit(state,unit.id,{kind:'bench',slot}));
  return state;
}
