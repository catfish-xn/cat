import { describe, expect, it } from 'vitest';
import type { LootReceipt } from '../src/simulation/m8/contracts';
import type { PersistentGrowth } from '../src/simulation/match-types';
import {
  appendResourceProvenance, foldResourceProvenance, mergeGrowthLedger, RESOURCE_PROVENANCE_VERSION,
  type CombatGrowthDelta, type ProvenanceCombatSettlement, type ResourceFact, type ResourceProvenance,
  type ResourceProvenanceContext,
} from '../src/simulation/resource-provenance';
import type { ScheduleReceipt } from '../src/simulation/strategy-types';
import type { UnitUpgradedEvent } from '../src/simulation/unit-types';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const empty = (): ResourceProvenance => ({ version: RESOURCE_PROVENANCE_VERSION, entries: [] });
const opening = (): ResourceProvenance => appendResourceProvenance(empty(), '1-2', { kind: 'unit-acquired', unitId: 'unit-1', source: { kind: 'opening' } });
const context = (extra: Partial<ResourceProvenanceContext> = {}): ResourceProvenanceContext => ({
  throughRoundOrdinal: 38, scheduleReceipts: [], lootReceipts: [], combatSettlements: [], ...extra,
});
const shop = (serial: number, definitionId = 'tristana'): ResourceFact => ({
  kind: 'unit-acquired', unitId: `unit-${serial}`, source: { kind: 'shop', generation: serial, slotIndex: 0, definitionId },
});
const upgrade = (survivorId: string, consumedIds: readonly string[], fromStar: 1 | 2 = 1, definitionId = 'tristana'): UnitUpgradedEvent => ({
  type: 'unitUpgraded', survivorId, consumedIds, definitionId, fromStar, toStar: fromStar === 1 ? 2 : 3,
  location: { kind: 'bench', slot: 0 },
});
const growth = (unitId: string, attackDamageBps: number): PersistentGrowth => ({ unitId, attackDamageBps });
const delta = (sourceUnitId: string, attackDamageBps: number): CombatGrowthDelta => ({ sourceUnitId, attackDamageBps });
const settlement = (roundId: string, ordinal: number): ProvenanceCombatSettlement => ({
  roundId, combatId: `round-${ordinal}`, settlementId: `round-${ordinal}-settled`,
});
const commit = (ordinal: number, prefix: number, sourceDeltas: readonly CombatGrowthDelta[]): ResourceFact => ({
  kind: 'combat-growth-committed', combatId: `round-${ordinal}`, settlementId: `round-${ordinal}-settled`,
  combatStartProvenancePrefixLength: prefix, sourceDeltas,
});
function loot(kind: 'unit' | 'item', definitionId: string, id: string, roundId = '3-7', encounterId = 'wolves-v1', slotId = 'w00', slotOrdinal = 1): LootReceipt {
  const source = JSON.stringify(['pve', roundId, encounterId, slotId]);
  const dropId = JSON.stringify([roundId, encounterId, source, slotOrdinal]);
  return { receiptId: JSON.stringify([dropId, 'grant']), dropId, payload: { kind, definitionId, quantity: 1 },
    grantedItemIds: kind === 'item' ? [id] : [], grantedUnitIds: kind === 'unit' ? [id] : [] };
}
const itemReceipt = (round: number, roundId: string, id: string, definitionId: string): ScheduleReceipt => ({
  eventId: `round:${roundId}:supply`, round, kind: 'component', itemIds: [id], gold: 0, unitId: null, definitionId,
});
function itemFixture() {
  const receipts = [itemReceipt(7, '2-4', 'item-1', 'sword'), itemReceipt(14, '3-4', 'item-2', 'sword')];
  let provenance = appendResourceProvenance(opening(), '2-4', { kind: 'item-acquired', itemId: 'item-1', source: { kind: 'schedule', eventId: receipts[0].eventId } });
  provenance = appendResourceProvenance(provenance, '3-4', { kind: 'item-acquired', itemId: 'item-2', source: { kind: 'schedule', eventId: receipts[1].eventId } });
  provenance = appendResourceProvenance(provenance, '3-5', { kind: 'item-combined', event: {
    type: 'itemCombined', consumedIds: ['item-1', 'item-2'], itemId: 'item-3', definitionId: 'deathblade',
  } });
  return { provenance, ctx: context({ scheduleReceipts: receipts }) };
}
function thousandFixture() {
  let provenance = appendResourceProvenance(opening(), '2-6', [shop(2), shop(3)]);
  provenance = appendResourceProvenance(provenance, '2-6', commit(9, 3, [delta('unit-2', 250), delta('unit-3', 375)]));
  const receipt = loot('unit', 'tristana', 'unit-4');
  provenance = appendResourceProvenance(provenance, '3-7', [
    { kind: 'unit-acquired', unitId: 'unit-4', source: { kind: 'loot', receiptId: receipt.receiptId } },
    { kind: 'unit-upgraded', acquisitionSequence: 4, event: upgrade('unit-2', ['unit-3', 'unit-4']) },
    commit(17, 4, [delta('unit-2', 125), delta('unit-3', 250)]),
  ]);
  return { provenance, ctx: context({ lootReceipts: [receipt], combatSettlements: [settlement('2-6', 9), settlement('3-7', 17)] }) };
}
function mutateEntry(provenance: ResourceProvenance, index: number, changes: object): ResourceProvenance {
  return { ...copy(provenance), entries: provenance.entries.map((entry, i) => i === index ? { ...copy(entry), ...changes } : copy(entry)) };
}
function removeEntry(provenance: ResourceProvenance, index: number): ResourceProvenance {
  return { ...copy(provenance), entries: provenance.entries.filter((_, i) => i !== index).map((entry, sequence) => ({ ...copy(entry), sequence })) };
}

