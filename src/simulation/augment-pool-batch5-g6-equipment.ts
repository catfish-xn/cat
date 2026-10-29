import type { MechanicReceipt } from './seat-mechanics/types';

export const CARRY_GOLEM_SOURCE = 'augment-pool-batch5-g6';

/** Identify the fixed kit by its grant source, including the inventory birth
 * before grantCarryGolem equips it. Restore separately authenticates these receipts. */
export function carryGolemFixedItemIds(receipts: readonly MechanicReceipt[] = []): ReadonlySet<string> {
  return new Set(receipts.flatMap(r => r.source === CARRY_GOLEM_SOURCE && r.kind === 'item' ? [r.itemId] : []));
}
