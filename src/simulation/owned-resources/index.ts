import { reconcileAnomalyResources, resolveAnomalyBinding } from '../anomaly-ownership';
import { canEquipPortableAnomaly } from '../augment-pool-batch5-r2-anomaly';
import { usableBenchSlots } from '../bench-capacity';
import { canonicalContent } from '../content';
import { ITEM_DEFINITIONS } from '../content/g2-3-item-registry';
import { deploymentCapFor } from '../deployment-cap';
import { deployUnit, getPlayerDeploymentCount } from '../game';
import { readG23Progress } from '../g2-3-state';
import { getMultiplayerRoundById } from '../multiplayer-round';
import { assertSharedPoolConservation, draftPool, sourceKey } from '../shared-pool-ledger';
import { SHOP_CATALOG } from '../match-rules';
import { isDeploymentCell, sameCell } from '../board';
import { UNIT_DEFINITIONS } from '../units';
import { planEquip, returnUnitItems } from '../inventory';
import { getUnitSellPrice } from '../unit-stats';
import { planDeferredUpgrades, transferUpgradeResources } from '../upgrades';
import { mergeGrowthLedger } from '../resource-provenance';
import type { Unit, UnitLocation } from '../unit-types';
import type { HeldResource, OwnershipAuthority, OwnershipBoundary, OwnershipFailure, OwnershipGrant,
  OwnershipOperation, OwnershipResult, OwnershipSeat, OwnershipState, OwnershipTransaction } from './types';
export type * from './types';

class OwnershipError extends Error {
  constructor(readonly reason: OwnershipFailure) { super(reason); }
}
function check(value: unknown, reason: OwnershipFailure = 'invalid-state'): asserts value {
  if (!value) throw new OwnershipError(reason);
}
const integer = (n: number, min = 0) => Number.isSafeInteger(n) && n >= min;
const identity = (s: string) => typeof s === 'string' && s.length > 0;
const same = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
const holdingId = (seatId: string, kind: string, id: string) => sourceKey('ownership', seatId, kind, id);

/** Capture a validated shared boundary; the independent package never alters existing Match commands. */
export function createOwnershipState(boundary: OwnershipBoundary): OwnershipState {
  canonicalContent(boundary);
  assertSharedPoolConservation(boundary.pool, boundary.states);
  check(boundary.states.length === boundary.pool.seats.length);
  const settledOrdinal = boundary.lastSettledRoundId === null ? 0 : getMultiplayerRoundById(boundary.lastSettledRoundId).ordinal;
  const seats: OwnershipSeat[] = boundary.states.map(state => {
    // Carousel ownership already has its own receipt protocol. Do not silently adopt that special case (Q5).
    check(state.phase === 'preparation' && !state.multiplayer?.combatRosterLocked
      && state.multiplayer?.status === 'active' && !(state.carousel?.pendingUnits.length));
    return { seatId: state.sharedPool!.seatId, preparation: state.preparation, items: state.items,
      nextUnitSerial: state.nextUnitSerial, nextItemSerial: state.nextItemSerial,
      duplicators: [], nextDuplicatorSerial: 1, deploymentCap: deploymentCapFor(state.level, readG23Progress(state)),
      gold: state.gold, anomalySelection: state.anomalySelection, anomalyBinding: state.anomalyBinding, persistentGrowth: state.persistentGrowth };
  });
  const state: OwnershipState = structuredClone({ pool: boundary.pool, seats, held: [], settledOrdinal,
    acquiredGrantIds: [], transactions: [] });
  assertOwnershipConservation(state);
  return state;
}

