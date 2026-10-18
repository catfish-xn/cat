import { describe, expect, it } from 'vitest';
import { canonicalContent } from '../src/simulation/content';
import { createMatch, startMatchCombat, stepMatch } from './fixtures/recorded-match';
import { restoreMatch, serializeMatch } from './fixtures/history-evidence';
import { accepted } from './match-helpers';

const running = () => accepted(startMatchCombat(createMatch(42)));
const failure = (run: () => unknown) => {
  try { run(); } catch (error) {
    if (error instanceof Error) return { name: error.name, message: error.message };
    throw error;
  }
  throw new Error('Expected rejection');
};

describe('B7 serialization compilation reuse and object-input isolation', () => {
  it('keeps canonical bytes, input ownership and continuation across repeated saves', () => {
    let state = running();
    for (let tick = 0; tick < 15; tick++) {
      const before = structuredClone(state), expected = canonicalContent(restoreMatch(state));
      for (let save = 0; save < 2; save++) {
        expect(serializeMatch(state)).toBe(expected);
        const object = JSON.parse(expected), restored = restoreMatch(object);
        expect(restored).toEqual(state);
        expect(restored.combat!.strategy).not.toBe(object.combat.strategy);
        expect(stepMatch(restored)).toEqual(stepMatch(state));
        expect(state).toEqual(before);
        expect(Object.isFrozen(object)).toBe(false);
      }
      state = stepMatch(state).state;
    }
  });

  it('does not let a warm compilation hide edits or change rejection messages', () => {
    const state = running(), text = serializeMatch(state);
    const mutations = [
      (s: any) => { s.combat.strategy.units[0].stats.attack++; },
      (s: any) => { s.combat.units[0].attackDamage++; },
      (s: any) => { s.nextItemSerial++; },
      (s: any) => { s.combatInputBasis.inputs.preparation.units[0].definitionId = 'lux'; },
      (s: any) => { s.resourceProvenance.entries[0].source.extra = 1; },
      (s: any) => { s.gold = Infinity; },
      (s: any) => { s.extra = undefined; },
    ];
    for (const mutate of mutations) {
      const raw = JSON.parse(text);
      serializeMatch(raw); // Warm serialization compilation before editing the same object.
      mutate(raw);
      const expected = failure(() => canonicalContent(restoreMatch(raw)));
      expect(failure(() => serializeMatch(raw))).toEqual(expected);
      expect(restoreMatch(text)).toEqual(state);
    }
  });

  it('retains accessor evaluation and cloning behavior of object serialization', () => {
    const text = serializeMatch(running());
    const candidate = () => {
      const raw = JSON.parse(text), gold = raw.gold;
      let reads = 0;
      Object.defineProperty(raw, 'gold', { enumerable: true, get() { reads++; return gold; } });
      return { raw, reads: () => reads };
    };
    const reference = candidate(), actual = candidate();
    const expected = canonicalContent(restoreMatch(reference.raw));
    expect(serializeMatch(actual.raw)).toBe(expected);
    expect(actual.reads()).toBe(reference.reads());
    expect(Object.isFrozen(actual.raw)).toBe(false);
  });

  it.each(['cycle', 'typed-array'])('keeps the legacy freeze rejection for ignored array properties containing a %s', kind => {
    const raw = JSON.parse(serializeMatch(running()));
    const extra: any = kind === 'cycle' ? [] : new Uint8Array([1]);
    if (kind === 'cycle') extra.push(extra);
    raw.m8.loot.receipts.extra = extra;
    const expected = failure(() => canonicalContent(restoreMatch(raw)));
    expect(failure(() => serializeMatch(raw))).toEqual(expected);
  });

  it('keeps negative zero in object restore and normalizes only serialized bytes', () => {
    const raw = JSON.parse(serializeMatch(running()));
    raw.combat.units[0].cooldownTicks = -0;
    raw.combatInputBasis.inputs.augmentProgress.pumpingRounds = -0;
    const restored = restoreMatch(raw);
    expect(Object.is(restored.combat!.units[0].cooldownTicks, -0)).toBe(true);
    expect(Object.is(restored.combatInputBasis!.inputs.augmentProgress.pumpingRounds, -0)).toBe(true);
    expect(serializeMatch(raw)).toBe(canonicalContent(restored));
    expect(Object.is(raw.combat.units[0].cooldownTicks, -0)).toBe(true);
  });
});
