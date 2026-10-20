import type { MatchState } from './match-types';

/** Internal shared predicate; callers projecting existing units already know membership. */
export function isD14PromotedUnit(state: Pick<MatchState, 'd14'>, unitId: string): boolean {
  return state.d14?.unitId === unitId && state.d14.phase === 'promoted';
}

/** Public scouting hint for a current preparation unit. Contains no owner-only values. */
export function d14PublicUnitMark(state: MatchState, unitId: string): { effectiveStarLevel: 4 } | null {
  return isD14PromotedUnit(state, unitId) && state.preparation.units.some(unit => unit.id === unitId)
    ? { effectiveStarLevel: 4 } : null;
}
