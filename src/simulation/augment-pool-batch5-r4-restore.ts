import type { MatchState } from './match-types';
import type { SharedPoolState } from './shared-pool-types';
import { validateAugmentAuthority, type AugmentHistoryAuthority } from './augment-history';
import { validateBatch1Gifts } from './augment-pool-grants';
import { AUGMENT_GIFT_SOURCE } from './augment-gift-plan';
import { lootEntryId, lootOrbId } from './loot-identity';

/** Independent pool receipts survive candidate erasure, upgrades, sales and gold/forfeit resolutions.
 * B5-67 has exactly one gift, acquired only from the fixed 2-1 augment choice. */
function poolHasMadChemistReward(pool: SharedPoolState, seatId: string | undefined): boolean {
  const receipt = JSON.stringify([AUGMENT_GIFT_SOURCE, 'round:2-1:augment', 'mad-chemist', 0, 0]);
  const dropId = lootEntryId(lootOrbId('2-1', 'mechanic', receipt, 0), 0);
  return pool.pending.some(r => r.seatId === seatId && r.dropId === dropId)
    || pool.rewards.some(r => r.seatId === seatId && r.dropId === dropId);
}

/** An online single-seat file cannot authenticate the opposing roster or an attached poison.
 * Reuse the existing independent server checkpoint handle; no new historical save section. */
export function validateMadChemistOnlineSave(pool: SharedPoolState, state: MatchState, authority?: AugmentHistoryAuthority): void {
  const required = poolHasMadChemistReward(pool, state.sharedPool?.seatId)
    || state.augments.some(a => a.definitionId === 'mad-chemist')
    || state.combat?.units.some(u => u.madChemist !== undefined || u.mechanics?.some(m => m.mechanic === 'madChemist'))
    || state.combatInputBasis?.inputs.augments.some(a => a.definitionId === 'mad-chemist')
    || state.seatMechanics?.receipts.some(r => r.receiptId.includes('"mad-chemist"')) === true;
  validateAugmentAuthority(state, authority, Boolean(required));
  if (required) validateBatch1Gifts(state);
}