// Pure checkpoint-② proofs. These are not claims that the future B8 loot pipeline is enabled.
// Numeric expectations are literal, including both the algebra-only 370 and legal-step 1000.
describe('B8 provenance shared stock/delta algebra', () => {
  it('moves 300 stock and 70 pending delta separately, yielding the independent 370 vector', () => {
    const event = upgrade('A', ['B', 'R']);
    const stock = [growth('A', 100), growth('B', 200)], pending = [growth('A', 30), growth('B', 40)];
    expect(mergeGrowthLedger(stock, [event])).toEqual([growth('A', 300)]);
    expect(mergeGrowthLedger(pending, [event])).toEqual([growth('A', 70)]);
    expect(mergeGrowthLedger([growth('A', 130), growth('B', 240)], [event])).toEqual([growth('A', 370)]);
    expect(stock).toEqual([growth('A', 100), growth('B', 200)]);
    expect(pending).toEqual([growth('A', 30), growth('B', 40)]);
  });

  it('follows a changed survivor through the second merge, including a dead source delta', () => {
    const events = [upgrade('A', ['B', 'R']), upgrade('C', ['A', 'D'], 2)];
    expect(mergeGrowthLedger([growth('A', 100), growth('B', 200)], events)).toEqual([growth('C', 300)]);
    expect(mergeGrowthLedger([growth('A', 30), growth('B', 40)], events)).toEqual([growth('C', 70)]);
  });

  it('accepts nonnegative integer algebra without weakening domain growth validation', () => {
    expect(mergeGrowthLedger([growth('A', 31), growth('B', 42)], [upgrade('A', ['B', 'R'])])).toEqual([growth('A', 73)]);
    expect(mergeGrowthLedger([growth('A', 0), growth('B', 0)], [upgrade('A', ['B', 'R'])])).toEqual([]);
    expect(() => mergeGrowthLedger([growth('A', -30), growth('B', 40)], [upgrade('A', ['B', 'R'])])).toThrow();
    expect(() => mergeGrowthLedger([growth('A', Number.MAX_SAFE_INTEGER), growth('B', 1)], [upgrade('A', ['B', 'R'])])).toThrow();
    expect(() => mergeGrowthLedger([growth('A', 1), growth('A', 2)], [])).toThrow();
    expect(() => mergeGrowthLedger([growth('A', 1.5)], [])).toThrow();
    expect(() => mergeGrowthLedger([], [upgrade('A', ['A', 'B'])])).toThrow();
  });
});

