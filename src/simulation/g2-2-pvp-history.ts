import type { RoundResult } from './match-types';

/** G2-2 Emissary (Ambessa): resist stacks count at most this many prior PvP victories. */
export const G22_EMISSARY_WIN_CAP = 7;

/**
 * Prior PvP victories read from the authoritative settled history: records before `round` whose
 * roundKind is pvp and result is playerWin, capped at seven. Solo and online use this same count.
 */
export function priorPvpWins(roundResults: readonly Pick<RoundResult, 'round' | 'roundKind' | 'result'>[], round: number): number {
  return Math.min(G22_EMISSARY_WIN_CAP, roundResults.filter(r => r.round < round && r.roundKind === 'pvp' && r.result === 'playerWin').length);
}
