import { ITEM_DEFINITIONS } from './content/items';
import type { ItemInstance } from './strategy-types';

export interface ItemGrantState { readonly items: readonly ItemInstance[]; readonly nextItemSerial: number }
export interface ItemGrantRequest {
  readonly definitionId: string;
  readonly receiptId: string;
}
export type ItemGrantFailure = 'invalid-grant' | 'duplicate-grant' | 'unknown-item-definition' | 'invalid-item-serial';
export type ItemGrantPlan<T extends ItemGrantState> =
  | { readonly ok: true; readonly state: T; readonly grantedItemIds: readonly [string] }
  | { readonly ok: false; readonly state: T; readonly reason: ItemGrantFailure };

/** IF-GRANT: plan one permanent inventory instance, never economy/RNG/events/receipts.
 * Match supplies IDs from its authoritative receipt ledger, then commits this plan
 * together with that same receipt/choice resolution. This is not a public command.
 */
export function planPermanentItemGrant<T extends ItemGrantState>(
  state: T, request: ItemGrantRequest, committedReceiptIds: readonly string[],
): ItemGrantPlan<T> {
  const fail = (reason: ItemGrantFailure): ItemGrantPlan<T> => ({ ok: false, state, reason });
  if (typeof request.receiptId !== 'string' || !request.receiptId) return fail('invalid-grant');
  if (committedReceiptIds.includes(request.receiptId)) return fail('duplicate-grant');
  if (typeof request.definitionId !== 'string' || !Object.hasOwn(ITEM_DEFINITIONS, request.definitionId)) return fail('unknown-item-definition');
  const serial = state.nextItemSerial;
  if (!Number.isSafeInteger(serial) || serial < 1 || serial === Number.MAX_SAFE_INTEGER
    || state.items.some(item => item.id === `item-${serial}`)) return fail('invalid-item-serial');
  const itemId = `item-${serial}`;
  return { ok: true, state: { ...state, nextItemSerial: serial + 1,
    items: [...state.items, { id: itemId, definitionId: request.definitionId, location: { kind: 'inventory' } }] }, grantedItemIds: [itemId] };
}
