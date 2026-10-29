import { type InventoryPlan } from './augment-pool-batch5-s3a';
import { P3_AUGMENT_ITEMS } from './content/s13-p3';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import { shareGeneratedJson } from './immutable-json';
import { isFrozenContent } from './content/freeze';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { lootReceiptId, lootOrbId, lootEntryId } from './loot-identity';
import { SHOP_CATALOG } from './match-rules';
import type { PersistentGrowth } from './match-types';
import type { LootReceipt } from './m8/contracts';
import { compareCodePoints } from './m8/identity';
import { getMultiplayerRoundById } from './multiplayer-round';
import { getCatalogRoundById, getCatalogRoundByOrdinal } from './round-selectors';
import { getRoundSchedule } from './round-schedule';
import type { ScheduleReceipt, StrategyEvent } from './strategy-types';
import { getUnitSellPrice } from './unit-stats';
import type { StarLevel, UnitUpgradedEvent } from './unit-types';
import { UNIT_DEFINITIONS } from './units';

export const RESOURCE_PROVENANCE_VERSION = 'm8-b8-resource-provenance-v1';
export type UnitAcquisitionSource =
  | {readonly kind:'carousel';readonly receiptId:string}
  | { readonly kind: 'opening'; readonly seed: number; readonly seatId: string }
  | { readonly kind: 'shop'; readonly generation: number; readonly slotIndex: number; readonly definitionId: string; readonly starLevel?: 2 }
  | { readonly kind: 'loot'; readonly receiptId: string }
  /** G2-3 seat-mechanics grant; receiptId names a SeatMechanicsState receipt. */
  | { readonly kind: 'mechanic'; readonly receiptId: string };
export type ItemAcquisitionSource =
  | {readonly kind:'carousel';readonly receiptId:string}
  | { readonly kind: 'schedule'; readonly eventId: string }
  | { readonly kind: 'loot'; readonly receiptId: string }
  | { readonly kind: 'mechanic'; readonly receiptId: string };
export interface CombatGrowthDelta { readonly sourceUnitId: string; readonly attackDamageBps: number }
export type ResourceFact =
  | import('./augment-history-types').AugmentItemTransform
  | { readonly kind: 'unit-transformed'; readonly choiceId: string; readonly unitId: string; readonly from: string; readonly to: string; readonly starLevel: StarLevel }
  | { readonly kind: 'augment-transform-completed'; readonly choiceId: string }
  | {readonly kind:'dual-purpose-selected';readonly choiceId:string;readonly level:number;readonly xp:number}
  | {readonly kind:'dual-purpose-xp-purchased';readonly levelBefore:number;readonly xpBefore:number;readonly generation:number;readonly settled:boolean}
  | {readonly kind:'form-swapper-selected';readonly choiceId:string}
  | {readonly kind:'d14-selected';readonly choiceId:string;readonly unitId:string;readonly heldItems:readonly import('./strategy-types').ItemInstance[]}
  | {readonly kind:'d14-returned';readonly choiceId:string;readonly unitId:string;readonly settledOrdinal:number}
  | {readonly kind:'anger-item-converted';readonly itemId:string;readonly from:string;readonly to:string;readonly receiptId:string}
  | {readonly kind:'g23-item-converted';readonly itemId:string;readonly from:string;readonly to:string;readonly receiptId:string}
  | {readonly kind:'carousel-preparation-settled';readonly receiptIds:readonly string[];readonly claimedUnitIds:readonly string[];readonly upgrades:readonly UnitUpgradedEvent[]}
  | {readonly kind:'carousel-unit-claimed';readonly unitId:string;readonly receiptId:string;readonly upgrades:readonly UnitUpgradedEvent[]}
  | {readonly kind:'consumable-used';readonly tick?:number;readonly record:import('./consumable-types').ConsumableUseRecord}
  | { readonly kind: 'unit-acquired'; readonly unitId: string; readonly source: UnitAcquisitionSource }
  | { readonly kind: 'unit-upgraded'; readonly acquisitionSequence: number; readonly event: UnitUpgradedEvent }
  | { readonly kind: 'unit-upgraded-after-combat'; readonly event: UnitUpgradedEvent }
  | { readonly kind: 'anvil-opened'; readonly unitId:string; readonly choiceId:string }
  /** Batch 3: a training dummy retired by its augment (Support Mining); the grant ledger authenticates receiptId. */
  | { readonly kind: 'unit-removed'; readonly unitId:string; readonly receiptId:string; readonly definitionId?:string; readonly starLevel?:1|2|3 }
  /** Batch 3: one free shop reroll spent at this shop generation; the free-reroll ledger must count exactly these. */
  | { readonly kind: 'free-reroll'; readonly generation:number }
  | { readonly kind: 'unit-sold'; readonly unitId: string; readonly context: 'preparation' | 'settlement-capacity'; readonly goldGranted: number }
  | { readonly kind: 'item-acquired'; readonly itemId: string; readonly source: ItemAcquisitionSource }
  // tick is present exactly for operations issued during combat.
  | { readonly kind: 'item-equipped'; readonly itemId: string; readonly unitId: string; readonly slot: number; readonly tick?: number }
  | { readonly kind: 'item-combined'; readonly event: Extract<StrategyEvent, { readonly type: 'itemCombined' }>; readonly tick?: number }
  | { readonly kind: 'combat-growth-committed'; readonly combatId: string; readonly settlementId: string;
      readonly combatStartProvenancePrefixLength: number; readonly sourceDeltas: readonly CombatGrowthDelta[] };
