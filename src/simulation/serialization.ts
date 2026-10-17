import { createPreparationLedgerValidator } from './preparation-ledger';
import type { BattleRecord } from '../m6/contracts';
import { validateMatchHistory } from './battle-record-validation';
import { canonicalContent } from './content';
import { needsCrownHistory, missingCrownHistory } from './crown-history';
import type { MatchState } from './match-types';
import { validateMatchStructure, validateMatchStructureForSerialization } from './serialization-structure';

/** Restore a detached Match. Crown claims require the existing completed replays;
 * structural/RNG consistency alone is not evidence of historical eligibility.
 * All saves additionally require the verified preparation command ledger. */
export function restoreMatch(input: unknown, battles?: readonly BattleRecord[]): MatchState {
  return withHistory(validateMatchStructure(input), battles);
}
function withHistory(state: MatchState, battles: readonly BattleRecord[] | undefined): MatchState {
  if (battles !== undefined) validateMatchHistory(state, battles);
  else if (needsCrownHistory(state)) missingCrownHistory();
  return state;
}

/** Internal archive-scoped structural and ledger verifier. Completed history
 * authority is checked by the archive walk; no global current session exists. */
export function createMatchRestoreSession() {
  const validateLedger = createPreparationLedgerValidator(true);
  return Object.assign((input: unknown) => validateMatchStructure(input, validateLedger),
    { battleProof: validateLedger.battleProof });
}

/** Canonical Match text; supply the same history as restoreMatch for crown claims. */
export function serializeMatch(state: MatchState, battles?: readonly BattleRecord[]): string {
  return canonicalContent(withHistory(validateMatchStructureForSerialization(state), battles));
}
export { validateM5Runtime } from './serialization-structure';
