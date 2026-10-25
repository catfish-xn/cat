import type { BattleRecord } from '../m6/contracts';
import { validateMatchHistory } from './battle-record-validation';
import { canonicalContent } from './content';
import { needsCrownHistory, missingCrownHistory } from './crown-history';
import type { MatchState } from './match-types';
import { validateMatchStructure, validateMatchStructureForSerialization } from './serialization-structure';

/** Restore a detached Match. Historical battle-condition claims require completed replays;
 * structural/RNG consistency alone is not evidence of eligibility (including zero-XP bench outcomes). */
export function restoreMatch(input: unknown, battles?: readonly BattleRecord[]): MatchState {
  return withHistory(validateMatchStructure(input), battles);
}
function withHistory(state: MatchState, battles: readonly BattleRecord[] | undefined): MatchState {
  if (battles !== undefined) validateMatchHistory(state, battles);
  else if (needsCrownHistory(state)) missingCrownHistory();
  return state;
}

/** Canonical Match text; supply the same historical evidence as restoreMatch. */
export function serializeMatch(state: MatchState, battles?: readonly BattleRecord[]): string {
  return canonicalContent(withHistory(validateMatchStructureForSerialization(state), battles));
}
export { validateM5Runtime } from './serialization-structure';
