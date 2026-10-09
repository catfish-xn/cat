import type { RoundDefinition } from './m8/contracts';
import type { MatchState } from './match-types';
import { ROUND_CATALOG } from './content/round-catalog';

/** Catalog-only query, not the frozen readRoundInfo(Match) runtime API.
 * Provisional B6-Q4: invalid queries throw RangeError; valid rows are frozen references.
 */
export function getCatalogRoundByOrdinal(ordinal: number): RoundDefinition {
  if (!Number.isSafeInteger(ordinal)) throw new RangeError('Invalid catalog round ordinal');
  const round = ROUND_CATALOG.find(r => r.ordinal === ordinal);
  if (!round) throw new RangeError('Unknown catalog round ordinal');
  return round;
}

export function getCatalogRoundById(roundId: string): RoundDefinition {
  const round = ROUND_CATALOG.find(r => r.roundId === roundId);
  if (!round) throw new RangeError('Unknown catalog round ID');
  return round;
}

/** A valid final round has no successor (null); an invalid ID still throws. */
export function getNextCatalogRound(roundId: string): RoundDefinition | null {
  const round = getCatalogRoundById(roundId);
  return round.isFinal ? null : getCatalogRoundByOrdinal(round.ordinal + 1);
}

/** Frozen UI query: return the current transaction's authoritative round definition. */
export function readRoundInfo(state: Readonly<MatchState>): RoundDefinition { return state.m8.round; }
