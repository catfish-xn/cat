/**
 * Timeout fallback for a seat whose rule state still waits on a choice when a deadline
 * passes (V2 D5: the server decides the deadline; the fallback may not spend gold or
 * re-issue rewards). Placeholder policy: first offer / first own unit, through the same
 * public commands a player would use. The canonical timeout choice is a rules-side
 * decision (docs/UI_REQUESTS.md "src/server 需要规则侧提供的接口").
 */
import { selectAnomalyTarget, selectChoice } from '../../simulation/match';
import type { MatchCommandResult, MatchState } from '../../simulation/match-types';

/** Resolves one pending step; returns null when the state is not waiting on a choice. */
export type ChoiceFallback = (state: MatchState) => MatchCommandResult | null;

export const firstOfferFallback: ChoiceFallback = state => {
  if (state.phase !== 'choice' || state.pendingChoice === null) return null;
  const pending = state.pendingChoice;
  if (pending.step === 'offer') return selectChoice(state, pending.choiceId, pending.generation, pending.offers[0]!);
  const unit = state.preparation.units.find(candidate => candidate.team === 'player');
  return selectAnomalyTarget(state, pending.choiceId, pending.generation, unit?.id ?? '');
};

const MAX_FALLBACK_STEPS = 8;
export type FallbackOutcome = { readonly ok: true; readonly state: MatchState } | { readonly ok: false; readonly state: MatchState; readonly reason: string };

/** Applies the fallback until the seat leaves the choice phase; a refused step is reported, not forced. */
export function resolvePendingChoices(state: MatchState, fallback: ChoiceFallback): FallbackOutcome {
  let current = state;
  for (let step = 0; step < MAX_FALLBACK_STEPS; step++) {
    const result = fallback(current);
    if (result === null) return { ok: true, state: current };
    if (!result.ok) return { ok: false, state: current, reason: result.reason };
    current = result.state;
  }
  return current.phase === 'choice' ? { ok: false, state: current, reason: 'choice-fallback-exhausted' } : { ok: true, state: current };
}
