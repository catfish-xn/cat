import type { MatchState } from './match-types';
import { validateAugmentAuthority, type AugmentHistoryAuthority } from './augment-history';
import { validateBatch1Gifts } from './augment-pool-grants';

/** An online single-seat file cannot authenticate the opposing roster or an attached poison.
 * Reuse the existing independent server checkpoint handle; no new historical save section. */
export function validateMadChemistOnlineSave(state: MatchState, authority?: AugmentHistoryAuthority): void {
  if (state.augments.some(a => a.definitionId === 'mad-chemist')
    || state.combat?.units.some(u => u.madChemist !== undefined || u.mechanics?.some(m => m.mechanic === 'madChemist'))
    || state.combatInputBasis?.inputs.augments.some(a => a.definitionId === 'mad-chemist')
    || state.seatMechanics?.receipts.some(r => r.receiptId.includes('"mad-chemist"'))) {
    validateAugmentAuthority(state, authority, true);
    validateBatch1Gifts(state);
  }
}
