import { describe, expect, it } from 'vitest';
import { createOpeningEncounter, OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG, selectOpeningEncounterFromWord, validateOpeningEncounterContext } from '../src/simulation/opening-encounter';

// Independent arithmetic implementation: BigInt modulo 2^32 rather than Math.imul.
function oracle(seed: number): number {
  const mask = 0xffffffffn;
  let salt = 2166136261n;
  for (const ch of 'opening-encounter-v1/select') salt = ((salt ^ BigInt(ch.charCodeAt(0))) * 16777619n) & mask;
  let x = BigInt(seed) ^ salt;
  x = ((x ^ (x >> 16n)) * 0x85ebca6bn) & mask;
  x = ((x ^ (x >> 13n)) * 0xc2b2ae35n) & mask;
  return Number((x ^ (x >> 16n)) & mask);
}

describe('v23 independent review: fmix32 selection', () => {
  it('all seeds 0..9999 match independent words and weighted intervals, with broad distribution', () => {
    const counts = new Map<string, number>();
    const words = new Set<number>();
    for (let seed = 0; seed < 10000; seed++) {
      const c = createOpeningEncounter(seed), word = oracle(seed);
      expect(c.selectionRng).toEqual({ state: word, draws: 1 });
      let end = 0;
      const ticket = Number(BigInt(word) * 10000n / 4294967296n);
      const chosen = OPENING_ENCOUNTERS.find(e => { end += e.weightBps; return ticket < end; })!;
      expect(c.selection.encounterId).toBe(chosen.id);
      words.add(word); counts.set(chosen.id, (counts.get(chosen.id) ?? 0) + 1);
    }
    expect(words.size).toBe(10000); // fmix32 is a permutation of uint32 inputs.
    expect([...counts.keys()].sort()).toEqual(OPENING_ENCOUNTERS.filter(e => e.weightBps > 0).map(e => e.id).sort());
    // Fixed seed window is a regression vector, not a probabilistic/flaky test.
    // Pearson chi-square across all catalog bins, including disabled entries.
    const chiSquare = OPENING_ENCOUNTERS.reduce((sum, e) => sum + ((counts.get(e.id) ?? 0) - e.weightBps) ** 2 / e.weightBps, 0);
    expect(chiSquare).toBeLessThan(60);
    console.info('v23 fmix32 counts:', JSON.stringify(Object.fromEntries(counts)), 'chiSquare:', chiSquare);
  });

  it('every cumulative interval boundary maps exactly, including the largest uint32', () => {
    let start = 0;
    for (const entry of OPENING_ENCOUNTERS) {
      if (entry.weightBps > 0) {
        const first = Number((BigInt(start) * 4294967296n + 9999n) / 10000n);
        const last = Number((BigInt(start + entry.weightBps) * 4294967296n + 9999n) / 10000n - 1n);
        expect(selectOpeningEncounterFromWord(first)).toBe(entry.id);
        expect(selectOpeningEncounterFromWord(last)).toBe(entry.id);
      }
      start += entry.weightBps;
    }
    expect(start).toBe(10000);
    expect(() => selectOpeningEncounterFromWord(2 ** 32)).toThrow();
  });

  it('serialized contexts authenticate exactly and reject old config, changed word or changed seed', () => {
    const current = createOpeningEncounter(9999);
    expect(() => validateOpeningEncounterContext(JSON.parse(JSON.stringify(current)), 9999)).not.toThrow();
    for (const bad of [
      { ...current, selection: { ...current.selection, configVersion: 'opening-encounters-14.24b-batch-a-v1' } },
      { ...current, selectionRng: { ...current.selectionRng, state: current.selectionRng.state ^ 1 } },
      { ...current, seed: 9998 },
    ]) expect(() => validateOpeningEncounterContext(bad, 9999)).toThrow('opening-context-mismatch');
    expect(OPENING_ENCOUNTER_CONFIG.selection).toMatch(/^murmur3-fmix32-word/);
  });
});
