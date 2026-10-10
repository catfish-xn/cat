import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatch, startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import * as provenance from '../src/simulation/resource-provenance';
import { accepted, finish } from './match-helpers';

const running = () => accepted(startMatchCombat(createMatch(42)));
afterEach(() => vi.restoreAllMocks());

describe('B8 within-restore complete resource projection reuse', () => {
  it('folds a running full prefix once per restore, never across inputs or calls', () => {
    const state = running(), raw = JSON.parse(JSON.stringify(state));
    const saved = JSON.stringify(raw), fold = vi.spyOn(provenance, 'foldResourceProvenance');
    const first = restoreMatch(saved);
    expect(first).toEqual(state); expect(JSON.stringify(raw)).toBe(saved);
    expect(fold).toHaveBeenCalledTimes(1);
    const projection = fold.mock.results[0].value;
    expect(Object.isFrozen(projection)).toBe(true);
    expect(Object.isFrozen(projection.units)).toBe(true);
    expect(first.combatInputBasis!.inputs.persistentGrowth).not.toBe(projection.persistentGrowth);
    const second = restoreMatch(saved);
    expect(fold).toHaveBeenCalledTimes(2);
    expect(second).toEqual(first); expect(second).not.toBe(first);
    expect(second.combatInputBasis).not.toBe(first.combatInputBasis);
    expect(second.combatInputBasis!.inputs.preparation).not.toBe(first.combatInputBasis!.inputs.preparation);
    expect(stepMatch(second)).toEqual(stepMatch(first));
    expect(restoreMatch(raw)).toEqual(first);
    expect(fold).toHaveBeenCalledTimes(4); // All object inputs retain the old double fold.
    raw.resourceProvenance.entries[0].source.extra = 1;
    expect(() => restoreMatch(raw)).toThrow(/^Invalid resource provenance: fields$/);
    expect(fold).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(first)).toBe(saved);
  });

  it('retains two full-ledger validations for finished combat with a shorter historical prefix', () => {
    const state = finish(running()), raw = JSON.parse(JSON.stringify(state));
    expect(state.combat?.status).toBe('finished');
    expect(state.combatInputBasis!.provenancePrefixLength).toBeLessThan(state.resourceProvenance.entries.length);
    const fold = vi.spyOn(provenance, 'foldResourceProvenance');
    expect(restoreMatch(JSON.stringify(raw))).toEqual(state);
    expect(fold).toHaveBeenCalledTimes(2);
    expect(fold.mock.calls[0][1].prefixLength).toBeUndefined();
    expect(fold.mock.calls[1][1].prefixLength).toBe(state.combatInputBasis!.provenancePrefixLength);
    // A valid historical prefix must not hide an illegal fact in its later suffix.
    raw.resourceProvenance.entries.at(-1).extra = 1;
    expect(() => restoreMatch(raw)).toThrow(/^Invalid resource provenance: fields$/);
    expect(fold).toHaveBeenCalledTimes(3);
  });

  it('still rejects a running basis prefix mutation after the complete fold succeeded', () => {
    const raw = JSON.parse(JSON.stringify(running()));
    raw.combatInputBasis.provenancePrefixLength = 0;
    const fold = vi.spyOn(provenance, 'foldResourceProvenance');
    expect(() => restoreMatch(JSON.stringify(raw))).toThrow(/^Invalid combat input basis$/);
    expect(fold).toHaveBeenCalledTimes(1);
  });

  it.each(['persistentGrowth', 'preparation'] as const)('preserves object rejection if a %s accessor changes the already-read ledger', property => {
    const raw = JSON.parse(JSON.stringify(running())), value = raw[property];
    const originalFold = provenance.foldResourceProvenance;
    let folded = false, changed = false;
    const fold = vi.spyOn(provenance, 'foldResourceProvenance').mockImplementation((ledger, context) => {
      const result = originalFold(ledger, context); folded = true; return result;
    });
    Object.defineProperty(raw, property, { enumerable: true, configurable: true, get() {
      if (folded) { raw.resourceProvenance.entries[0].source.extra = 1; changed = true; }
      return value;
    } });
    expect(() => restoreMatch(raw)).toThrow(/^Invalid resource provenance: fields$/);
    expect(changed).toBe(true); expect(fold).toHaveBeenCalledTimes(2);
  });
});
