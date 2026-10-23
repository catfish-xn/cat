import { describe, expect, it } from 'vitest';
import { openMatchCombatStream, openMatchCombatStreamSteps, stepMatchCombatStream, revealMatchCombatStreamTerminal, settleMatchCombatStream,
  startMatchCombat, stepMatch, deployMatchUnit } from '../src/simulation/match';
import { validateMultiplayerOrbLedger } from '../src/simulation/orb-restore';
import { validateB8Loot } from '../src/simulation/b8-restore';
import { readLootView } from '../src/simulation/loot-view';
import { restoreSharedOrbSnapshot, runSharedMatchCommand } from '../src/simulation/shared-pool';
import type { MatchCommandResult, MatchState } from '../src/simulation/match-types';
import { accept, room } from './tp-helpers';

const ok = (result: MatchCommandResult) => { if (!result.ok) throw Error(result.reason); return result; };
const json = (value: unknown) => JSON.stringify(value);
function fixture(col = 3, row = 6, seed = 42) {
  const { pool, states } = room(undefined, 1, seed);
  const initial = states[0];
  const source = ok(deployMatchUnit(initial, initial.preparation.units.find(u => u.team === 'player')!.id,
    { kind: 'board', cell: { col, row } })).state;
  let state = ok(openMatchCombatStream(source)).state;
  for (let i = 0; i < 1201; i++) {
    const next = stepMatchCombatStream(state);
    if (next.terminal) return { pool, source, before: state, terminal: next.terminal };
    state = next.state;
  }
  throw Error('no terminal');
}
function valid(state: MatchState) {
  expect(() => validateMultiplayerOrbLedger(state)).not.toThrow();
  expect(() => validateB8Loot(state)).not.toThrow();
}

