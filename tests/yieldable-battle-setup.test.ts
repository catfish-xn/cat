import { describe, expect, it } from 'vitest';
import { createMatch, deployMatchUnit, openMatchCombatStream, openMatchCombatStreamSteps, stepMatchCombatStream } from '../src/simulation/match';
import { snapshotForBattle, snapshotForBattleSteps, restorePlayerBattleSnapshot, restorePlayerBattleSnapshotSteps } from '../src/simulation/two-sided-snapshot';
import { compileBattle, compileBattleSteps, restoreBattleInput, restoreBattleInputSteps, startTwoSidedBattle, startTwoSidedBattleSteps } from '../src/simulation/two-sided-battle';
import { canonicalContent, canonicalContentSteps } from '../src/simulation/content';
import { freezeContent, freezeContentSteps } from '../src/simulation/content/freeze';
import { drainSetup } from '../src/simulation/setup-work';
import { buildStrategySnapshot, buildStrategySnapshotSteps } from '../src/simulation/strategy-snapshot';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import type { MatchState } from '../src/simulation/match-types';

const bytes = (value: unknown) => JSON.stringify(value);
function sliced<T>(work: Generator<void, T, void>, paused: () => void = () => {}): T {
  let count = 0;
  for (;;) {
    const next = work.next();
    if (next.done) { expect(count).toBeGreaterThan(0); return next.value; }
    expect(next.value).toBeUndefined(); count++; paused();
  }
}
function pve(seed: number) {
  const initial = createMatch(seed);
  const deployed = deployMatchUnit(initial, initial.preparation.units[0]!.id, { kind: 'board', cell: { col: 3, row: 6 } });
  if (!deployed.ok) throw Error(deployed.reason);
  return deployed.state;
}
// Legal asset descriptors, not fabricated restorable history (as in T2's hand oracles).
function pvp(seed: number): MatchState {
  const base = pve(seed), round = getCatalogRoundById('2-1');
  return { ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round },
    preparation: { ...base.preparation, units: base.preparation.units.filter(u => u.team === 'player') } };
}

