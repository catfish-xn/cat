import type { MatchState } from './match-types';
import type { AnomalyBinding } from './strategy-types';

/** Shared eligibility rule; callers project the roster appropriate to their phase. */
export function readsLiveGold(binding: AnomalyBinding | null, activePlayerIds: readonly string[]): boolean {
  return binding?.definitionId === 'avarice-incarnate' && activePlayerIds.includes(binding.unitId);
}

/** Trusted Match state: current running PvE combat or the upcoming preparation roster. */
export function readMatchLiveGoldReaders(state: MatchState): boolean {
  if (state.m8.round.kind !== 'pve') return false;
  if (state.phase === 'preparation') {
    return readsLiveGold(state.anomalyBinding, state.preparation.units
      .filter(u => u.team === 'player' && u.location.kind === 'board').map(u => u.id));
  }
  if (state.phase !== 'combat' || state.combat.status !== 'running') return false;
  return readsLiveGold(state.anomalyBinding, state.combat.units
    .filter(u => u.team === 'player' && u.alive && u.hp > 0).map(u => u.id));
}