export type ResourceProvenanceEntry = ResourceFact & { readonly sequence: number; readonly roundId: string };
export interface ResourceProvenance {
  readonly version: typeof RESOURCE_PROVENANCE_VERSION;
  readonly equipmentHistory: 'ordered';
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
  /** P-B5-59: authenticated Pilfer copies arrive at the next natural round, including supply. */
  readonly pilferRewards?: readonly import('./augment-gift-plan').AugmentGift[];
  /** D2: authenticated BRB completed-item anvils may mature on a supply entry. */
  readonly brbRewards?: readonly import('./augment-gift-plan').AugmentGift[];
  readonly batch5Inventory?:InventoryPlan;
  readonly s3bState?: Pick<import('./match-types').MatchState,'augments'|'resourceProvenance'|'seed'>;
  readonly augmentHistory?: import('./augment-history-types').AugmentHistory;
  readonly g23?:import('./g2-3-match-progress').G23MatchProgress;
  readonly g23RadiantRound?:number;
  readonly carouselReceipts?:readonly import('./carousel-types').CarouselReceipt[];
  readonly pendingCarouselUnitIds?:readonly string[];
  readonly carouselOpening?:boolean;
  /** Receipts must already be authenticated against their schedule/frozen loot plan. */
  readonly scheduleReceipts: readonly ScheduleReceipt[];
  readonly lootReceipts: readonly LootReceipt[];
  /** G2-3 seat-mechanics receipts (already structurally validated); absent before G2-3. */
  readonly mechanicReceipts?: readonly import('./seat-mechanics/types').MechanicReceipt[];
  readonly throughRoundOrdinal: number;
  /** Validate the entire stream, then return this prefix's projection (including prefix 0). */
  readonly prefixLength?: number;
  /** Already validated non-supply settlements; every one requires exactly one commit. */
  readonly combatSettlements: readonly ProvenanceCombatSettlement[];
}

