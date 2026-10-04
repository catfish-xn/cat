import { compareIds, eliminationResult, type CombatState, type CombatStep } from './combat-types';

/** Contract baseline; combat implementation is assigned to simulation agent. */
export function advanceCombatTick(state: CombatState): CombatStep {
  const tick = state.tick + 1;
  const units = [...state.units].sort(compareIds);
  const eliminated = eliminationResult(units);
  const result = eliminated ?? (tick >= state.maxTicks ? 'draw' : null);
  return { state: { ...state, units, tick, status: result === null ? 'running' : 'finished', result },
    events: result === null ? [] : [{ type: 'combatFinished', tick, result, reason: eliminated === null ? 'timeout' : 'elimination' }] };
}
