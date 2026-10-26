import { describe, expect, it } from 'vitest';
import { canonicalContent, digestContent } from '../src/simulation/content';
import { createScopedContentFreezer, freezeContent, freezeTransientContent, isFrozenContent } from '../src/simulation/content/freeze';
import { copyCombatUnitForTick, freezeCombatDeclarations, sharedCombatDeclarations } from '../src/simulation/combat-static';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { unit } from './combat-helpers';
import { createMatch, snapshotForBattle, compileBattle, startTwoSidedBattle, proposeSettlement,
  toCombatReplay, toCombatViewState, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';

function previousCopy(input: ReturnType<typeof unit>) {
  const shared = sharedCombatDeclarations(input);
  const omitted = Object.fromEntries(Object.keys(shared).map(key => [key, undefined]));
  const copy = structuredClone({ ...input, ...omitted,
    ...(input.mechanismDefinitions ? { mechanismDefinitions: undefined } : {}),
    ...(input.mechanismState ? { mechanismState: undefined } : {}),
    ...(input.triggerLedger ? { triggerLedger: undefined } : {}) });
  freezeCombatDeclarations(copy);
  return Object.assign(copy, shared,
    ...(input.mechanismDefinitions ? [{ mechanismDefinitions: input.mechanismDefinitions }] : []),
    ...(input.mechanismState ? [{ mechanismState: input.mechanismState }] : []),
    ...(input.triggerLedger ? [{ triggerLedger: input.triggerLedger }] : []));
}

describe('simulation performance preserves bytes and snapshot ownership', () => {
  it('scoped freezing preserves deep immutability without populating the global table', () => {
    const freeze = createScopedContentFreezer();
    const child = { n: 1 }, shallow = Object.freeze({ child });
    expect(freeze(shallow)).toBe(shallow);
    expect(Object.isFrozen(child)).toBe(true);
    expect(isFrozenContent(child)).toBe(false);
    expect(isFrozenContent(shallow)).toBe(false);
    const transient = freezeTransientContent({ nested: [{ n: 2 }] });
    expect(Object.isFrozen(transient.nested[0])).toBe(true);
    expect(isFrozenContent(transient.nested[0])).toBe(false);
    expect(() => { transient.nested[0].n = 3; }).toThrow();
  });
  it('incremental battle validation retains frozen results and rejects altered external graphs', () => {
    const base = createMatch(42), round = getCatalogRoundById('2-1');
    const state: MatchState = { ...base, round: round.ordinal, roundDefinitionId: round.roundId,
      m8: { ...base.m8, round }, preparation: { ...base.preparation, units: [{ id: 'unit-1', definitionId: 'maddie',
        starLevel: 1, team: 'player', location: { kind: 'board', cell: { col: 3, row: 4 } } }] } };
    const input = compileBattle(snapshotForBattle(state, 'A'), snapshotForBattle(state, 'B'), 42, { battleId: 'frozen-chunks' });
    const task = startTwoSidedBattle(input);
    let result = task.advance(1);
    for (let i = 1; !result && i < 1200; i++) result = task.advance(1);
    expect(result).not.toBeNull();
    const source = result!, bytes = canonicalContent(source), proposal = proposeSettlement(source);
    const assertFrozen = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return;
      expect(Object.isFrozen(value)).toBe(true);
      Object.values(value).forEach(assertFrozen);
    };
    assertFrozen(source); assertFrozen(proposal);
    const replay = toCombatReplay(source); assertFrozen(replay);
    const view = toCombatViewState(source.terminal); assertFrozen(view);
    expect(isFrozenContent(view)).toBe(false);
    expect(isFrozenContent(replay.ticks[1])).toBe(false);
    expect(canonicalContent(proposeSettlement(structuredClone(source)))).toBe(canonicalContent(proposal));
    expect(canonicalContent(source)).toBe(bytes);
    const clone = structuredClone(source);
    Object.assign(clone.events[0], { extra: Infinity });
    expect(() => proposeSettlement(clone)).toThrow('invalid-result');
    expect(() => proposeSettlement({ ...source, initial: { ...source.initial, extra: () => 1 } } as typeof source)).toThrow('invalid-result');
    const altered = structuredClone(source); Object.assign(altered.events[0], { eventSeq: 5 });
    expect(() => proposeSettlement(altered)).toThrow('invalid-result');
  });
  it.each([0, 256, 2047, 2048, 4096, 65536])('canonical text and digest across the short-cache boundary (%i)', length => {
    const input = { z: [{ text: '汉\\\"\n'.repeat(length), n: -0 }], a: [true, null, 1e21] };
    const expected = canonicalContent(input), digest = digestContent(input);
    const frozen = freezeContent(structuredClone(input));
    for (let i = 0; i < 3; i++) {
      expect(canonicalContent(frozen)).toBe(expected);
      expect(digestContent(frozen)).toBe(digest);
    }
  });
  it('never certifies a frozen wrapper containing mutable children or getters', () => {
    const child = { text: 'x'.repeat(5000) }, wrapper = Object.freeze({ child });
    const before = digestContent(wrapper); child.text += 'changed';
    expect(digestContent(wrapper)).not.toBe(before);
    let reads = 0;
    const getter = Object.freeze({ get child() { return ++reads; } });
    expect(canonicalContent(getter)).toBe('{"child":1}');
    expect(canonicalContent(getter)).toBe('{"child":2}');
  });
  it.each([{ kind: 'function', value: () => 1 }, { kind: 'symbol', value: Symbol('not-json') }])('retains native DataCloneError for $kind values', ({ value }) => {
    const input = Object.assign(unit('p', 'player', 1, 3), { probe: value });
    expect(() => copyCombatUnitForTick(input)).toThrow(expect.objectContaining({ name: 'DataCloneError' }));
  });
  it('detaches mutable input and writable state while reusing only immutable records', () => {
    const input = unit('p', 'player', 1, 3, {
      runtime: { ...EMPTY_RUNTIME },
      expansion: { damageDealt: 0, damageTaken: 0, crystals: 0, crystalDamage: 0, attacksRemaining: 0,
        buffUntilTick: 0, lastRetaliationTick: 0, chainUntilTick: 0, chainTargets: ['e'], chainCastSeq: 0, chainKills: 0 },
      tasks: [{ key: 'p:task', kind: 'bleed', source: { ownerId: 'p', sourceKind: 'ability', definitionId: 'bleed', instanceId: 'p:bleed', effectIndex: 0 },
        executeAtTick: 10, targetId: 'e', amount: 3, ordinal: 0, total: 1, cancellable: false, actionSeq: 1 }],
    });
    const bytes = JSON.stringify(input), first = copyCombatUnitForTick(input), second = copyCombatUnitForTick(first);
    expect(JSON.stringify(first)).toBe(JSON.stringify(previousCopy(input)));
    expect(JSON.stringify(second)).toBe(JSON.stringify(previousCopy(first)));
    expect(first.tasks).not.toBe(input.tasks);
    expect(first.tasks![0]).not.toBe(input.tasks![0]);
    expect(second.tasks).not.toBe(first.tasks);
    expect(second.tasks![0]).toBe(first.tasks![0]);
    expect(Object.isFrozen(second.tasks![0].source)).toBe(true);
    expect(Object.isFrozen(input.tasks![0].source)).toBe(false);
    expect(Object.isFrozen(input.ability)).toBe(false);
    (second.runtime as { attackCount: number }).attackCount++;
    second.expansion!.chainTargets.push('another');
    expect(JSON.stringify(input)).toBe(bytes);
    expect(first.expansion!.chainTargets).toEqual(['e']);
    expect(first.runtime!.attackCount).toBe(0);
  });
  it('detaches native fallback roots when they later appear inside another read-only record', () => {
    const input = unit('p', 'player', 1, 3);
    const first = copyCombatUnitForTick({ ...input, cell: new Date(1234) as unknown as typeof input.cell });
    const date = first.cell as unknown as Date;
    const nested = copyCombatUnitForTick({ ...input, cell: { ...input.cell, date } as typeof input.cell });
    const copiedDate = (nested.cell as typeof input.cell & { date: Date }).date;
    expect(copiedDate).toBeInstanceOf(Date);
    expect(copiedDate).not.toBe(date);
    copiedDate.setTime(5678);
    expect(date.getTime()).toBe(1234);
  });
});