export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RangeError(`Invalid resource provenance: ${message}`);
}
export function integer(value: unknown, minimum = 0): asserts value is number {
  requireValue(Number.isSafeInteger(value) && (value as number) >= minimum, 'integer');
}
export function nonempty(value: unknown): asserts value is string {
  requireValue(typeof value === 'string' && value.length > 0, 'identity');
}
export function record(value: unknown): asserts value is Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype, 'plain object');
}
export function keys(value: unknown, names: readonly string[]): asserts value is Record<string, unknown> {
  record(value);
  const actual = Object.keys(value);
  requireValue(actual.length === names.length && actual.every(key => names.includes(key)), 'fields');
}
export function plainJson(value: unknown, ancestors = new Set<object>()): void {
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

export const compareGrowth = (a: PersistentGrowth, b: PersistentGrowth) => compareCodePoints(a.unitId, b.unitId);

/** Append ordered facts atomically; no grants, RNG or independently writable counters. */
export function appendResourceProvenance(
  provenance: Omit<ResourceProvenance, 'equipmentHistory'> & { readonly equipmentHistory?: 'ordered' }, roundId: string, facts: ResourceFact | readonly ResourceFact[],
): ResourceProvenance {
  requireValue(provenance.version === RESOURCE_PROVENANCE_VERSION, 'version');
  requireValue(provenance.equipmentHistory === 'ordered' || provenance.entries.length === 0, 'ordered equipment history required');
  const round = getMultiplayerRoundById(roundId);
  requireValue(!provenance.entries.length || getMultiplayerRoundById(provenance.entries.at(-1)!.roundId).ordinal <= round.ordinal, 'round order');
  const added = Array.isArray(facts) ? facts : [facts];
  plainJson(added);
  return shareGeneratedJson({ version: RESOURCE_PROVENANCE_VERSION, equipmentHistory: 'ordered',
    entries: [...(isFrozenContent(provenance.entries) ? provenance.entries : structuredClone(provenance.entries)), ...added.map((fact, index) => ({
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

export interface BirthReceipt { readonly kind: 'unit' | 'item'; readonly id: string; readonly definitionId: string; readonly roundId: string; readonly starLevel?:StarLevel }
/** Births a mechanic receipt authorizes: a held unit, an item, or the item a forge/black-market choice granted. */
function mechanicBirths(receipts: readonly import('./seat-mechanics/types').MechanicReceipt[]): (BirthReceipt & { readonly key: string })[] {
  return receipts.flatMap((receipt): (BirthReceipt & { readonly key: string })[] => {
    const key = `mechanic:${receipt.receiptId}`;
    if (receipt.kind === 'unit' && receipt.resolution === 'held' && receipt.unitId) {
      requireValue(SHOP_CATALOG.includes(receipt.definitionId) || !!UNIT_DEFINITIONS[receipt.definitionId]?.summon, 'mechanic unit definition');
      return [{ key, kind: 'unit' as const, id: receipt.unitId, definitionId: receipt.definitionId, roundId: receipt.roundId,...(receipt.starLevel?{starLevel:receipt.starLevel}:{}) }];
    }
    const itemId = receipt.kind === 'item' || receipt.kind === 'choice' ? receipt.itemId : null;
    if (!itemId) return [];
    const definitionId = receipt.kind === 'item' ? receipt.definitionId : (receipt as Extract<typeof receipt, { kind: 'choice' }>).optionId;
    requireValue(Object.hasOwn(ITEM_DEFINITIONS, definitionId), 'mechanic item definition');
    return [{ key, kind: 'item' as const, id: itemId, definitionId, roundId: receipt.roundId }];
  });
}
type ReceiptContext = Pick<ResourceProvenanceContext, 'scheduleReceipts' | 'lootReceipts' | 'throughRoundOrdinal' | 'carouselReceipts' | 'mechanicReceipts'>;
let receiptScope: { context: ReceiptContext; births: Map<string, BirthReceipt> }[] | undefined;
/** Only Match's private parsed graph is stable during a synchronous restore.
 * Object inputs, nested object restores and serialization keep every old read.
 * This reuses one within-call receipt projection, never a restored Match or a
 * result from another input/call. Returned maps and records stay detached. */
export function withResourceReceiptReuse<T>(parsedJsonInput: boolean, run: () => T): T {
  const previous = receiptScope;
  receiptScope = parsedJsonInput ? [] : undefined;
  try { return run(); } finally { receiptScope = previous; }
}
const copyBirths = (births: Map<string, BirthReceipt>) => new Map([...births].map(([key, value]) => [key, { ...value }]));
export function validateResourceReceipts(context: ReceiptContext): Map<string, BirthReceipt> {
  const known = receiptScope?.find(entry => entry.context.scheduleReceipts === context.scheduleReceipts
    && entry.context.lootReceipts === context.lootReceipts && entry.context.mechanicReceipts === context.mechanicReceipts
    && entry.context.carouselReceipts === context.carouselReceipts && entry.context.throughRoundOrdinal === context.throughRoundOrdinal);
  if (known) return copyBirths(known.births);
  const births = new Map<string, BirthReceipt>(), receiptIds = new Set<string>(), assetIds = new Set<string>();
  const add = (key: string, birth: BirthReceipt) => {
    requireValue(!births.has(key) && !assetIds.has(birth.id), 'duplicate receipt birth');
    births.set(key, birth); assetIds.add(birth.id);
  };
  for(const receipt of context.carouselReceipts??[]) {
    requireValue(receipt.status==='granted'&&receipt.id===`${receipt.carouselId}:${receipt.seatId}`&&receipt.holdingSource===receipt.id&&receipt.unitId!==null&&receipt.itemInstanceId!==null&&!receiptIds.has(receipt.id),'carousel receipt');receiptIds.add(receipt.id);
    const roundId=receipt.carouselId.slice(receipt.carouselId.lastIndexOf(':')+1),round=getCatalogRoundById(roundId==='1-1'?'1-2':roundId);
    requireValue(round.ordinal<=context.throughRoundOrdinal&&SHOP_CATALOG.includes(receipt.definitionId)&&Object.hasOwn(ITEM_DEFINITIONS,receipt.itemId),'carousel identity');
    add(`carousel-unit:${receipt.id}`,{kind:'unit',id:receipt.unitId,definitionId:receipt.definitionId,roundId:round.roundId});
    add(`carousel-item:${receipt.id}`,{kind:'item',id:receipt.itemInstanceId,definitionId:receipt.itemId,roundId:round.roundId});
  }
  for (const receipt of context.scheduleReceipts) {
    plainJson(receipt);
    keys(receipt, ['eventId', 'round', 'kind', 'itemIds', 'gold', 'unitId', 'definitionId']);
    requireValue(!receiptIds.has(`schedule:${receipt.eventId}`), 'duplicate schedule receipt');
    receiptIds.add(`schedule:${receipt.eventId}`);
    const round = getCatalogRoundByOrdinal(receipt.round);
    requireValue(round.ordinal <= context.throughRoundOrdinal
      && getRoundSchedule(round.ordinal).some(event => event.id === receipt.eventId && event.kind === receipt.kind), 'schedule identity');
    requireValue(Array.isArray(receipt.itemIds), 'schedule items');
    // A schedule choice never grants a unit: actual augment units are mechanic/loot births.
    if (receipt.kind === 'augment') requireValue(receipt.unitId === null, 'augment receipt unit');
    if (receipt.kind === 'component') {
      requireValue(receipt.itemIds.length === 1 && receipt.unitId === null && receipt.gold === 0
        && typeof receipt.definitionId === 'string' && ITEM_DEFINITIONS[receipt.definitionId]?.kind === 'component', 'schedule component');
      nonempty(receipt.itemIds[0]);
      add(`schedule:${receipt.eventId}`, { kind: 'item', id: receipt.itemIds[0], definitionId: receipt.definitionId, roundId: round.roundId });
    } else if (receipt.kind === 'augment' && receipt.definitionId && P3_AUGMENT_ITEMS[receipt.definitionId]) {
      requireValue(receipt.itemIds.length === 1 && receipt.unitId === null && receipt.gold === 0, 'augment item receipt');
      nonempty(receipt.itemIds[0]);
      add(`schedule:${receipt.eventId}`, { kind: 'item', id: receipt.itemIds[0], definitionId: P3_AUGMENT_ITEMS[receipt.definitionId], roundId: round.roundId });
    } else requireValue(receipt.itemIds.length === 0 && receipt.kind !== 'reward', 'unsupported schedule birth');
  }
  for (const receipt of context.lootReceipts) {
    plainJson(receipt);
    keys(receipt, ['receiptId', 'dropId', 'payload', 'grantedItemIds', 'grantedUnitIds',
      ...(receipt.resolution ? ['resolution','gold','claimedRoundId'] : []),
      ...(receipt.payload?.kind==='consumable' && receipt.resolution!=='forfeited'?['grantedConsumableIds']:[])]);
    nonempty(receipt.dropId);
    const tuple: unknown = JSON.parse(receipt.dropId);
    requireValue(Array.isArray(tuple) && tuple.length === 2, 'loot drop identity');
    const orb:unknown=JSON.parse(tuple[0]);
    requireValue(Array.isArray(orb)&&orb.length===5&&orb[0]==='orb','loot orb identity');
    const [,sourceRoundId, encounterId, sourceUnitId, slotOrdinal] = orb;
    const roundId=receipt.claimedRoundId??sourceRoundId;
    integer(tuple[1]);
    nonempty(roundId); nonempty(encounterId); nonempty(sourceUnitId); integer(slotOrdinal);
    const round = getMultiplayerRoundById(roundId), sourceRound=getMultiplayerRoundById(sourceRoundId);
    const mechanic=encounterId==='mechanic' && context.mechanicReceipts?.some(r=>r.kind==='unit'&&r.resolution==='orb'&&r.receiptId===sourceUnitId&&r.orbId===tuple[0]);
    requireValue(round.ordinal <= context.throughRoundOrdinal && round.ordinal>=sourceRound.ordinal
      && (mechanic || sourceRound.encounterId === encounterId)
      && receipt.dropId === lootEntryId(lootOrbId(sourceRoundId, encounterId, sourceUnitId, slotOrdinal),tuple[1])
      && receipt.receiptId === lootReceiptId(receipt.dropId), 'loot receipt identity');
    requireValue(!receiptIds.has(`loot:${receipt.receiptId}`), 'duplicate loot receipt');
    receiptIds.add(`loot:${receipt.receiptId}`);
    requireValue(Array.isArray(receipt.grantedItemIds) && Array.isArray(receipt.grantedUnitIds), 'loot granted IDs');
    record(receipt.payload);
    if(receipt.resolution) {
      integer(receipt.gold); nonempty(receipt.claimedRoundId);
      requireValue(['held','gold','capacity-sold','forfeited'].includes(receipt.resolution),'orb resolution');
      if(receipt.resolution==='forfeited'||receipt.resolution==='gold'||receipt.resolution==='capacity-sold') {
        requireValue(!receipt.grantedItemIds.length&&!receipt.grantedUnitIds.length&&!receipt.grantedConsumableIds?.length,'resolved orb has no birth');
        if(receipt.resolution==='forfeited') requireValue(receipt.gold===0,'forfeited gold');
        else {
          requireValue(receipt.payload.kind==='unit'&&SHOP_CATALOG.includes(receipt.payload.definitionId),'orb gold definition');
          const unit={id:'orb',team:'player' as const,location:{kind:'bench' as const,slot:0},definitionId:receipt.payload.definitionId,starLevel:receipt.payload.starLevel??1};
          requireValue([1,2,3].includes(unit.starLevel)&&receipt.gold===(receipt.resolution==='gold'?UNIT_DEFINITIONS[unit.definitionId].cost:getUnitSellPrice(unit)),'orb gold price');
        }
        continue;
      }
      requireValue(receipt.gold===(receipt.payload.kind==='gold'?receipt.payload.quantity:0),'held orb gold');
    }
    if(receipt.payload.kind==='forge') {
      keys(receipt.payload,['kind','definitionId','quantity']);
      requireValue(Object.hasOwn(G24_FORGE_POOLS,receipt.payload.definitionId)&&receipt.payload.quantity===1&&!receipt.grantedItemIds.length&&receipt.grantedUnitIds.length===1,'forge grant');
      add(`loot:${receipt.receiptId}`,{kind:'unit',id:receipt.grantedUnitIds[0],definitionId:receipt.payload.definitionId,roundId});continue;
    }
    if(receipt.payload.kind==='consumable') {
      requireValue(receipt.payload.quantity===1&&receipt.grantedConsumableIds?.length===1&&!receipt.grantedItemIds.length&&!receipt.grantedUnitIds.length,'consumable birth');
      continue;
    }
    if (receipt.payload.kind === 'gold') {
      keys(receipt.payload, ['kind', 'quantity']); integer(receipt.payload.quantity, 1);
      requireValue(!receipt.grantedItemIds.length && !receipt.grantedUnitIds.length, 'gold birth');
      continue;
    }
    keys(receipt.payload, ['kind', 'definitionId', 'quantity',...(receipt.payload.kind==='unit'&&receipt.payload.starLevel?['starLevel']:[])]);
    const { kind, definitionId, quantity } = receipt.payload; nonempty(definitionId);
    requireValue((kind === 'unit' || kind === 'item') && quantity === 1, 'loot resource quantity');
    requireValue(kind === 'unit' ? SHOP_CATALOG.includes(definitionId)
      : !!ITEM_DEFINITIONS[definitionId], 'loot resource definition');
    const granted = kind === 'unit' ? receipt.grantedUnitIds : receipt.grantedItemIds;
    requireValue(granted.length === 1 && (kind === 'unit' ? receipt.grantedItemIds : receipt.grantedUnitIds).length === 0, 'loot resource identity');
    nonempty(granted[0]);
    if(kind==='unit') requireValue([1,2,3].includes(receipt.payload.starLevel??1),'unit birth star');
    add(`loot:${receipt.receiptId}`, { kind, id: granted[0], definitionId, roundId,
      ...(receipt.payload.kind==='unit'?{starLevel:receipt.payload.starLevel??1}:{}) });
  }
  for (const birth of mechanicBirths(context.mechanicReceipts ?? [])) {
    requireValue(getMultiplayerRoundById(birth.roundId).ordinal <= context.throughRoundOrdinal, 'mechanic receipt round');
    add(birth.key, birth);
  }
  receiptScope?.push({ context: { ...context }, births: copyBirths(births) });
  return births;
}


