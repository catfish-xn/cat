import { deepStrictEqual } from 'node:assert';
import { describe, expect, it } from 'vitest';
import { snapshotData } from '../src/replay/snapshot';
import { BattleHistory, validateBattleRecord } from '../src/replay';
import { deepFreeze } from '../src/replay/history';
import { startMatchCombat, stepMatch } from '../src/simulation/match';
import { readyMatch } from './match-helpers';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';

describe('G4 detached replay snapshots', () => {
  it('shares only deeply immutable data and preserves dynamic aliases, cycles and scalar values', () => {
    const declaration = deepFreeze({ effect: { amount: 42 } }), dynamic = { hp: 7 };
    const source: any = { declaration, a: dynamic, b: dynamic, absent: undefined, negativeZero: -0 };
    source.self = source;
    Object.defineProperty(source, '__proto__', { value: { safe: true }, enumerable: true });
    const copy = snapshotData(source);
    deepStrictEqual(copy, structuredClone(source));
    expect(copy).not.toBe(source); expect(copy.a).not.toBe(dynamic);
    expect(copy.a).toBe(copy.b); expect(copy.self).toBe(copy);
    expect(copy.declaration).toBe(declaration);
    copy.a.hp = 0; expect(dynamic.hp).toBe(7);
  });
  it('keeps native cloning for accessors and non-JSON data without speculative getter calls', () => {
    let reads = 0;
    const source = { before: { n: 1 }, get sampled() { reads++; return { n: reads }; }, date: new Date(0), map: new Map([['x', 1]]) };
    const copy = snapshotData(source);
    expect(reads).toBe(1); expect(copy.sampled).toEqual({ n: 1 });
    expect(copy.date).toBeInstanceOf(Date); expect(copy.map).toBeInstanceOf(Map);
    expect(() => snapshotData({ fn() {} })).toThrow();
    const shallow = Object.freeze({ child: { hp: 7 } });
    const detached = snapshotData(shallow); shallow.child.hp = 0;
    expect(detached.child.hp).toBe(7);
  });
  it('cannot poison validated owned-record results or admit a tampered external copy', () => {
    let state = readyMatch(42);
    const history = new BattleHistory('g4-cache');
    const observe = (next: ReturnType<typeof stepMatch>) => {
      history.observe({ before: state, after: next.state, events: next.events.filter((e): e is LedgerCombatEvent => e.domain === 'combat'), reason: 'tick' });
      state = next.state;
    };
    const start = startMatchCombat(state); if (!start.ok) throw new Error(start.reason);
    observe(start);
    while (state.phase === 'combat') observe(stepMatch(state));
    const record = history.completedRecords[0], verified = validateBattleRecord(record), expected = structuredClone(verified);
    (verified.settledMatch as { playerHp: number }).playerHp = 0;
    (verified.terminal as { tick: number }).tick = 999;
    const next = validateBattleRecord(record);
    deepStrictEqual(next, expected); expect(next).not.toBe(verified);
    (next.terminal as { tick: number }).tick = 888;
    deepStrictEqual(validateBattleRecord(record), expected);
    const tampered = structuredClone(record); (tampered.initial as { tick: number }).tick = 1;
    expect(() => validateBattleRecord(deepFreeze(tampered))).toThrow();
    // A frozen outer upload still has mutable children. A successful earlier
    // read cannot authorize its later changed graph through an identity key.
    const shallow = Object.freeze(structuredClone(record));
    deepStrictEqual(validateBattleRecord(shallow), expected);
    (shallow.initial as { tick: number }).tick = 1;
    expect(() => validateBattleRecord(shallow)).toThrow();
  });
});

it('snapshots arrays, sparse entries and prototype-named JSON keys without changing the source',()=>{
 const input:any={array:new Array(3),constructor:{value:1},toString:'plain'};
 input.array[1]={hp:9};Object.defineProperty(input.array,'extra',{value:{ok:true},enumerable:true});
 const copy=snapshotData(input);
 deepStrictEqual(copy,structuredClone(input));
 expect(0 in copy.array).toBe(false);expect(copy.array[1]).not.toBe(input.array[1]);
 expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
});
