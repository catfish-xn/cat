import { isImmutableJson, shareGeneratedJson } from '../src/simulation/immutable-json';
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
  it('shares only immutable data with identical JSON bytes and retains negative zero/getters', () => {
    const first = shareGeneratedJson({ kind: 'g4', payload: { a: 1, b: 2 } });
    expect(shareGeneratedJson({ kind: 'g4', payload: { a: 1, b: 2 } })).toBe(first);
    expect(Object.isFrozen(first.payload)).toBe(true);
    const ordered = { kind: 'g4', payload: { b: 2, a: 1 } }, bytes = JSON.stringify(ordered);
    expect(shareGeneratedJson(ordered)).not.toBe(first);
    expect(JSON.stringify(ordered)).toBe(bytes);
    shareGeneratedJson({ n: 0 });
    expect(Object.is(shareGeneratedJson({ n: -0 }).n, -0)).toBe(true);
    let n = 1; const getter = { get n() { return n; } };
    shareGeneratedJson(getter); n++;
    expect(shareGeneratedJson(getter).n).toBe(2);
  });
  it('validated JSON comparison preserves canonical equality, object key order and array order', () => {
    const child = { n: 1 }, wrapper = Object.freeze({ child });
    const before = canonicalContent(wrapper); child.n++;
    expect(canonicalContent(wrapper)).not.toBe(before);
    let n = 1; const getter = Object.freeze({ get n() { return n; } });
    expect(canonicalContent(getter)).toBe('{"n":1}'); n++;
    expect(canonicalContent(getter)).toBe('{"n":2}');
    const values = [null, false, 0, -0, '', 'x', [], {}, [1, 2], [2, 1], { b: 2, a: [1] }, { a: [1], b: 2 }, { a: [1] }];
    for (const left of values) for (const right of values)
      expect(equalValidatedContent(left, right)).toBe(canonicalContent(left) === canonicalContent(right));
  });
});

it('admits detached deep-frozen checkpoints without freezing shallow children or executing getters', () => {
  const child = { hp: 1 }, shallow = Object.freeze({ child });
  expect(isImmutableJson(shallow)).toBe(false);
  child.hp++; expect(child.hp).toBe(2); expect(Object.isFrozen(child)).toBe(false);
  const checkpoint = Object.freeze({ child: Object.freeze({ hp: 2 }) });
  expect(isImmutableJson(checkpoint)).toBe(true);
  let reads = 0;
  const accessor = Object.freeze({ get child() { reads++; return checkpoint.child; } });
  expect(isImmutableJson(accessor)).toBe(false); expect(reads).toBe(0);
  const unusual = Object.freeze(Object.setPrototypeOf([1], { toJSON: () => 'changed' }));
  expect(isImmutableJson(unusual)).toBe(false);
});
