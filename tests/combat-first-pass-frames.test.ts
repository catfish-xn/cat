import { performance } from 'node:perf_hooks';
import { describe, expect, it, vi } from 'vitest';
import * as replayView from '../src/simulation/combat-replay-view';
import {
  createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  proposeSettlement, startCombatReplay, createCombatReplayRecorder, stepCombat, startMatchCombat,
  equipItem, type MatchState, type BattleInput, type CombatReplay, type LedgerCombatEvent, type CombatState,
} from '../src/server-entry';
import { canonicalContent } from '../src/simulation/content';
import { isFrozenContent } from '../src/simulation/content/freeze';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { grantMechanicItem } from '../src/simulation/seat-mechanics';
import { catalogPreparation } from './t5r-helpers';

function seat(hero = 'lux', coat = false, empty = false): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  let state: MatchState = { ...base, round: round.ordinal, roundDefinitionId: round.roundId,
    m8: { ...base.m8, round }, preparation: { ...base.preparation, units: empty ? [] : [
      { id: 'unit-1', definitionId: hero, starLevel: 1, team: 'player',
        location: { kind: 'board', cell: { col: 3, row: 4 } } },
    ] } };
  if (coat) {
    const grant = grantMechanicItem(state, { receiptId: 'first-pass-coat', source: 'test',
      definitionId: 'TFT_Item_Artifact_SuspiciousTrenchCoat' });
    if (!grant.ok) throw Error(grant.reason);
    const equip = equipItem(grant.state, grant.state.items.at(-1)!.id, 'unit-1', 0);
    if (!equip.ok) throw Error(equip.reason);
    state = equip.state;
  }
  return state;
}
function input(seed: number, kind = 'ordinary'): BattleInput {
  return compileBattle(snapshotForBattle(seat(kind === 'forge' ? 'jayce' : 'lux', kind === 'trench', kind === 'empty'), 'A'),
    snapshotForBattle(seat('lux', false, kind === 'empty'), 'B'), seed, { battleId: `first-pass-${kind}-${seed}` });
}
function replayOf(battle: Parameters<typeof startCombatReplay>[0]): CombatReplay {
  return startCombatReplay(battle).advance(1201)!;
}
function deeplyFrozen(value: unknown): void {
  if (value && typeof value === 'object') {
    expect(Object.isFrozen(value)).toBe(true);
    for (const child of Object.values(value)) deeplyFrozen(child);
  }
}
function captured(source: BattleInput, budget: number) {
  const task = startTwoSidedBattle(source, { captureReplay: true });
  expect(task.replay()).toBeNull();
  expect(() => task.advance(0)).toThrow('invalid-budget');
  let result = null, calls = 0;
  do {
    result = task.advance(budget); calls++;
    if (!result) expect(task.replay()).toBeNull();
  } while (!result);
  expect(calls).toBe(Math.max(1, Math.ceil(result.terminal.tick / budget)));
  expect(task.advance(1)).toBe(result);
  expect(() => task.advance(0)).toThrow('invalid-budget');
  const replay = task.replay()!;
  expect(task.replay()).toBe(replay);
  return { result, replay };
}

