import { describe, expect, it, vi } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { appendAugmentFact, historyRoster, traceHistoryCommand } from '../src/simulation/augment-history';
import { augmentDeathBoundary, augmentPreparationElapsed, augmentRecordedDeathEvents, withHistoryProof } from '../src/simulation/augment-history-log';
import { freezeContent } from '../src/simulation/content/freeze';
import { isImmutableJson } from '../src/simulation/immutable-json';
import { clonePlainData } from '../src/simulation/plain-clone';
import { snapshotData } from '../src/replay/snapshot';
import { fixedCapture } from '../src/persistence/capture-ownership';
import type { AugmentDeath, AugmentHistory, AugmentHistoryFact } from '../src/simulation/augment-history-types';
import type { MatchState } from '../src/simulation/match-types';

function origin(): MatchState {
  return { ...createMatch(42), augmentHistory: { version: 'augment-history-v1', seatId: 'solo', facts: [], proof: { kind: 'server' } } };
}
const history = (state: MatchState): AugmentHistory => state.augmentHistory!;
const boundary = (state: MatchState, tick: number, battleId = 'battle-a', deaths: readonly AugmentDeath[] = []): MatchState =>
  appendAugmentFact(state, { kind: 'deaths', battleId, completeThroughTick: tick, deaths });

