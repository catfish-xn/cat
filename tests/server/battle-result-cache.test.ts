import { beforeAll, describe, expect, it, vi } from 'vitest';
import { augmentDeathsFromEvents } from '../../src/simulation/augment-death-samples';
import type { BattleJob, BattleResolver } from '../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleInput, BattleResult, SharedPoolState } from '../../src/server/room/types';
import { battleCacheResolver, type BattleResultCache } from './battle-result-cache';
import { makeRoom, runUntil } from './helpers';

const eventsOf = (result: BattleResult) => result.kind === 'two-sided'
  ? [result.battle.events]
  : result.outcomes.flatMap(outcome => outcome.combat ? [outcome.combat.events] : []);
const deathsOf = (result: BattleResult) => augmentDeathsFromEvents(eventsOf(result).flat(), true, true);
function finish(job: BattleJob): BattleResult {
  for (;;) { const result = job.advance(100); if (result) return result; }
}

// Capture real room envelopes; every cache below is populated by executing the real resolver.
const fixtures = new Map<BattleResult['kind'], { input: BattleInput; pool: SharedPoolState }>();
beforeAll(() => {
  const real = new TwoSidedBattleResolver();
  const { room, clock } = makeRoom({ resolveBattle(input, pool) {
    const result = real.resolveBattle(input, pool);
    if (deathsOf(result).length && !fixtures.has(result.kind)) fixtures.set(result.kind, { input, pool });
    return result;
  } });
  try {
    room.start();
    runUntil(room, clock, state => state.roundId === '2-1' && state.phase === 'settlement');
    expect([...fixtures.keys()].sort()).toEqual(['placeholder', 'two-sided']);
  } finally { room.dispose(); }
});

for (const kind of ['two-sided', 'placeholder'] as const) describe(`${kind} battle cache`, () => {
  for (const path of ['sync', 'sliced', 'fallback'] as const) it(`${path} recording preserves executed samples and isolates every cache read`, () => {
    const { input, pool } = fixtures.get(kind)!;
    const real = new TwoSidedBattleResolver();
    const resolveBattle = vi.fn((input: BattleInput, pool: SharedPoolState) => real.resolveBattle(input, pool));
    const inner: BattleResolver = path === 'sliced'
      ? { resolveBattle, startBattle: (input, pool) => real.startBattle(input, pool) }
      : { resolveBattle };
    const cache: BattleResultCache = new Map();
    const record = battleCacheResolver(cache, 'record', inner);
    const executed = path === 'sync' ? record.resolveBattle(input, pool) : finish(record.startBattle!(input, pool));
    const expected = structuredClone(executed), deaths = deathsOf(executed);
    expect(executed.kind).toBe(kind);
    expect(deaths.length).toBeGreaterThan(0);
    expect(cache.size).toBe(1);
    const stored = [...cache.values()][0]!;
    expect(stored).not.toBe(executed);
    expect(deathsOf(stored)).toEqual(deaths);
    // A recording caller can mutate its result without poisoning the stored copy.
    (executed as { battleId: string }).battleId = 'caller-mutated';
    expect(stored).toEqual(expected);

    const miss = vi.fn(() => { throw new Error('unexpected cache miss'); });
    const read = battleCacheResolver(cache, 'read', { resolveBattle: miss, startBattle: miss });
    for (const resolver of [record, read]) {
      const job = resolver.startBattle!(input, pool);
      for (const take of [() => resolver.resolveBattle(input, pool), () => job.advance(1)!]) {
        const first = take();
        expect(first).toEqual(expected);
        expect(deathsOf(first)).toEqual(deaths);
        expect(first).not.toBe(stored);
        expect(eventsOf(first)[0]![0]).not.toBe(eventsOf(stored)[0]![0]);
        for (const events of eventsOf(first)) (events as unknown[]).splice(0);
        const second = take();
        expect(second).toEqual(expected);
        expect(deathsOf(second)).toEqual(deaths);
        expect(stored).toEqual(expected);
      }
    }
    expect(miss).not.toHaveBeenCalled();
    expect(resolveBattle).toHaveBeenCalledTimes(path === 'sliced' ? 0 : 1);
  });

  it('executes read misses without writing them back', () => {
    const { input, pool } = fixtures.get(kind)!;
    const real = new TwoSidedBattleResolver();
    const resolveBattle = vi.fn((input: BattleInput, pool: SharedPoolState) => real.resolveBattle(input, pool));
    const cache: BattleResultCache = new Map();
    const read = battleCacheResolver(cache, 'read', { resolveBattle });
    const result = read.resolveBattle(input, pool);
    const job = read.startBattle!(input, pool), first = finish(job);
    expect(first).toEqual(result);
    expect(deathsOf(first)).toEqual(deathsOf(result));
    expect(deathsOf(first).length).toBeGreaterThan(0);
    for (const events of eventsOf(first)) (events as unknown[]).splice(0);
    expect(finish(job)).toEqual(result);
    expect(deathsOf(finish(job))).toEqual(deathsOf(result));
    expect(cache.size).toBe(0);
    expect(resolveBattle).toHaveBeenCalledTimes(2);
  });
});