describe('B8 provenance opening, append and prefix projections', () => {
  it('initializes the only opening identity and independent immutable appends', () => {
    const source: ResourceFact = shop(2, 'maddie');
    const initial = opening(), next = appendResourceProvenance(initial, '1-2', source);
    expect(initial.entries).toHaveLength(1);
    expect(Object.isFrozen(next.entries[1])).toBe(true);
    expect(Object.isFrozen(source)).toBe(false);
    expect(foldResourceProvenance(initial, context({ throughRoundOrdinal: 1 }))).toEqual({
      units: [{ id: 'unit-1', definitionId: 'irelia', starLevel: 1 }], items: [], persistentGrowth: [], nextUnitSerial: 2, nextItemSerial: 1,
    });
    expect(next.entries.map(entry => entry.sequence)).toEqual([0, 1]);
  });

  it('projects any prefix while authenticating the complete stream and later receipts', () => {
    const { provenance, ctx } = thousandFixture();
    const zero = foldResourceProvenance(provenance, { ...ctx, prefixLength: 0 });
    expect(zero).toEqual({ units: [], items: [], persistentGrowth: [], nextUnitSerial: 1, nextItemSerial: 1 });
    const start = foldResourceProvenance(provenance, { ...ctx, prefixLength: 4 });
    expect(start.units).toEqual([
      { id: 'unit-1', definitionId: 'irelia', starLevel: 1 },
      { id: 'unit-2', definitionId: 'tristana', starLevel: 1 },
      { id: 'unit-3', definitionId: 'tristana', starLevel: 1 },
    ]);
    expect(start.persistentGrowth).toEqual([growth('unit-2', 250), growth('unit-3', 375)]);
    expect(start.nextUnitSerial).toBe(4);
    expect(foldResourceProvenance(provenance, { ...ctx, prefixLength: 5 }).units).toHaveLength(4);
    expect(foldResourceProvenance(provenance, { ...ctx, prefixLength: 6 }).persistentGrowth).toEqual([growth('unit-2', 625)]);
    expect(() => foldResourceProvenance(mutateEntry(provenance, 6, { settlementId: 'fake' }), { ...ctx, prefixLength: 1 })).toThrow();
  });

  it.each([
    ['no opening', empty()],
    ['duplicate opening', appendResourceProvenance(opening(), '1-2', { kind: 'unit-acquired', unitId: 'unit-2', source: { kind: 'opening' } })],
    ['wrong opening unit', mutateEntry(opening(), 0, { unitId: 'unit-2' })],
    ['wrong opening round', mutateEntry(opening(), 0, { roundId: '1-3' })],
    ['wrong first source', mutateEntry(opening(), 0, { source: { kind: 'shop', definitionId: 'irelia', generation: 1, slotIndex: 0 } })],
    ['noncontinuous sequence', mutateEntry(opening(), 0, { sequence: 1 })],
    ['extra state authority', { ...opening(), growthBySurvivor: {} }],
  ])('rejects %s', (_label, provenance) => {
    expect(() => foldResourceProvenance(provenance, context())).toThrow();
  });

  it('rejects future rounds, descending catalog order, missing fields and bad prefix bounds', () => {
    const provenance = appendResourceProvenance(opening(), '2-1', shop(2));
    expect(() => foldResourceProvenance(provenance, context({ throughRoundOrdinal: 3 }))).toThrow();
    expect(() => appendResourceProvenance(provenance, '1-4', shop(3))).toThrow();
    expect(() => foldResourceProvenance(provenance, context({ prefixLength: 3 }))).toThrow();
    expect(() => foldResourceProvenance(provenance, context({ prefixLength: -1 }))).toThrow();
    expect(() => foldResourceProvenance({ entries: [] }, context())).toThrow();
    expect(() => foldResourceProvenance({ ...opening(), version: 'future-version' }, context())).toThrow();
  });

  it('rejects unsupported JSON values and prototype-bearing records', () => {
    expect(() => foldResourceProvenance({ ...opening(), entries: new Array(1) }, context())).toThrow();
    expect(() => foldResourceProvenance(new Date(), context())).toThrow();
    expect(() => foldResourceProvenance(mutateEntry(opening(), 0, { extra: undefined }), context())).toThrow();
    const cycle = { ...opening() } as Record<string, unknown>; cycle.self = cycle;
    expect(() => foldResourceProvenance(cycle, context())).toThrow();
  });
});