describe('first-pass combat frames', () => {
  // Three independent RNG seeds exercise ordinary attacks/casts. Jayce adds the
  // G2-3 forge and its first-tick roster reorder. Trench replaces an original
  // hero with two dynamic clones: identity alignment, enter/leave and keyframes.
  it.each([[42, 'ordinary'], [43, 'ordinary'], [44, 'ordinary'], [45, 'forge'], [46, 'trench']] as const)(
    'PvP seed %s / %s preserves result, settlement and every replay byte', (seed, kind) => {
      const source = input(seed, kind), before = canonicalContent(source);
      const t0 = performance.now();
      const control = resolveTwoSidedBattle(source, 1201), expectedReplay = replayOf(control);
      const rerunMs = performance.now() - t0, t1 = performance.now();
      const actual = captured(source, 7), captureMs = performance.now() - t1;
      expect(canonicalContent(actual.result)).toBe(canonicalContent(control));
      expect(canonicalContent(actual.replay)).toBe(canonicalContent(expectedReplay));
      expect(canonicalContent(proposeSettlement(actual.result))).toBe(canonicalContent(proposeSettlement(control)));
      expect(canonicalContent(source)).toBe(before);
      deeplyFrozen(actual.replay);
      expect(isFrozenContent(actual.replay)).toBe(false);
      expect(() => Object.assign(actual.replay.initial.units[0], { hp: -1 })).toThrow(TypeError);
      if (kind === 'forge') expect(control.initial.units.some(u => u.definitionId.includes('forge'))).toBe(true);
      if (kind === 'trench') {
        expect(control.terminal.trenchSplits).toHaveLength(1);
        expect(actual.replay.ticks.some(f => f.events.some(e => e.type === 'unitEntered'))).toBe(true);
        expect(actual.replay.ticks.some(f => f.events.some(e => e.type === 'unitLeft'))).toBe(true);
      }
      if (seed === 42) console.info(JSON.stringify({ seed, rerunMs, captureMs, referenceOnly: true }));
    });

  it('advance(1), advance(7), advance(1201) have identical boundaries, frames and results', () => {
    const source = input(46, 'trench');
    const results = [1, 7, 1201].map(budget => captured(source, budget));
    expect(canonicalContent(results[0])).toBe(canonicalContent(results[1]));
    expect(canonicalContent(results[1])).toBe(canonicalContent(results[2]));
    expect(() => resolveTwoSidedBattle(source, 1)).toThrow('step-limit-exceeded');
  });

  it('disabled capture retains original task shape and result; tick-zero finish is supported', () => {
    const source = input(47, 'empty');
    const plain = startTwoSidedBattle(source), disabled = startTwoSidedBattle(source, { captureReplay: false });
    expect(Object.keys(plain)).toEqual(['sampleBankGold','advance']);
    expect(Object.keys(disabled)).toEqual(['sampleBankGold','advance']);
    expect(canonicalContent(disabled.advance(1))).toBe(canonicalContent(plain.advance(1)));
    const actual = captured(source, 1);
    expect(actual.result.terminal.tick).toBe(0);
    expect(canonicalContent(actual.replay)).toBe(canonicalContent(replayOf(actual.result)));
    deeplyFrozen(actual.replay);
  });

  it('does not cache a result when replay finalization throws, and can retry consistently', () => {
    const createRecorder = replayView.createCombatReplayRecorder;
    const failure = new Error('replay finish failed');
    let finish: ReturnType<typeof vi.spyOn> | undefined;
    const factory = vi.spyOn(replayView, 'createCombatReplayRecorder').mockImplementation((...args) => {
      const recorder = createRecorder(...args);
      finish = vi.spyOn(recorder, 'finish').mockImplementation(() => { throw failure; });
      return recorder;
    });
    try {
      const task = startTwoSidedBattle(input(48), { captureReplay: true });
      expect(factory).toHaveBeenCalledOnce();
      expect(() => task.advance(1201)).toThrow(failure);
      expect(task.replay()).toBeNull();
      expect(() => task.advance(1)).toThrow(failure);
      expect(task.replay()).toBeNull();
      expect(finish).toHaveBeenCalledTimes(2);
      finish!.mockRestore();
      const result = task.advance(1);
      expect(result).not.toBeNull();
      expect(canonicalContent(task.replay())).toBe(canonicalContent(replayOf(result!)));
      expect(task.advance(1)).toBe(result);
    } finally {
      finish?.mockRestore();
      factory.mockRestore();
    }
  });

  // Real Match PvE routes: opening combat and wolves' deferred tick-zero jumps.
  it.each([['1-2', 51], ['3-7', 52]] as const)('PvE %s seed %s: server-style stepping records identical bytes', (round, seed) => {
    const start = startMatchCombat(catalogPreparation(round, seed));
    if (!start.ok || !start.state.combat) throw Error('start');
    const initial = start.state.combat;
    const events = start.events.filter((e): e is LedgerCombatEvent => e.domain === 'combat');
    const suppliedInitial = structuredClone(initial), suppliedEvents = structuredClone(events);
    const recorder = createCombatReplayRecorder(suppliedInitial, suppliedEvents);
    Object.assign(suppliedInitial.units[0], { hp: -123 });
    if (suppliedEvents[0]) Object.assign(suppliedEvents[0], { tick: -123 });
    expect(() => recorder.finish(initial)).toThrow('invalid-replay-input');
    let terminal: CombatState = initial;
    while (terminal.status === 'running') {
      const next = stepCombat(terminal);
      // Record mutable detached input, then mutate it after record returns. No
      // saved frame may depend on that input or freeze the caller's checkpoint.
      const supplied = structuredClone(next);
      const frame = recorder.record(terminal, supplied), bytes = canonicalContent(frame);
      deeplyFrozen(frame);
      Object.assign(supplied.state.units[0], { hp: -123 });
      Object.assign(supplied.state.units[0].cell, { col: -123 });
      if (supplied.events[0]) Object.assign(supplied.events[0], { tick: -123 });
      expect(canonicalContent(frame)).toBe(bytes);
      terminal = next.state; events.push(...toLedgerEvents(next.events));
    }
    const actual = recorder.finish(terminal);
    expect(canonicalContent(actual)).toBe(canonicalContent(replayOf({ initial, terminal, events })));
    expect(recorder.finish(terminal)).toBe(actual);
    expect(() => recorder.record(terminal, stepCombat(terminal))).toThrow('replay-divergence');
    expect(() => recorder.finish({ ...terminal, tick: terminal.tick + 1 })).toThrow('replay-divergence');
    deeplyFrozen(actual);
  });

  it('rejects nonzero starts, skipped/repeated ticks and inconsistent terminal without advancing', () => {
    const start = startMatchCombat(createMatch(53));
    if (!start.ok || !start.state.combat) throw Error('start');
    const initial = start.state.combat, next = stepCombat(initial);
    const recorder = createCombatReplayRecorder(initial, []);
    expect(() => createCombatReplayRecorder(next.state, [])).toThrow('invalid-replay-input');
    expect(() => recorder.record(next.state, stepCombat(next.state))).toThrow('replay-divergence');
    recorder.record(initial, next);
    expect(() => recorder.record(initial, next)).toThrow('replay-divergence');
  });
});
