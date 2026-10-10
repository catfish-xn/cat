import { DEFAULT_BOARD, isDeploymentCell } from './board';
import { freezeContent } from './content/freeze';
import { ITEM_DEFINITIONS } from './content/items';
import { lootDropId, lootReceiptId } from './loot-identity';
import { MATCH_RULES, OPENING_INITIAL_STATE, SHOP_CATALOG } from './match-rules';
import type { PersistentGrowth } from './match-types';
import type { LootReceipt } from './m8/contracts';
import { compareCodePoints } from './m8/identity';
import { getCatalogRoundById, getCatalogRoundByOrdinal } from './round-selectors';
import { getRoundSchedule } from './round-schedule';
import type { ScheduleReceipt, StrategyEvent } from './strategy-types';
import { getUnitSellPrice } from './unit-stats';
import type { StarLevel, UnitUpgradedEvent } from './unit-types';

export const RESOURCE_PROVENANCE_VERSION = 'm8-b8-resource-provenance-v1';
export type UnitAcquisitionSource =
  | { readonly kind: 'opening' }
  | { readonly kind: 'shop'; readonly generation: number; readonly slotIndex: number; readonly definitionId: string }
  | { readonly kind: 'loot'; readonly receiptId: string };
export type ItemAcquisitionSource =
  | { readonly kind: 'schedule'; readonly eventId: string }
  | { readonly kind: 'loot'; readonly receiptId: string };
export interface CombatGrowthDelta { readonly sourceUnitId: string; readonly attackDamageBps: number }
export type ResourceFact =
  | { readonly kind: 'unit-acquired'; readonly unitId: string; readonly source: UnitAcquisitionSource }
  | { readonly kind: 'unit-upgraded'; readonly acquisitionSequence: number; readonly event: UnitUpgradedEvent }
  | { readonly kind: 'unit-sold'; readonly unitId: string; readonly context: 'preparation' | 'settlement-capacity'; readonly goldGranted: number }
  | { readonly kind: 'item-acquired'; readonly itemId: string; readonly source: ItemAcquisitionSource }
  | { readonly kind: 'item-combined'; readonly event: Extract<StrategyEvent, { readonly type: 'itemCombined' }> }
  | { readonly kind: 'combat-growth-committed'; readonly combatId: string; readonly settlementId: string;
      readonly combatStartProvenancePrefixLength: number; readonly sourceDeltas: readonly CombatGrowthDelta[] };
export type ResourceProvenanceEntry = ResourceFact & { readonly sequence: number; readonly roundId: string };
export interface ResourceProvenance {
  readonly version: typeof RESOURCE_PROVENANCE_VERSION;
  readonly entries: readonly ResourceProvenanceEntry[];
}
export interface ProvenanceUnit { readonly id: string; readonly definitionId: string; readonly starLevel: StarLevel }
export interface ProvenanceItem { readonly id: string; readonly definitionId: string }
export interface FoldedResourceProvenance {
  readonly units: readonly ProvenanceUnit[];
  readonly items: readonly ProvenanceItem[];
  readonly persistentGrowth: readonly PersistentGrowth[];
  readonly nextUnitSerial: number;
  readonly nextItemSerial: number;
}
export interface ProvenanceCombatSettlement {
  readonly roundId: string; readonly combatId: string; readonly settlementId: string;
}
export interface ResourceProvenanceContext {
  /** Receipts must already be authenticated against their schedule/frozen loot plan. */
  readonly scheduleReceipts: readonly ScheduleReceipt[];
  readonly lootReceipts: readonly LootReceipt[];
  readonly throughRoundOrdinal: number;
  /** Validate the entire stream, then return this prefix's projection (including prefix 0). */
  readonly prefixLength?: number;
  /** Already validated non-supply settlements; every one requires exactly one commit. */
  readonly combatSettlements: readonly ProvenanceCombatSettlement[];
}

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(`Invalid resource provenance: ${message}`);
}
function integer(value: unknown, minimum = 0): asserts value is number {
  requireValue(Number.isSafeInteger(value) && (value as number) >= minimum, 'integer');
}
function nonempty(value: unknown): asserts value is string {
  requireValue(typeof value === 'string' && value.length > 0, 'identity');
}
function record(value: unknown): asserts value is Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype, 'plain object');
}
function keys(value: unknown, names: readonly string[]): asserts value is Record<string, unknown> {
  record(value);
  const actual = Object.keys(value);
  requireValue(actual.length === names.length && actual.every(key => names.includes(key)), 'fields');
}
function plainJson(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { requireValue(Number.isSafeInteger(value), 'JSON integer'); return; }
  requireValue(typeof value === 'object' && value !== null && !ancestors.has(value), 'plain JSON');
  ancestors.add(value);
  if (Array.isArray(value)) {
    requireValue(Object.keys(value).length === value.length, 'dense JSON array');
    for (let i = 0; i < value.length; i++) {
      requireValue(Object.hasOwn(value, i), 'dense JSON array'); plainJson(value[i], ancestors);
    }
  } else {
    record(value);
    requireValue(Reflect.ownKeys(value).length === Object.keys(value).length, 'JSON keys');
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      requireValue('value' in descriptor, 'JSON data property'); plainJson(descriptor.value, ancestors);
    }
  }
  ancestors.delete(value);
}
const compareIds = (a: { readonly id: string }, b: { readonly id: string }) => compareCodePoints(a.id, b.id);
const compareGrowth = (a: PersistentGrowth, b: PersistentGrowth) => compareCodePoints(a.unitId, b.unitId);

