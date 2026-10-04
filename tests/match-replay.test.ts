import { describe, expect, it } from 'vitest';
import { buyUnit, buyXp, createMatch, deployMatchUnit, nextRound, rerollShop, sellUnit, startMatchCombat, stepMatch,
  type MatchCommandResult, type MatchState } from '../src/simulation/match';
import type { CombatEvent } from '../src/simulation/combat';
import { accepted, freeze } from './match-helpers';
import { cardValue, expectedCommand, expectedRound, expectedShop, type LedgerCommand } from './fixtures/m3/oracle.cjs';

type Command = LedgerCommand | { type: 'start' } | { type: 'continue'; round: number };
function dispatch(state: MatchState, command: Command): MatchCommandResult {
  switch (command.type) {
    case 'buy': return buyUnit(state, command.slot, command.generation);
    case 'buyXp': return buyXp(state);
    case 'sell': return sellUnit(state, command.id);
    case 'deploy': return deployMatchUnit(state, command.id, command.target);
    case 'reroll': return rerollShop(state);
    case 'start': return startMatchCombat(state);
    case 'continue': return nextRound(state, command.round);
  }
}
const opening: Command[] = [
  { type: 'reroll' }, { type: 'buy', slot: 2, generation: 2 }, { type: 'buyXp' },
  { type: 'buy', slot: 1, generation: 2 }, { type: 'buy', slot: 3, generation: 2 },
  { type: 'deploy', id: 'unit-1', target: { kind: 'board', cell: { col: 1, row: 4 } } },
  { type: 'deploy', id: 'unit-3', target: { kind: 'board', cell: { col: 3, row: 4 } } },
  { type: 'deploy', id: 'unit-2', target: { kind: 'board', cell: { col: 5, row: 4 } } },
];

function replay(options: { serialize?: boolean; injectFailures?: boolean } = {}) {
  let state = createMatch(42), seq = 0;
  const states: MatchState[] = [], events: CombatEvent[] = [], records: unknown[] = [], errors: string[] = [];
  let rerollSpend = 0, xpSpend = 0, income = 0;
  function reject(result: MatchCommandResult) {
    expect(result.ok).toBe(false); expect(result.state).toBe(state);
    if (!result.ok) errors.push(result.reason);
  }
  function checkpoint() {
    expect(state.gold + cardValue(state.preparation.units)).toBe(15 - rerollSpend - xpSpend + income);
    states.push(structuredClone(state));
    if (options.serialize) state = JSON.parse(JSON.stringify(state)) as MatchState;
    if (!options.injectFailures) return;
    const copy = structuredClone(state); freeze(state);
    reject(sellUnit(state, 'absent')); reject(buyUnit(state, -1, state.shop.generation));
    if (state.phase === 'preparation') {
      reject(buyUnit(state, 0, state.shop.generation - 1)); reject(nextRound(state, state.round));
      for (const id of ['unit-4', 'unit-6', 'unit-7', 'unit-8']) if (!state.preparation.units.some(u => u.id === id)) reject(sellUnit(state, id));
      if (state.gold < 2) reject(rerollShop(state));
      if (state.gold < 4 || state.level === 9) reject(buyXp(state));
      const slot = state.shop.slots.findIndex(s => s.status === 'purchased');
      if (slot >= 0) reject(buyUnit(state, slot, state.shop.generation));
    } else {
      reject(buyUnit(state, 0, state.shop.generation)); reject(buyXp(state)); reject(rerollShop(state));
      reject(startMatchCombat(state)); reject(deployMatchUnit(state, 'unit-1', { kind: 'bench', slot: 0 }));
      if (state.phase === 'settlement') reject(nextRound(state, state.round - 1));
      else reject(nextRound(state, state.round));
    }
    expect(state).toEqual(copy);
  }
  function command(command: Command) {
    const before = state, result = dispatch(freeze(state), command);
    if (command.type !== 'start' && command.type !== 'continue') expect(result).toEqual(expectedCommand(before, command));
    state = accepted(result);
    if (command.type === 'reroll') rerollSpend += 2;
    if (command.type === 'buyXp') xpSpend += 4;
    if (command.type === 'continue') {
      expect({ shop: state.shop, rngState: state.rngState }).toEqual(expectedShop(before.rngState, before.shop.generation + 1, before.level));
      expect([state.level, state.xp, state.playerHp, state.gold]).toEqual([before.level, before.xp, before.playerHp, before.gold]);
    }
    records.push({ seq: seq++, round: before.round, logicalTick: before.combat?.tick ?? 0, command, ok: result.ok, events: result.ok ? result.events : [] });
    checkpoint();
  }
  checkpoint();
  for (const item of JSON.parse(JSON.stringify(opening)) as Command[]) command(item);
  for (let round = 1; round <= 10 && state.phase !== 'gameOver'; round++) {
    if (round > 1) {
      if (state.gold >= 4 && state.level < 9) command({ type: 'buyXp' });
      const bench = state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench');
      let count = state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length;
      for (const unit of bench) if (count < state.level) { command({ type: 'deploy', id: unit.id, target: { kind: 'board', cell: { col: count, row: 6 } } }); count++; }
      if (state.gold >= 2) command({ type: 'reroll' });
    }
    const before = state;
    command({ type: 'start' });
    while (state.phase === 'combat') {
      const next = stepMatch(freeze(state)); state = next.state; events.push(...next.events);
      if (state.phase !== 'combat') {
        income += 5; expect(state.roundResults.at(-1)).toEqual(expectedRound(before, state.combat!));
      }
      checkpoint();
    }
    expect(state.roundResults).toHaveLength(round);
    for (let i = 0; i < 3; i++) expect(stepMatch(state)).toEqual({ state, events: [] });
    if (state.phase === 'settlement') command({ type: 'continue', round });
  }
  expect(state.roundResults.length).toBeGreaterThanOrEqual(8);
  expect(events.some(e => e.type === 'cast')).toBe(true);
  expect(events.some(e => e.type === 'shieldChanged')).toBe(true);
  expect(events.some(e => e.type === 'damage' && e.magicAmount > 0)).toBe(true);
  expect(events.some(e => e.type === 'damage' && e.absorbed > 0)).toBe(true);
  expect(state.roundResults.some(r => r.result === 'enemyWin' && r.hpLost > 0)).toBe(true);
  return { header: { schemaVersion: 3, rulesVersion: 'm3-v1', contentVersion: 'm3-content-v1', seed: 42 }, state, states, events, records, errors };
}