describe('B8 provenance receipt, birth and consumption chain', () => {
  it('binds a received candidate even when it is immediately consumed; folds legal 1000 Bps', () => {
    const { provenance, ctx } = thousandFixture(), before = JSON.stringify({ provenance, ctx });
    const result = foldResourceProvenance(provenance, ctx);
    expect(result.units).toEqual([
      { id: 'unit-1', definitionId: 'irelia', starLevel: 1 },
      { id: 'unit-2', definitionId: 'tristana', starLevel: 2 },
    ]);
    expect(result.persistentGrowth).toEqual([growth('unit-2', 1000)]);
    expect(result.nextUnitSerial).toBe(5);
    expect(ctx.lootReceipts[0].grantedUnitIds).toEqual(['unit-4']);
    expect(result.units.some(unit => unit.id === 'unit-4')).toBe(false);
    expect(JSON.stringify({ provenance, ctx })).toBe(before);
    expect(foldResourceProvenance(copy(provenance), ctx)).toEqual(result);
  });

  it('follows an actual two-level chain with changing survivor and no dead-source filter', () => {
    let provenance = opening();
    // C and D are already two-star. A/B enter combat separately; R completes a cascade.
    provenance = appendResourceProvenance(provenance, '2-6', [shop(2), shop(3), shop(4),
      { kind: 'unit-upgraded', acquisitionSequence: 3, event: upgrade('unit-2', ['unit-3', 'unit-4']) },
      shop(5), shop(6), shop(7),
      { kind: 'unit-upgraded', acquisitionSequence: 7, event: upgrade('unit-5', ['unit-6', 'unit-7']) },
      shop(8), shop(9),
      commit(9, 11, [delta('unit-8', 250), delta('unit-9', 375)]),
    ]);
    const receipt = loot('unit', 'tristana', 'unit-10');
    provenance = appendResourceProvenance(provenance, '3-7', [
      { kind: 'unit-acquired', unitId: 'unit-10', source: { kind: 'loot', receiptId: receipt.receiptId } },
      { kind: 'unit-upgraded', acquisitionSequence: 12, event: upgrade('unit-8', ['unit-10', 'unit-9']) },
      { kind: 'unit-upgraded', acquisitionSequence: 12, event: upgrade('unit-2', ['unit-5', 'unit-8'], 2) },
      commit(17, 12, [delta('unit-8', 125), delta('unit-9', 250)]),
    ]);
    const result = foldResourceProvenance(provenance, context({ lootReceipts: [receipt], combatSettlements: [settlement('2-6', 9), settlement('3-7', 17)] }));
    expect(result.units).toEqual([
      { id: 'unit-1', definitionId: 'irelia', starLevel: 1 },
      { id: 'unit-2', definitionId: 'tristana', starLevel: 3 },
    ]);
    expect(result.persistentGrowth).toEqual([growth('unit-2', 1000)]);
    expect(result.nextUnitSerial).toBe(11);
  });

  it('rejects deleted, duplicated and forged receipt births', () => {
    const { provenance, ctx } = thousandFixture();
    expect(() => foldResourceProvenance(provenance, { ...ctx, lootReceipts: [] })).toThrow();
    expect(() => foldResourceProvenance(provenance, { ...ctx, lootReceipts: [...ctx.lootReceipts, ctx.lootReceipts[0]] })).toThrow();
    expect(() => foldResourceProvenance(provenance, { ...ctx, lootReceipts: [{ ...ctx.lootReceipts[0], grantedUnitIds: ['unit-2'] }] })).toThrow();
    expect(() => foldResourceProvenance(provenance, { ...ctx, lootReceipts: [{ ...ctx.lootReceipts[0], payload: { kind: 'unit', definitionId: 'lux', quantity: 1 } }] })).toThrow();
    expect(() => foldResourceProvenance(removeEntry(provenance, 4), ctx)).toThrow();
    expect(() => foldResourceProvenance(appendResourceProvenance(provenance, '3-7', { kind: 'unit-acquired', unitId: 'unit-5', source: { kind: 'loot', receiptId: ctx.lootReceipts[0].receiptId } }), ctx)).toThrow();
  });

  it('requires every valid receipt birth, including a fully consumed component', () => {
    const { provenance, ctx } = itemFixture();
    const result = foldResourceProvenance(provenance, ctx);
    expect(result.items).toEqual([{ id: 'item-3', definitionId: 'deathblade' }]);
    expect(result.nextItemSerial).toBe(4);
    expect(ctx.scheduleReceipts.map(receipt => receipt.itemIds)).toEqual([['item-1'], ['item-2']]);
    expect(() => foldResourceProvenance(removeEntry(provenance, 1), ctx)).toThrow();
    expect(() => foldResourceProvenance(opening(), ctx)).toThrow();
  });

  it.each([
    ['missing consumption', null],
    ['duplicate consumed ID', { event: upgrade('unit-2', ['unit-3', 'unit-3']) }],
    ['survivor consumed', { event: upgrade('unit-2', ['unit-2', 'unit-4']) }],
    ['wrong definition', { event: upgrade('unit-2', ['unit-3', 'unit-4'], 1, 'lux') }],
    ['wrong star', { event: upgrade('unit-2', ['unit-3', 'unit-4'], 2) }],
    ['illegal star jump', { event: { ...upgrade('unit-2', ['unit-3', 'unit-4']), toStar: 3 } }],
    ['absent source', { event: upgrade('unit-2', ['unit-3', 'unit-99']) }],
    ['old acquisition', { acquisitionSequence: 2 }],
    ['self reference', { acquisitionSequence: 5 }],
    ['wrong event shape', { event: { ...upgrade('unit-2', ['unit-3', 'unit-4']), consumedUnitIds: [] } }],
  ])('rejects upgrade %s', (_label, mutation) => {
    const { provenance, ctx } = thousandFixture();
    expect(() => foldResourceProvenance(mutation === null ? removeEntry(provenance, 5) : mutateEntry(provenance, 5, mutation), ctx)).toThrow();
  });

  it('rejects a nonconsecutive transaction, duplicate consumption and a forged reverse cycle', () => {
    const { provenance, ctx } = thousandFixture();
    const fact = provenance.entries[5];
    const duplicate = appendResourceProvenance(provenance, '3-7', { kind: 'unit-upgraded', acquisitionSequence: 4, event: upgrade('unit-3', ['unit-2', 'unit-4']) });
    expect(() => foldResourceProvenance(duplicate, ctx)).toThrow();
    const interrupted = { ...provenance, entries: [...provenance.entries.slice(0, 5),
      { kind: 'unit-sold' as const, unitId: 'unit-1', context: 'preparation' as const, goldGranted: 1, sequence: 5, roundId: '3-7' },
      { ...fact, sequence: 6 }, { ...provenance.entries[6], sequence: 7 }] };
    expect(() => foldResourceProvenance(interrupted, ctx)).toThrow();
  });

  it('enforces shop structural boundaries without claiming RNG or command-history authenticity', () => {
    const provenance = appendResourceProvenance(opening(), '1-2', [shop(2, 'lux'), shop(3, 'maddie')]);
    expect(foldResourceProvenance(provenance, context()).units).toHaveLength(3);
    for (const source of [
      { kind: 'shop', definitionId: 'neutral-minion', generation: 1, slotIndex: 0 },
      { kind: 'shop', definitionId: 'lux', generation: 0, slotIndex: 0 },
      { kind: 'shop', definitionId: 'lux', generation: 1, slotIndex: 5 },
      { kind: 'shop', definitionId: 'lux', generation: 1.5, slotIndex: 0 },
      { kind: 'reward', definitionId: 'lux' },
    ]) expect(() => foldResourceProvenance(mutateEntry(provenance, 1, { source }), context())).toThrow();
    expect(() => foldResourceProvenance(mutateEntry(provenance, 2, { source: { kind: 'shop', definitionId: 'maddie', generation: 2, slotIndex: 0 } }), context())).toThrow();
    expect(() => foldResourceProvenance(mutateEntry(provenance, 2, { unitId: 'unit-4' }), context())).toThrow();
  });

  it('recomputes star-dependent sale price and deletes growth without reusing unit serials', () => {
    const { provenance, ctx } = thousandFixture();
    const sold = appendResourceProvenance(provenance, '3-7', { kind: 'unit-sold', unitId: 'unit-2', context: 'settlement-capacity', goldGranted: 5 });
    expect(foldResourceProvenance(sold, ctx)).toMatchObject({
      units: [{ id: 'unit-1', definitionId: 'irelia', starLevel: 1 }], persistentGrowth: [], nextUnitSerial: 5,
    });
    expect(() => foldResourceProvenance(mutateEntry(sold, 7, { goldGranted: 6 }), ctx)).toThrow();
    expect(() => foldResourceProvenance(appendResourceProvenance(sold, '3-7', { kind: 'unit-sold', unitId: 'unit-2', context: 'settlement-capacity', goldGranted: 5 }), ctx)).toThrow();
    expect(() => foldResourceProvenance(appendResourceProvenance(opening(), '1-2', { kind: 'unit-sold', unitId: 'unit-1', context: 'settlement-capacity', goldGranted: 1 }), context())).toThrow();
  });
});

