import { expect } from 'vitest';
import { createMatch, deployMatchUnit, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState } from '../src/simulation/match';

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
  let state = createMatch();
  for (const [index, id] of ['unit-1', 'unit-2', 'unit-3'].entries()) {
    state = accepted(deployMatchUnit(state, id, { kind: 'board', cell: { col: 1 + index * 2, row: 4 } }));
  }
  return state;
}
export function finish(input: MatchState): MatchState {
  let state = input;
  for (let i = 0; i < 1201 && state.phase === 'combat'; i++) state = stepMatch(state).state;
  expect(['settlement', 'gameOver']).toContain(state.phase);
  return state;
}
export function battle(): MatchState { return accepted(startMatchCombat(deployed())); }
