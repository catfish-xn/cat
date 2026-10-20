import currentFingerprints from './fixtures/v17-b8-fingerprints.json';
import { deepStrictEqual } from 'node:assert';
import { freeze } from './combat-helpers';
import { expectWallClockBelow } from './fixtures/wallclock';
import { beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, toCombatReplay, startMatchCombat, stepCombat,
  type MatchState, type LedgerCombatEvent, type CombatReplayInput } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import type { CombatState } from '../src/simulation/combat-types';
import { catalogPreparation } from './t5r-helpers';

const compiledInputs = new Map<string, ReturnType<typeof compileBattle>>();
function input(count = 9, mirror = false) {
  const key = `${count}:${mirror}`, cached = compiledInputs.get(key);
  if (cached) return cached;
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  const names = ['irelia', 'leona', 'tristana', 'maddie', 'lux', 'darius', 'irelia', 'leona', 'lux'];
  const state: MatchState = { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId,
    m8: { ...base.m8, round }, items: [], preparation: { ...base.preparation,
      units: names.slice(0, count).map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
        team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: i % 7, row: 4 + Math.floor(i / 7) } } })) } };
  const compiled = compileBattle(snapshotForBattle(state, 'A'), snapshotForBattle(state, 'B'), 42,
    { battleId: 'resumable', ...(mirror ? { mirrorOfSeatId: 'B' } : {}) });
  compiledInputs.set(key, compiled); return compiled;
}
let pveSource: CombatReplayInput | undefined;
function pve(): CombatReplayInput {
  if (pveSource) return pveSource;
  const start = startMatchCombat(catalogPreparation('3-7'));
  if (!start.ok || !start.state.combat) throw new Error('start');
  const initial = start.state.combat;
  let terminal: CombatState = initial;
  const events = start.events.filter((e): e is LedgerCombatEvent => e.domain === 'combat');
  while (terminal.status === 'running') {
    const next = stepCombat(terminal); terminal = next.state; events.push(...toLedgerEvents(next.events));
  }
  return pveSource = freeze({ initial, terminal, events });
}
const controlBattles = new Map<boolean, ReturnType<typeof resolveTwoSidedBattle>>();
function controlBattle(mirror = false) {
  let battle = controlBattles.get(mirror);
  if (!battle) { battle = freeze(resolveTwoSidedBattle(input(9, mirror), 1201)); controlBattles.set(mirror, battle); }
  return battle;
}
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const invalid = [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1];