describe('terminal orb rule boundary', () => {
  it.each(['synchronous', 'generator'] as const)('%s opening records a tick-zero PvE terminal before settlement', path => {
    // A legal empty board loses immediately; it has no killing blow or earned orb.
    let source = room(undefined, 1).states[0];
    for (const unit of source.preparation.units.filter(u => u.team === 'player')) {
      source = ok(deployMatchUnit(source, unit.id, { kind: 'bench', slot: 0 })).state;
    }
    const original = json(source);
    const open = () => {
      if (path === 'synchronous') return openMatchCombatStream(source);
      const work = openMatchCombatStreamSteps(source);
      let pauses = 0;
      for (;;) {
        const next = work.next();
        if (next.done) { expect(pauses).toBeGreaterThan(0); return next.value; }
        pauses++;
        expect(next.value).toBeUndefined();
        expect(json(source)).toBe(original);
        expect(source).not.toHaveProperty('pendingCombatTerminal');
      }
    };
    const opened = open();
    if (!opened.ok) throw Error(opened.reason);
    expect(opened.streamInitial).toMatchObject({ tick: 0, status: 'finished', result: 'enemyWin' });
    expect(opened.state.pendingCombatTerminal).toBe(opened.streamInitial);
    expect(opened.state.phase).toBe('preparation');
    expect(opened.state.combat).toBeNull();
    expect(opened.events.some(e => e.type === 'lootForfeited')).toBe(true);
    expect(opened.events.some(e => e.type === 'lootRevealed')).toBe(false);
    for (const field of ['gold', 'items', 'playerHp', 'roundResults', 'preparation', 'rngState',
      'rewardRngState', 'choiceRngState', 'sharedPool'] as const) expect(opened.state[field]).toEqual(source[field]);
    expect(stepMatchCombatStream(opened.state)).toEqual({ state: opened.state, events: [], terminal: opened.streamInitial });
    expect(ok(revealMatchCombatStreamTerminal(opened.state, opened.streamInitial!)))
      .toEqual({ ok: true, state: opened.state, events: [] });
    valid(opened.state);
    const settled = ok(settleMatchCombatStream(opened.state, opened.streamInitial!));
    expect(settled.state).not.toHaveProperty('pendingCombatTerminal');
    expect(json(settled.state)).toBe(json(ok(startMatchCombat(source)).state));
    expect(json(source)).toBe(original);
  });

  it('records the killing blow, reveals immediately and validates before settlement without moving resources or RNG', () => {
    const { before, terminal } = fixture(), result = ok(revealMatchCombatStreamTerminal(before, terminal));
    const reveals = result.events.filter(e => e.type === 'lootRevealed');
    expect(reveals.length).toBeGreaterThan(0);
    expect(reveals.every(e => e.death.tick === terminal.tick)).toBe(true);
    expect(readLootView(result.state).unclaimedOrbs!.length).toBeGreaterThan(readLootView(before).unclaimedOrbs!.length);
    expect(result.state.pendingCombatTerminal).toBe(terminal);
    expect(result.state.combat).toBe(before.combat);
    for (const field of ['gold', 'items', 'playerHp', 'roundResults', 'preparation', 'rngState', 'battleSeedRngState',
      'rewardRngState', 'choiceRngState', 'equipmentState', 'sharedPool'] as const) expect(result.state[field]).toEqual(before[field]);
    valid(result.state);
    const { pendingCombatTerminal: _pending, ...missing } = result.state;
    expect(() => validateMultiplayerOrbLedger(missing)).toThrow(/death evidence/);
    expect(() => validateB8Loot({ ...result.state, pendingCombatTerminal: { ...terminal, tick: terminal.tick + 1 } } as MatchState)).toThrow(/pending terminal/);
    const premature = { ...before, m8: { ...before.m8, loot: { ...before.m8.loot,
      direct: before.m8.loot.direct.map(d => d.status === 'planned' ? { ...d, status: 'forfeited' as const } : d) } } };
    expect(() => validateMultiplayerOrbLedger(premature)).toThrow(/unearned forfeit lifecycle/);
    expect(() => validateB8Loot(premature)).toThrow(/unearned forfeit lifecycle/);
  });

  it('repeated reveal and step are inert; wrong round, running terminal and conflicting terminal fail atomically', () => {
    const { before, terminal } = fixture(), state = ok(revealMatchCombatStreamTerminal(before, terminal)).state;
    expect(revealMatchCombatStreamTerminal(state, structuredClone(terminal))).toEqual({ ok: true, state, events: [] });
    expect(ok(revealMatchCombatStreamTerminal(state, terminal)).state).toBe(state);
    expect(stepMatch(state)).toEqual({ state, events: [] });
    expect(stepMatchCombatStream(state)).toEqual({ state, events: [], terminal });
    for (const bad of [{ ...terminal, combatId: 'round-999' }, before.combat!, { ...terminal, result: 'draw' as const }]) {
      const rejected = revealMatchCombatStreamTerminal(state, bad);
      expect(rejected).toEqual({ ok: false, state, reason: 'wrong-phase' });
      expect(rejected.state).toBe(state);
    }
  });

  it('streamed and whole-round final Match bytes and terminal combat are identical', () => {
    const { source, before, terminal } = fixture();
    const revealed = ok(revealMatchCombatStreamTerminal(before, terminal));
    const streamed = ok(settleMatchCombatStream(revealed.state, terminal));
    let full = ok(startMatchCombat(source)).state;
    while (full.phase === 'combat') full = stepMatch(full).state;
    expect(json(streamed.state)).toBe(json(full));
    expect(streamed.state).not.toHaveProperty('pendingCombatTerminal');
    expect(streamed.events.some(e => e.type === 'lootRevealed')).toBe(false);
    expect(settleMatchCombatStream(streamed.state, terminal)).toEqual({ ok: false, state: streamed.state, reason: 'wrong-phase' });
  });

  it('claiming the last orb in the gap survives JSON restore and grants every entry exactly once', () => {
    // Fixed public-command vector: seed 22 with this deployment kills an item carrier last.
    const { pool, before, terminal } = fixture(5, 4, 22), revealed = ok(revealMatchCombatStreamTerminal(before, terminal));
    const previous = new Set(readLootView(before).unclaimedOrbs!.map(o => o.orbId));
    const plans = revealed.state.m8.loot.frozen.rounds.flatMap(r => r.orbs);
    const orb = readLootView(revealed.state).unclaimedOrbs!.find(o => !previous.has(o.orbId)
      && plans.find(p => p.orbId === o.orbId)!.entries.some(e => e.payload.kind === 'item'))!;
    expect(orb).toBeDefined();
    const queued = accept(runSharedMatchCommand(pool, revealed.state, { type: 'claimOrb', round: before.round, orbId: orb.orbId }));
    valid(queued.state);
    expect(queued.state.items).toEqual(before.items);
    expect(queued.state.m8.loot.receipts).toEqual(before.m8.loot.receipts);
    const restored = restoreSharedOrbSnapshot(queued.pool, json(queued.state));
    expect(json(restored)).toBe(json(queued.state));
    const settle = (state: MatchState) => accept(runSharedMatchCommand(queued.pool, state, { type: 'settleCombatStream', terminal }));
    const paid = settle(queued.state);
    expect(json(settle(restored))).toBe(json(paid));
    valid(paid.state);
    const entries = paid.state.m8.loot.frozen.rounds.flatMap(r => r.orbs).find(o => o.orbId === orb.orbId)!.entries;
    expect(entries.some(e => e.payload.kind === 'item')).toBe(true);
    for (const entry of entries) {
      const receipts = paid.state.m8.loot.receipts.filter(r => r.dropId === entry.dropId);
      expect(receipts).toHaveLength(1);
      expect(receipts[0].resolution).not.toBe('forfeited');
      if (entry.payload.kind === 'item') expect(receipts[0].grantedItemIds).toHaveLength(entry.payload.quantity);
      for (const id of receipts[0].grantedItemIds) expect(paid.state.items.filter(i => i.id === id)).toHaveLength(1);
    }
    expect(paid.state.m8.loot.queuedOrbClaims).toEqual([]);
    expect(runSharedMatchCommand(paid.pool, paid.state, { type: 'claimOrb', round: before.round, orbId: orb.orbId })).toMatchObject({ ok: false, reason: 'already-claimed' });
    expect(runSharedMatchCommand(paid.pool, paid.state, { type: 'settleCombatStream', terminal })).toMatchObject({ ok: false, state: paid.state });
  });
});
