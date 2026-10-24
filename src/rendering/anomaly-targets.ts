/**
 * S13 4-6 anomaly picking, display side: which of my units the rules' selectAnomalyTarget would accept (it checks
 * again), and which cells the board lights for it. Read-only; the 2D board and the 3D layer (via BoardPiece.glow) draw it.
 */
import type { MatchState } from '../simulation/match-types';
import type { Unit } from '../simulation/units';
import { isAnvil } from '../simulation/content/anvils';
import { eligibleD14Target } from '../simulation/d14-runtime';

/** My units I may lock as the anomaly target; empty outside the target step. */
export function anomalyCandidates(state: MatchState): Unit[] {
  const choice = state.pendingChoice;
  if (state.phase !== 'choice' || choice?.kind !== 'anomaly' || choice.step !== 'target' || state.anomalyBinding) return [];
  return state.preparation.units.filter(unit => unit.team === 'player' && !isAnvil(unit.definitionId)
    && (!state.multiplayer || choice.offers.every(id => eligibleD14Target(unit, id))));
}
/** Lit cells: every candidate while I pick (`lit` the one I picked), then only the locked unit; null outside an anomaly choice. */
export function anomalyGlow(state: MatchState, selected: string | null): { readonly ids: readonly string[]; readonly lit: string | null } | null {
  const choice = state.pendingChoice;
  if (state.phase !== 'choice' || choice?.kind !== 'anomaly') return null;
  if (choice.step !== 'target') return choice.targetId ? { ids: [choice.targetId], lit: choice.targetId } : null;
  const ids = anomalyCandidates(state).map(unit => unit.id);
  return { ids, lit: selected && ids.includes(selected) ? selected : null };
}