describe('M3 versioned full-state deterministic replay', () => {
  it('replays commands, merges, every battle tick, events, shop RNG and HP identically', () => {
    expect(replay()).toEqual(replay());
  });
  it('inserting rejected commands leaves the complete successful trajectory unchanged', () => {
    const normal = replay(), injected = replay({ injectFailures: true });
    expect(injected.errors).toEqual(expect.arrayContaining(['unknown-unit', 'invalid-slot', 'wrong-phase', 'stale-shop', 'stale-round', 'insufficient-gold', 'purchased-slot']));
    expect({ ...injected, errors: [] }).toEqual(normal);
  });
  it('JSON restores after every command/tick, including Mana, shields, settlements and terminal states', () => {
    expect(replay({ serialize: true })).toEqual(replay());
  });
  it('replays a serialized terminal Game Over snapshot without a hidden settlement flag', () => {
    let state = createMatch(42);
    while (state.phase !== 'gameOver') {
      const before = state;
      state = accepted(startMatchCombat(JSON.parse(JSON.stringify(state)) as MatchState));
      expect(state.roundResults.at(-1)).toEqual(expectedRound(before, state.combat!));
      if (state.phase === 'settlement') state = accepted(nextRound(state, state.round));
    }
    const restored = freeze(JSON.parse(JSON.stringify(state)) as MatchState);
    expect(stepMatch(restored)).toEqual({ state: restored, events: [] });
    expect(stepMatch(restored).state).toBe(restored);
    expect(nextRound(restored, restored.round)).toEqual({ ok: false, state: restored, reason: 'wrong-phase' });
    expect(startMatchCombat(restored)).toEqual({ ok: false, state: restored, reason: 'wrong-phase' });
  });
  it('does not share hidden RNG or unit serials across concurrently created matches', () => {
    const state = accepted(buyUnit(createMatch(0), 0, 1)), copy = structuredClone(state);
    for (let i = 0; i < 30; i++) { createMatch(i); accepted(buyXp(createMatch(i))); }
    expect(state).toEqual(copy);
    expect(rerollShop(state)).toEqual(rerollShop(copy));
  });
});
