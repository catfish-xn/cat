import currentFingerprints from './fixtures/g2-1-b8-fingerprints.json';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, toCombatReplay, startMatchCombat, stepCombat,
  type MatchState, type LedgerCombatEvent, type CombatReplayInput } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import type { CombatState } from '../src/simulation/combat-types';
import { catalogPreparation } from './t5r-helpers';

function input(count = 9, mirror = false) {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  const names = ['irelia', 'leona', 'tristana', 'maddie', 'lux', 'darius', 'irelia', 'leona', 'lux'];
  const state: MatchState = { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId,
    m8: { ...base.m8, round }, items: [], preparation: { ...base.preparation,
      units: names.slice(0, count).map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
        team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: i % 7, row: 4 + Math.floor(i / 7) } } })) } };
  return compileBattle(snapshotForBattle(state, 'A'), snapshotForBattle(state, 'B'), 42,
    { battleId: 'resumable', ...(mirror ? { mirrorOfSeatId: 'B' } : {}) });
}
function pve(): CombatReplayInput {
  const start = startMatchCombat(catalogPreparation('3-7'));
  if (!start.ok || !start.state.combat) throw new Error('start');
  const initial = start.state.combat;
  let terminal: CombatState = initial;
  const events = start.events.filter((e): e is LedgerCombatEvent => e.domain === 'combat');
  while (terminal.status === 'running') {
    const next = stepCombat(terminal); terminal = next.state; events.push(...toLedgerEvents(next.events));
  }
  return { initial, terminal, events };
}
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const invalid = [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1];

describe('SR-B8-02 resumable pure tasks', () => {
  it.each([0, 1, 9])('pre-change byte fingerprint: %s units per side', count => {
    const battle = resolveTwoSidedBattle(input(count), 1201);
    // Recompiled in both real engines; byte differences are audited in g2-1/fixture-migration.json.
    const fingerprints = currentFingerprints;
    expect([sha(battle), sha(toCombatReplay(battle))]).toEqual(fingerprints[String(count) as keyof typeof fingerprints]);
  });
  it.each([1, 7, 100, 1201])('PvP and mirror equal synchronous bytes at slice %s', budget => {
    for (const mirror of [false, true]) {
      const source = input(9, mirror), before = JSON.stringify(source);
      const expected = resolveTwoSidedBattle(source, 1201), task = startTwoSidedBattle(source);
      let result = null, calls = 0;
      while (!result && calls++ < 1201) result = task.advance(budget);
      expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
      expect(calls).toBe(Math.max(1, Math.ceil(expected.terminal.tick / budget)));
      expect(task.advance(1)).toBe(result);
      expect(JSON.stringify(source)).toBe(before);
    }
  });
  it.each([1, 13, 100, 1201])('PvP/PvE replay bytes and deferred tick0 at slice %s', budget => {
    for (const source of [resolveTwoSidedBattle(input(), 1201), pve()]) {
      const expected = toCombatReplay(source), task = startCombatReplay(source);
      let result = null, calls = 0;
      while (!result && calls++ < 1201) result = task.advance(budget);
      expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
      expect(calls).toBe(Math.max(1, Math.ceil(source.terminal.tick / budget)));
      expect(task.advance(1)).toBe(result);
    }
  });
  it('invalid budgets never consume a slice, including after completion; old total cap still faults', () => {
    const source = input(), battle = resolveTwoSidedBattle(source, 1201);
    const tasks = [startTwoSidedBattle(source), startCombatReplay(battle)];
    for (const task of tasks) {
      for (const budget of invalid) expect(() => task.advance(budget)).toThrow('invalid-budget');
      expect(task.advance(1)).toBeNull();
      expect(task.advance(1201)).not.toBeNull();
      for (const budget of invalid) expect(() => task.advance(budget)).toThrow('invalid-budget');
    }
    expect(() => resolveTwoSidedBattle(source, 1)).toThrow('step-limit-exceeded');
  });
  it('tick0 terminal completes once without stepping', () => {
    const task = startTwoSidedBattle(input(0)), result = task.advance(1)!;
    expect(result.terminal.tick).toBe(0); expect(task.advance(1)).toBe(result);
    const replay = startCombatReplay(result), view = replay.advance(1)!;
    expect(view.ticks).toHaveLength(1); expect(replay.advance(1)).toBe(view);
  });
  it('owns mutable input through pauses and retains replay divergence validation', () => {
    const source = structuredClone(resolveTwoSidedBattle(input(), 1201));
    const expected = toCombatReplay(source), task = startCombatReplay(source);
    expect(task.advance(1)).toBeNull(); Object.assign(source, { events: [] });
    expect(task.advance(1201)).toEqual(expected);
    const original = pve(), bad = { ...original, events: original.events.slice(0, -1) };
    const invalidTask = startCombatReplay(bad);
    expect(invalidTask.advance(1)).toBeNull();
    expect(() => invalidTask.advance(1201)).toThrow('replay-divergence');
  });
  it('one-tick scheduling budget on nine-unit armies: measures startup and longest advance', () => {
    const source = input();
    // Warm engine paths before measuring, without weakening the 50 ms target.
    const battle = resolveTwoSidedBattle(source, 1201); toCombatReplay(battle);
    for (const [name, factory] of [
      ['battle', () => startTwoSidedBattle(source)],
      ['replay', () => startCombatReplay(battle)],
    ] as const) {
      let begin = performance.now(); const task = factory(); const startupMs = performance.now() - begin;
      let longestMs = 0, result = null, calls = 0;
      while (!result && calls++ < 1201) {
        begin = performance.now(); result = task.advance(1); longestMs = Math.max(longestMs, performance.now() - begin);
      }
      console.info(JSON.stringify({ name, startupMs, longestMs, calls }));
      expect(result).not.toBeNull(); expect(startupMs).toBeLessThan(50); expect(longestMs).toBeLessThan(50);
    }
  });
});
