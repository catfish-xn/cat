import { describe, expect, it } from 'vitest';
import { buyUnit, buyXp, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat,
  type MatchCommandResult, type MatchState } from '../src/simulation/match';
import type { Unit, UnitLocation } from '../src/simulation/units';
import { accepted, battle, finish, freeze, readyMatch, emptyBoard, reachRound } from './match-helpers';
import { cardValue, expectedCommand, type LedgerCommand } from './fixtures/m5/command-oracle.cjs';
import { generateShop } from '../src/simulation/shop';
import { COST, shop as expectedShop } from './fixtures/m5/oracle.cjs';

/** Explicit command-unit fixture: a fixed funded level-3/three-holder input.
 * This preserves the independent command arithmetic vectors, not new-match or B8 acquisition evidence.
 * True 0G/one-hero creation and public opening progression are tested separately in B6 integration.
 */
function economyFixture():MatchState {
  const state=readyMatch();
  return {...state,gold:10,level:3,nextUnitSerial:4,...generateShop(42,1,3),preparation:{...state.preparation,units:[
    ...state.preparation.units.filter(u=>u.team==='enemy'),
    ...['irelia','maddie','lux'].map((definitionId,i)=>fixtureUnit(`unit-${i+1}`,definitionId,{kind:'board',cell:{col:1+2*i,row:i===0?4:7}})),
  ]}};
}
const economyEmptyBoard=()=>emptyBoard(economyFixture());

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
  const state = economyEmptyBoard();
  return { ...state, preparation: { ...state.preparation, units: [...state.preparation.units,
    ...['irelia', 'darius', 'zyra', 'rell', 'leona', 'vander'].map((definitionId, i) =>
      fixtureUnit(`fixture-${i}`, definitionId, { kind: 'bench', slot: i + 3 }))] } };
}

