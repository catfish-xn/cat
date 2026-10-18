import { describe, expect, it } from 'vitest';
import { canonicalContent, digestContent } from '../src/simulation/content';
import { freezeContent } from '../src/simulation/content/freeze';
import { copyCombatUnitForTick, freezeCombatDeclarations, sharedCombatDeclarations } from '../src/simulation/combat-static';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { unit } from './combat-helpers';

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
});
