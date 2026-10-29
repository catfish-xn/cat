import type { MatchState } from './match-types';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { requireAugmentFacts } from './augment-history';
import { AUGMENT_BATCH5_H1 } from './content/augment-pool-batch5-h1';

function shopGlitchTiming(state: MatchState): { start: number; interval: number; end: number } | null {
  const owner = state.augments.find(a => a.definitionId === 'shop-glitch');
  if (!owner || getMultiplayerRoundByOrdinal(state.round).kind !== 'pve') return null;
  const acquisition = requireAugmentFacts(state, 'acquire', owner.acquiredRound).find(f => f.choiceId === owner.choiceId);
  if (!acquisition) throw new RangeError('Invalid augment history: missing Shop Glitch acquisition');
  const start = owner.acquiredRound === state.round ? acquisition.preparationElapsedMs : 0;
  const values = AUGMENT_BATCH5_H1['shop-glitch'].source.values;
  const interval = values.RefreshTimer * 1000, end = start + values.TotalTimer * 1000;
  return { start, interval, end };
}

/** Next logical preparation boundary, including locked shops whose boundary must be consumed. Pure query. */
export function nextShopGlitchPreparationTime(state: MatchState, elapsedMs: number): number | null {
  const timing = shopGlitchTiming(state);
  if (!timing || elapsedMs >= timing.end) return null;
  return timing.start + (Math.floor(Math.max(0, elapsedMs - timing.start) / timing.interval) + 1) * timing.interval;
}

/** Preparation clock boundaries crossed since the previous sample. Locked boundaries are consumed, never deferred. */
export function shopGlitchRefreshes(state: MatchState, previousMs: number, elapsedMs: number): number {
  if (state.shop.locked) return 0;
  const timing = shopGlitchTiming(state);
  if (!timing) return 0;
  const { start, interval, end } = timing;
  const count = (time: number) => Math.floor(Math.max(0, Math.min(time, end) - start) / interval);
  return count(elapsedMs) - count(previousMs);
}