/** Append facts atomically; no grants, RNG, locations or independently writable counters. */
export function appendResourceProvenance(
  provenance: ResourceProvenance, roundId: string, facts: ResourceFact | readonly ResourceFact[],
): ResourceProvenance {
  requireValue(provenance.version === RESOURCE_PROVENANCE_VERSION, 'version');
  const round = getCatalogRoundById(roundId);
  requireValue(!provenance.entries.length || getCatalogRoundById(provenance.entries.at(-1)!.roundId).ordinal <= round.ordinal, 'round order');
  const added = Array.isArray(facts) ? facts : [facts];
  plainJson(added);
  return freezeContent({ version: RESOURCE_PROVENANCE_VERSION,
    entries: [...structuredClone(provenance.entries), ...added.map((fact, index) => ({
      ...structuredClone(fact), sequence: provenance.entries.length + index, roundId,
    }))] });
}

/** Shared nonnegative integer algebra for stock AND pending delta. Save-step checks belong to fold. */
export function mergeGrowthLedger(
  ledger: readonly PersistentGrowth[], events: readonly UnitUpgradedEvent[],
): readonly PersistentGrowth[] {
  const values = new Map<string, number>();
  for (const entry of ledger) {
    nonempty(entry.unitId);
    requireValue(Number.isSafeInteger(entry.attackDamageBps) && entry.attackDamageBps >= 0 && !values.has(entry.unitId), 'growth ledger');
    values.set(entry.unitId, entry.attackDamageBps);
  }
  for (const event of events) {
    const ids = [event.survivorId, ...event.consumedIds];
    requireValue(event.consumedIds.length === 2 && new Set(ids).size === 3, 'upgrade identity');
    ids.forEach(nonempty);
    let total = 0;
    for (const id of ids) {
      total += values.get(id) ?? 0;
      requireValue(Number.isSafeInteger(total), 'growth overflow'); values.delete(id);
    }
    if (total) values.set(event.survivorId, total);
  }
  return [...values].filter(([, value]) => value !== 0)
    .map(([unitId, attackDamageBps]) => ({ unitId, attackDamageBps })).sort(compareGrowth);
}

