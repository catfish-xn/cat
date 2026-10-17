import { drawItemRandom, type ItemRandomStreams } from './g2-4b-item-kernel';

export type ItemGoldKind = 'collector' | 'gamblers-blade' | 'moguls-full' | 'moguls-periodic';
export interface ItemGoldOpportunity {
  readonly battleId: string;
  readonly ownerId: string;
  readonly itemInstanceId: string;
  readonly kind: ItemGoldKind;
  readonly tick: number;
  readonly ordinal: number;
}
export interface ItemGoldReceipt extends ItemGoldOpportunity {
  readonly id: string;
  readonly word: number | null;
  readonly gold: number;
}
export interface ItemGoldLedger {
  readonly streams: ItemRandomStreams;
  readonly receipts: readonly ItemGoldReceipt[];
}

function validateOpportunity(opportunity: ItemGoldOpportunity): void {
  if (!opportunity || Object.keys(opportunity).length !== 6
    || !['collector', 'gamblers-blade', 'moguls-full', 'moguls-periodic'].includes(opportunity.kind)
    || [opportunity.battleId, opportunity.ownerId, opportunity.itemInstanceId].some(s => typeof s !== 'string' || !s)
    || !Number.isSafeInteger(opportunity.tick) || opportunity.tick < 0
    || !Number.isSafeInteger(opportunity.ordinal) || opportunity.ordinal < 0)
    throw new RangeError('Invalid item gold opportunity');
}

/** Includes failed rolls: otherwise a forged save could erase failures and reroll.
 * Source values: Collector 40%, Gambler 5%, Mogul 1 gold; normal Set13 only.
 */
export function recordItemGold(ledger: ItemGoldLedger, opportunity: ItemGoldOpportunity): ItemGoldLedger {
  validateOpportunity(opportunity);
  const id = JSON.stringify(['g24-item-gold', opportunity.battleId, opportunity.ownerId,
    opportunity.itemInstanceId, opportunity.kind, opportunity.ordinal]);
  const previous = ledger.receipts.find(r => r.id === id);
  if (previous) {
    if (previous.tick !== opportunity.tick) throw new RangeError('Conflicting item gold opportunity');
    return ledger;
  }
  if (ledger.receipts.length && ledger.receipts.at(-1)!.tick > opportunity.tick)
    throw new RangeError('Unordered item gold opportunity');
  const randomKind = opportunity.kind === 'collector' || opportunity.kind === 'gamblers-blade' ? opportunity.kind : null;
  const draw = randomKind ? drawItemRandom(ledger.streams, randomKind) : null;
  const chanceBps = opportunity.kind === 'collector' ? 4000 : 500;
  const gold = draw ? (BigInt(draw.word) * 10000n < BigInt(chanceBps) * 4294967296n ? 1 : 0) : 1;
  return {streams: draw?.streams ?? ledger.streams,
    receipts: [...ledger.receipts, {...opportunity, id, word: draw?.word ?? null, gold}]};
}

/** Reconstruct using opportunities supplied by combat authority, never candidate
 * save receipts. Check every field, including failures, ordering and RNG words.
 */
export function validateItemGoldLedger(candidate: ItemGoldLedger, initialStreams: ItemRandomStreams,
  opportunities: readonly ItemGoldOpportunity[]): void {
  let expected: ItemGoldLedger = {streams: initialStreams, receipts: []};
  for (const opportunity of opportunities) expected = recordItemGold(expected, opportunity);
  const same = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const left = Object.keys(a), right = Object.keys(b);
    return left.length === right.length && left.every(k => Object.hasOwn(b, k)
      && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  };
  if (!same(candidate, expected)) throw new RangeError('Invalid item gold ledger');
}

/** Pending gold is selected by combat owner, including a dead holder. The match
 * adapter must grant each returned positive receipt exactly once via its ledger.
 */
export function itemGoldPayouts(ledger: ItemGoldLedger, ownerIds: ReadonlySet<string>) {
  return ledger.receipts.filter(r => r.gold > 0 && ownerIds.has(r.ownerId))
    .map(r => ({receiptId: r.id, source: 'g24-item-gold', amount: r.gold}));
}
