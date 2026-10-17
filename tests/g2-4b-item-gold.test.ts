import { expect, it } from 'vitest';
import { createItemRandomStreams } from '../src/simulation/g2-4b-item-kernel';
import { recordItemGold, validateItemGoldLedger, itemGoldPayouts,
  type ItemGoldLedger, type ItemGoldOpportunity } from '../src/simulation/g2-4b-item-gold';

const opportunity = (ordinal: number, kind: ItemGoldOpportunity['kind'] = 'gamblers-blade'): ItemGoldOpportunity =>
  ({battleId: 'battle-1', ownerId: 'holder', itemInstanceId: 'item-1', kind, tick: ordinal + 1, ordinal});

it('retains every failed roll and is identical across save/resume and duplicate processing', () => {
  const streams = createItemRandomStreams(123);
  let ledger: ItemGoldLedger = {streams, receipts: []};
  const opportunities = Array.from({length: 100}, (_, n) => opportunity(n));
  for (const o of opportunities) {
    const next = recordItemGold(ledger, o);
    expect(recordItemGold(next, o)).toBe(next);
    expect(recordItemGold(JSON.parse(JSON.stringify(ledger)), o)).toEqual(next);
    ledger = next;
  }
  expect(ledger.receipts).toHaveLength(100);
  expect(ledger.receipts.some(r => r.gold === 0)).toBe(true);
  expect(ledger.receipts.some(r => r.gold === 1)).toBe(true);
  expect(ledger.streams.fishbones).toEqual(streams.fishbones);
  expect(ledger.streams.collector).toEqual(streams.collector);
  validateItemGoldLedger(ledger, streams, opportunities);
});

it('uses independent collector rolls and deterministic Mogul payouts without drawing RNG', () => {
  const streams = createItemRandomStreams(123), empty = {streams, receipts: []};
  const first = recordItemGold(empty, opportunity(0, 'collector'));
  const mogul = recordItemGold(first, opportunity(1, 'moguls-full'));
  expect(mogul.streams).toBe(first.streams);
  expect(mogul.receipts.at(-1)).toMatchObject({word: null, gold: 1});
  const other = recordItemGold(mogul, {...opportunity(2, 'moguls-periodic'), ownerId: 'enemy'});
  const payouts = itemGoldPayouts(other, new Set(['holder']));
  expect(payouts.map(p => p.receiptId)).not.toContain(other.receipts.at(-1)!.id);
  expect(payouts.at(-1)).toMatchObject({source: 'g24-item-gold', amount: 1});
});

it('rejects changed rolls, added money, omitted failures, added fields and reordered opportunities', () => {
  const streams = createItemRandomStreams(4);
  const ops = Array.from({length: 20}, (_, n) => opportunity(n));
  const ledger = ops.reduce(recordItemGold, {streams, receipts: []} as ItemGoldLedger);
  for (const mutate of [
    (x: ItemGoldLedger) => { (x.receipts[0] as {gold: number}).gold += 1; },
    (x: ItemGoldLedger) => { (x.receipts[0] as {word: number}).word = 0; },
    (x: ItemGoldLedger) => { (x.receipts as unknown[]).splice(x.receipts.findIndex(r => !r.gold), 1); },
    (x: ItemGoldLedger) => { Object.assign(x.receipts[0], {extra: true}); },
  ]) {
    const changed = structuredClone(ledger); mutate(changed);
    expect(() => validateItemGoldLedger(changed, streams, ops)).toThrow();
  }
  expect(() => recordItemGold(ledger, {...opportunity(0), tick: 2})).toThrow();
  expect(() => recordItemGold(ledger, {...opportunity(30), tick: 1})).toThrow();
});
