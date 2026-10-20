import { P3_AUGMENT_ITEMS } from './content/s13-p3';
import {g23RadiantDefinitionId,g23RewardAtoms} from './g2-3-rewards';
import { selectOpeningUnit } from './opening-unit';
import { shareGeneratedJson } from './immutable-json';
import { DEFAULT_BOARD, isDeploymentCell } from './board';
import { freezeContent, isFrozenContent } from './content/freeze';
import { ITEM_DEFINITIONS } from './content/g2-3-item-registry';
import { lootReceiptId, lootOrbId, lootEntryId } from './loot-identity';
import { MATCH_RULES, OPENING_INITIAL_STATE, SHOP_CATALOG } from './match-rules';
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
import { MAX_COMBAT_TICKS } from './combat-types';

export const RESOURCE_PROVENANCE_VERSION = 'm8-b8-resource-provenance-v1';
export type UnitAcquisitionSource =
  | {readonly kind:'carousel';readonly receiptId:string}
  | { readonly kind: 'opening'; readonly seed: number; readonly seatId: string }
  | { readonly kind: 'shop'; readonly generation: number; readonly slotIndex: number; readonly definitionId: string }
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
  | {readonly kind:'g23-item-converted';readonly itemId:string;readonly from:string;readonly to:string;readonly receiptId:string}
  | {readonly kind:'carousel-preparation-settled';readonly receiptIds:readonly string[];readonly claimedUnitIds:readonly string[];readonly upgrades:readonly UnitUpgradedEvent[]}
  | {readonly kind:'carousel-unit-claimed';readonly unitId:string;readonly receiptId:string;readonly upgrades:readonly UnitUpgradedEvent[]}
  | {readonly kind:'consumable-used';readonly tick?:number;readonly record:import('./consumable-types').ConsumableUseRecord}
  | { readonly kind: 'unit-acquired'; readonly unitId: string; readonly source: UnitAcquisitionSource }
  | { readonly kind: 'unit-upgraded'; readonly acquisitionSequence: number; readonly event: UnitUpgradedEvent }
  | { readonly kind: 'unit-upgraded-after-combat'; readonly event: UnitUpgradedEvent }
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

