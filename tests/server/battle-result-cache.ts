import { createHash } from 'node:crypto';
import { carryAugmentDeathSample } from '../../src/simulation/augment-death-samples';
import type { BattleJob, BattleResolver } from '../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleInput, BattleResult, SharedPoolState } from '../../src/server/room/types';

/**
 * Real battle results, keyed by the frozen input and pool. A beforeAll records them by
 * actually resolving; later cases only read clones, so one case cannot change what another sees.
 * A miss still resolves for real and is not written back.
 * Death samples live in a WeakMap keyed by event identity, so every clone carries the
 * observations from the executed events without changing the cached result.
 */
export type BattleResultCache = Map<string, BattleResult>;

const keyOf = (input: BattleInput, pool: SharedPoolState): string =>
  createHash('sha256').update(JSON.stringify({ input, pool })).digest('hex');

function cloneBattleResult(result: BattleResult): BattleResult {
  const cloned = structuredClone(result);
  if (result.kind === 'two-sided' && cloned.kind === 'two-sided') {
    result.battle.events.forEach((event, index) => carryAugmentDeathSample(event, cloned.battle.events[index]!));
  } else if (result.kind === 'placeholder' && cloned.kind === 'placeholder') {
    result.outcomes.forEach((outcome, index) => {
      const combat = cloned.outcomes[index]!.combat;
      outcome.combat?.events.forEach((event, eventIndex) => carryAugmentDeathSample(event, combat!.events[eventIndex]!));
    });
  }
  return cloned;
}

export function battleCacheResolver(
  cache: BattleResultCache,
  mode: 'record' | 'read',
  inner: BattleResolver = new TwoSidedBattleResolver(),
): BattleResolver {
  const take = (key: string): BattleResult | undefined => {
    const found = cache.get(key);
    return found ? cloneBattleResult(found) : undefined;
  };
  const keep = (key: string, result: BattleResult): BattleResult => {
    if (mode === 'record' && !cache.has(key)) cache.set(key, cloneBattleResult(result));
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
      if (cached) return { advance: () => cloneBattleResult(cached) };
      if (inner.startBattle) {
        const job = inner.startBattle(input, pool);
        return { advance: maxTicks => {
          const result = job.advance(maxTicks);
          if (!result) return null;
          return keep(key, result);
        } };
      }
      const result = keep(key, inner.resolveBattle(input, pool));
      return { advance: () => cloneBattleResult(result) };
    },
  };
}
