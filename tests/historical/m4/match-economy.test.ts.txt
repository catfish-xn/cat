import { describe, expect, it } from 'vitest';
import { buyUnit, buyXp, createMatch, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat,
  type MatchCommandResult, type MatchState } from '../src/simulation/match';
import type { Unit, UnitLocation } from '../src/simulation/units';
import { accepted, battle, finish, freeze } from './match-helpers';
import { cardValue, COST, expectedCommand, expectedShop, type LedgerCommand } from './fixtures/m4/oracle.cjs';

function rejects(state: MatchState, action: (state: MatchState) => MatchCommandResult, reason: string) {
  const before = structuredClone(state), result = action(freeze(state));
  expect(result).toEqual({ ok: false, state, reason });
  expect(result.state).toBe(state); expect(state).toEqual(before);
}
function dispatch(state: MatchState, command: LedgerCommand) {
  switch (command.type) {
    case 'buy': return buyUnit(state, command.slot, command.generation);
    case 'buyXp': return buyXp(state);
    case 'reroll': return rerollShop(state);
    case 'sell': return sellUnit(state, command.id);
    case 'deploy': return deployMatchUnit(state, command.id, command.target);
  }
}
function ledger(state: MatchState, command: LedgerCommand): MatchState {
  const before = structuredClone(state), expected = expectedCommand(state, command);
  const result = dispatch(freeze(state), command);
  expect(result).toEqual(expected); expect(state).toEqual(before);
  return accepted(result);
}
function offer(state: MatchState, definitionId: string): MatchState {
  return { ...state, shop: { ...state.shop, slots: [{ status: 'available', definitionId }, ...state.shop.slots.slice(1)] } };
}
function fixtureUnit(id: string, definitionId: string, location: UnitLocation, starLevel: Unit['starLevel'] = 1): Unit {
  return { id, definitionId, location, starLevel, team: 'player' };
}
function fullBench(): MatchState {
  const state = createMatch();
  return { ...state, preparation: { ...state.preparation, units: [...state.preparation.units,
    fixtureUnit('fixture-archer', 'archer', { kind: 'bench', slot: 5 }),
    fixtureUnit('fixture-bulwark', 'bulwark', { kind: 'bench', slot: 6 })] } };
}