interface BirthReceipt { readonly kind: 'unit' | 'item'; readonly id: string; readonly definitionId: string; readonly roundId: string; readonly starLevel?:StarLevel }
/** Births a mechanic receipt authorizes: a held unit, an item, or the item a forge/black-market choice granted. */
function mechanicBirths(receipts: readonly import('./seat-mechanics/types').MechanicReceipt[]): (BirthReceipt & { readonly key: string })[] {
  return receipts.flatMap((receipt): (BirthReceipt & { readonly key: string })[] => {
    const key = `mechanic:${receipt.receiptId}`;
    if (receipt.kind === 'unit' && receipt.resolution === 'held' && receipt.unitId) {
      requireValue(SHOP_CATALOG.includes(receipt.definitionId) || !!UNIT_DEFINITIONS[receipt.definitionId]?.summon, 'mechanic unit definition');
      return [{ key, kind: 'unit' as const, id: receipt.unitId, definitionId: receipt.definitionId, roundId: receipt.roundId }];
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
    requireValue(getCatalogRoundById(birth.roundId).ordinal <= context.throughRoundOrdinal, 'mechanic receipt round');
    add(birth.key, birth);
  }
  receiptScope?.push({ context: { ...context }, births: copyBirths(births) });
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
export function foldResourceProvenance(value: unknown, context: ResourceProvenanceContext, parsedJsonInput = false): FoldedResourceProvenance {
  getCatalogRoundByOrdinal(context.throughRoundOrdinal);
  if (!parsedJsonInput) plainJson(value);
  record(value);
  requireValue(Object.hasOwn(value, 'equipmentHistory'), 'ordered equipment history required');
  keys(value, ['version', 'equipmentHistory', 'entries']);
  requireValue(value.equipmentHistory === 'ordered', 'ordered equipment history required');
  requireValue(value.version === RESOURCE_PROVENANCE_VERSION && Array.isArray(value.entries) && (value.entries.length > 0 || context.carouselOpening===true), 'version/opening');
  const entries = value.entries as ResourceProvenanceEntry[];
  const prefixLength = context.prefixLength ?? entries.length;
  integer(prefixLength); requireValue(prefixLength <= entries.length, 'prefix bounds');
  const births = validateResourceReceipts(context), usedBirths = new Set<string>();
  const rewardAtoms = new Map(context.g23?.rewards.flatMap(bundle => g23RewardAtoms(bundle,context.g23!.seed).map(atom => [atom.id,atom] as const)));
  const duplicatorClaims = new Map(context.g23?.rewardClaims.flatMap(claim => {
    const atom = rewardAtoms.get(claim.atomId);
    return atom?.kind === 'duplicator' ? [[claim.id,atom] as const] : [];
  }));
  // Progress has been replayed from economy actions and linked to round results.
  // Derive reward availability from that authority, never from the saved ordering.
  const rewardBoundaries = new Map(context.g23?.rewardClaims.map(claim => {
    const bundle = context.g23!.rewards.find(bundle => bundle.id === claim.bundleId)!;
    const battle = context.g23!.economyReceipts.find(receipt => receipt.kind === 'battle'
      && (bundle.source === 'conqueror' ? receipt.bundles.includes(bundle.id)
        : bundle.id === `g23:market:${receipt.facts.battleId}:${bundle.tier}`));
    requireValue(battle?.kind === 'battle', 'mechanic reward battle');
    const roundId = getCatalogRoundByOrdinal(battle.facts.round).roundId;
    const settlement = context.combatSettlements.find(value => value.roundId === roundId);
    requireValue(settlement && claim.round >= bundle.round && bundle.round >= battle.facts.round,
      'mechanic reward settlement');
    const commitIndex = entries.findIndex(entry => entry.kind === 'combat-growth-committed'
      && entry.roundId === roundId && entry.combatId === settlement.combatId
      && entry.settlementId === settlement.settlementId);
    requireValue(commitIndex >= 0, 'mechanic reward settlement');
    return [claim.id, {claimRound:claim.round, commitIndex}] as const;
  }));
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
  const deferredCarouselIds = new Set<string>(), preparationReceipts = new Set<string>(), claimedCarouselIds = new Set<string>();
  const finishAcquisition = () => {
    if (!acquisition) return;
    for (const star of [1, 2]) requireValue([...units.values()].filter(unit => unit.definitionId === acquisition!.definitionId && unit.starLevel === star && !deferredCarouselIds.has(unit.id) && !context.pendingCarouselUnitIds?.includes(unit.id)).length < 3, 'missing upgrade');
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
    const lootSourceId=(entry.kind==='unit-acquired'||entry.kind==='item-acquired')&&entry.source?.kind==='loot'?entry.source.receiptId:null;
    const explicitOrbReceipt=lootSourceId?context.lootReceipts.find(r=>r.receiptId===lootSourceId&&r.claimedRoundId===entry.roundId):undefined;
    if ((entry.kind === 'unit-acquired' || entry.kind === 'item-acquired') && entry.source?.kind === 'loot'
      && !explicitOrbReceipt
      && !firstLootBirth.has(entry.roundId)) firstLootBirth.set(entry.roundId, index);
    if ((entry.kind === 'unit-acquired' || entry.kind === 'item-acquired') && entry.source?.kind === 'mechanic') {
      const boundary = rewardBoundaries.get(entry.source.receiptId);
      if (boundary) {
        const commit = entries[boundary.commitIndex] as Extract<ResourceProvenanceEntry, {kind:'combat-growth-committed'}>;
        requireValue(round.ordinal === boundary.claimRound && index > boundary.commitIndex,
          'mechanic reward settlement order');
        requireValue(commit.combatStartProvenancePrefixLength <= boundary.commitIndex
          && commit.combatStartProvenancePrefixLength < index, 'mechanic reward combat prefix');
      }
    }
    if (entry.kind === 'unit-acquired') {
      keys(entry, [...common, 'unitId', 'source']); record(entry.source);
      requireValue(round.kind !== 'supply'||entry.source.kind==='carousel'||entry.source.kind==='loot'
        &&explicitOrbReceipt?.resolution==='held', 'unit birth in supply');
      requireValue(entry.unitId === `unit-${nextUnitSerial}`, 'unit serial'); integer(nextUnitSerial + 1, 1);
      let definitionId: string;
      if (entry.source.kind === 'opening') {
        keys(entry.source, ['kind','seed','seatId']);
        requireValue(index === 0 && entry.unitId === OPENING_INITIAL_STATE.unit.id && round.ordinal === 1, 'opening');
        definitionId = selectOpeningUnit(entry.source.seed as number, entry.source.seatId as string);
      } else if(entry.source.kind==='carousel') {
        keys(entry.source,['kind','receiptId']);definitionId=takeBirth(`carousel-unit:${entry.source.receiptId}`,'unit',entry.unitId,entry.roundId);
      } else if (entry.source.kind === 'shop') {
        keys(entry.source, ['kind', 'generation', 'slotIndex', 'definitionId']);
        requireValue(!commits.has(entry.roundId), 'shop after settlement');
        integer(entry.source.generation, 1); integer(entry.source.slotIndex);
        requireValue(entry.source.slotIndex < MATCH_RULES.shopSize && entry.source.generation >= lastShopGeneration
          && SHOP_CATALOG.includes(entry.source.definitionId), 'shop source');
        const key = `${entry.source.generation}:${entry.source.slotIndex}`;
        requireValue(!shopSlots.has(key), 'duplicate shop purchase'); shopSlots.add(key); lastShopGeneration = entry.source.generation;
        definitionId = entry.source.definitionId;
      } else if (entry.source.kind === 'mechanic') {
        keys(entry.source, ['kind', 'receiptId']); nonempty(entry.source.receiptId);
        definitionId = takeBirth(`mechanic:${entry.source.receiptId}`, 'unit', entry.unitId, entry.roundId);
        const atom = duplicatorClaims.get(entry.source.receiptId);
        if (atom) {
          const owned = new Set([...units.values()].filter(unit => !deferredCarouselIds.has(unit.id)
            && !context.pendingCarouselUnitIds?.includes(unit.id)).map(unit => unit.definitionId));
          // Settlement births can only be automatic: the public claim command is
          // preparation-only. Replay its ordered selection before adding this birth,
          // even when the saved match has already advanced and combat is null.
          if (commits.has(entry.roundId)) requireValue(atom.options.find(id => owned.has(id)) === definitionId, 'mechanic duplicator target');
          else if (atom.duplicatorDefinitionId === 'TFT13_Crime_Consumable_LesserShimmerDuplicator')
            requireValue(owned.has(definitionId), 'mechanic duplicator target');
        }
      } else {
        keys(entry.source, ['kind', 'receiptId']);
        requireValue(entry.source.kind === 'loot', 'unit source'); nonempty(entry.source.receiptId);
        definitionId = takeBirth(`${entry.source.kind}:${entry.source.receiptId}`, 'unit', entry.unitId, entry.roundId);
      }
      requireValue(index !== 0 || (entry.source.kind === 'opening'||entry.source.kind==='carousel'&&context.carouselOpening===true), 'missing opening');
      const starLevel=entry.source.kind==='loot'?births.get(`loot:${entry.source.receiptId}`)?.starLevel??1:1;
      units.set(entry.unitId, { id: entry.unitId, definitionId, starLevel }); nextUnitSerial++;
      if(entry.source.kind==='carousel')deferredCarouselIds.add(entry.unitId);
      acquisition = { sequence: index, unitId: entry.unitId, definitionId, roundId: entry.roundId, survivorId: entry.unitId, star: starLevel };
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
    } else if(entry.kind==='carousel-preparation-settled') {
      keys(entry,[...common,'receiptIds','claimedUnitIds','upgrades']);
      requireValue(Array.isArray(entry.receiptIds)&&Array.isArray(entry.claimedUnitIds)&&Array.isArray(entry.upgrades),'carousel preparation');
      const eligible = (id:string) => { const r=context.carouselReceipts?.find(r=>r.id===id);requireValue(r && getCatalogRoundById(r.carouselId.split(':').at(-1)!).ordinal<round.ordinal,'carousel preparation boundary');return r!; };
      for(const id of entry.receiptIds){const r=eligible(id);requireValue(!preparationReceipts.has(id),'duplicate carousel preparation');preparationReceipts.add(id);if(r.unitId)deferredCarouselIds.delete(r.unitId);}
      for(const id of entry.claimedUnitIds){const r=context.carouselReceipts?.find(r=>r.unitId===id);requireValue(r&&units.has(id)&&!claimedCarouselIds.has(id),'carousel claim ownership');eligible(r!.id);claimedCarouselIds.add(id);deferredCarouselIds.delete(id);}
      for(const event of entry.upgrades as readonly UnitUpgradedEvent[]){validateUpgrade(event);for(const id of [event.survivorId,...event.consumedIds]){const u=units.get(id);requireValue(u&&u.definitionId===event.definitionId&&u.starLevel===event.fromStar,'carousel upgrade ownership');}event.consumedIds.forEach(id=>units.delete(id));units.set(event.survivorId,{id:event.survivorId,definitionId:event.definitionId,starLevel:event.toStar});growth=mergeGrowthLedger(growth,[event]);}
    } else if(entry.kind==='carousel-unit-claimed') {
      keys(entry,[...common,'unitId','receiptId','upgrades']);
      const receipt=context.carouselReceipts?.find(r=>r.id===entry.receiptId);
      requireValue(receipt?.unitId===entry.unitId&&units.has(entry.unitId)&&Array.isArray(entry.upgrades),'pending carousel ownership');
      for(const event of entry.upgrades as readonly UnitUpgradedEvent[]){validateUpgrade(event);for(const id of [event.survivorId,...event.consumedIds]){const u=units.get(id);requireValue(u&&u.definitionId===event.definitionId&&u.starLevel===event.fromStar,'pending upgrade ownership');}event.consumedIds.forEach(id=>units.delete(id));units.set(event.survivorId,{id:event.survivorId,definitionId:event.definitionId,starLevel:event.toStar});growth=mergeGrowthLedger(growth,[event]);}
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
      requireValue(source.kind === 'schedule' || source.kind === 'loot'||source.kind==='carousel'||source.kind==='mechanic', 'item source');
      keys(source, source.kind === 'schedule' ? ['kind', 'eventId'] : ['kind', 'receiptId']);
      nonempty(source.kind === 'schedule' ? source.eventId : source.receiptId);
      const key = source.kind === 'schedule' ? `schedule:${source.eventId}` : source.kind==='carousel'?`carousel-item:${source.receiptId}`:source.kind==='mechanic'?`mechanic:${source.receiptId}`:`loot:${source.receiptId}`;
      const definitionId = takeBirth(key, 'item', entry.itemId, entry.roundId);
      items.set(entry.itemId, { id: entry.itemId, definitionId }); nextItemSerial++;
    } else if(entry.kind==='g23-item-converted'){
      keys(entry,[...common,'itemId','from','to','receiptId']);requireValue(context.g23RadiantRound!==undefined&&getCatalogRoundById(entry.roundId).ordinal>=context.g23RadiantRound&&entry.receiptId==='g23:conqueror:15'&&items.get(entry.itemId)?.definitionId===entry.from&&g23RadiantDefinitionId(entry.from)===entry.to,'radiant conversion');items.set(entry.itemId,{id:entry.itemId,definitionId:entry.to});
    } else if (entry.kind === 'item-equipped') {
      keys(entry, [...common, 'itemId', 'unitId', 'slot', ...(Object.hasOwn(entry, 'tick') ? ['tick'] : [])]); integer(entry.slot);
      if (Object.hasOwn(entry, 'tick')) { integer(entry.tick); requireValue(entry.tick! < MAX_COMBAT_TICKS, 'equipment tick'); }
      requireValue(items.has(entry.itemId) && units.has(entry.unitId) && entry.slot < 3, 'equipment ownership/slot');
    } else if (entry.kind === 'item-combined') {
      keys(entry, [...common, 'event', ...(Object.hasOwn(entry, 'tick') ? ['tick'] : [])]); keys(entry.event, ['type', 'consumedIds', 'itemId', 'definitionId']);
      if (Object.hasOwn(entry, 'tick')) { integer(entry.tick); requireValue(entry.tick! < MAX_COMBAT_TICKS, 'equipment tick'); }
      // T12 permits combinations before/after settlement and during supply choices.
      // Input ownership, recipe, consumption and serial checks remain mandatory below.
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
    } else if(entry.kind==='consumable-used') {
      keys(entry,[...common,'record',...(Object.hasOwn(entry,'tick') ? ['tick'] : [])]);
      if (Object.hasOwn(entry,'tick')) { integer(entry.tick); requireValue(entry.tick! < MAX_COMBAT_TICKS, 'consumable tick'); }
      const r=entry.record;
      keys(r,['consumableId','definitionId','target','effect','affectedItems','output','rngBefore','rngAfter']);
      requireValue(Array.isArray(r.affectedItems)&&r.affectedItems.length>0,'consumable affected items');
      for(const rawItem of r.affectedItems) {
        keys(rawItem, ['id','definitionId','location']);
        const item = rawItem as unknown as import('./strategy-types').ItemInstance;
        keys(item.location, item.location.kind === 'inventory' ? ['kind'] : ['kind','unitId','slot']);
        requireValue(items.get(item.id)?.definitionId===item.definitionId,'consumable ownership');
        if (item.location.kind !== 'inventory') {
          requireValue(item.location.kind === 'unit' && units.has(item.location.unitId), 'consumable holder');
          integer(item.location.slot); requireValue(item.location.slot < 3, 'consumable slot');
        }
      }
      keys(r.target, r.target.kind === 'unit' ? ['kind','unitId'] : ['kind','itemId']);
      keys(r.rngBefore, ['state','draws']); keys(r.rngAfter, ['state','draws']);
      if (r.output) keys(r.output, ['id','definitionId']);
      if(r.effect==='remove-all')requireValue(r.target.kind==='unit'&&units.has(r.target.unitId)&&r.output===null,'remover target');
      else {
        requireValue(r.target.kind==='item'&&r.affectedItems.length===1&&r.affectedItems[0].id===r.target.itemId
          &&r.output?.id===`item-${nextItemSerial}`&&!!ITEM_DEFINITIONS[r.output.definitionId],'reforge serial');
        items.delete(r.target.itemId);items.set(r.output.id,{...r.output});nextItemSerial++;
      }
    } else if (entry.kind === 'combat-growth-committed') {
      keys(entry, [...common, 'combatId', 'settlementId', 'combatStartProvenancePrefixLength', 'sourceDeltas']);
      requireValue(round.kind !== 'supply' && entry.combatId === `round-${round.ordinal}`
        && entry.settlementId === `round-${round.ordinal}-settled` && !commits.has(entry.roundId), 'combat settlement identity/uniqueness');
      integer(entry.combatStartProvenancePrefixLength, 1);
      const start = entry.combatStartProvenancePrefixLength;
      requireValue(start <= index && Array.isArray(entry.sourceDeltas), 'combat start prefix');
      requireValue(start <= (firstLootBirth.get(entry.roundId) ?? index), 'loot before combat start');
      const suffix = entries.slice(start, index);
      requireValue(suffix.every(fact => fact.roundId === entry.roundId && (fact.kind==='g23-item-converted'||fact.kind === 'item-equipped' || fact.kind === 'item-combined' || fact.kind === 'consumable-used' || fact.kind === 'unit-upgraded'
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
    requireValue(index !== 0 || entry.kind === 'unit-acquired' && (entry.source.kind === 'opening'||entry.source.kind==='carousel'&&context.carouselOpening===true), 'missing opening');
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