describe('B8 provenance growth identity, ownership and once-only settlement', () => {
  it('records empty deltas too and rejects a missing or repeated settlement', () => {
    const provenance = appendResourceProvenance(opening(), '1-2', commit(1, 1, []));
    const ctx = context({ combatSettlements: [settlement('1-2', 1)] });
    expect(foldResourceProvenance(provenance, ctx).persistentGrowth).toEqual([]);
    expect(() => foldResourceProvenance(opening(), ctx)).toThrow();
    expect(() => foldResourceProvenance(provenance, context())).toThrow();
    expect(() => foldResourceProvenance(provenance, { ...ctx, combatSettlements: [settlement('1-2', 1), settlement('1-2', 1)] })).toThrow();
    expect(() => foldResourceProvenance(appendResourceProvenance(provenance, '1-2', commit(1, 2, [])), ctx)).toThrow();
    expect(() => foldResourceProvenance(appendResourceProvenance(opening(), '2-4', commit(7, 1, [])), context({ combatSettlements: [settlement('2-4', 7)] }))).toThrow();
  });

  it.each([
    ['combat identity', { combatId: 'round-16' }],
    ['settlement identity', { settlementId: 'round-9-settled' }],
    ['negative delta', { sourceDeltas: [delta('unit-2', -125)] }],
    ['zero delta', { sourceDeltas: [delta('unit-2', 0)] }],
    ['illegal 30/40 algebra in a save', { sourceDeltas: [delta('unit-2', 30), delta('unit-3', 40)] }],
    ['duplicate source', { sourceDeltas: [delta('unit-2', 125), delta('unit-2', 250)] }],
    ['unsorted source', { sourceDeltas: [delta('unit-3', 250), delta('unit-2', 125)] }],
    ['non-Tristana source', { sourceDeltas: [delta('unit-1', 125)] }],
    ['post-start candidate', { sourceDeltas: [delta('unit-4', 125)] }],
    ['unknown source', { sourceDeltas: [delta('unit-99', 125)] }],
    ['future prefix', { combatStartProvenancePrefixLength: 8 }],
    ['prefix before previous commit', { combatStartProvenancePrefixLength: 3 }],
    ['prefix inside acquisition', { combatStartProvenancePrefixLength: 5 }],
    ['prefix after upgrade revives consumed source', { combatStartProvenancePrefixLength: 6 }],
  ])('rejects growth %s', (_label, mutation) => {
    const { provenance, ctx } = thousandFixture();
    expect(() => foldResourceProvenance(mutateEntry(provenance, 6, mutation), ctx)).toThrow();
  });

  it('rejects a sale or shop acquisition between start-prefix and growth commit', () => {
    let provenance = appendResourceProvenance(opening(), '1-2', shop(2));
    provenance = appendResourceProvenance(provenance, '1-2', commit(1, 1, [delta('unit-2', 125)]));
    expect(() => foldResourceProvenance(provenance, context({ combatSettlements: [settlement('1-2', 1)] }))).toThrow();
    provenance = appendResourceProvenance(opening(), '1-2', [
      { kind: 'unit-sold', unitId: 'unit-1', context: 'preparation', goldGranted: 1 }, commit(1, 1, []),
    ]);
    expect(() => foldResourceProvenance(provenance, context({ combatSettlements: [settlement('1-2', 1)] }))).toThrow();
  });
});

