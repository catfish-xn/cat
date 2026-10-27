import { expect, it, vi } from 'vitest';
import { canonicalContent, digestContent } from '../src/simulation/content';
import { equalContent } from '../src/simulation/battle-record-validation';
import * as match from '../src/simulation/match';
import { BattleHistory, PlaybackSession } from '../src/replay';
import type { BattleRecord } from '../src/m6/contracts';
import type { LedgerCombatEvent } from '../src/simulation/combat-types';

const outcome = (run: () => unknown) => {
  try { return { value: run() }; }
  catch (error) { return { name: (error as Error).name, message: (error as Error).message }; }
};
it('replay equality preserves canonical values and validates both complete graphs', () => {
  const values: unknown[] = [null, false, true, -0, 0, 1e21, '\ud800', '', undefined, NaN, Infinity, 1n,
    {}, [], { a: 1, b: [false, null] }, { b: [false, null], a: 1 }, { '10': 1, '2': 2 },
    { a: 0, z: Infinity }, { a: 1, z: undefined }, [1, , 3], [1, 2, 3],
    Object.assign([1], { extra: 'ignored' }), new Date(0), new Map(), Object.create(null)];
  for (const a of values) for (const b of values)
    expect(outcome(() => equalContent(a, b))).toEqual(outcome(() => canonicalContent(a) === canonicalContent(b)));
  const hidden = { b: 1 };
  Object.defineProperty(hidden, 'a', { value: 1, enumerable: false });
  expect(equalContent({ a: 1 }, hidden)).toBe(false);
  expect(equalContent(Object.freeze({ a: [1] }), { a: [1] })).toBe(true);
  const mutable = { a: [1] };
  expect(equalContent(mutable, { a: [1] })).toBe(true);
  mutable.a[0] = 2;
  expect(equalContent(mutable, { a: [1] })).toBe(false);
});
it('accessors and custom array dispatch use the original encoder exactly once', () => {
  const fixture = () => {
    const reads: string[] = [];
    const value = { get z() { reads.push('z'); return [2]; }, get a() { reads.push('a'); return 1; } };
    return { value, reads };
  };
  const before = fixture(), after = fixture(), right = { z: [2], a: 1 };
  expect(equalContent(after.value, right)).toBe(canonicalContent(before.value) === canonicalContent(right));
  expect(after.reads).toEqual(before.reads);
  let calls = 0;
  const custom = Object.assign([1], { map: () => { calls++; return ['custom']; } });
  expect(equalContent(custom, [1])).toBe(false);
  expect(calls).toBe(1);
  let invalidReads = 0;
  const invalid = { a: 9, get z() { invalidReads++; return Infinity; } };
  expect(() => equalContent({ a: 1, z: 2 }, invalid)).toThrow('finite plain JSON');
  expect(invalidReads).toBe(1);
});

it('revalidates every tick for each external PlaybackSession, including the same input object', () => {
  const history = new BattleHistory('independent-validation'), before = match.createMatch(42), start = match.startMatchCombat(before);
  if (!start.ok) throw Error(start.reason);
  let state = start.state;
  const combatEvents = (events: readonly match.MatchEvent[]) => events.filter((event): event is LedgerCombatEvent => event.domain === 'combat');
  history.observe({ before, after: state, events: combatEvents(start.events), reason: 'command' });
  while (state.phase === 'combat') {
    const before = state, next = match.stepMatch(state); state = next.state;
    history.observe({ before, after: state, events: combatEvents(next.events), reason: 'tick' });
  }
  const record = JSON.parse(JSON.stringify(history.completedRecords[0])) as BattleRecord;
  const stepping = vi.spyOn(match, 'stepMatch');
  try {
    for (let invocation = 1; invocation <= 2; invocation++) {
      const playback = new PlaybackSession(record);
      expect(stepping).toHaveBeenCalledTimes(record.endTick * invocation);
      playback.seek(record.endTick);
      expect(stepping).toHaveBeenCalledTimes(record.endTick * invocation);
      playback.dispose();
    }
    Object.assign(record.events.at(-1)!, { type: 'forged' });
    Object.assign(record, { eventHash: digestContent(record.events) });
    expect(() => new PlaybackSession(record)).toThrow('事件缺失或内容错误');
    expect(stepping).toHaveBeenCalledTimes(record.endTick * 3);
  } finally { stepping.mockRestore(); }
});
