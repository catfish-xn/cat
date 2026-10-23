import type { CombatState } from './combat-types';
import type { MatchState, FinishedCombat } from './match-types';

/** Trusted runner boundary, not an untrusted client combat submission. */
export function isMatchCombatStreamTerminal(state: MatchState, terminal: CombatState): terminal is FinishedCombat {
  return state.multiplayer?.status === 'active' && state.m8.round.kind === 'pve'
    && !!state.combatInputBasis && !state.roundResults.some(r => r.round >= state.round)
    && terminal.status === 'finished' && ['playerWin', 'enemyWin', 'draw'].includes(terminal.result ?? '')
    && terminal.combatId === `round-${state.round}`
    && (state.phase === 'combat' && state.combat.status === 'running'
      && state.combat.combatId === terminal.combatId && terminal.tick === state.combat.tick + 1
      && Number.isSafeInteger(terminal.nextEventSeq) && terminal.nextEventSeq! >= (state.combat.nextEventSeq ?? 0)
      || state.phase === 'preparation' && state.combat === null && terminal.tick === 0);
}
