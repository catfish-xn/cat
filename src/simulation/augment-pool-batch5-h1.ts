import type { MatchState } from './match-types';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { requireAugmentFacts } from './augment-history';
import { AUGMENT_BATCH5_H1 } from './content/augment-pool-batch5-h1';

/** Preparation clock boundaries crossed since the previous sample. Locked boundaries are consumed, never deferred. */
export function shopGlitchRefreshes(state: MatchState, previousMs: number, elapsedMs: number): number {
  const owner = state.augments.find(a => a.definitionId === 'shop-glitch');
  if (!owner || getMultiplayerRoundByOrdinal(state.round).kind !== 'pve' || state.shop.locked) return 0;
  const acquisition = requireAugmentFacts(state, 'acquire', owner.acquiredRound).find(f => f.choiceId === owner.choiceId);
  if (!acquisition) throw new RangeError('Invalid augment history: missing Shop Glitch acquisition');
  const start = owner.acquiredRound === state.round ? acquisition.preparationElapsedMs : 0;
  const values = AUGMENT_BATCH5_H1['shop-glitch'].source.values;
  const interval = values.RefreshTimer * 1000, end = start + values.TotalTimer * 1000;
  const count = (time: number) => Math.floor(Math.max(0, Math.min(time, end) - start) / interval);
  return count(elapsedMs) - count(previousMs);
}
