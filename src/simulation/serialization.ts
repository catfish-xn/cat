import type { BattleRecord } from '../m6/contracts';
import { validateMatchHistory } from './battle-record-validation';
import { canonicalContent } from './content';
import { needsCrownHistory, missingCrownHistory } from './crown-history';
import type { MatchState } from './match-types';
import { validateMatchStructure, validateMatchStructureForSerialization } from './serialization-structure';

/** Restore a detached Match. Every settled battle requires its completed replay;
 * candidate receipts and multiplayer.g23Facts cannot authenticate themselves. */
export function restoreMatch(input: unknown, battles?: readonly BattleRecord[]): MatchState {
  return withHistory(validateMatchStructure(input), battles);
}
function withHistory(state: MatchState, battles: readonly BattleRecord[] | undefined): MatchState {
  if (battles !== undefined) validateMatchHistory(state, battles);
  else if (needsCrownHistory(state)) missingCrownHistory();
  else if (state.roundResults.some(result => result.roundKind !== 'supply'))
    throw new Error('Invalid Match save: 缺少历史证据：请提供完整 battles 回放');
  return state;
}

/** Canonical Match text; supply the same completed history as restoreMatch. */
export function serializeMatch(state: MatchState, battles?: readonly BattleRecord[]): string {
  return canonicalContent(withHistory(validateMatchStructureForSerialization(state), battles));
}
export { validateM5Runtime } from './serialization-structure';
