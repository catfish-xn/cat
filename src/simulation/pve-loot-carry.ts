import type { CombatState } from './combat-types';
import { ROUND_CATALOG } from './content/round-catalog';
import { countsG23SurvivorDamage } from './g2-3-summons';
import type { LootCarry } from './loot-types';
import type { MatchState } from './match-types';
import { resolveRoundEconomy } from './round-economy';
import { getCatalogRoundById } from './round-selectors';

/** The next catalog PvE after `roundId`, or null when this round is the last one. */
export function nextPveRoundId(roundId: string): string | null {
  const start = ROUND_CATALOG.findIndex(round => round.roundId === roundId);
  if (start < 0) return null;
  for (let index = start + 1; index < ROUND_CATALOG.length; index++) if (ROUND_CATALOG[index].kind === 'pve') return ROUND_CATALOG[index].roundId;
  return null;
}

/**
 * Wiki (TFT Monster): loot a lost PvE round would have voided is carried to the next PvE.
 * A win, a lethal loss, or the last PvE has nowhere to deliver it and stays forfeited.
 * Draw and timeout count as losses, matching the economy streak.
 */
export function pveLossCarryRound(state: MatchState, combat: CombatState): string | null {
  if (state.m8.round.kind !== 'pve' || combat.status !== 'finished' || combat.result === null || combat.result === 'playerWin') return null;
  const deliver = nextPveRoundId(state.roundDefinitionId);
  if (!deliver) return null;
  const enemySurvivors = combat.units.filter(unit => unit.team === 'enemy' && countsG23SurvivorDamage(unit)).length;
  const hpAfter = resolveRoundEconomy({
    augments: state.augments, roundId: state.roundDefinitionId, result: combat.result, gold: state.gold,
    streak: state.streak, level: state.level, xp: state.xp, hp: state.playerHp, enemySurvivors,
  }).hpAfter;
  return hpAfter > 0 ? deliver : null;
}

/** Null when the stored carry row is one the loss rule would have written. */
export function invalidCarryReason(state: MatchState, sourceRoundId: string, dropId: string): string | null {
  const rows = (state.m8.loot.carry ?? []).filter(row => row.dropId === dropId);
  if (rows.length !== 1) return 'carry identity';
  const deliver = nextPveRoundId(sourceRoundId);
  if (!deliver || rows[0].deliverRoundId !== deliver) return 'carry destination';
  if (state.m8.loot.earnedEvidence.some(entry => entry.dropId === dropId)) return 'carry kill';
  const source = getCatalogRoundById(sourceRoundId), result = state.roundResults[source.ordinal - 1];
  if (result) return result.roundId === sourceRoundId && result.result !== 'playerWin' && result.hpAfter > 0 ? null : 'carry result';
  if (state.round !== source.ordinal) return 'carry result';
  const combat = state.pendingCombatTerminal ?? state.combat;
  if (!combat || pveLossCarryRound(state, combat) !== deliver) return 'carry result';
  return null;
}

export function carryByDrop(state: MatchState): ReadonlyMap<string, LootCarry> {
  return new Map((state.m8.loot.carry ?? []).map(row => [row.dropId, row]));
}
