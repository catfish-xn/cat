import type { MatchState } from './match-types';

/** Digested multiplayer operations; deployment and upgrade policy are unchanged. */
export const MULTIPLAYER_OPERATION_RULES = {
  version: 'multiplayer-combat-ops-v26-anomaly-preparation',
  phases: ['preparation', 'combat', 'choice', 'settlement'],
  upgradeVersion: 'bench-during-combat-deferred-v1',
  autoDeploymentVersion: 'front-center-left-first-v1',
  anomalySaleVersion: 'pending-choice-refuse-all-v1',
} as const;

export const EQUIPMENT_OPERATION_RULES_VERSION = 'equipment-ops-next-battle-v1';

/** Permanent equipment is editable in every live phase, including a locked PvP roster. */
export function canOperateEquipment(state: Readonly<MatchState>): boolean {
  return state.pendingChoice?.payload?.source !== 'masterwork-upgrade' && state.multiplayer?.status !== 'eliminated'
    && (state.phase === 'preparation' || state.phase === 'combat'
      || state.phase === 'choice' || state.phase === 'settlement');
}

/** Authority is opt-in multiplayer metadata, never a client-supplied command flag. */
export function canOperateMatch(state: Readonly<MatchState>): boolean {
  if (state.multiplayer?.status === 'eliminated' || state.pendingChoice?.payload?.source === 'masterwork-upgrade') return false;
  return state.phase === 'preparation' || (state.phase === 'choice' && state.pendingChoice?.kind === 'anomaly' && state.pendingChoice.returnPhase === 'preparation') || (state.multiplayer?.status === 'active'
    && (state.phase === 'combat' || state.phase === 'choice' || state.phase === 'settlement'));
}

/** PvE has a real combat phase; PvP keeps T3 preparation plus this server-only lock. */
export function isCombatRosterLocked(state: Readonly<MatchState>): boolean {
  return Boolean(state.multiplayer && (state.phase === 'combat' || state.multiplayer.combatRosterLocked));
}
