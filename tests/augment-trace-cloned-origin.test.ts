import { expect, it } from 'vitest';
import { nextRound, selectChoice, startMatchCombat, stepMatch, createMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, resolveM5Choices } from './match-helpers';

/** A solo state the engine did not hand out (a structuredClone, as fixture caches return) has no live command trace.
 * When a history-proof augment is then acquired, the live acquire fact and restore's replay of the same origin must agree
 * on previousBattle: both derive it from the origin's finished combat. Before the fix the live fact said 'unavailable'
 * while the replay recorded the 1-4 battle, so restore rejected the legal save ("replayed facts/state mismatch"). */
it('a cloned settled solo state keeps the same previousBattle fact live and on replay', () => {
  let state: MatchState = createMatch(42);
  while (state.roundDefinitionId !== '1-4') {
    state = resolveM5Choices(state);
    state = accepted(startMatchCombat(emptyBoard(state)));
    while (state.phase === 'combat') state = stepMatch(state).state;
    state = resolveM5Choices(state);
    state = accepted(nextRound(state, state.round));
  }
  state = resolveM5Choices(state);
  state = accepted(startMatchCombat(emptyBoard(state)));
  while (state.phase === 'combat') state = stepMatch(state).state;
  state = resolveM5Choices(state);
  expect(state.phase).toBe('settlement');
  expect(state.combat?.status).toBe('finished');
  // The clone carries no live trace; everything after it is public commands.
  let cloned = accepted(nextRound(structuredClone(state), state.round));
  const choice = cloned.pendingChoice!;
  expect(choice.kind).toBe('augment');
  expect(choice.offers).toContain('snipers-nest');
  cloned = accepted(selectChoice(cloned, choice.choiceId, choice.generation, 'snipers-nest'));
  const acquire = cloned.augmentHistory!.facts.find(f => f.kind === 'acquire');
  expect(acquire).toMatchObject({ kind: 'acquire', definitionId: 'snipers-nest', previousBattle: { status: 'recorded', roundId: '1-4' } });
  for (const input of [serializeMatch(cloned), JSON.parse(serializeMatch(cloned))]) expect(restoreMatch(input)).toEqual(cloned);
});