/** Pool available + shops + pending reservations + ALL visible and held base copies == initial supply. */
export function assertOwnershipConservation(state: OwnershipState): void {
  canonicalContent(state);
  assertSharedPoolConservation(state.pool);
  check(integer(state.settledOrdinal));
  check(state.seats.length === state.pool.seats.length && new Set(state.seats.map(s => s.seatId)).size === state.seats.length);
  check(new Set(state.held.map(h => h.id)).size === state.held.length);
  check(new Set(state.acquiredGrantIds).size === state.acquiredGrantIds.length);
  check(new Set(state.transactions.map(t => t.id)).size === state.transactions.length);
  for (const seat of state.seats) {
    check(state.pool.seats.some(s => s.seatId === seat.seatId && !s.released));
    check(integer(seat.nextUnitSerial, 1) && integer(seat.nextItemSerial, 1) && integer(seat.nextDuplicatorSerial, 1)
      && integer(seat.deploymentCap, 1) && integer(seat.gold));
    const held = state.held.filter(h => h.seatId === seat.seatId);
    const units = [...seat.preparation.units.filter(u => u.team === 'player'),
      ...held.flatMap(h => h.kind === 'unit' ? [h.unit] : [])];
    const unitIds = new Set(units.map(u => u.id));
    check(unitIds.size === units.length);
    if (seat.anomalyBinding) {
      check(unitIds.has(seat.anomalyBinding.unitId));
    }
    if (seat.anomalySelection) check(same(resolveAnomalyBinding(seat.anomalySelection,seat.anomalyBinding,units.filter(u=>seat.preparation.units.some(v=>v.id===u.id)||u.id===seat.anomalyBinding?.unitId)),seat.anomalyBinding));
    const holdings = state.pool.holdings.filter(h => h.seatId === seat.seatId);
    const champions = units.filter(u => !UNIT_DEFINITIONS[u.definitionId]?.summon);
    check(champions.length === holdings.length);
    for (const unit of champions) check(holdings.some(h => h.unitId === unit.id && h.definitionId === unit.definitionId
      && h.sources.length === 3 ** (unit.starLevel - 1)));
    const items = [...seat.items, ...held.flatMap(h => h.kind === 'unit' ? h.items : h.kind === 'item' ? [h.item] : [])];
    check(new Set(items.map(i => i.id)).size === items.length);
    for (const item of items) check(Object.hasOwn(ITEM_DEFINITIONS, item.definitionId)
      && (item.location.kind === 'inventory' || unitIds.has(item.location.unitId)));
    const duplicators = [...seat.duplicators, ...held.flatMap(h => h.kind === 'duplicator' ? [h.duplicator] : [])];
    check(new Set(duplicators.map(d => d.id)).size === duplicators.length);
    for (const d of duplicators) check(identity(d.id) && integer(d.maxCost, 1) && d.maxCost <= 5);
    for (const h of held) {
      const assetId = h.kind === 'unit' ? h.unit.id : h.kind === 'item' ? h.item.id : h.duplicator.id;
      check(h.id === holdingId(seat.seatId, h.kind, assetId) && identity(h.source)
        && integer(h.boundRound) && integer(h.returnRound) && h.returnRound >= h.boundRound);
      if (h.kind === 'unit') check(h.unit.team === 'player' && h.items.every(i => i.location.kind === 'unit' && i.location.unitId === h.unit.id));
    }
  }
  check(state.held.every(h => state.seats.some(s => s.seatId === h.seatId)));
}

type Draft = { -readonly [K in keyof OwnershipState]: OwnershipState[K] } & { seats: OwnershipSeat[]; held: HeldResource[]; acquiredGrantIds: string[] };
function seatOf(state: Draft, seatId: string): OwnershipSeat {
  const seat = state.seats.find(s => s.seatId === seatId); check(seat, 'unknown-seat'); return seat;
}
function updateSeat(state: Draft, seat: OwnershipSeat): void {
  state.seats = state.seats.map(s => s.seatId === seat.seatId ? seat : s);
}
/** Explicit mechanism placement: first empty bench, then a free legal player cell within the frozen cap.
 * No merge, upgrade, sale, carousel convention or reward regeneration is hidden here (Q3/Q5). */