describe('B8 provenance item recipes, continuous product serials and receipts', () => {
  it.each([
    ['wrong recipe', { definitionId: 'rageblade' }],
    ['same component twice', { consumedIds: ['item-1', 'item-1'] }],
    ['unborn component', { consumedIds: ['item-1', 'item-99'] }],
    ['reversed canonical inputs', { consumedIds: ['item-2', 'item-1'] }],
    ['skipped serial', { itemId: 'item-4' }],
    ['reused serial', { itemId: 'item-1' }],
  ])('rejects %s', (_label, mutation) => {
    const { provenance, ctx } = itemFixture();
    const combined = provenance.entries[3];
    if (combined.kind !== 'item-combined') throw new Error('Fixture');
    expect(() => foldResourceProvenance(mutateEntry(provenance, 3, { event: { ...combined.event, ...mutation } }), ctx)).toThrow();
  });

  it('rejects repeated consumption, a completed item as a component, and product double-birth', () => {
    const { provenance, ctx } = itemFixture();
    const duplicate = appendResourceProvenance(provenance, '3-5', { kind: 'item-combined', event: {
      type: 'itemCombined', consumedIds: ['item-1', 'item-2'], itemId: 'item-4', definitionId: 'deathblade',
    } });
    expect(() => foldResourceProvenance(duplicate, ctx)).toThrow();
    const wrong = appendResourceProvenance(provenance, '3-5', { kind: 'item-combined', event: {
      type: 'itemCombined', consumedIds: ['item-2', 'item-3'], itemId: 'item-4', definitionId: 'deathblade',
    } });
    expect(() => foldResourceProvenance(wrong, ctx)).toThrow();
    const reborn = appendResourceProvenance(provenance, '3-5', { kind: 'item-acquired', itemId: 'item-3', source: { kind: 'schedule', eventId: ctx.scheduleReceipts[0].eventId } });
    expect(() => foldResourceProvenance(reborn, ctx)).toThrow();
  });

  it('reads item identity only from its loot receipt and rejects unbound or late receipts', () => {
    const receipt = loot('item', 'rod', 'item-1', '1-3', 'minions-b-v1', 'r01', 0);
    const provenance = appendResourceProvenance(opening(), '1-3', { kind: 'item-acquired', itemId: 'item-1', source: { kind: 'loot', receiptId: receipt.receiptId } });
    const ctx = context({ lootReceipts: [receipt] });
    expect(foldResourceProvenance(provenance, ctx).items).toEqual([{ id: 'item-1', definitionId: 'rod' }]);
    expect(() => foldResourceProvenance(provenance, context())).toThrow();
    expect(() => foldResourceProvenance(provenance, { ...ctx, throughRoundOrdinal: 1 })).toThrow();
    expect(() => foldResourceProvenance(mutateEntry(provenance, 1, { roundId: '1-4' }), ctx)).toThrow();
    expect(() => foldResourceProvenance(provenance, { ...ctx, lootReceipts: [{ ...receipt, receiptId: 'forged' }] })).toThrow();
    expect(() => foldResourceProvenance(provenance, { ...ctx, lootReceipts: [{ ...receipt, grantedItemIds: ['item-1', 'item-2'] }] })).toThrow();
  });
});


