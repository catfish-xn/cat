import { equipItem, type MatchState } from '../../src/simulation/match';
import { previewEquip } from '../../src/simulation/item-selectors';
import { grantMechanicItem } from '../../src/simulation/seat-mechanics';

export const TEST_GOLD_ITEMS = {
  mogulsMail: 'TFT7_Item_ShimmerscaleMogulsMail',
  collector: 'TFT4_Item_OrnnTheCollector',
  gamblersBlade: 'TFT7_Item_ShimmerscaleGamblersBlade',
} as const;
export type TestGoldItemId = typeof TEST_GOLD_ITEMS[keyof typeof TEST_GOLD_ITEMS];

/** Test fixture only: existing mechanic grant ledger + public equip command.
 * Returns a new state; throws on invalid input without mutating the input state.
 * itemIds are definition IDs, not permanent instance IDs. This is not idempotent.
 */
export function grantTestItems(state: MatchState, request: {
  readonly unitId: string;
  readonly itemIds: readonly TestGoldItemId[];
}): MatchState {
  if (state.phase !== 'preparation' || state.multiplayer?.combatRosterLocked)
    throw new Error('grantTestItems: requires unlocked preparation');
  if (!state.preparation.units.some(u => u.id === request.unitId && u.team === 'player'))
    throw new Error('grantTestItems: unknown player unit');
  let next: MatchState = state;
  for (const definitionId of request.itemIds) {
    if (!Object.values(TEST_GOLD_ITEMS).includes(definitionId))
      throw new Error(`grantTestItems: unsupported item ${definitionId}`);
    const grant = grantMechanicItem(next, {
      receiptId: JSON.stringify(['test-gold-items', next.nextItemSerial, request.unitId, definitionId]),
      source: 'test-gold-items', definitionId,
    });
    if (!grant.ok) throw new Error(`grantTestItems: grant ${grant.reason}`);
    if (grant.receipt.kind !== 'item') throw new Error('grantTestItems: expected item receipt');
    const itemId = grant.receipt.itemId;
    const slot = [0, 1, 2].find(slot => previewEquip(grant.state, itemId, request.unitId, slot).allowed);
    if (slot === undefined) throw new Error(`grantTestItems: no legal slot for ${definitionId}`);
    const equipped = equipItem(grant.state, itemId, request.unitId, slot);
    if (!equipped.ok) throw new Error(`grantTestItems: equip ${equipped.reason}`);
    next = equipped.state;
  }
  return next;
}