export function registerB8(mode: 'fast' | 'timing'): void {
if (mode === 'fast') {
  beforeAll(() => { pve(); });
  for (const mirror of [false, true]) beforeAll(() => { controlBattle(mirror); });
}
describe('SR-B8-02 resumable pure tasks', () => {
  if (mode === 'fast') { it.each([0, 1, 9])('pre-change byte fingerprint: %s units per side', count => {
    const battle = resolveTwoSidedBattle(input(count), 1201);
    // G2 bytes audited in docs/evidence/g2-1/fixture-migration.json.
    const fingerprints: Record<number, readonly string[]> = currentFingerprints;
    const replay = toCombatReplay(battle);
    // G5 adds only heal.shares. Retain the original byte anchor for every prior field,
    // and independently check every newly exposed share against the complete ledger.
    const legacyReplay = { ...replay, ticks: replay.ticks.map(frame => ({ ...frame,
      events: frame.events.map(event => {
        if (event.type !== 'heal') return event;
        const { shares: _shares, ...legacy } = event; return legacy;
      }) })) };
    deepStrictEqual([sha(battle), sha(legacyReplay)], fingerprints[count]);
    deepStrictEqual(replay.ticks.flatMap(frame => frame.events).filter(event => event.type === 'heal')
      .map(event => ({ eventSeq: event.eventSeq, shares: event.shares })),
    battle.events.filter(event => event.type === 'heal').map(event => ({ eventSeq: event.eventSeq,
      shares: event.outcome.shares.map(share => ({ sourceId: share.source.ownerId, actual: share.actual })) })));
  }); }
  if (mode === 'fast') { it.each([1, 7, 100, 1201])('PvP and mirror equal synchronous bytes at slice %s', budget => {
    for (const mirror of [false, true]) {
      const source = input(9, mirror), before = JSON.stringify(source);
      const expected = controlBattle(mirror), task = startTwoSidedBattle(source);
      let result = null, calls = 0;
      while (!result && calls++ < 1201) result = task.advance(budget);
      expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
      expect(calls).toBe(Math.max(1, Math.ceil(expected.terminal.tick / budget)));
      expect(task.advance(1)).toBe(result);
      expect(JSON.stringify(source)).toBe(before);
    }
  }); }
  if (mode === 'fast') { it.each([1, 13, 100, 1201])('PvP/PvE replay bytes and deferred tick0 at slice %s', budget => {
    for (const source of [controlBattle(), pve()]) {
      const expected = toCombatReplay(source), task = startCombatReplay(source);
      let result = null, calls = 0;
      while (!result && calls++ < 1201) result = task.advance(budget);
      expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
      expect(calls).toBe(Math.max(1, Math.ceil(source.terminal.tick / budget)));
      expect(task.advance(1)).toBe(result);
    }
  }); }
  if (mode === 'fast') { it('invalid budgets never consume a slice, including after completion; old total cap still faults', () => {
    const source = input(), battle = controlBattle();
    const tasks = [startTwoSidedBattle(source), startCombatReplay(battle)];
    for (const task of tasks) {
      for (const budget of invalid) expect(() => task.advance(budget)).toThrow('invalid-budget');
      expect(task.advance(1)).toBeNull();
      expect(task.advance(1201)).not.toBeNull();
      for (const budget of invalid) expect(() => task.advance(budget)).toThrow('invalid-budget');
    }
    expect(() => resolveTwoSidedBattle(source, 1)).toThrow('step-limit-exceeded');
  }); }
  if (mode === 'fast') { it('tick0 terminal completes once without stepping', () => {
    const task = startTwoSidedBattle(input(0)), result = task.advance(1)!;
    expect(result.terminal.tick).toBe(0); expect(task.advance(1)).toBe(result);
    const replay = startCombatReplay(result), view = replay.advance(1)!;
    expect(view.ticks).toHaveLength(1); expect(replay.advance(1)).toBe(view);
  }); }
  if (mode === 'fast') { it('owns mutable input through pauses and retains replay divergence validation', () => {
    const source = structuredClone(controlBattle());
    const expected = toCombatReplay(source), task = startCombatReplay(source);
    expect(task.advance(1)).toBeNull(); Object.assign(source, { events: [] });
    deepStrictEqual(task.advance(1201), expected);
    const original = pve(), bad = { ...original, events: original.events.slice(0, -1) };
    const invalidTask = startCombatReplay(bad);
    expect(invalidTask.advance(1)).toBeNull();
    expect(() => invalidTask.advance(1201)).toThrow('replay-divergence');
  }); }
  if (mode === 'fast') { it('defers early and trailing animation divergence until the terminal slice', () => {
    const source = controlBattle();
    const damage = source.events.find(event => event.type === 'packetDamage')!;
    expect(damage.type).toBe('packetDamage');
    if (damage.type !== 'packetDamage') throw new Error('missing damage fixture');
    for (const events of [
      source.events.map(event => event === damage
        ? { ...event, outcome: { ...event.outcome, hpDamage: event.outcome.hpDamage + 1 } } : event),
      [...source.events, damage],
    ]) {
      const task = startCombatReplay({ ...source, events });
      for (let tick = 1; tick < source.terminal.tick; tick++) expect(task.advance(1)).toBeNull();
      expect(() => task.advance(1)).toThrow('replay-divergence');
    }
  }); }
  if (mode === 'timing') {
    for (const name of ['battle', 'replay'] as const) describe(name, { concurrent: false, shuffle: false }, () => {
      let factory: () => ReturnType<typeof startTwoSidedBattle> | ReturnType<typeof startCombatReplay>;
      const measure = () => {
        let begin = performance.now(); const task = factory(); const startupMs = performance.now() - begin;
        let longestMs = 0, result = null, calls = 0;
        while (!result && calls++ < 1201) {
          begin = performance.now(); result = task.advance(1); longestMs = Math.max(longestMs, performance.now() - begin);
        }
        expect(result).not.toBeNull();
        return { startupMs, longestMs, calls };
      };
      const samples: ReturnType<typeof measure>[] = [];
      beforeAll(() => {
        const source = input();
        if (name === 'battle') factory = () => startTwoSidedBattle(source);
        else {
          const battle = resolveTwoSidedBattle(source, 1201);
          factory = () => startCombatReplay(battle);
        }
        measure(); // Exactly one complete warmup of this task kind, not a sample.
      });
      // Consecutive samples each retain the original default test timeout.
      // Each longestMs is the maximum of every one-tick advance in that run.
      it.each([1, 2, 3, 4, 5])('complete one-tick measurement %i', () => { samples.push(measure()); });
      it('one-tick scheduling budget on nine-unit armies: median startup and longest advance', () => {
        expect(samples).toHaveLength(5);
        const median = (values: number[]) => [...values].sort((a, b) => a - b)[2];
        const startupMs = median(samples.map(sample => sample.startupMs));
        const longestMs = median(samples.map(sample => sample.longestMs));
        console.info(JSON.stringify({ name, warmups: 1, samples, startupMs, longestMs }));
        expectWallClockBelow(`b8 ${name} median startup`, startupMs, 50); expectWallClockBelow(`b8 ${name} median longest advance`, longestMs, 50);
      });
    });
  }
});
}