describe('M4 atomic economy and independent ledger', () => {
  it('uses the frozen two-word level shop and buys a non-merge card into the first free bench slot', () => {
    const state = createMatch();
    expect({ shop: state.shop, rngState: state.rngState }).toEqual(expectedShop(42, 1, 3));
    const next = ledger(state, { type: 'buy', slot: 4, generation: 1 });
    expect(next.gold).toBe(8); expect(next.nextUnitSerial).toBe(7);
    expect(next.preparation.units.find(u => u.id === 'unit-6')).toEqual(fixtureUnit('unit-6', 'scout', { kind: 'bench', slot: 5 }));
    expect(next.rngState).toBe(state.rngState);
  });
  it('fills holes by slot number independently of array order and never reuses a sold ID', () => {
    let state = ledger(createMatch(), { type: 'buy', slot: 4, generation: 1 });
    state = ledger(state, { type: 'sell', id: 'unit-6' });
    state = ledger(state, { type: 'sell', id: 'unit-2' });
    state = offer({ ...state, preparation: { ...state.preparation, units: [...state.preparation.units].reverse() } }, 'archer');
    const next = ledger(state, { type: 'buy', slot: 0, generation: 1 });
    expect(next.preparation.units.find(u => u.id === 'unit-7')?.location).toEqual({ kind: 'bench', slot: 1 });
    expect(next.preparation.units.some(u => u.id === 'unit-6')).toBe(false);
  });
  it.each([-1, 5, 0.5, NaN, Infinity])('rejects invalid slot %s without spending or allocating', index => {
    rejects(createMatch(), s => buyUnit(s, index, 1), 'invalid-slot');
  });
  it('rejects stale and purchased slots and honors failure precedence', () => {
    const state = ledger(createMatch(), { type: 'buy', slot: 0, generation: 1 });
    rejects(state, s => buyUnit(s, 0, 1), 'purchased-slot');
    const refreshed = ledger(state, { type: 'reroll' });
    rejects(refreshed, s => buyUnit(s, 0, 1), 'stale-shop');
    rejects({ ...refreshed, gold: 0 }, s => buyUnit(s, -1, 1), 'invalid-slot');
    rejects({ ...refreshed, gold: 0 }, s => buyUnit(s, 0, 1), 'stale-shop');
  });
  it.each(Object.entries(COST))('charges exact cost for %s (%i gold), rejecting one gold below it', (id, cost) => {
    const state = offer(createMatch(), id);
    rejects({ ...state, gold: cost - 1 }, s => buyUnit(s, 0, 1), 'insufficient-gold');
    expect(ledger({ ...state, gold: cost }, { type: 'buy', slot: 0, generation: 1 }).gold).toBe(0);
  });
  it('rejects full bench without merge but accepts last free slot after deployment', () => {
    let state = offer(fullBench(), 'mystic');
    rejects(state, s => buyUnit(s, 0, 1), 'bench-full');
    state = ledger(state, { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 2, row: 4 } } });
    const next = ledger(state, { type: 'buy', slot: 0, generation: 1 });
    expect(next.preparation.units.find(u => u.id === 'unit-6')?.location).toEqual({ kind: 'bench', slot: 0 });
  });
  it('buys a third copy even on a full bench, retains the first positioned ID, and spends one serial', () => {
    const state = offer(fullBench(), 'sentinel'), beforeValue = cardValue(state.preparation.units);
    const result = buyUnit(freeze(state), 0, 1);
    expect(result).toEqual(expectedCommand(state, { type: 'buy', slot: 0, generation: 1 }));
    const next = accepted(result);
    expect(next.preparation.units.find(u => u.id === 'unit-1')).toMatchObject({ starLevel: 2, location: { kind: 'bench', slot: 0 } });
    expect(next.preparation.units.some(u => ['unit-4', 'unit-6'].includes(u.id))).toBe(false);
    expect(next.nextUnitSerial).toBe(7); expect(cardValue(next.preparation.units)).toBe(beforeValue + 1);
    rejects(next, s => sellUnit(s, 'unit-6'), 'unknown-unit');
  });
  it('merges across board/bench and performs 8+1 cascade to three stars atomically', () => {
    let state = offer(createMatch(), 'sentinel');
    const enemies = state.preparation.units.filter(u => u.team === 'enemy');
    state = { ...state, preparation: { ...state.preparation, units: [...enemies,
      fixtureUnit('unit-1', 'sentinel', { kind: 'board', cell: { col: 2, row: 4 } }),
      fixtureUnit('unit-2', 'sentinel', { kind: 'bench', slot: 0 }),
      fixtureUnit('unit-3', 'sentinel', { kind: 'bench', slot: 1 }, 2),
      fixtureUnit('unit-4', 'sentinel', { kind: 'bench', slot: 2 }, 2)] } };
    const result = buyUnit(freeze(state), 0, 1), next = accepted(result);
    expect(result).toEqual(expectedCommand(state, { type: 'buy', slot: 0, generation: 1 }));
    expect(result.ok && result.events.filter(e => e.type === 'unitUpgraded').map(e => [e.fromStar, e.toStar])).toEqual([[1, 2], [2, 3]]);
    expect(next.preparation.units.filter(u => u.team === 'player')).toEqual([fixtureUnit('unit-1', 'sentinel', { kind: 'board', cell: { col: 2, row: 4 } }, 3)]);
    expect(cardValue(next.preparation.units)).toBe(9);
    expect(ledger(next, { type: 'sell', id: 'unit-1' }).gold).toBe(state.gold - 1 + 9);
  });
  it.each([1, 2, 3] as const)('sells %s-star instances from board and bench at card-equivalent value', starLevel => {
    let state = createMatch();
    state = { ...state, preparation: { ...state.preparation, units: state.preparation.units.map(u => u.id === 'unit-1' ? { ...u, definitionId: 'warden', starLevel } : u) } };
    state = ledger(state, { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 2, row: 4 } } });
    state = ledger(state, { type: 'sell', id: 'unit-1' });
    state = ledger(state, { type: 'sell', id: 'unit-2' });
    expect(state.gold).toBe(11 + 4 * 3 ** (starLevel - 1));
    rejects(state, s => sellUnit(s, 'unit-1'), 'unknown-unit');
    rejects(state, s => sellUnit(s, 'enemy-1'), 'enemy-unit');
  });
  it('charges exact D fee and consumes ten words only on successful refresh', () => {
    const input = { ...createMatch(), gold: 2 }, next = ledger(input, { type: 'reroll' });
    expect(next.gold).toBe(0); expect(next.preparation).toBe(input.preparation);
    expect({ shop: next.shop, rngState: next.rngState }).toEqual(expectedShop(input.rngState, 2, input.level));
    rejects(next, rerollShop, 'insufficient-gold');
  });
  it('F grants XP/levels without touching current shop, and the following D uses new odds', () => {
    let state = createMatch();
    state = ledger(state, { type: 'buyXp' });
    expect([state.level, state.xp, state.gold]).toEqual([3, 4, 6]);
    const before = state;
    state = ledger(state, { type: 'buyXp' });
    expect([state.level, state.xp, state.gold]).toEqual([4, 2, 2]);
    expect(state.shop).toBe(before.shop); expect(state.rngState).toBe(before.rngState);
    state = ledger(state, { type: 'reroll' });
    expect(state.shop.slots).toEqual(['beacon', 'scout', 'archer', 'squire', 'striker'].map(definitionId => ({ status: 'available', definitionId })));
    rejects(state, buyXp, 'insufficient-gold');
  });
  it('F preserves a valid old-generation offer and checks max-level before money', () => {
    let state = ledger(createMatch(), { type: 'buyXp' });
    state = ledger(state, { type: 'buy', slot: 0, generation: 1 });
    expect(state.shop.generation).toBe(1);
    rejects({ ...state, level: 9, xp: 0, gold: 0 }, buyXp, 'max-level');
    expect(ledger({ ...createMatch(), level: 8, xp: 79, gold: 4 }, { type: 'buyXp' })).toMatchObject({ level: 9, xp: 0, gold: 0 });
  });
  it('keeps every failed D/F state field unchanged during a 60-command burst', () => {
    const state = freeze({ ...createMatch(), gold: 0 });
    for (let i = 0; i < 30; i++) { rejects(state, rerollShop, 'insufficient-gold'); rejects(state, buyXp, 'insufficient-gold'); }
  });
  it.each(['combat', 'settlement', 'gameOver'] as const)('rejects all operations in %s at the simulation boundary', phase => {
    const running = battle();
    const state = phase === 'combat' ? running : phase === 'settlement' ? finish(running)
      : accepted(startMatchCombat({ ...createMatch(), playerHp: 1 }));
    expect(state.phase).toBe(phase);
    const commands = [(s: MatchState) => buyUnit(s, 0, s.shop.generation), (s: MatchState) => sellUnit(s, 'unit-1'),
      rerollShop, buyXp, startMatchCombat, (s: MatchState) => deployMatchUnit(s, 'unit-1', { kind: 'bench', slot: 0 })];
    for (const command of commands) rejects(state, command, 'wrong-phase');
    if (phase === 'gameOver') rejects(state, s => nextRound(s, s.round), 'wrong-phase');
  });
  it('can deliberately abandon an empty board after selling the last deployed unit, paying HP for recovery income', () => {
    let state = ledger(createMatch(), { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 0, row: 4 } } });
    state = ledger(state, { type: 'sell', id: 'unit-1' });
    const result = accepted(startMatchCombat(freeze(state)));
    expect(result).toMatchObject({ phase: 'settlement', playerHp: 94, gold: state.gold + 5, xp: 2 });
    expect(result.combat).toMatchObject({ tick: 0, result: 'enemyWin' });
  });
});
