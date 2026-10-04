import { describe, expect, it } from 'vitest';
import { buyUnit, createMatch, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { accepted, battle, finish, freeze } from './match-helpers';

function rejects(state: MatchState, action: (state: MatchState) => MatchCommandResult, reason: string) {
  const before = structuredClone(state);
  const result = action(freeze(state));
  expect(result).toEqual({ ok: false, state, reason });
  expect(result.state).toBe(state);
  expect(state).toEqual(before);
}

describe('atomic economy commands', () => {
  it('buys into the first free bench slot without changing random state or the previous snapshot', () => {
    const input = freeze(createMatch()), before = structuredClone(input);
    const next = accepted(buyUnit(input, 0, 1));
    expect(next.gold).toBe(7);
    expect(next.rngState).toBe(input.rngState);
    expect(next.nextUnitSerial).toBe(7);
    expect(next.preparation.units.at(-1)).toEqual({ id: 'unit-6', definitionId: 'sentinel', team: 'player', location: { kind: 'bench', slot: 5 } });
    expect(next.shop).toEqual({ generation: 1, slots: [{ status: 'purchased' }, ...input.shop.slots.slice(1)] });
    expect(input).toEqual(before);
  });

  it('fills holes by slot number regardless of units ordering and never reuses a sold ID', () => {
    let state = accepted(buyUnit(createMatch(), 0, 1));
    state = accepted(sellUnit(state, 'unit-6'));
    state = accepted(sellUnit(state, 'unit-2'));
    state = { ...state, preparation: { ...state.preparation, units: [...state.preparation.units].reverse() } };
    const next = accepted(buyUnit(freeze(state), 1, 1));
    expect(next.preparation.units.at(-1)).toMatchObject({ id: 'unit-7', location: { kind: 'bench', slot: 1 } });
    expect(next.preparation.units.some(unit => unit.id === 'unit-6')).toBe(false);
  });

  it.each([-1, 5, 0.5, NaN, Infinity])('rejects invalid shop index %s', index => {
    rejects(createMatch(), state => buyUnit(state, index, 1), 'invalid-slot');
  });

  it('rejects a stale shop and already purchased slot without spending or allocating', () => {
    const state = accepted(buyUnit(createMatch(), 0, 1));
    rejects(state, current => buyUnit(current, 0, 1), 'purchased-slot');
    const refreshed = accepted(rerollShop(state));
    rejects(refreshed, current => buyUnit(current, 0, 1), 'stale-shop');
  });

  it('rejects a full bench independently of sufficient gold, and accepts its last free slot', () => {
    let state = accepted(buyUnit(createMatch(), 0, 1));
    state = accepted(buyUnit(state, 1, 1));
    expect(state.gold).toBe(4);
    expect(state.preparation.units.filter(unit => unit.location.kind === 'bench')).toHaveLength(7);
    rejects(state, current => buyUnit(current, 2, 1), 'bench-full');
    state = accepted(deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 2, row: 4 } }));
    const next = accepted(buyUnit(state, 2, 1));
    expect(next.preparation.units.at(-1)?.location).toEqual({ kind: 'bench', slot: 0 });
  });

  it('rejects insufficient buy money and allows exact price', () => {
    rejects({ ...createMatch(), gold: 2 }, state => buyUnit(state, 0, 1), 'insufficient-gold');
    expect(accepted(buyUnit({ ...createMatch(), gold: 3 }, 0, 1)).gold).toBe(0);
  });

  it('sells both bench and board player instances once at a fixed price', () => {
    let state = createMatch();
    const rng = state.rngState;
    state = accepted(deployMatchUnit(state, 'unit-2', { kind: 'board', cell: { col: 2, row: 4 } }));
    state = accepted(sellUnit(freeze(state), 'unit-1'));
    state = accepted(sellUnit(freeze(state), 'unit-2'));
    expect(state.gold).toBe(14);
    expect(state.preparation.units.map(unit => unit.id)).toEqual(['unit-3', 'unit-4', 'unit-5', 'enemy-1', 'enemy-2']);
    expect(state.rngState).toBe(rng);
    expect(state.nextUnitSerial).toBe(6);
    rejects(state, current => sellUnit(current, 'unit-2'), 'unknown-unit');
    rejects(state, current => sellUnit(current, 'absent'), 'unknown-unit');
    rejects(state, current => sellUnit(current, 'enemy-1'), 'enemy-unit');
  });

  it('refreshes all five slots for exact fee and rejects insufficient money without advancing RNG', () => {
    const input = { ...accepted(buyUnit(createMatch(), 0, 1)), gold: 2 };
    const next = accepted(rerollShop(freeze(input)));
    expect(next.gold).toBe(0);
    expect(next.shop.generation).toBe(2);
    expect(next.shop.slots).toHaveLength(5);
    expect(next.shop.slots.every(slot => slot.status === 'available')).toBe(true);
    expect(next.rngState).not.toBe(input.rngState);
    expect(next.preparation).toBe(input.preparation);
    rejects(next, rerollShop, 'insufficient-gold');
    rejects({ ...createMatch(), gold: 1 }, rerollShop, 'insufficient-gold');
  });

  it.each(['combat', 'settlement'] as const)('rejects all preparation commands in %s through simulation', phase => {
    const running = battle(), state = phase === 'combat' ? running : finish(running);
    const commands = [
      (s: MatchState) => buyUnit(s, 0, s.shop.generation),
      (s: MatchState) => sellUnit(s, 'unit-1'), rerollShop, startMatchCombat,
      (s: MatchState) => deployMatchUnit(s, 'unit-1', { kind: 'bench', slot: 0 }),
    ];
    for (const command of commands) rejects(state, command, 'wrong-phase');
  });

  it('keeps Start gates authoritative after selling the last deployed player', () => {
    let state = accepted(deployMatchUnit(createMatch(), 'unit-1', { kind: 'board', cell: { col: 0, row: 4 } }));
    state = accepted(sellUnit(state, 'unit-1'));
    rejects(state, startMatchCombat, 'missing-player');
    rejects(state, current => nextRound(current, 1), 'wrong-phase');
    expect(accepted(startMatchCombat(accepted(deployMatchUnit(state, 'unit-2', { kind: 'board', cell: { col: 0, row: 4 } })))).phase).toBe('combat');
  });
});