function freeLocation(seat: OwnershipSeat): UnitLocation | null {
  if (seat.preparation.overflowUnitIds?.length) return null;
  for (let slot = 0; slot < usableBenchSlots(seat.preparation); slot++) {
    if (!seat.preparation.units.some(u => u.location.kind === 'bench' && u.location.slot === slot)) return { kind: 'bench', slot };
  }
  if (seat.preparation.usableBenchSlots !== undefined) return null;
  if (getPlayerDeploymentCount(seat.preparation) >= seat.deploymentCap) return null;
  const board = seat.preparation.board;
  for (let row = board.deploymentZones.player.firstRow; row <= board.deploymentZones.player.lastRow; row++) {
    for (let col = 0; col < board.columns; col++) {
      const cell = { col, row };
      if (isDeploymentCell(board, 'player', cell)
        && !seat.preparation.units.some(u => u.location.kind === 'board' && sameCell(u.location.cell, cell))) return { kind: 'board', cell };
    }
  }
  return null;
}
function claim(state: Draft, id: string, seatId: string, full: 'hold' | 'reject'): void {
  const h = state.held.find(h => h.id === id && h.seatId === seatId); check(h, 'unknown-holding');
  check(h.returnRound <= state.settledOrdinal, 'not-returnable');
  const seat = seatOf(state, seatId);
  if (h.kind === 'unit') {
    const location = freeLocation(seat);
    if (!location) { check(full === 'hold', 'full-seat'); return; }
    updateSeat(state, { ...seat, preparation: { ...seat.preparation, units: [...seat.preparation.units, { ...h.unit, location }] },
      items: [...seat.items, ...h.items] });
  } else if (h.kind === 'item') updateSeat(state, { ...seat, items: [...seat.items, h.item] });
  else updateSeat(state, { ...seat, duplicators: [...seat.duplicators, h.duplicator] });
  state.held = state.held.filter(other => other !== h);
}
function receiveUnit(state: Draft, seatId: string, definitionId: string, source: string, full: 'hold' | 'reject'): void {
  check(SHOP_CATALOG.includes(definitionId), 'invalid-target');
  const pool = draftPool(state.pool), seat = seatOf(state, seatId);
  check(pool.available[definitionId] > 0, 'pool-empty');
  const id = `unit-${seat.nextUnitSerial}`;
  const location = freeLocation(seat);
  check(location || full === 'hold', 'full-seat');
  const unit: Omit<Unit, 'location'> = { id, definitionId, team: 'player', starLevel: 1 };
  pool.available[definitionId]--;
  pool.holdings.push({ seatId, unitId: id, definitionId, sources: [source] });
  state.pool = pool;
  updateSeat(state, { ...seat, nextUnitSerial: seat.nextUnitSerial + 1,
    preparation: location ? { ...seat.preparation, units: [...seat.preparation.units, { ...unit, location }] } : seat.preparation });
  if (!location) state.held.push({ id: holdingId(seatId, 'unit', id), seatId, source,
    boundRound: state.settledOrdinal, returnRound: state.settledOrdinal, kind: 'unit', unit, originLocation: null, items: [] });
}
function acquire(state: Draft, grant: OwnershipGrant, full: 'hold' | 'reject'): void {
  check(!state.acquiredGrantIds.includes(grant.id), 'already-acquired');
  check(identity(grant.id) && identity(grant.seatId) && grant.resources.length > 0, 'unauthorized-grant');
  for (const [index, resource] of grant.resources.entries()) {
    const source = sourceKey('ownership-grant', grant.id, index);
    if (resource.kind === 'unit') receiveUnit(state, grant.seatId, resource.definitionId, source, full);
    else {
      const seat = seatOf(state, grant.seatId);
      if (resource.kind === 'item') {
        check(Object.hasOwn(ITEM_DEFINITIONS, resource.definitionId), 'invalid-target');
        updateSeat(state, { ...seat, nextItemSerial: seat.nextItemSerial + 1,
          items: [...seat.items, { id: `item-${seat.nextItemSerial}`, definitionId: resource.definitionId, location: { kind: 'inventory' } }] });
      } else {
        check(resource.kind === 'duplicator' && integer(resource.maxCost, 1) && resource.maxCost <= 5, 'invalid-target');
        updateSeat(state, { ...seat, nextDuplicatorSerial: seat.nextDuplicatorSerial + 1,
          duplicators: [...seat.duplicators, { id: `duplicator-${seat.nextDuplicatorSerial}`, maxCost: resource.maxCost }] });
      }
    }
  }
  state.acquiredGrantIds.push(grant.id);
}
function apply(state: Draft, op: OwnershipOperation, authority: OwnershipAuthority, transactionId: string): void {
  if (op.kind === 'acquire') {
    const grant = authority.grants.find(g => g.id === op.grantId); check(grant, 'unauthorized-grant');
    acquire(state, grant, op.full); return;
  }
  if (op.kind === 'settle') {
    let ordinal: number;
    try { ordinal = getMultiplayerRoundById(op.roundId).ordinal; } catch { throw new OwnershipError('invalid-round'); }
    if (ordinal === state.settledOrdinal) return;
    check(ordinal === state.settledOrdinal + 1, 'invalid-round');
    state.settledOrdinal = ordinal;
    // Q3: catalog carousel and overtime ordinals count, full seats keep the same owned instance.
    for (const h of [...state.held]) if (h.kind === 'unit' && h.returnRound <= ordinal) claim(state, h.id, h.seatId, 'hold');
    return;
  }
  check('seatId' in op, 'invalid-transaction');
  const seat = seatOf(state, op.seatId);
  if (op.kind === 'claim') { claim(state, op.holdingId, op.seatId, op.full); return; }
  if (op.kind === 'hold-unit') {
    check(integer(op.rounds, 1) && integer(state.settledOrdinal + op.rounds), 'invalid-round');
    const unit = seat.preparation.units.find(u => u.id === op.unitId && u.team === 'player'); check(unit, 'unknown-unit');
    check(!UNIT_DEFINITIONS[unit.definitionId]?.summon, 'invalid-target');
    const items = seat.items.filter(i => i.location.kind === 'unit' && i.location.unitId === unit.id);
    const { location: originLocation, ...ownedUnit } = unit;
    state.held.push({ id: holdingId(seat.seatId, 'unit', unit.id), seatId: seat.seatId,
      source: transactionId, boundRound: state.settledOrdinal, returnRound: state.settledOrdinal + op.rounds,
      kind: 'unit', unit: ownedUnit, originLocation, items });
    updateSeat(state, { ...seat, preparation: { ...seat.preparation, units: seat.preparation.units.filter(u => u !== unit) },
      items: seat.items.filter(i => !items.includes(i)) });
  } else if (op.kind === 'hold-item') {
    const item = seat.items.find(i => i.id === op.itemId); check(item, 'unknown-item');
    check(item.location.kind === 'inventory', 'not-inventory');
    state.held.push({ id: holdingId(seat.seatId, 'item', item.id), seatId: seat.seatId, source: transactionId,
      boundRound: state.settledOrdinal, returnRound: state.settledOrdinal, kind: 'item', item });
    updateSeat(state, { ...seat, items: seat.items.filter(i => i !== item) });
  } else if (op.kind === 'hold-duplicator') {
    const duplicator = seat.duplicators.find(d => d.id === op.duplicatorId); check(duplicator, 'unknown-duplicator');
    state.held.push({ id: holdingId(seat.seatId, 'duplicator', duplicator.id), seatId: seat.seatId, source: transactionId,
      boundRound: state.settledOrdinal, returnRound: state.settledOrdinal, kind: 'duplicator', duplicator });
    updateSeat(state, { ...seat, duplicators: seat.duplicators.filter(d => d !== duplicator) });
  } else if (op.kind === 'duplicate') {
    const duplicator = seat.duplicators.find(d => d.id === op.duplicatorId); check(duplicator, 'unknown-duplicator');
    const unit = seat.preparation.units.find(u => u.id === op.unitId && u.team === 'player'); check(unit, 'unknown-unit');
    check(UNIT_DEFINITIONS[unit.definitionId].cost <= duplicator.maxCost, 'invalid-target');
    receiveUnit(state, seat.seatId, unit.definitionId, sourceKey('ownership-copy', seat.seatId, duplicator.id), op.full);
    const nextSeat = seatOf(state, seat.seatId);
    updateSeat(state, { ...nextSeat, duplicators: nextSeat.duplicators.filter(d => d.id !== duplicator.id) });
  } else if (op.kind === 'sell') {
    // Existing ordinary sale algebra; held units are deliberately absent from this lookup (Q3).
    const unit = seat.preparation.units.find(u => u.id === op.unitId && u.team === 'player'); check(unit, 'unknown-unit');
    check(!UNIT_DEFINITIONS[unit.definitionId]?.summon, 'invalid-target');
    const pool = draftPool(state.pool), holding = pool.holdings.find(h => h.seatId === seat.seatId && h.unitId === unit.id);
    check(holding);
    pool.available[unit.definitionId] += holding.sources.length;
    pool.holdings = pool.holdings.filter(h => h !== holding); state.pool = pool;
    updateSeat(state, { ...seat, gold: seat.gold + getUnitSellPrice(unit), items: returnUnitItems(seat.items, unit.id).items,
      anomalyBinding: seat.anomalyBinding?.unitId === unit.id ? null : seat.anomalyBinding,
      persistentGrowth: seat.persistentGrowth.filter(g => g.unitId !== unit.id),
      preparation: { ...seat.preparation, units: seat.preparation.units.filter(u => u !== unit) } });
    for (const h of [...state.held]) if (h.seatId === seat.seatId && h.kind === 'unit' && h.returnRound <= state.settledOrdinal) claim(state, h.id, seat.seatId, 'hold');
  } else if (op.kind === 'merge-live') {
    // Q5: explicit caller operation, using the unchanged ordinary triple planner; custody never participates.
    const merged = planDeferredUpgrades(seat.preparation);
    const resources = transferUpgradeResources(seat.items, seat.anomalyBinding, merged.events);
    const pool = draftPool(state.pool);
    for (const event of merged.events) {
      const ids = [event.survivorId, ...event.consumedIds];
      const parts = ids.map(id => pool.holdings.find(h => h.seatId === seat.seatId && h.unitId === id));
      check(parts.every(h => h && h.definitionId === event.definitionId && h.sources.length === 3 ** (event.fromStar - 1)));
      pool.holdings = pool.holdings.filter(h => h.seatId !== seat.seatId || !ids.includes(h.unitId));
      pool.holdings.push({ seatId: seat.seatId, unitId: event.survivorId, definitionId: event.definitionId,
        sources: parts.flatMap(h => h!.sources) });
    }
    state.pool = pool;
    updateSeat(state, { ...seat, preparation: merged.preparation, items: resources.items,
      anomalyBinding: resources.anomalyBinding, persistentGrowth: mergeGrowthLedger(seat.persistentGrowth, merged.events) });
    for (const h of [...state.held]) if (h.seatId === seat.seatId && h.kind === 'unit' && h.returnRound <= state.settledOrdinal) claim(state, h.id, seat.seatId, 'hold');
  } else if (op.kind === 'equip') {
    const item = seat.items.find(i => i.id === op.itemId);
    check(item && canEquipPortableAnomaly(seat, item, op.unitId), 'invalid-target');
    const plan = planEquip(seat.items, seat.preparation, op.itemId, op.unitId, op.slot, seat.nextItemSerial);
    check(plan.ok, 'invalid-target');
    updateSeat(state, { ...seat, items: plan.items, nextItemSerial: plan.nextItemSerial });
  } else if (op.kind === 'deploy') {
    const result = deployUnit(seat.preparation, op.unitId, op.location); check(result.ok, 'invalid-location');
    check(getPlayerDeploymentCount(result.state) <= seat.deploymentCap, 'full-seat');
    updateSeat(state, { ...seat, preparation: result.state });
    for (const h of [...state.held]) if (h.seatId === seat.seatId && h.kind === 'unit' && h.returnRound <= state.settledOrdinal) claim(state, h.id, seat.seatId, 'hold');
  } else check(false, 'invalid-transaction');
}

