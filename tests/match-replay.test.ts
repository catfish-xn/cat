import { describe, expect, it } from 'vitest';
import { buyUnit, createMatch, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat, stepMatch, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import type { CombatEvent } from '../src/simulation/combat';
import { accepted, freeze } from './match-helpers';

/** A serializable user-command log; tick is logical time, never a wall clock. */
type Command = { type: 'buy'; slot: number; generation: number } | { type: 'sell'; id: string }
  | { type: 'deploy'; id: string; col: number; row: number } | { type: 'reroll' | 'start' }
  | { type: 'continue'; round: number };
function dispatch(state: MatchState, command: Command): MatchCommandResult {
  switch (command.type) {
    case 'buy': return buyUnit(state, command.slot, command.generation);
    case 'sell': return sellUnit(state, command.id);
    case 'deploy': return deployMatchUnit(state, command.id, { kind: 'board', cell: { col: command.col, row: command.row } });
    case 'reroll': return rerollShop(state);
    case 'start': return startMatchCombat(state);
    case 'continue': return nextRound(state, command.round);
  }
}
const opening: Command[] = [
  { type: 'buy', slot: 0, generation: 1 }, { type: 'buy', slot: 1, generation: 1 },
  // Full bench before buying another available slot, and insufficient money after two rerolls.
  { type: 'reroll' }, { type: 'reroll' },
  { type: 'sell', id: 'unit-6' },
  { type: 'deploy', id: 'unit-1', col: 0, row: 4 }, { type: 'sell', id: 'unit-1' },
  { type: 'deploy', id: 'unit-7', col: 1, row: 4 },
  { type: 'deploy', id: 'unit-2', col: 3, row: 4 }, { type: 'deploy', id: 'unit-3', col: 5, row: 4 },
];

function replay(options: { injectFailures?: boolean; serialize?: boolean } = {}) {
  let state = createMatch(42), buys = 0, sells = 0, rerolls = 0, settlements = 0;
  const states: MatchState[] = [state], events: CombatEvent[] = [], errors: string[] = [];
  function checkRejected(result: MatchCommandResult) {
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    if (!result.ok) errors.push(result.reason);
  }
  function checkpoint() {
    expect(state.gold).toBe(10 - 3 * buys + 2 * sells - 2 * rerolls + 5 * settlements);
    states.push(structuredClone(state));
    if (options.serialize) state = JSON.parse(JSON.stringify(state)) as MatchState;
    if (!options.injectFailures) return;
    const before = structuredClone(state);
    freeze(state);
    checkRejected(sellUnit(state, 'missing'));
    checkRejected(buyUnit(state, -1, state.shop.generation));
    if (state.phase !== 'preparation') {
      checkRejected(buyUnit(state, 0, state.shop.generation));
      checkRejected(rerollShop(state));
      checkRejected(sellUnit(state, 'unit-7'));
      checkRejected(startMatchCombat(state));
    } else {
      checkRejected(nextRound(state, state.round));
      if (state.gold < 2) checkRejected(rerollShop(state));
      if (state.gold < 3) checkRejected(buyUnit(state, 4, state.shop.generation));
      const benchFull = state.preparation.units.filter(unit => unit.location.kind === 'bench').length === 7;
      if (benchFull && state.gold >= 3) checkRejected(buyUnit(state, 4, state.shop.generation));
    }
    expect(state).toEqual(before);
  }
  function command(command: Command) {
    state = accepted(dispatch(state, command));
    if (command.type === 'buy') buys++;
    if (command.type === 'sell') sells++;
    if (command.type === 'reroll') rerolls++;
    checkpoint();
  }
  for (const item of JSON.parse(JSON.stringify(opening)) as Command[]) command(item);
  for (let round = 1; round <= 5; round++) {
    command({ type: 'start' });
    while (state.phase === 'combat') {
      const next = stepMatch(freeze(state));
      state = next.state;
      events.push(...next.events);
      if (state.phase === 'settlement') settlements++;
      checkpoint();
    }
    expect(state.roundResults).toHaveLength(round);
    for (let i = 0; i < 3; i++) expect(stepMatch(state)).toEqual({ state, events: [] });
    command({ type: 'continue', round });
    if (round < 5) command({ type: 'deploy', id: 'unit-7', col: round % 2 === 1 ? 0 : 1, row: round % 2 === 1 ? 7 : 4 });
  }
  expect(state.round).toBe(6);
  expect(state.gold).toBe(29);
  expect(state.roundResults.map(record => record.round)).toEqual([1, 2, 3, 4, 5]);
  return { state, states, events, errors };
}

describe('five-round deterministic integration replay', () => {
  it('replays every state, shop, result and event from identical seed and commands', () => {
    expect(replay()).toEqual(replay());
  });
  it('inserting rejected commands leaves the complete successful trajectory unchanged', () => {
    const normal = replay(), rejected = replay({ injectFailures: true });
    expect(rejected.errors).toEqual(expect.arrayContaining(['bench-full', 'insufficient-gold', 'wrong-phase', 'unknown-unit', 'invalid-slot']));
    expect({ ...rejected, errors: [] }).toEqual(normal);
  });
  it('restores from JSON in every preparation, combat and settlement step with no hidden state', () => {
    expect(replay({ serialize: true })).toEqual(replay());
  });
});