describe('M5 atomic economy and independent ledger', () => {
  it('uses the frozen two-word level shop and buys a non-merge card into the first free bench slot', () => {
    const state = economyFixture();
    expect({ shop: state.shop, rngState: state.rngState }).toEqual(expectedShop(42, 1, 3));
    const next = ledger(state, { type: 'buy', slot: 4, generation: 1 });
    expect(next.gold).toBe(8); expect(next.nextUnitSerial).toBe(5);
    expect(next.preparation.units.find(u => u.id === 'unit-4')).toEqual(fixtureUnit('unit-4', 'vander', { kind: 'bench', slot: 0 }));
    expect(next.rngState).toBe(state.rngState);
  });
  it('fills holes by slot number independently of array order and never reuses a sold ID', () => {
    let state = ledger(economyEmptyBoard(), { type: 'buy', slot: 4, generation: 1 });
    state = ledger(state, { type: 'sell', id: 'unit-4' });
    state = ledger(state, { type: 'sell', id: 'unit-2' });
    state = offer({ ...state, preparation: { ...state.preparation, units: [...state.preparation.units].reverse() } }, 'rell');
    const next = ledger(state, { type: 'buy', slot: 0, generation: 1 });
    expect(next.preparation.units.find(u => u.id === 'unit-5')?.location).toEqual({ kind: 'bench', slot: 1 });
    expect(next.preparation.units.some(u => u.id === 'unit-4')).toBe(false);
  });
  it.each([-1, 5, 0.5, NaN, Infinity])('rejects invalid slot %s without spending or allocating', index => {
    rejects(economyFixture(), s => buyUnit(s, index, 1), 'invalid-slot');
  });
  it('rejects stale and purchased slots and honors failure precedence', () => {
    const state = ledger(economyFixture(), { type: 'buy', slot: 0, generation: 1 });
    rejects(state, s => buyUnit(s, 0, 1), 'purchased-slot');
    const refreshed = ledger(state, { type: 'reroll' });
    rejects(refreshed, s => buyUnit(s, 0, 1), 'stale-shop');
    rejects({ ...refreshed, gold: 0 }, s => buyUnit(s, -1, 1), 'invalid-slot');
    rejects({ ...refreshed, gold: 0 }, s => buyUnit(s, 0, 1), 'stale-shop');
  });
  it.each(Object.entries(COST))('charges exact cost for %s (%i gold), rejecting one gold below it', (id, cost) => {
    const state = offer(economyFixture(), id);
    rejects({ ...state, gold: cost - 1 }, s => buyUnit(s, 0, 1), 'insufficient-gold');
    expect(ledger({ ...state, gold: cost }, { type: 'buy', slot: 0, generation: 1 }).gold).toBe(0);
  });
  it('rejects full bench without merge but accepts last free slot after deployment', () => {
    let state = offer(fullBench(), 'lux');
    rejects(state, s => buyUnit(s, 0, 1), 'bench-full');
    state = ledger(state, { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 2, row: 4 } } });
    const next = ledger(state, { type: 'buy', slot: 0, generation: 1 });
    expect(next.preparation.units.find(u => u.id === 'unit-4')?.location).toEqual({ kind: 'bench', slot: 0 });
  });
  it('buys a third copy even on a full bench, retains the first positioned ID, and spends one serial', () => {
    const state = offer(fullBench(), 'irelia'), beforeValue = cardValue(state.preparation.units);
    const result = buyUnit(freeze(state), 0, 1);
    expect(result).toEqual(expectedCommand(state, { type: 'buy', slot: 0, generation: 1 }));
    const next = accepted(result);
    expect(next.preparation.units.find(u => u.id === 'unit-1')).toMatchObject({ starLevel: 2, location: { kind: 'bench', slot: 0 } });
    expect(next.preparation.units.some(u => ['fixture-0', 'unit-4'].includes(u.id))).toBe(false);
    expect(next.nextUnitSerial).toBe(5); expect(cardValue(next.preparation.units)).toBe(beforeValue + 1);
    rejects(next, s => sellUnit(s, 'unit-4'), 'unknown-unit');
  });
  it('merges across board/bench and performs 8+1 cascade to three stars atomically', () => {
    let state = { ...offer(economyFixture(), 'irelia'), nextUnitSerial: 5 };
    const enemies = state.preparation.units.filter(u => u.team === 'enemy');
    state = { ...state, preparation: { ...state.preparation, units: [...enemies,
      fixtureUnit('unit-1', 'irelia', { kind: 'board', cell: { col: 2, row: 4 } }),
      fixtureUnit('unit-2', 'irelia', { kind: 'bench', slot: 0 }),
      fixtureUnit('unit-3', 'irelia', { kind: 'bench', slot: 1 }, 2),
      fixtureUnit('unit-4', 'irelia', { kind: 'bench', slot: 2 }, 2)] } };
    const result = buyUnit(freeze(state), 0, 1), next = accepted(result);
    expect(result).toEqual(expectedCommand(state, { type: 'buy', slot: 0, generation: 1 }));
    expect(result.ok && result.events.filter(e => e.type === 'unitUpgraded').map(e => [e.fromStar, e.toStar])).toEqual([[1, 2], [2, 3]]);
    expect(next.preparation.units.filter(u => u.team === 'player')).toEqual([fixtureUnit('unit-1', 'irelia', { kind: 'board', cell: { col: 2, row: 4 } }, 3)]);
    expect(cardValue(next.preparation.units)).toBe(9);
    expect(ledger(next, { type: 'sell', id: 'unit-1' }).gold).toBe(state.gold - 1 + 9);
  });
  it.each([1, 2, 3] as const)('sells %s-star instances from board and bench at the M5 sale-loss value', starLevel => {
    let state = economyFixture();
    state = { ...state, preparation: { ...state.preparation, units: state.preparation.units.map(u => u.id === 'unit-1' ? { ...u, definitionId: 'corki', starLevel } : u) } };
    state = ledger(state, { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 2, row: 4 } } });
    state = ledger(state, { type: 'sell', id: 'unit-1' });
    state = ledger(state, { type: 'sell', id: 'unit-2' });
    expect(state.gold).toBe(11 + [4, 11, 35][starLevel - 1]);
    rejects(state, s => sellUnit(s, 'unit-1'), 'unknown-unit');
    rejects(state, s => sellUnit(s, state.preparation.units.find(u => u.team === 'enemy')!.id), 'enemy-unit');
  });
  it('charges exact D fee and consumes ten words only on successful refresh', () => {
    const input = { ...economyFixture(), gold: 2 }, next = ledger(input, { type: 'reroll' });
    expect(next.gold).toBe(0); expect(next.preparation).toBe(input.preparation);
    expect({ shop: next.shop, rngState: next.rngState }).toEqual(expectedShop(input.rngState, 2, input.level));
    rejects(next, rerollShop, 'insufficient-gold');
  });
  it('F grants XP/levels without touching current shop, and the following D uses new odds', () => {
    let state = economyFixture();
    state = ledger(state, { type: 'buyXp' });
    expect([state.level, state.xp, state.gold]).toEqual([3, 4, 6]);
    const before = state;
    state = ledger(state, { type: 'buyXp' });
    expect([state.level, state.xp, state.gold]).toEqual([4, 2, 2]);
    expect(state.shop).toBe(before.shop); expect(state.rngState).toBe(before.rngState);
    state = ledger(state, { type: 'reroll' });
    expect(state.shop.slots).toEqual(['loris', 'vander', 'leona', 'zyra', 'scar'].map(definitionId => ({ status: 'available', definitionId })));
    rejects(state, buyXp, 'insufficient-gold');
  });
  it('F preserves a valid old-generation offer and checks max-level before money', () => {
    let state = ledger(economyFixture(), { type: 'buyXp' });
    state = ledger(state, { type: 'buy', slot: 0, generation: 1 });
    expect(state.shop.generation).toBe(1);
    rejects({ ...state, level: 9, xp: 0, gold: 0 }, buyXp, 'max-level');
    expect(ledger({ ...economyFixture(), level: 8, xp: 75, gold: 4 }, { type: 'buyXp' })).toMatchObject({ level: 9, xp: 0, gold: 0 });
  });
  it('keeps every failed D/F state field unchanged during a 60-command burst', () => {
    const state = freeze({ ...economyFixture(), gold: 0 });
    for (let i = 0; i < 30; i++) { rejects(state, rerollShop, 'insufficient-gold'); rejects(state, buyXp, 'insufficient-gold'); }
  });
  it.each(['choice', 'combat', 'settlement', 'gameOver'] as const)('rejects all operations in %s at the simulation boundary', phase => {
    const running = battle();
    const state = phase === 'choice' ? reachRound('2-1',false) : phase === 'combat' ? running : phase === 'settlement' ? finish(running)
      : accepted(startMatchCombat({ ...economyEmptyBoard(), playerHp: 1 }));
    expect(state.phase).toBe(phase);
    const commands = [(s: MatchState) => buyUnit(s, 0, s.shop.generation), (s: MatchState) => sellUnit(s, 'unit-1'),
      rerollShop, buyXp, startMatchCombat, (s: MatchState) => deployMatchUnit(s, 'unit-1', { kind: 'bench', slot: 0 })];
    for (const command of commands) rejects(state, command, 'wrong-phase');
    if (phase === 'gameOver') rejects(state, s => nextRound(s, s.round), 'wrong-phase');
  });
  it('can deliberately abandon an empty board after selling the last deployed unit, paying HP for recovery income', () => {
    let state = ledger(economyEmptyBoard(), { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 0, row: 4 } } });
    state = ledger(state, { type: 'sell', id: 'unit-1' });
    const result = accepted(startMatchCombat(freeze(state)));
    expect(result).toMatchObject({ phase: 'settlement', playerHp: 97, gold: state.gold + 2, xp: 2 });
    expect(result.combat).toMatchObject({ tick: 0, result: 'enemyWin' });
  });
});