/** Pure atomic batch. Failed intermediate plans are discarded, including IDs, pool, receipts and events. */
export function transactOwnership(state: OwnershipState, transaction: OwnershipTransaction, authority: OwnershipAuthority): OwnershipResult {
  try {
    assertOwnershipConservation(state);
    canonicalContent(transaction); canonicalContent(authority);
    check(identity(transaction.id) && Array.isArray(transaction.operations) && transaction.operations.length > 0, 'invalid-transaction');
    check(new Set(authority.grants.map(g => g.id)).size === authority.grants.length, 'unauthorized-grant');
    const prior = state.transactions.find(t => t.id === transaction.id);
    if (prior) { check(same(prior, transaction), 'receipt-conflict'); return { ok: true, state, events: [] }; }
    const draft: Draft = structuredClone({ ...state, seats: [...state.seats], held: [...state.held], acquiredGrantIds: [...state.acquiredGrantIds] });
    for (const op of transaction.operations) {
      if (op.kind === 'acquire' || op.kind === 'claim' || op.kind === 'duplicate') {
        check(op.full === 'hold' || op.full === 'reject', 'invalid-transaction');
      }
      apply(draft, op, authority, transaction.id);
      draft.seats = draft.seats.map(seat => {
        const held = draft.held.flatMap(h => h.seatId === seat.seatId && h.kind === 'unit' && h.unit.id === seat.anomalyBinding?.unitId ? [h.unit] : []);
        const resources = reconcileAnomalyResources(seat.anomalySelection, seat.anomalyBinding, [...seat.preparation.units.filter(u=>u.team==='player'), ...held], seat.items);
        return {...seat, anomalyBinding:resources.anomalyBinding, items:resources.items};
      });
    }
    // Every accepted ID is durable, even when only the command receipt changes.
    const resourcesChanged = !same(draft, state);
    draft.transactions = [...draft.transactions, structuredClone(transaction)];
    assertOwnershipConservation(draft);
    return { ok: true, state: draft, events: resourcesChanged ? [{ type: 'ownershipCommitted', transactionId: transaction.id }] : [] };
  } catch (error) {
    return { ok: false, state, reason: error instanceof OwnershipError ? error.reason : 'invalid-state' };
  }
}

