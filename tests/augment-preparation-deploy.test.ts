import { expect, it } from 'vitest';
import { buyUnit, deployMatchUnit, startMatchCombat } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, reachRound } from './match-helpers';

it('a solo pending augment keeps its offers, generation and choice RNG while units move up and down', () => {
  let state = reachRound('2-1', false, 42);
  const choice = state.pendingChoice!, rng = state.choiceRngState;
  const unit = state.preparation.units.find(u => u.team === 'player')!;
  for (const target of [{ kind: 'board' as const, cell: { col: 3, row: 4 } }, { kind: 'bench' as const, slot: 8 }]) {
    state = accepted(deployMatchUnit(state, unit.id, target));
    expect(state.phase).toBe('choice'); expect(state.pendingChoice).toEqual(choice);
    expect(state.choiceRngState).toBe(rng);
    expect(state.preparation.units.find(u => u.id === unit.id)!.location).toEqual(target);
  }
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  for (const r of [buyUnit(state, 0, state.shop.generation), startMatchCombat(state)]) {
    expect(r).toMatchObject({ ok: false, reason: 'wrong-phase' }); expect(r.state).toBe(state);
  }
});
it('other pending choices retain their board restriction and failed deploys are atomic', () => {
  const augment = reachRound('2-1', false, 42);
  const state = { ...augment, pendingChoice: { ...augment.pendingChoice!, kind: 'component' as const } };
  const unit = state.preparation.units.find(u => u.team === 'player')!;
  const r = deployMatchUnit(state, unit.id, { kind: 'board', cell: { col: 3, row: 4 } });
  expect(r).toEqual({ ok: false, state, reason: 'wrong-phase' }); expect(r.state).toBe(state);
});