interface BirthReceipt { readonly kind: 'unit' | 'item'; readonly id: string; readonly definitionId: string; readonly roundId: string }
function receiptBirths(context: ResourceProvenanceContext): Map<string, BirthReceipt> {
  const births = new Map<string, BirthReceipt>(), receiptIds = new Set<string>(), assetIds = new Set<string>();
  const add = (key: string, birth: BirthReceipt) => {
    requireValue(!births.has(key) && !assetIds.has(birth.id), 'duplicate receipt birth');
    births.set(key, birth); assetIds.add(birth.id);
  };
  for (const receipt of context.scheduleReceipts) {
    plainJson(receipt);
    keys(receipt, ['eventId', 'round', 'kind', 'itemIds', 'gold', 'unitId', 'definitionId']);
    requireValue(!receiptIds.has(`schedule:${receipt.eventId}`), 'duplicate schedule receipt');
    receiptIds.add(`schedule:${receipt.eventId}`);
    const round = getCatalogRoundByOrdinal(receipt.round);
    requireValue(round.ordinal <= context.throughRoundOrdinal
      && getRoundSchedule(round.ordinal).some(event => event.id === receipt.eventId && event.kind === receipt.kind), 'schedule identity');
    requireValue(Array.isArray(receipt.itemIds), 'schedule items');
    if (receipt.kind === 'component') {
      requireValue(receipt.itemIds.length === 1 && receipt.unitId === null && receipt.gold === 0
        && typeof receipt.definitionId === 'string' && ITEM_DEFINITIONS[receipt.definitionId]?.kind === 'component', 'schedule component');
      nonempty(receipt.itemIds[0]);
      add(`schedule:${receipt.eventId}`, { kind: 'item', id: receipt.itemIds[0], definitionId: receipt.definitionId, roundId: round.roundId });
    } else requireValue(receipt.itemIds.length === 0 && receipt.kind !== 'reward', 'unsupported schedule birth');
  }
  for (const receipt of context.lootReceipts) {
    plainJson(receipt);
    keys(receipt, ['receiptId', 'dropId', 'payload', 'grantedItemIds', 'grantedUnitIds']);
    nonempty(receipt.dropId);
    const tuple: unknown = JSON.parse(receipt.dropId);
    requireValue(Array.isArray(tuple) && tuple.length === 4, 'loot drop identity');
    const [roundId, encounterId, sourceUnitId, slotOrdinal] = tuple;
    nonempty(roundId); nonempty(encounterId); nonempty(sourceUnitId); integer(slotOrdinal);
    const round = getCatalogRoundById(roundId);
    requireValue(round.ordinal <= context.throughRoundOrdinal && round.encounterId === encounterId
      && receipt.dropId === lootDropId(roundId, encounterId, sourceUnitId, slotOrdinal)
      && receipt.receiptId === lootReceiptId(receipt.dropId), 'loot receipt identity');
    requireValue(!receiptIds.has(`loot:${receipt.receiptId}`), 'duplicate loot receipt');
    receiptIds.add(`loot:${receipt.receiptId}`);
    requireValue(Array.isArray(receipt.grantedItemIds) && Array.isArray(receipt.grantedUnitIds), 'loot granted IDs');
    record(receipt.payload);
    if (receipt.payload.kind === 'gold') {
      keys(receipt.payload, ['kind', 'quantity']); integer(receipt.payload.quantity, 1);
      requireValue(!receipt.grantedItemIds.length && !receipt.grantedUnitIds.length, 'gold birth');
      continue;
    }
    keys(receipt.payload, ['kind', 'definitionId', 'quantity']);
    const { kind, definitionId, quantity } = receipt.payload; nonempty(definitionId);
    requireValue((kind === 'unit' || kind === 'item') && quantity === 1, 'loot resource quantity');
    requireValue(kind === 'unit' ? SHOP_CATALOG.includes(definitionId)
      : ITEM_DEFINITIONS[definitionId]?.kind === 'component', 'loot resource definition');
    const granted = kind === 'unit' ? receipt.grantedUnitIds : receipt.grantedItemIds;
    requireValue(granted.length === 1 && (kind === 'unit' ? receipt.grantedItemIds : receipt.grantedUnitIds).length === 0, 'loot resource identity');
    nonempty(granted[0]);
    add(`loot:${receipt.receiptId}`, { kind, id: granted[0], definitionId, roundId });
  }
  return births;
}

function validateUpgrade(event: UnitUpgradedEvent): void {
  keys(event, ['type', 'survivorId', 'consumedIds', 'definitionId', 'fromStar', 'toStar', 'location']);
  nonempty(event.definitionId);
  requireValue(event.type === 'unitUpgraded' && (event.fromStar === 1 || event.fromStar === 2)
    && event.toStar === event.fromStar + 1, 'upgrade stars');
  requireValue(Array.isArray(event.consumedIds) && event.consumedIds.length === 2
    && new Set([event.survivorId, ...event.consumedIds]).size === 3
    && compareCodePoints(event.consumedIds[0], event.consumedIds[1]) < 0, 'upgrade participants');
  [event.survivorId, ...event.consumedIds].forEach(nonempty);
  record(event.location);
  if (event.location.kind === 'board') {
    keys(event.location, ['kind', 'cell']); keys(event.location.cell, ['col', 'row']);
    requireValue(isDeploymentCell(DEFAULT_BOARD, 'player', event.location.cell), 'upgrade location');
  } else {
    keys(event.location, ['kind', 'slot']); integer(event.location.slot);
    requireValue(event.location.kind === 'bench' && event.location.slot < 9, 'upgrade location');
  }
}

/** Read-only structural proof. Location/retention and current combat deltas are cross-checked by
 * Match against its independently validated basis and the existing planPurchase implementation.
 * This does not authenticate jointly forged historical shop commands or historical combat events.
 */