/** Restore by replay from an independently verified boundary and grant authority, never candidate receipts. */
export function restoreOwnership(input: unknown, boundary: OwnershipBoundary, authority: OwnershipAuthority,
  verifiedTransactions: readonly OwnershipTransaction[]): OwnershipState {
  const candidate = (typeof input === 'string' ? JSON.parse(input) : input) as OwnershipState;
  canonicalContent(candidate);
  check(Array.isArray(candidate.transactions) && same(candidate.transactions, verifiedTransactions));
  let state = createOwnershipState(boundary);
  for (const transaction of verifiedTransactions) {
    const result = transactOwnership(state, transaction, authority); check(result.ok);
    state = result.state;
  }
  check(same(state, candidate));
  return state;
}
export function serializeOwnership(state: OwnershipState, boundary: OwnershipBoundary, authority: OwnershipAuthority,
  verifiedTransactions: readonly OwnershipTransaction[]): string {
  return canonicalContent(restoreOwnership(state, boundary, authority, verifiedTransactions));
}

/** Read-only manual-tool preview; no ID, receipt, event or resource is allocated. */
export function previewDuplicator(state: OwnershipState, seatId: string, duplicatorId: string,
  unitId: string, full: 'hold' | 'reject'): { readonly ok: true; readonly definitionId: string;
    readonly destination: 'preparation' | 'holding' } | { readonly ok: false; readonly reason: OwnershipFailure } {
  try {
    assertOwnershipConservation(state);
    check(full === 'hold' || full === 'reject', 'invalid-transaction');
    const seat = state.seats.find(s => s.seatId === seatId); check(seat, 'unknown-seat');
    const tool = seat.duplicators.find(d => d.id === duplicatorId); check(tool, 'unknown-duplicator');
    const unit = seat.preparation.units.find(u => u.id === unitId && u.team === 'player'); check(unit, 'unknown-unit');
    check(SHOP_CATALOG.includes(unit.definitionId) && UNIT_DEFINITIONS[unit.definitionId].cost <= tool.maxCost, 'invalid-target');
    check(state.pool.available[unit.definitionId] > 0, 'pool-empty');
    const location = freeLocation(seat); check(location || full === 'hold', 'full-seat');
    return { ok: true, definitionId: unit.definitionId, destination: location ? 'preparation' : 'holding' };
  } catch (error) { return { ok: false, reason: error instanceof OwnershipError ? error.reason : 'invalid-state' }; }
}