describe('append-only augment history checkpoints', () => {
  it('publishes writable data fields from frozen inputs, retaining key order and accepting facts replacement', () => {
    const initial = freezeContent(boundary(origin(), 1));
    const next = boundary(initial, 2), nextHistory = history(next);
    expect(Object.keys(nextHistory)).toEqual(['version', 'seatId', 'facts', 'proof']);
    for (const key of Object.keys(nextHistory)) {
      expect(Object.getOwnPropertyDescriptor(nextHistory, key)).toEqual({
        value: Reflect.get(nextHistory, key), enumerable: true, configurable: true, writable: true,
      });
    }
    const replacement: AugmentHistoryFact[] = [];
    expect(Reflect.set(nextHistory, 'version', 'augment-history-v1')).toBe(true);
    expect(Reflect.set(nextHistory, 'seatId', 'solo')).toBe(true);
    expect(Reflect.set(nextHistory, 'facts', replacement)).toBe(true);
    expect(nextHistory.facts).toBe(replacement);
    // The private index must follow the current data property, not its old array.
    expect(augmentDeathBoundary(nextHistory, 'battle-a', 2)).toBe(false);
    const appended = boundary(next, 3);
    expect(history(appended).facts.map(fact => fact.sequence)).toEqual([0]);
    expect(history(initial).facts).toHaveLength(1);
    expect(Reflect.deleteProperty(nextHistory, 'seatId')).toBe(true);
  });

  it('preserves old/frozen snapshots, branch prefixes, and ordinary clone/JSON array bytes', () => {
    const initial = origin(), first = boundary(initial, 1);
    const firstBytes = JSON.stringify(first), frozen = freezeContent(first);
    const second = boundary(frozen, 2), third = boundary(second, 3);
    const fork = boundary(frozen, 20), forkNext = boundary(fork, 21);
    expect(JSON.stringify(first)).toBe(firstBytes);
    expect(history(initial).facts).toEqual([]);
    for (const [state, ticks] of [[second, [1, 2]], [third, [1, 2, 3]], [fork, [1, 20]], [forkNext, [1, 20, 21]]] as const) {
      const expected = ticks.map((tick, sequence) => ({ kind: 'deaths', battleId: 'battle-a', completeThroughTick: tick, deaths: [],
        sequence, seatId: 'solo', round: state.round, roundId: state.roundDefinitionId, resourcePrefix: state.resourceProvenance.entries.length }));
      expect(history(state).facts).toEqual(expected);
      expect(JSON.stringify(history(state).facts)).toBe(JSON.stringify(expected));
      const clone = structuredClone(state);
      expect(clone).toEqual(state);
      expect(Array.isArray(history(clone).facts)).toBe(true);
      expect(Object.getOwnPropertyDescriptor(history(clone), 'facts')?.get).toBeUndefined();
      expect(JSON.stringify(clone)).toBe(JSON.stringify(state));
    }
  });

  it('indexes empty boundaries and death identities without letting future or fork rows authenticate an old prefix', () => {
    const initial = origin(), first = boundary(initial, 1);
    const death = { eventSeq: 17 } as AugmentDeath;
    const second = boundary(first, 2, 'battle-a', [death]);
    expect(augmentDeathBoundary(history(second), 'battle-a', 1)).toBe(true);
    expect(augmentDeathBoundary(history(second), 'battle-a', 2)).toBe(true);
    expect(augmentRecordedDeathEvents(history(second), 'battle-a')).toEqual(new Set([17]));
    expect(augmentDeathBoundary(history(first), 'battle-a', 2)).toBe(false);
    expect(augmentRecordedDeathEvents(history(first), 'battle-a')).toEqual(new Set());
    const fork = boundary(first, 9, 'battle-b', [{ eventSeq: 19 } as AugmentDeath]);
    expect(augmentDeathBoundary(history(fork), 'battle-a', 2)).toBe(false);
    expect(augmentDeathBoundary(history(second), 'battle-b', 9)).toBe(false);
    expect(augmentRecordedDeathEvents(history(fork), 'battle-a')).toEqual(new Set());
    expect(augmentRecordedDeathEvents(history(fork), 'battle-b')).toEqual(new Set([19]));
    // Repeated ticks/identities retain the first boundary's prefix position.
    const repeated = boundary(second, 1, 'battle-a', [death]);
    expect(augmentDeathBoundary(history(repeated), 'battle-a', 1)).toBe(true);
    expect(augmentRecordedDeathEvents(history(repeated), 'battle-a')).toEqual(new Set([17]));
    const cold = structuredClone(second);
    expect(augmentRecordedDeathEvents(history(cold), 'battle-a')).toEqual(new Set([17]));
  });

  it('keeps acquisition and explicit preparation clock precedence, rounds, cold inputs, and historical prefixes', () => {
    const initial = origin();
    const acquired = appendAugmentFact(initial, { kind: 'acquire', choiceId: 'a', definitionId: 'shop-glitch', goldBefore: initial.gold,
      hpBefore: initial.playerHp, roster: historyRoster(initial), preparationElapsedMs: 300, previousBattle: { status: 'none' } });
    const advanced = appendAugmentFact(acquired, { kind: 'preparation-time', elapsedMs: 500 });
    const later = appendAugmentFact({ ...advanced, round: advanced.round + 1 }, { kind: 'preparation-time', elapsedMs: 10 });
    for (const state of [later, structuredClone(later)]) {
      expect(augmentPreparationElapsed(history(state), initial.round)).toBe(500);
      expect(augmentPreparationElapsed(history(state), later.round)).toBe(10);
      expect(augmentPreparationElapsed(history(state), later.round + 1)).toBeUndefined();
    }
    expect(augmentPreparationElapsed(history(acquired), initial.round)).toBe(300);
    expect(augmentPreparationElapsed(history(acquired), initial.round, true)).toBeUndefined();
    const fork = appendAugmentFact(acquired, { kind: 'preparation-time', elapsedMs: 400 });
    expect(augmentPreparationElapsed(history(fork), initial.round)).toBe(400);
    expect(augmentPreparationElapsed(history(advanced), initial.round)).toBe(500);
  });

  it('appends and checks 4096 tick boundaries without reading the public fact array again', () => {
    let reads = 0;
    const initial = origin(), facts: readonly AugmentHistoryFact[] = [];
    let state = { ...initial, augmentHistory: { ...history(initial), get facts() { reads++; return facts; } } };
    for (let tick = 0; tick < 4096; tick++) {
      state = boundary(state, tick) as typeof state;
      expect(augmentDeathBoundary(history(state), 'battle-a', tick)).toBe(true);
      expect(augmentPreparationElapsed(history(state), state.round)).toBeUndefined();
      state = { ...state, augmentHistory: withHistoryProof(history(state), { kind: 'server' }) };
    }
    expect(reads).toBe(1);
    expect(history(state).facts).toHaveLength(4096);
    expect(history(state).facts.at(-1)?.sequence).toBe(4095);
    expect(history(initial).facts).toEqual([]);
  });

  it('compresses only consecutive steps and preserves prior command bytes across forks, clones, and failed commands', () => {
    const seed = createMatch(42);
    const initial: MatchState = { ...seed, augmentHistory: { ...history(origin()), proof: { kind: 'solo', origin: seed, commands: [] } } };
    const execute = (state: MatchState, name: string, args: readonly unknown[] = []) =>
      traceHistoryCommand(name, [state, ...args], () => ({ ...state }));
    const first = execute(initial, 'stepMatch'), firstBytes = JSON.stringify(first);
    const second = execute(first, 'stepMatch'), secondBytes = JSON.stringify(second);
    const third = execute(second, 'stepMatch');
    const parameter = { nested: [1, 2] };
    const fork = execute(first, 'parameter', [parameter, undefined]);
    parameter.nested.push(3);
    const following = execute(fork, 'stepMatch');
    const commands = (state: MatchState) => { const proof = history(state).proof; if (proof.kind !== 'solo') throw Error('solo proof'); return proof.commands; };
    expect(commands(third)).toEqual([{ name: 'stepMatch', args: [], count: 3 }]);
    expect(commands(following)).toEqual([{ name: 'stepMatch', args: [], count: 1 },
      { name: 'parameter', args: [{ nested: [1, 2] }, null], count: 1 }, { name: 'stepMatch', args: [], count: 1 }]);
    expect(JSON.stringify(first)).toBe(firstBytes);
    expect(JSON.stringify(second)).toBe(secondBytes);
    const cold = execute(structuredClone(second), 'stepMatch');
    expect(JSON.stringify(cold)).toBe(JSON.stringify(third));
    const failed = { ok: false, state: first, reason: 'test' };
    expect(traceHistoryCommand('stepMatch', [first], () => failed)).toBe(failed);
    expect(JSON.stringify(first)).toBe(firstBytes);
  });

  it('keeps facts and solo commands on the plain-data paths and shares immutable Match subgraphs in snapshots and captures', () => {
    const seed = createMatch(42);
    const initial: MatchState = { ...seed, augmentHistory: { ...history(origin()), proof: { kind: 'solo', origin: seed, commands: [] } } };
    const appended = boundary(initial, 1);
    const traced = traceHistoryCommand('stepMatch', [appended], () => ({ ...appended }));
    const state = { ...traced, preparation: structuredClone(traced.preparation) };
    const proof = history(state).proof;
    if (proof.kind !== 'solo') throw Error('solo proof');
    expect(Object.getOwnPropertyDescriptor(history(state), 'facts')).toEqual({ value: history(state).facts,
      enumerable: true, configurable: true, writable: true });
    expect(Object.getOwnPropertyDescriptor(proof, 'commands')).toEqual({ value: proof.commands,
      enumerable: true, configurable: true, writable: true });
    expect(Array.isArray(history(state).facts)).toBe(true);
    expect(Array.isArray(proof.commands)).toBe(true);
    expect(Reflect.set(proof, 'commands', proof.commands.slice())).toBe(true);
    expect(isImmutableJson(state.m8)).toBe(true);
    const nativeClone = vi.spyOn(globalThis, 'structuredClone');
    try {
      const mutableHistoryCopy = snapshotData(state);
      expect(mutableHistoryCopy.m8).toBe(state.m8);
      expect(mutableHistoryCopy.augmentHistory).not.toBe(state.augmentHistory);
      expect(mutableHistoryCopy.augmentHistory).toEqual(state.augmentHistory);
      expect(isImmutableJson(freezeContent(history(state)))).toBe(true);
      const copy = snapshotData(state);
      expect(copy).toEqual(state);
      expect(copy).not.toBe(state);
      expect(copy.m8).toBe(state.m8);
      expect(copy.augmentHistory).toBe(state.augmentHistory);
      expect(copy.preparation).not.toBe(state.preparation);
      const capture = fixedCapture({ match: state, currentBattle: null, battleKeys: [], addedBattles: [] });
      expect(capture.match).not.toBe(state);
      expect(capture.match.m8).toBe(state.m8);
      expect(capture.match.augmentHistory).toBe(state.augmentHistory);
      expect(clonePlainData(state)).toEqual(state);
      expect(nativeClone).not.toHaveBeenCalled();
    } finally { nativeClone.mockRestore(); }
  });
});
