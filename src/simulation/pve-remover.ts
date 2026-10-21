import { CONSUMABLE_RULES } from './content/consumables';
import type { MatchState } from './match-types';
import { getMultiplayerRoundById } from './multiplayer-round';
import { appendMechanicReceipt } from './seat-mechanics/state';

const policy = CONSUMABLE_RULES.pveRemover;
const receiptId = (roundId: string) => `${policy.receiptPrefix}${roundId}`;

/** Fixed PvE bonus, separate from carrier kills, orb claims and every RNG stream. */
export function grantPveRemover(state: MatchState): MatchState {
  const result = state.roundResults.find(r => r.round === state.round);
  if (!result || getMultiplayerRoundById(result.roundId).kind !== 'pve' || result.hpAfter <= 0
    || state.multiplayer?.status === 'eliminated'
    || state.seatMechanics?.receipts.some(r => r.receiptId === receiptId(result.roundId))) return state;
  const consumableId = `consumable-${state.nextConsumableSerial}`;
  return appendMechanicReceipt({...state, nextConsumableSerial: state.nextConsumableSerial + policy.quantity,
    consumables: [...state.consumables, {consumableId, definitionId: policy.definitionId}]}, {
    receiptId: receiptId(result.roundId), source: policy.receiptSource, kind: 'consumable',
    round: result.round, roundId: result.roundId, definitionId: policy.definitionId, consumableId,
  });
}

/** Rebuild eligibility from settled HP/history; never trust a claimed source alone. */
export function validatePveRemover(state: MatchState): void {
  const check = (value: unknown) => { if (!value) throw new RangeError('Invalid PvE remover receipt'); };
  const expected = new Map(state.roundResults.filter(r => getMultiplayerRoundById(r.roundId).kind === 'pve' && r.hpAfter > 0)
    .map(r => [receiptId(r.roundId), r]));
  for (const receipt of state.seatMechanics?.receipts ?? []) {
    if (receipt.source !== policy.receiptSource && !receipt.receiptId.startsWith(policy.receiptPrefix)) continue;
    const round = expected.get(receipt.receiptId);
    check(round && receipt.source === policy.receiptSource && receipt.kind === 'consumable'
      && receipt.definitionId === policy.definitionId && receipt.round === round.round && receipt.roundId === round.roundId);
    expected.delete(receipt.receiptId);
  }
  check(expected.size === 0);
}