describe('B8 provenance known historical operation boundaries', () => {
  it('rejects post-settlement shop purchases and preparation sales', () => {
    const provenance = appendResourceProvenance(opening(), '1-2', commit(1, 1, []));
    const ctx = context({ combatSettlements: [settlement('1-2', 1)] });
    expect(() => foldResourceProvenance(appendResourceProvenance(provenance, '1-2', shop(2)), ctx)).toThrow();
    expect(() => foldResourceProvenance(appendResourceProvenance(provenance, '1-2', {
      kind: 'unit-sold', unitId: 'unit-1', context: 'preparation', goldGranted: 1,
    }), ctx)).toThrow();
    expect(foldResourceProvenance(appendResourceProvenance(provenance, '1-3', shop(2)), ctx).units).toHaveLength(2);
  });

  it('rejects a combination after settlement even in a historical round', () => {
    const { provenance, ctx } = itemFixture();
    const beforeCombine = { ...provenance, entries: provenance.entries.slice(0, 3) };
    const settled = appendResourceProvenance(beforeCombine, '3-5', commit(15, 3, []));
    const combined = provenance.entries[3];
    if (combined.kind !== 'item-combined') throw new Error('Fixture');
    expect(() => foldResourceProvenance(appendResourceProvenance(settled, '3-5', {
      kind: 'item-combined', event: combined.event,
    }), { ...ctx, combatSettlements: [settlement('3-5', 15)] })).toThrow();
  });

  it('rejects purchases, sales and combinations in supply rounds', () => {
    expect(() => foldResourceProvenance(appendResourceProvenance(opening(), '2-4', shop(2)), context())).toThrow();
    expect(() => foldResourceProvenance(appendResourceProvenance(opening(), '2-4', {
      kind: 'unit-sold', unitId: 'unit-1', context: 'preparation', goldGranted: 1,
    }), context())).toThrow();
    const { provenance, ctx } = itemFixture();
    expect(() => foldResourceProvenance(mutateEntry(provenance, 3, { roundId: '3-4' }), ctx)).toThrow();
  });

  it('permits a same-round capacity receipt only after its real candidate birth', () => {
    const receipt = loot('unit', 'maddie', 'unit-2', '1-2', 'minions-a-v1', 'm01', 0);
    let provenance = appendResourceProvenance(opening(), '1-2', commit(1, 1, []));
    provenance = appendResourceProvenance(provenance, '1-2', [
      { kind: 'unit-sold', unitId: 'unit-1', context: 'settlement-capacity', goldGranted: 1 },
      { kind: 'unit-acquired', unitId: 'unit-2', source: { kind: 'loot', receiptId: receipt.receiptId } },
    ]);
    const ctx = context({ lootReceipts: [receipt], combatSettlements: [settlement('1-2', 1)] });
    expect(foldResourceProvenance(provenance, ctx)).toMatchObject({ units: [{ id: 'unit-2', definitionId: 'maddie', starLevel: 1 }], nextUnitSerial: 3 });
    expect(() => foldResourceProvenance(removeEntry(provenance, 3), ctx)).toThrow();
  });

  it('rejects array-coerced definition and source identities at the JSON boundary', () => {
    const { provenance, ctx } = itemFixture(), combined = provenance.entries[3];
    if (combined.kind !== 'item-combined') throw new Error('Fixture');
    expect(() => foldResourceProvenance(mutateEntry(provenance, 3, { event: { ...combined.event, definitionId: ['deathblade'] } }), ctx)).toThrow();
    expect(() => foldResourceProvenance(mutateEntry(provenance, 1, {
      source: { kind: 'schedule', eventId: [ctx.scheduleReceipts[0].eventId] },
    }), ctx)).toThrow();
  });
});


