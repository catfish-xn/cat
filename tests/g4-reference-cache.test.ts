import { describe, expect, it } from 'vitest';
import { canonicalContent, equalValidatedContent } from '../src/simulation/content';
import { freezeLootThroughRound, restoreFrozenLootLedger } from '../src/simulation/loot-freeze';
import { createOrbLayout, freezeOrbLayoutThroughRound, restoreOrbLayout } from '../src/simulation/orb-layout';

describe('G4 deterministic reference cache boundaries', () => {
  it('reuses generated references while revalidating mutable layouts and ledgers', () => {
    const result = freezeOrbLayoutThroughRound(createOrbLayout(42), 38);
    if (!result.ok) throw Error(result.reason);
    const layout = result.layout, ledger = freezeLootThroughRound(9, 38, layout);
    expect(freezeLootThroughRound(9, 38, layout)).toBe(ledger);
    const mutable = JSON.parse(JSON.stringify(layout));
    expect(restoreOrbLayout(mutable)).toEqual(layout);
    mutable.rng.draws++;
    expect(() => freezeLootThroughRound(9, 38, mutable)).toThrow('Invalid orb layout');
    const copy = JSON.parse(JSON.stringify(ledger));
    expect(restoreFrozenLootLedger(copy, { seed: 9, throughRoundOrdinal: 38, layout })).toEqual(ledger);
    copy.rounds[0].encounterPlan.drops[0].payload.quantity++;
    expect(() => restoreFrozenLootLedger(copy, { seed: 9, throughRoundOrdinal: 38, layout })).toThrow('Invalid frozen loot ledger');
  });
  it('bounded reference eviction preserves seed/boundary and replay bytes', () => {
    const original = freezeLootThroughRound(42, 38), bytes = canonicalContent(original);
    for (let seed = 100; seed < 240; seed++) freezeLootThroughRound(seed, 1);
    expect(canonicalContent(freezeLootThroughRound(42, 38))).toBe(bytes);
    expect(freezeLootThroughRound(42, 37).throughRoundOrdinal).toBe(37);
    expect(freezeLootThroughRound(43, 38).seed).toBe(43);
    freezeLootThroughRound(0, 1);
    expect(Object.is(freezeLootThroughRound(-0, 1).seed, -0)).toBe(true);
    expect(Object.is(freezeLootThroughRound(0, 1).seed, -0)).toBe(false);
  });
  it('validated JSON comparison preserves canonical equality, object key order and array order', () => {
    const values = [null, false, 0, -0, '', 'x', [], {}, [1, 2], [2, 1], { b: 2, a: [1] }, { a: [1], b: 2 }, { a: [1] }];
    for (const left of values) for (const right of values)
      expect(equalValidatedContent(left, right)).toBe(canonicalContent(left) === canonicalContent(right));
  });
});