describe('yieldable battle setup', () => {
  it.each([7, 42, 991])('PvP seed %i: snapshots, compiled input, every tick and full replay bytes match', seed => {
    const left = pvp(seed), right = pvp(seed + 1), original = bytes([left, right]);
    const a = sliced(snapshotForBattleSteps(left, 'a')), b = sliced(snapshotForBattleSteps(right, 'b'));
    expect(bytes(a)).toBe(bytes(snapshotForBattle(left, 'a')));
    expect(bytes(b)).toBe(bytes(snapshotForBattle(right, 'b')));
    expect(bytes(sliced(restorePlayerBattleSnapshotSteps(a)))).toBe(bytes(restorePlayerBattleSnapshot(a)));
    for (const mirror of [false, true]) {
      const identity = { battleId: `setup:${seed}`, ...(mirror ? { mirrorOfSeatId: 'b' } : {}) };
      const input = sliced(compileBattleSteps(a, b, seed, identity));
      expect(bytes(input)).toBe(bytes(compileBattle(a, b, seed, identity)));
      expect(bytes(sliced(restoreBattleInputSteps(input)))).toBe(bytes(restoreBattleInput(input)));
      const syncTicks: number[] = [], slicedTicks: number[] = [];
      const sync = startTwoSidedBattle(input, { captureReplay: true, beforeTick: tick => { syncTicks.push(tick); return []; } });
      const task = sliced(startTwoSidedBattleSteps(input, { captureReplay: true, beforeTick: tick => { slicedTicks.push(tick); return []; } }), () => {
        expect(bytes([left, right])).toBe(original);
        expect(slicedTicks).toEqual([]);
      });
      expect(bytes([task.initial, task.initialFrame])).toBe(bytes([sync.initial, sync.initialFrame]));
      let done = false;
      for (let tick = 0; tick < 1200 && !done; tick++) {
        const actual = task.advanceTick(), expected = sync.advanceTick();
        expect(bytes(actual)).toBe(bytes(expected)); done = actual.result !== null;
      }
      expect(done).toBe(true);
      expect(bytes(task.replay())).toBe(bytes(sync.replay()));
      expect(slicedTicks).toEqual(syncTicks);
    }
  });

  it.each([7, 42, 991])('PvE seed %i: initial, each step and RNG are byte identical; source stays unchanged', seed => {
    const source = pve(seed), original = bytes(source);
    const expected = openMatchCombatStream(source);
    const actual = sliced(openMatchCombatStreamSteps(source), () => expect(bytes(source)).toBe(original));
    expect(bytes(actual)).toBe(bytes(expected));
    expect(actual.ok && expected.ok).toBe(true);
    if (!actual.ok || !expected.ok) throw Error('open failed');
    let left = actual.state, right = expected.state, done = false;
    for (let tick = 0; tick < 1200 && !done; tick++) {
      const a = stepMatchCombatStream(left), b = stepMatchCombatStream(right);
      expect(bytes(a)).toBe(bytes(b)); left = a.state; right = b.state; done = a.terminal !== null;
    }
    expect(done).toBe(true); expect(bytes(source)).toBe(original);
  });

  it('preserves the frozen equipment trait basis through both compiler entry points', () => {
    const state = pve(42), original = bytes(state);
    const opening = buildStrategySnapshot(state);
    expect(opening.traits.length).toBeGreaterThan(0);
    // An explicit empty basis must override freshly derived membership too.
    for (const equipmentBasis of [opening, { ...opening, traits: [] }]) {
      const before = bytes(equipmentBasis);
      const sync = buildStrategySnapshot(state, undefined, undefined, equipmentBasis);
      const actual = sliced(buildStrategySnapshotSteps(state, undefined, undefined, equipmentBasis), () => {
        expect(bytes(state)).toBe(original);
        expect(bytes(equipmentBasis)).toBe(before);
      });
      expect(bytes(actual)).toBe(bytes(sync));
      expect(actual.traits).toBe(equipmentBasis.traits);
      expect(sync.traits).toBe(equipmentBasis.traits);
    }
  });

  it('cancellation during validation leaves input intact and a new initialization matches', () => {
    const state = pvp(42), original = bytes(state), work = snapshotForBattleSteps(state, 'a');
    expect(work.next().done).toBe(false);
    work.return(undefined as never);
    expect(bytes(state)).toBe(original);
    expect(bytes(sliced(snapshotForBattleSteps(state, 'a')))).toBe(bytes(snapshotForBattle(state, 'a')));
  });

  it('preserves failure reasons, including rejection after a pause, and failed command state identity', () => {
    const a = snapshotForBattle(pvp(42), 'a'), b = snapshotForBattle(pvp(7), 'b');
    for (const [sync, work] of [
      [() => restorePlayerBattleSnapshot({ ...a, version: 'bad' }), () => restorePlayerBattleSnapshotSteps({ ...a, version: 'bad' })],
      [() => compileBattle(a, a, 42), () => compileBattleSteps(a, a, 42)],
      [() => compileBattle(a, b, -1), () => compileBattleSteps(a, b, -1)],
      [() => restoreBattleInput({ ...compileBattle(a, b, 42), mapping: [] }), () => restoreBattleInputSteps({ ...compileBattle(a, b, 42), mapping: [] })],
    ] as const) {
      const failure = (run: () => unknown) => { try { run(); } catch (e) { return [String(e), (e as { reason: string }).reason]; } throw Error('expected refusal'); };
      expect(failure(() => drainSetup<unknown>(work()))).toEqual(failure(sync));
    }
    const initial = pve(42), opened = openMatchCombatStream(initial);
    if (!opened.ok) throw Error(opened.reason);
    const failed = drainSetup(openMatchCombatStreamSteps(opened.state));
    expect(failed).toEqual(openMatchCombatStream(opened.state));
    expect(failed.ok).toBe(false); expect(failed.state).toBe(opened.state);
  });

  it('traverses a large graph in multiple pieces, with unchanged canonical text and deep freeze', () => {
    const graph = Array.from({ length: 300 }, (_, i) => ({ z: [i, { n: i }], a: `unit-${i}` }));
    const original = bytes(graph);
    expect(sliced(canonicalContentSteps(graph))).toBe(canonicalContent(graph));
    const frozen = sliced(freezeContentSteps(structuredClone(graph)));
    expect(bytes(frozen)).toBe(original);
    expect(frozen.every(x => Object.isFrozen(x) && Object.isFrozen(x.z) && Object.isFrozen(x.z[1]))).toBe(true);
    expect(bytes(frozen)).toBe(bytes(freezeContent(structuredClone(graph))));
    expect(canonicalContent(frozen)).toBe(sliced(canonicalContentSteps(graph)));
  });

  it('preserves canonical array/getter order, rejects non-JSON and never caches mutable children', () => {
    const array = [1, 2];
    Object.defineProperty(array, Symbol.iterator, { value: function* () { yield 99; } });
    for (const canonical of [canonicalContent, (x: unknown) => drainSetup(canonicalContentSteps(x))]) {
      expect(canonical(array)).toBe('[1,2]');
      const calls: string[] = [], child = { n: 1 };
      const value = Object.freeze({ get z() { calls.push('z'); return child; }, get a() { calls.push('a'); return 2; } });
      expect(canonical(value)).toBe('{"a":2,"z":{"n":1}}');
      expect(calls).toEqual(['a', 'z']); child.n = 3;
      expect(canonical(value)).toBe('{"a":2,"z":{"n":3}}');
      expect(canonical({ '2': 2, '10': 10 })).toBe('{"10":10,"2":2}');
      for (const bad of [[, 1], { n: NaN }, { n: undefined }, new Date(0)]) expect(() => canonical(bad)).toThrow(TypeError);
    }
  });
});