export function foldResourceProvenance(value: unknown, context: ResourceProvenanceContext): FoldedResourceProvenance {
  getCatalogRoundByOrdinal(context.throughRoundOrdinal);
  plainJson(value); keys(value, ['version', 'entries']);
  requireValue(value.version === RESOURCE_PROVENANCE_VERSION && Array.isArray(value.entries) && value.entries.length > 0, 'version/opening');
  const entries = value.entries as ResourceProvenanceEntry[];
  const prefixLength = context.prefixLength ?? entries.length;
  integer(prefixLength); requireValue(prefixLength <= entries.length, 'prefix bounds');
  const births = receiptBirths(context), usedBirths = new Set<string>();
  const units = new Map<string, ProvenanceUnit>(), items = new Map<string, ProvenanceItem>();
  let growth: readonly PersistentGrowth[] = [], nextUnitSerial = 1, nextItemSerial = 1, lastOrdinal = 1;
  let acquisition: { readonly sequence: number; readonly unitId: string; readonly definitionId: string; readonly roundId: string; survivorId: string; star: number } | null = null;
  let lastShopGeneration = 0;
  const shopSlots = new Set<string>(), commits = new Map<string, ProvenanceCombatSettlement>();
  const firstLootBirth = new Map<string, number>();
  const starts = new Set(entries.filter(entry => entry?.kind === 'combat-growth-committed')
    .map(entry => (entry as Extract<ResourceProvenanceEntry, { kind: 'combat-growth-committed' }>).combatStartProvenancePrefixLength));
  const unitPrefixes = new Map<number, ReadonlyMap<string, ProvenanceUnit>>();
  const projection = (): FoldedResourceProvenance => ({ units: [...units.values()].map(unit => ({ ...unit })).sort(compareIds),
    items: [...items.values()].map(item => ({ ...item })).sort(compareIds), persistentGrowth: growth.map(entry => ({ ...entry })), nextUnitSerial, nextItemSerial });
  let result = projection();
  const finishAcquisition = () => {
    if (!acquisition) return;
    for (const star of [1, 2]) requireValue([...units.values()].filter(unit => unit.definitionId === acquisition!.definitionId && unit.starLevel === star).length < 3, 'missing upgrade');
    acquisition = null;
  };
  const takeBirth = (key: string, kind: BirthReceipt['kind'], id: string, roundId: string): string => {
    const birth = births.get(key);
    requireValue(birth && birth.kind === kind && birth.id === id && birth.roundId === roundId && !usedBirths.has(key), 'receipt birth binding');
    usedBirths.add(key); return birth.definitionId;
  };
  for (const [index, entry] of entries.entries()) {
    record(entry); integer(entry.sequence);
    requireValue(entry.sequence === index, 'sequence');
    const round = getCatalogRoundById(entry.roundId);
    requireValue(round.ordinal >= lastOrdinal && round.ordinal <= context.throughRoundOrdinal, 'round order/boundary');
    lastOrdinal = round.ordinal;
    if (starts.has(index)) unitPrefixes.set(index, new Map(units));
    if (entry.kind !== 'unit-upgraded') finishAcquisition();
    const common = ['kind', 'sequence', 'roundId'];
    if ((entry.kind === 'unit-acquired' || entry.kind === 'item-acquired') && entry.source?.kind === 'loot'
      && !firstLootBirth.has(entry.roundId)) firstLootBirth.set(entry.roundId, index);
    if (entry.kind === 'unit-acquired') {
      keys(entry, [...common, 'unitId', 'source']); record(entry.source);
      requireValue(round.kind !== 'supply', 'unit birth in supply');
      requireValue(entry.unitId === `unit-${nextUnitSerial}`, 'unit serial'); integer(nextUnitSerial + 1, 1);
      let definitionId: string;
      if (entry.source.kind === 'opening') {
        keys(entry.source, ['kind']);
        requireValue(index === 0 && entry.unitId === OPENING_INITIAL_STATE.unit.id && round.ordinal === 1, 'opening');
        definitionId = OPENING_INITIAL_STATE.unit.definitionId;
      } else if (entry.source.kind === 'shop') {
        keys(entry.source, ['kind', 'generation', 'slotIndex', 'definitionId']);
        requireValue(!commits.has(entry.roundId), 'shop after settlement');
        integer(entry.source.generation, 1); integer(entry.source.slotIndex);
        requireValue(entry.source.slotIndex < MATCH_RULES.shopSize && entry.source.generation >= lastShopGeneration
          && SHOP_CATALOG.includes(entry.source.definitionId), 'shop source');
        const key = `${entry.source.generation}:${entry.source.slotIndex}`;
        requireValue(!shopSlots.has(key), 'duplicate shop purchase'); shopSlots.add(key); lastShopGeneration = entry.source.generation;
        definitionId = entry.source.definitionId;
      } else {
        keys(entry.source, ['kind', 'receiptId']);
        requireValue(entry.source.kind === 'loot', 'unit source'); nonempty(entry.source.receiptId);
        definitionId = takeBirth(`loot:${entry.source.receiptId}`, 'unit', entry.unitId, entry.roundId);
      }
      requireValue(index !== 0 || entry.source.kind === 'opening', 'missing opening');
      units.set(entry.unitId, { id: entry.unitId, definitionId, starLevel: 1 }); nextUnitSerial++;
      acquisition = { sequence: index, unitId: entry.unitId, definitionId, roundId: entry.roundId, survivorId: entry.unitId, star: 1 };
    } else if (entry.kind === 'unit-upgraded') {
      keys(entry, [...common, 'acquisitionSequence', 'event']); integer(entry.acquisitionSequence);
      validateUpgrade(entry.event);
      const event = entry.event;
      requireValue(acquisition && acquisition.sequence === entry.acquisitionSequence && acquisition.sequence > 0
        && acquisition.roundId === entry.roundId && acquisition.definitionId === event.definitionId
        && acquisition.star === event.fromStar && [event.survivorId, ...event.consumedIds].includes(acquisition.survivorId), 'upgrade transaction');
      for (const id of [event.survivorId, ...event.consumedIds]) {
        const unit = units.get(id);
        requireValue(unit && unit.definitionId === event.definitionId && unit.starLevel === event.fromStar, 'upgrade ownership');
      }
      event.consumedIds.forEach(id => units.delete(id));
      units.set(event.survivorId, { id: event.survivorId, definitionId: event.definitionId, starLevel: event.toStar });
      growth = mergeGrowthLedger(growth, [event]); acquisition.survivorId = event.survivorId; acquisition.star = event.toStar;
    } else if (entry.kind === 'unit-sold') {
      keys(entry, [...common, 'unitId', 'context', 'goldGranted']); integer(entry.goldGranted);
      const unit = units.get(entry.unitId);
      requireValue(unit && round.kind !== 'supply' && (entry.context === 'preparation' || entry.context === 'settlement-capacity'), 'sale ownership/context');
      requireValue(entry.context !== 'preparation' || !commits.has(entry.roundId), 'preparation sale after settlement');
      requireValue(entry.context !== 'settlement-capacity' || commits.has(entry.roundId), 'sale before settlement');
      requireValue(entry.goldGranted === getUnitSellPrice({ ...unit, team: 'player', location: { kind: 'bench', slot: 0 } }), 'sale price');
      units.delete(entry.unitId); growth = growth.filter(value => value.unitId !== entry.unitId);
    } else if (entry.kind === 'item-acquired') {
      keys(entry, [...common, 'itemId', 'source']); record(entry.source);
      requireValue(entry.itemId === `item-${nextItemSerial}`, 'item serial'); integer(nextItemSerial + 1, 1);
      const source = entry.source;
      requireValue(source.kind === 'schedule' || source.kind === 'loot', 'item source');
      keys(source, source.kind === 'schedule' ? ['kind', 'eventId'] : ['kind', 'receiptId']);
      nonempty(source.kind === 'schedule' ? source.eventId : source.receiptId);
      const key = source.kind === 'schedule' ? `schedule:${source.eventId}` : `loot:${source.receiptId}`;
      const definitionId = takeBirth(key, 'item', entry.itemId, entry.roundId);
      items.set(entry.itemId, { id: entry.itemId, definitionId }); nextItemSerial++;
    } else if (entry.kind === 'item-combined') {
      keys(entry, [...common, 'event']); keys(entry.event, ['type', 'consumedIds', 'itemId', 'definitionId']);
      requireValue(round.kind !== 'supply' && !commits.has(entry.roundId), 'combination phase');
      const event = entry.event; nonempty(event.definitionId);
      requireValue(event.type === 'itemCombined' && Array.isArray(event.consumedIds) && event.consumedIds.length === 2
        && compareCodePoints(event.consumedIds[0], event.consumedIds[1]) < 0, 'combination inputs');
      const [a, b] = event.consumedIds.map(id => items.get(id));
      const recipe = ITEM_DEFINITIONS[event.definitionId];
      requireValue(a && b && ITEM_DEFINITIONS[a.definitionId]?.kind === 'component' && ITEM_DEFINITIONS[b.definitionId]?.kind === 'component'
        && recipe?.kind === 'completed' && recipe.recipe && (recipe.recipe[0] === a.definitionId && recipe.recipe[1] === b.definitionId
          || recipe.recipe[0] === b.definitionId && recipe.recipe[1] === a.definitionId), 'combination recipe/ownership');
      requireValue(event.itemId === `item-${nextItemSerial}`, 'combined item serial'); integer(nextItemSerial + 1, 1);
      event.consumedIds.forEach(id => items.delete(id)); items.set(event.itemId, { id: event.itemId, definitionId: event.definitionId }); nextItemSerial++;
    } else if (entry.kind === 'combat-growth-committed') {
      keys(entry, [...common, 'combatId', 'settlementId', 'combatStartProvenancePrefixLength', 'sourceDeltas']);
      requireValue(round.kind !== 'supply' && entry.combatId === `round-${round.ordinal}`
        && entry.settlementId === `round-${round.ordinal}-settled` && !commits.has(entry.roundId), 'combat settlement identity/uniqueness');
      integer(entry.combatStartProvenancePrefixLength, 1);
      const start = entry.combatStartProvenancePrefixLength;
      requireValue(start <= index && Array.isArray(entry.sourceDeltas), 'combat start prefix');
      requireValue(start <= (firstLootBirth.get(entry.roundId) ?? index), 'loot before combat start');
      const suffix = entries.slice(start, index);
      requireValue(suffix.every(fact => fact.roundId === entry.roundId && (fact.kind === 'unit-upgraded'
        || (fact.kind === 'unit-acquired' || fact.kind === 'item-acquired') && fact.source.kind === 'loot')), 'combat resource suffix');
      requireValue(start === entries.length || entries[start]?.kind !== 'unit-upgraded', 'combat start transaction boundary');
      const originalUnits = unitPrefixes.get(start)!;
      let previousId = '';
      for (const delta of entry.sourceDeltas) {
        keys(delta, ['sourceUnitId', 'attackDamageBps']); nonempty(delta.sourceUnitId); integer(delta.attackDamageBps, 1);
        requireValue(compareCodePoints(previousId, delta.sourceUnitId) < 0 && delta.attackDamageBps % 125 === 0
          && originalUnits.get(delta.sourceUnitId)?.definitionId === 'tristana', 'combat growth source/step');
        previousId = delta.sourceUnitId;
      }
      const pending = mergeGrowthLedger(entry.sourceDeltas.map(delta => ({ unitId: delta.sourceUnitId, attackDamageBps: delta.attackDamageBps })),
        suffix.filter((fact): fact is Extract<ResourceProvenanceEntry, { kind: 'unit-upgraded' }> => fact.kind === 'unit-upgraded').map(fact => fact.event));
      const next = new Map(growth.map(value => [value.unitId, value.attackDamageBps]));
      for (const delta of pending) {
        requireValue(units.get(delta.unitId)?.definitionId === 'tristana', 'migrated growth owner');
        const total = (next.get(delta.unitId) ?? 0) + delta.attackDamageBps; integer(total, 1); next.set(delta.unitId, total);
      }
      growth = [...next].map(([unitId, attackDamageBps]) => ({ unitId, attackDamageBps })).sort(compareGrowth);
      commits.set(entry.roundId, { roundId: entry.roundId, combatId: entry.combatId, settlementId: entry.settlementId });
    } else requireValue(false, 'fact kind');
    requireValue(index !== 0 || entry.kind === 'unit-acquired' && entry.source.kind === 'opening', 'missing opening');
    if (index + 1 === prefixLength) result = projection();
  }
  finishAcquisition();
  requireValue(usedBirths.size === births.size, 'missing receipt birth');
  {
    requireValue(Array.isArray(context.combatSettlements) && context.combatSettlements.length === commits.size, 'missing combat growth commit');
    const seen = new Set<string>();
    for (const expected of context.combatSettlements) {
      const commit = commits.get(expected.roundId);
      requireValue(!seen.has(expected.roundId) && commit && commit.combatId === expected.combatId
        && commit.settlementId === expected.settlementId, 'combat growth receipt binding');
      seen.add(expected.roundId);
    }
  }
  return freezeContent(result);
}
