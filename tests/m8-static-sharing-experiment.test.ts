import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { itemMatch } from './fixtures/m8-b4-match';

type MutableUnit = Record<string, any>;
const holder = (state: api.MatchState): MutableUnit => state.combat!.units.find(u => u.id === 'unit-1')!;

describe('experimental static sharing: observable contract and hostile boundaries', () => {
  it('shares only frozen owned declarations; dynamic state stays detached', () => {
    const state = itemMatch('titans-resolve'), unit = holder(state);
    const before = structuredClone(state);
    const next = holder(api.stepMatch(state).state);
    expect(next.itemPrograms).toBe(unit.itemPrograms);
    expect(next.sources).toBe(unit.sources);
    expect(Object.isFrozen(unit.itemPrograms)).toBe(true);
    expect(Object.isFrozen(unit.itemPrograms[0].program)).toBe(true);
    expect(Object.isFrozen(unit.sources[0])).toBe(true);
    expect(next.runtime).not.toBe(unit.runtime);
    expect(next.statuses).not.toBe(unit.statuses);
    expect(next.tasks).not.toBe(unit.tasks);
    expect(next.shieldLayers).not.toBe(unit.shieldLayers);
    expect(state).toEqual(before);
    expect(Reflect.set(unit.itemPrograms[0].source, 'ownerId', 'forged')).toBe(false);
    expect(Reflect.set(unit.sources, 0, null)).toBe(false);
  });

  it('does not intern declarations across independent matches; mutation cannot poison another match', () => {
    const a = itemMatch('titans-resolve'), b = itemMatch('titans-resolve');
    const left = holder(a), right = holder(b), saved = structuredClone(b);
    expect(left.itemPrograms).not.toBe(right.itemPrograms);
    expect(left.itemPrograms[0].program).not.toBe(right.itemPrograms[0].program);
    expect(left.sources).not.toBe(right.sources);
    expect(Reflect.set(left.itemPrograms[0].program, 'effects', [])).toBe(false);
    api.stepMatch(a);
    expect(b).toEqual(saved);
    expect(api.stepMatch(a)).toEqual(api.stepMatch(b));
  });

  it('replacement with another trusted battle root still takes a detached native copy', () => {
    const a = itemMatch('titans-resolve'), b = itemMatch('titans-resolve');
    holder(a).itemPrograms = holder(b).itemPrograms;
    const next = holder(api.stepMatch(a).state);
    expect(next.itemPrograms).toEqual(holder(b).itemPrograms);
    expect(next.itemPrograms).not.toBe(holder(b).itemPrograms);
    expect(Object.isFrozen(next.itemPrograms)).toBe(false);
  });

  it('foreign frozen lookalikes are not trusted and arbitrary functions still reject', () => {
    const state = itemMatch('titans-resolve'), unit = holder(state);
    unit.itemPrograms = Object.freeze(structuredClone(unit.itemPrograms));
    const next = holder(api.stepMatch(state).state);
    expect(next.itemPrograms).not.toBe(unit.itemPrograms);
    unit.itemPrograms = [() => 1];
    expect(() => api.stepMatch(state)).toThrow(expect.objectContaining({ name: 'DataCloneError' }));
  });

  it('preserves cross-field aliases into a shared subtree by falling back without freezing the alias', () => {
    const state = itemMatch('titans-resolve'), unit = holder(state);
    unit.probe = { program: unit.itemPrograms[0].program, root: unit.sources };
    unit.probe.self = unit.probe;
    const next = holder(api.stepMatch(state).state);
    expect(next.itemPrograms).not.toBe(unit.itemPrograms);
    expect(next.probe.program).toBe(next.itemPrograms[0].program);
    expect(next.probe.root).toBe(next.sources);
    expect(next.probe.self).toBe(next.probe);
    expect(Object.isFrozen(next.probe.program)).toBe(false);
  });

  it('reads nested accessors only once; function first values are not skipped', () => {
    const state = itemMatch('titans-resolve'), unit = holder(state);
    let reads = 0;
    unit.probe = Object.defineProperty({}, 'value', { enumerable: true, get: () => ++reads === 1 ? () => 1 : 2 });
    expect(() => api.stepMatch(state)).toThrow(expect.objectContaining({ name: 'DataCloneError' }));
    expect(reads).toBe(1);
  });

  it('preserves Date, Map, sparse arrays and nested getter order on the fallback', () => {
    const state = itemMatch('titans-resolve'), unit = holder(state), reads: string[] = [];
    const probe: Record<string, unknown> = { sparse: Object.assign(new Array(2), { extra: 7 }), date: new Date(12), map: new Map([[1, 2]]) };
    for (const key of ['z', 'a']) Object.defineProperty(probe, key, { enumerable: true, get: () => { reads.push(key); return key; } });
    unit.probe = probe;
    const next = holder(api.stepMatch(state).state);
    expect(reads).toEqual(['z', 'a']);
    expect(next.probe.date).toEqual(new Date(12));
    expect(next.probe.map).toEqual(new Map([[1, 2]]));
    expect(0 in next.probe.sparse).toBe(false);
    expect(next.probe.sparse.extra).toBe(7);
  });

  it('valid restore freezes only detached output; text/object continuations match live', () => {
    const state = itemMatch('titans-resolve'), raw = structuredClone(state), saved = serializeMatch(state);
    const object = restoreMatch(raw), text = restoreMatch(saved);
    expect(object).toEqual(state); expect(text).toEqual(state);
    expect(Object.isFrozen(holder(raw).itemPrograms)).toBe(false);
    expect(Object.isFrozen(holder(object).itemPrograms)).toBe(true);
    expect(holder(object).itemPrograms).not.toBe(holder(text).itemPrograms);
    expect(api.stepMatch(object)).toEqual(api.stepMatch(state));
    expect(api.stepMatch(text)).toEqual(api.stepMatch(state));
  });

  it('restore still rejects forged definition/source, function, Date and sparse declarations', () => {
    const state = itemMatch('titans-resolve');
    const changes = [
      (u: MutableUnit) => { u.itemPrograms[0].source.ownerId = 'forged'; },
      (u: MutableUnit) => { u.itemPrograms[0].program = { effects: [] }; },
      (u: MutableUnit) => { u.sources[0].source.ownerId = 'forged'; },
      (u: MutableUnit) => { u.itemPrograms = [() => 1]; },
      (u: MutableUnit) => { u.itemPrograms = new Date(); },
      (u: MutableUnit) => { u.itemPrograms = new Array(1); },
    ];
    for (const change of changes) {
      const raw = structuredClone(state); change(holder(raw));
      expect(() => restoreMatch(raw)).toThrow();
      expect(Object.isFrozen(holder(raw).sources)).toBe(false);
    }
  });

  it('records the Proxy trap contract limitation explicitly; rejection is still DataCloneError', () => {
    const state = itemMatch('titans-resolve'), unit = holder(state), calls: string[] = [];
    unit.probe = new Proxy({}, { getPrototypeOf: target => { calls.push('getPrototypeOf'); return Reflect.getPrototypeOf(target); } });
    expect(() => structuredClone({ probe: unit.probe })).toThrow(expect.objectContaining({ name: 'DataCloneError' }));
    expect(calls).toEqual([]);
    expect(() => api.stepMatch(state)).toThrow(expect.objectContaining({ name: 'DataCloneError' }));
    expect(calls).toContain('getPrototypeOf'); // Experimental incompatibility, not a compatibility pass.
  });
});
