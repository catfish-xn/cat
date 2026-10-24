import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { commitReceipt } from '../src/simulation/loot-runtime';
import { shareGeneratedJson, isImmutableJson } from '../src/simulation/immutable-json';
import type { LootReceipt } from '../src/simulation/m8/contracts';

it('loot receipt transitions preserve the exact frozen ledger after a JSON-equal m8 cache hit', () => {
  const state = createMatch(42), frozen = state.m8.loot.frozen;
  // Isolated transaction-level vector: committing a receipt is not an asset grant.
  const receipt: LootReceipt = { receiptId: 'v23-review-intern', dropId: 'family:v23-review-intern', payload: { kind: 'gold', quantity: 1 }, grantedItemIds: [], grantedUnitIds: [] };
  const older = shareGeneratedJson(structuredClone({ ...state.m8, loot: { ...state.m8.loot, receipts: [...state.m8.loot.receipts, receipt] } }));
  expect(older.loot.frozen).not.toBe(frozen);
  const next = commitReceipt(state, receipt);
  expect(next.m8).toEqual(older);
  expect(next.m8).not.toBe(older);
  expect(next.m8.loot.frozen).toBe(frozen);
  expect(next.m8.loot.layoutBinding).toBe(state.m8.loot.layoutBinding);
  expect(isImmutableJson(next.m8)).toBe(true);
  expect(state.m8.loot.receipts).not.toContainEqual(receipt);
  expect(next.m8.loot.receipts.filter(r => r.receiptId === receipt.receiptId)).toHaveLength(1);
  expect(() => commitReceipt(next, receipt)).toThrow('Duplicate loot receipt');
  expect(next.gold).toBe(state.gold);
  expect(next.rngState).toBe(state.rngState);
});
