import { createHash } from 'node:crypto';
import type { BattleJob, BattleResolver } from '../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleInput, BattleResult, SharedPoolState } from '../../src/server/room/types';

/**
 * Real battle results, keyed by the frozen input and pool. A beforeAll records them by
 * actually resolving; later cases only read clones, so one case cannot change what another sees.
 * A miss still resolves for real and is not written back.
 * Do not use this when settlement reads augment death samples: those samples live in a WeakMap
 * keyed by the event object, and a clone is a different object.
 */
export type BattleResultCache = Map<string, BattleResult>;

const keyOf = (input: BattleInput, pool: SharedPoolState): string =>
  createHash('sha256').update(JSON.stringify({ input, pool })).digest('hex');

export function battleCacheResolver(
  cache: BattleResultCache,
  mode: 'record' | 'read',
  inner: BattleResolver = new TwoSidedBattleResolver(),
): BattleResolver {
  const take = (key: string): BattleResult | undefined => {
    const found = cache.get(key);
    return found ? structuredClone(found) : undefined;
  };
  const keep = (key: string, result: BattleResult): BattleResult => {
    if (mode === 'record' && !cache.has(key)) cache.set(key, structuredClone(result));
    return result;
  };
  return {
    resolveBattle(input, pool) {
      const key = keyOf(input, pool);
      return take(key) ?? keep(key, inner.resolveBattle(input, pool));
    },
    startBattle(input, pool): BattleJob {
      const key = keyOf(input, pool);
      const cached = cache.get(key);
      if (cached) return { advance: () => structuredClone(cached) };
      if (inner.startBattle) {
        const job = inner.startBattle(input, pool);
        return { advance: maxTicks => {
          const result = job.advance(maxTicks);
          if (!result) return null;
          return keep(key, result);
        } };
      }
      const result = keep(key, inner.resolveBattle(input, pool));
      return { advance: () => structuredClone(result) };
    },
  };
}
