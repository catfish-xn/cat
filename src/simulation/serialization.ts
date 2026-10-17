import type { BattleRecord } from '../m6/contracts';
import { validateMatchHistory } from './battle-record-validation';
import { canonicalContent } from './content';
import { needsCrownHistory, missingCrownHistory } from './crown-history';
import type { MatchState } from './match-types';
import { validateMatchStructure } from './serialization-structure';

/** Restore a detached Match. Crown claims require the existing completed replays;
 * structural/RNG consistency alone is not evidence of historical eligibility.
 * No-crown saves retain the existing structural restore contract. */
export function restoreMatch(input: unknown, battles?: readonly BattleRecord[]): MatchState {
  const state = validateMatchStructure(input);
  if (battles !== undefined) validateMatchHistory(state, battles);
  else if (needsCrownHistory(state)) missingCrownHistory();
  return state;
}

/** Canonical Match text; supply the same history as restoreMatch for crown claims. */
export function serializeMatch(state: MatchState, battles?: readonly BattleRecord[]): string {
  return canonicalContent(restoreMatch(state, battles));
}