describe('B8 provenance loot cannot become a same-round combat input', () => {
  it('rejects a forged start prefix that grants current-combat growth to its loot candidate', () => {
    const receipt = loot('unit', 'tristana', 'unit-2');
    const provenance = appendResourceProvenance(opening(), '3-7', [
      { kind: 'unit-acquired', unitId: 'unit-2', source: { kind: 'loot', receiptId: receipt.receiptId } },
      commit(17, 2, [delta('unit-2', 125)]),
    ]);
    expect(() => foldResourceProvenance(provenance, context({
      lootReceipts: [receipt], combatSettlements: [settlement('3-7', 17)],
    }))).toThrow('loot before combat start');
  });

  it('rejects a same-round item receipt hidden inside the start prefix, even with empty delta', () => {
    const receipt = loot('item', 'rod', 'item-1', '1-3', 'minions-b-v1', 'r01', 0);
    const provenance = appendResourceProvenance(opening(), '1-3', [
      { kind: 'item-acquired', itemId: 'item-1', source: { kind: 'loot', receiptId: receipt.receiptId } },
      commit(2, 2, []),
    ]);
    expect(() => foldResourceProvenance(provenance, context({
      lootReceipts: [receipt], combatSettlements: [settlement('1-3', 2)],
    }))).toThrow('loot before combat start');
  });

  it('still accepts same-round shop Tristana in the real pre-combat prefix', () => {
    const provenance = appendResourceProvenance(opening(), '3-7', [shop(2), commit(17, 2, [delta('unit-2', 125)])]);
    expect(foldResourceProvenance(provenance, context({
      combatSettlements: [settlement('3-7', 17)],
    })).persistentGrowth).toEqual([growth('unit-2', 125)]);
  });

  it('still accepts a capacity candidate after commitment, eligible for the next round only', () => {
    const receipt = loot('unit', 'tristana', 'unit-2');
    let provenance = appendResourceProvenance(opening(), '3-7', [commit(17, 1, []),
      { kind: 'unit-sold', unitId: 'unit-1', context: 'settlement-capacity', goldGranted: 1 },
      { kind: 'unit-acquired', unitId: 'unit-2', source: { kind: 'loot', receiptId: receipt.receiptId } },
    ]);
    const ctx = context({ lootReceipts: [receipt], combatSettlements: [settlement('3-7', 17)] });
    expect(foldResourceProvenance(provenance, ctx).persistentGrowth).toEqual([]);
    provenance = appendResourceProvenance(provenance, '4-1', commit(18, 4, [delta('unit-2', 125)]));
    expect(foldResourceProvenance(provenance, { ...ctx, combatSettlements: [settlement('3-7', 17), settlement('4-1', 18)] })
      .persistentGrowth).toEqual([growth('unit-2', 125)]);
  });
});
