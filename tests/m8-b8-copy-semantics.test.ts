import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { canonicalContent } from '../src/simulation/content';

/* Node-one audit Q1 (P2): the plain-data tick copy and the concatenating canonicalContent were
 * withdrawn; the original structuredClone detach and map/join canonicalisation are restored.
 * These are the audit's counterexamples through the public stepMatch entry, pinned to the
 * original semantics: every accessor is read exactly once and non-plain values keep
 * structuredClone's platform behaviour. */
function combatWithProbe(define: (unit: Record<string, unknown>) => void) {
  const started = api.startMatchCombat(api.createMatch(42));
  if (!started.ok) throw new Error(started.reason);
  const unit = { ...started.state.combat!.units[0] } as Record<string, unknown>;
  define(unit);
  return { ...started.state, combat: { ...started.state.combat!, units: [unit, ...started.state.combat!.units.slice(1)] } } as api.MatchState;
}

describe('B8 node-one Q1: original copy semantics on the public step entry', () => {
  it('a getter that first returns a function is read once and fails with DataCloneError', () => {
    let reads = 0;
    const state = combatWithProbe(unit => Object.defineProperty(unit, 'probe', { enumerable: true,
      get: () => (++reads === 1 ? () => 1 : 2) }));
    expect(() => api.stepMatch(state)).toThrow(expect.objectContaining({ name: 'DataCloneError' }));
    expect(reads).toBe(1);
  });
  it('a getter returning a Date is read once and its value is cloned as a Date', () => {
    let reads = 0;
    const state = combatWithProbe(unit => Object.defineProperty(unit, 'probe', { enumerable: true,
      get: () => new Date(++reads * 1000) }));
    const next = api.stepMatch(state).state.combat!.units.find(unit => (unit as unknown as Record<string, unknown>).probe !== undefined) as unknown as Record<string, unknown>;
    expect(reads).toBe(1);
    expect(next.probe).toBeInstanceOf(Date);
    expect((next.probe as Date).getTime()).toBe(1000);
  });
  it('a sparse array with an extra key keeps both the hole and the key', () => {
    const decorated = Object.assign(new Array(1), { extra: 'keep' });
    const state = combatWithProbe(unit => { unit.probe = decorated; });
    const next = api.stepMatch(state).state.combat!.units.find(unit => (unit as unknown as Record<string, unknown>).probe !== undefined) as unknown as Record<string, unknown>;
    const copy = next.probe as unknown[] & { extra?: string };
    expect(copy).not.toBe(decorated);
    expect(copy.length).toBe(1);
    expect(0 in copy).toBe(false);
    expect(copy.extra).toBe('keep');
  });
});

describe('B8 node-one Q1: canonicalContent keeps its original map/join semantics', () => {
  it('reads each object accessor once, in sorted key order', () => {
    const reads: string[] = [];
    const value = {};
    for (const key of ['b', 'a']) Object.defineProperty(value, key, { enumerable: true, get: () => { reads.push(key); return reads.length; } });
    expect(canonicalContent(value)).toBe('{"a":1,"b":2}');
    expect(reads).toEqual(['a', 'b']);
  });
  it('an element accessor that deletes a later element follows Array.prototype.map (skipped, empty slot)', () => {
    const value: unknown[] = [0, 2];
    Object.defineProperty(value, 0, { enumerable: true, configurable: true, get: () => { delete value[1]; return 1; } });
    // The sparse check runs first on the intact array; map then skips the deleted index.
    expect(canonicalContent(value)).toBe('[1,]');
  });
  it('an element accessor that returns a non-finite value still fails with the original message', () => {
    const value: unknown[] = [0];
    Object.defineProperty(value, 0, { enumerable: true, get: () => Number.NaN });
    expect(() => canonicalContent(value)).toThrow('Content must be finite plain JSON data');
  });
});
