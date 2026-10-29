import { validateHistoricalEquipment } from './b8-restore';
import { validatePortableAnomaly } from './restore-checks/portable-anomaly-check';
import { maximumPlayerHp, titanicTitanChoiceId, h7CarouselRelease, h7CarouselParticipantValid } from './augment-pool-batch5-h7-health';
import { brbShopDisabled } from './augment-brb';
import { applyAngerIssues } from './augment-pool-batch5-r2';
import { validateMadChemistOnlineSave } from './augment-pool-batch5-r4-restore';
import { augmentNeedsHistory } from './augment-history-owners';
import { validateAugmentHistory } from './augment-history-restore';
import { validateOnlineBatch1GiftAuthority } from './restore-checks/batch1-gifts-check';
import { validateTombRaider } from './restore-checks/tomb-raider-check';
import { appendAugmentFact, historyRoster, type AugmentHistoryAuthority } from './augment-history';
import { drainBatch5Inventory } from './augment-pool-batch5-s3a';
import { drainBatch1Gifts } from './augment-pool-grants';
import { mechanicGrantEvents } from './g2-3-runtime';
import { placeCarouselUnit, resolveCarouselPreparation } from './carousel-units';
import { canonicalContent, CONTENT_DIGEST } from './content';
import { COMPONENT_IDS, ITEM_DEFINITIONS } from './content/items';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import { nextRandom, validateSeed } from './rng';
import { getCatalogRoundById } from './round-selectors';
import { assertSharedPoolConservation } from './shared-pool-ledger';
import type { SharedPoolState } from './shared-pool-types';
import type { MatchState } from './match-types';
import type { CostTier, UnitUpgradedEvent } from './unit-types';
import type { CarouselRoundId, CarouselRng, CarouselParticipant, CarouselSlot, CarouselReceipt, CarouselState, CarouselFailure, CarouselEvent, CarouselResult } from './carousel-types';
import { CAROUSEL_RULES, CAROUSEL_COST_ODDS, CAROUSEL_COST_POLICY, carouselCostCounts } from './carousel-policy';
import { UNIT_DEFINITIONS } from './units';
import { releaseSeatOnElimination } from './shared-pool';
import { appendResourceProvenance } from './resource-provenance';
import { createCarouselMatch, finishCarouselSupply } from './match';
import type { MatchEvent } from './match-types';
import { draftPool, returnHolding, reconcileHoldings } from './shared-pool-ledger';
import { carouselPriorityChoice, tableScrapsPick } from './augment-pool-batch5-h5';
import type { SharedPoolResult, SharedPoolEvent } from './shared-pool-types';
export type * from './carousel-types';
export { CAROUSEL_RULES, CAROUSEL_COST_ODDS, CAROUSEL_COST_POLICY };
const rounds: readonly CarouselRoundId[] = ['2-4', '3-4', '4-4', '5-4', '6-4'];
const completed = Object.keys(ITEM_DEFINITIONS).filter(id => ITEM_DEFINITIONS[id].kind === 'completed').sort();
const integer = (n: number, min = 0) => Number.isSafeInteger(n) && n >= min;
const validRound = (r: string): r is CarouselRoundId => rounds.includes(r as CarouselRoundId);
const equal = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
export function schedule(roundId: string): {
    firstBatchMs: number;
    batchIntervalMs: number;
    tailMs: number;
} {
    if (!validRound(roundId))
        throw new RangeError('invalid-round');
    return { firstBatchMs: CAROUSEL_RULES.firstBatchMs, batchIntervalMs: CAROUSEL_RULES.batchIntervalMs, tailMs: CAROUSEL_RULES.tailMs };
}
function carouselRelease(participants: readonly CarouselParticipant[], first: number, interval: number) {
    const release = h7CarouselRelease(participants, first, interval);
    const releaseAtMs = { ...release.releaseAtMs };
    for (const p of participants) if (p.priorityChoiceId) releaseAtMs[p.seatId] = 0;
    const order = [...participants].sort((a, b) => a.hp - b.hp || a.seatIndex - b.seatIndex);
    const releaseOrder = (order.some(p => p.titanicTitanChoiceId)
        ? [...order].sort((a, b) => releaseAtMs[a.seatId] - releaseAtMs[b.seatId] || order.indexOf(a) - order.indexOf(b))
        : order).map(p => p.seatId);
    return { releaseAtMs, releaseOrder };
}
export function opensCarousel(state: MatchState): boolean {
    return !!state.carousel && validRound(state.roundDefinitionId) && !state.carousel.receipts.some(r => r.carouselId.endsWith(`:carousel:${state.roundDefinitionId}`));
}
export function prepareCarouselParticipants(pool: SharedPoolState, states: readonly {
    seatId: string;
    state: MatchState;
}[]): {
    ok: true;
    pool: SharedPoolState;
} | {
    ok: false;
    pool: SharedPoolState;
    reason: 'invalid-pool' | 'invalid-participants';
} {
    try {
        assertSharedPoolConservation(pool);
    }
    catch {
        return { ok: false, pool, reason: 'invalid-pool' };
    }
    const active = pool.seats.filter(s => !s.released);
    if (!Array.isArray(states) || pool.seats.length !== pool.seatCount || !active.length || states.length !== active.length || new Set(states.map(s => s.seatId)).size !== states.length)
        return { ok: false, pool, reason: 'invalid-participants' };
    const participants: CarouselParticipant[] = [];
    for (const entry of states) {
        const seat = active.find(s => s.seatId === entry.seatId), s = entry.state;
        if (!s || !seat || !integer(s.playerHp, 1) || s.playerHp > maximumPlayerHp(s.augments) || s.sharedPool?.poolId !== pool.poolId || s.sharedPool.seatId !== entry.seatId || s.sharedPool.revision !== seat.revision || s.multiplayer?.status !== 'active' || s.multiplayer.seatId !== entry.seatId)
            return { ok: false, pool, reason: 'invalid-participants' };
        let priorityChoiceId: string | null, choiceId: string | undefined;
        try { priorityChoiceId = carouselPriorityChoice(s); choiceId = titanicTitanChoiceId(s); }
        catch { return { ok: false, pool, reason: 'invalid-participants' }; }
        participants.push({ seatId: seat.seatId, seatIndex: seat.seatIndex, hp: s.playerHp, ...(priorityChoiceId ? {priorityChoiceId} : {}), ...(choiceId ? {titanicTitanChoiceId:choiceId} : {}) });
    }
    participants.sort((a, b) => a.hp - b.hp || a.seatIndex - b.seatIndex);
    return { ok: true, pool: { ...pool, carouselParticipants: participants } };
}
function drawSlots(initial: Readonly<Record<string, number>>, roundId: CarouselRoundId, rngState: number, id: string) {
    const available = { ...initial }, slots: CarouselSlot[] = [];
    let wordState = rngState;
    const words = Array.from({ length: CAROUSEL_COST_POLICY.rng.words }, () => {
        const n = nextRandom(wordState); wordState = n.state; return n.word;
    });
    const counts = [...carouselCostCounts(Number(roundId.split('-')[0]), words[CAROUSEL_COST_POLICY.rng.groupWordIndex])];
    for (let slot = 0; slot < 9; slot++) {
        let roll = Math.floor(words[slot * 3] * (9 - slot) / 4294967296), tier = 1;
        for (let i = 0; i < counts.length; i++) {
            tier = i + 1;
            if (roll < counts[i])
                break;
            roll -= counts[i];
        }
        counts[tier - 1]--;
        const stocked = ([1, 2, 3, 4, 5, 6] as CostTier[]).filter(t => SHOP_CATALOG_BY_COST[t].some(d => available[d] > 0)).sort((a, b) => Math.abs(a - tier) - Math.abs(b - tier) || a - b), catalog = [...SHOP_CATALOG_BY_COST[stocked[0]]].sort();
        let member = Math.floor(words[slot * 3 + 1] * catalog.reduce((sum, d) => sum + available[d], 0) / 4294967296);
        const definitionId = catalog.find(d => { if (member < available[d])
            return true; member -= available[d]; return false; })!;
        available[definitionId]--;
        const items = roundId === '5-4' || roundId === '6-4' ? completed : COMPONENT_IDS, itemId = items[Math.floor(words[slot * 3 + 2] * items.length / 4294967296)];
        slots.push({ slot, definitionId, itemId, reservationId: `${id}:slot:${slot}`, pickedBy: null });
    }
    return { available, slots, wordState };
}
export function createCarousel(pool: SharedPoolState, roundId: CarouselRoundId, rng: CarouselRng): {
    ok: true;
    state: CarouselState;
    events: readonly CarouselEvent[];
} | {
    ok: false;
    pool: SharedPoolState;
    rng: CarouselRng;
    reason: CarouselFailure;
    events: readonly [
    ];
} {
    const fail = (reason: CarouselFailure) => ({ ok: false as const, pool, rng, reason, events: [] as const });
    try {
        assertSharedPoolConservation(pool);
    }
    catch {
        return fail('invalid-pool');
    }
    if (!validRound(roundId))
        return fail('invalid-round');
    try {
        if (rng.algorithm !== 'lcg32-v1')
            return fail('invalid-rng');
        validateSeed(rng.state);
    }
    catch {
        return fail('invalid-rng');
    }
    if (pool.carouselRounds.includes(roundId))
        return fail('carousel-exists');
    if (roundId === '1-1' ? pool.naturalRound !== 0 : pool.naturalRound !== getCatalogRoundById(roundId).ordinal)
        return fail('invalid-round');
    const participants = pool.carouselParticipants, active = pool.seats.filter(s => !s.released);
    if (pool.seats.length !== pool.seatCount || !participants.length || participants.length !== active.length || new Set(participants.map(p => p.seatId)).size !== participants.length || participants.some(p => !integer(p.hp, 1) || !h7CarouselParticipantValid(p) || p.priorityChoiceId !== undefined && (typeof p.priorityChoiceId !== 'string' || !p.priorityChoiceId.length) || !active.some(s => s.seatId === p.seatId && s.seatIndex === p.seatIndex)))
        return fail('invalid-participants');
    if (Object.values(pool.available).reduce((a, b) => a + b, 0) < 9)
        return fail('pool-exhausted');
    const id = `${pool.poolId}:carousel:${roundId}`, { available, slots, wordState } = drawSlots(pool.available, roundId, rng.state, id);
    const ordered = [...participants].sort((a, b) => a.hp - b.hp || a.seatIndex - b.seatIndex), times = schedule(roundId), release = carouselRelease(ordered,times.firstBatchMs,times.batchIntervalMs);
    const nextPool: SharedPoolState = { ...pool, available, carouselParticipants: ordered, revision: pool.revision + 1, carouselRounds: [...pool.carouselRounds, roundId], carouselReservations: [...pool.carouselReservations, ...slots.map(s => ({ carouselId: id, reservationId: s.reservationId, slot: s.slot, definitionId: s.definitionId, seatId: null }))] };
    const state: CarouselState = { version: 'carousel-v1', id, roundId, pool: nextPool, initialAvailable: { ...pool.available }, participants: ordered, status: 'open', revision: 0, elapsedMs: 0, slots, ...release, deadlineMs: times.firstBatchMs + (Math.ceil(ordered.length / 2) - 1) * times.batchIntervalMs + times.tailMs, rngBefore: { ...rng }, rngAfter: { algorithm: 'lcg32-v1', state: wordState }, receipts: [] };
    assertSharedPoolConservation(nextPool);
    return { ok: true, state, events: [{ type: 'carousel-created', carouselId: id, roundId }] };
}
const fail = (state: CarouselState, reason: CarouselFailure): CarouselResult => ({ ok: false, state, reason, events: [] });
export function validateCarousel(state: CarouselState): void {
    assertSharedPoolConservation(state.pool);
    if (state.version !== 'carousel-v1' || !validRound(state.roundId) || state.id !== `${state.pool.poolId}:carousel:${state.roundId}` || !state.pool.carouselRounds.includes(state.roundId) || !integer(state.revision) || !integer(state.elapsedMs) || !['open', 'closed'].includes(state.status) || state.slots.length !== 9)
        throw Error('invalid-carousel');
    const ordered = [...state.participants].sort((a, b) => a.hp - b.hp || a.seatIndex - b.seatIndex), times = schedule(state.roundId), release = carouselRelease(ordered,times.firstBatchMs,times.batchIntervalMs);
    if (!ordered.length || ordered.length > 8 || !equal(state.participants,state.pool.carouselParticipants) || !equal(state.releaseOrder, release.releaseOrder) || new Set(state.releaseOrder).size !== ordered.length || ordered.some(p => !integer(p.hp, 1) || !h7CarouselParticipantValid(p) || p.priorityChoiceId !== undefined && (typeof p.priorityChoiceId !== 'string' || !p.priorityChoiceId.length) || !state.pool.seats.some(s => s.seatId === p.seatId && s.seatIndex === p.seatIndex)) || !equal(state.releaseAtMs, release.releaseAtMs) || state.deadlineMs !== times.firstBatchMs + (Math.ceil(ordered.length / 2) - 1) * times.batchIntervalMs + times.tailMs)
        throw Error('invalid-carousel');
    let seed = state.rngBefore.state;
    validateSeed(seed);
    for (let i = 0; i < CAROUSEL_COST_POLICY.rng.words; i++)
        seed = nextRandom(seed).state;
    if (state.rngBefore.algorithm !== 'lcg32-v1' || state.rngAfter.algorithm !== 'lcg32-v1' || state.rngAfter.state !== seed || !equal(state.receipts, state.pool.carouselReceipts.filter(r => r.carouselId === state.id)))
        throw Error('invalid-carousel');
    for (const [i, s] of state.slots.entries()) {
        if (s.slot !== i || s.reservationId !== `${state.id}:slot:${i}` || !Object.hasOwn(state.pool.initial, s.definitionId) || !ITEM_DEFINITIONS[s.itemId] || s.pickedBy !== null && !state.releaseOrder.includes(s.pickedBy))
            throw Error('invalid-carousel');
        const r = state.receipts.find(r => r.slot === i), reservation = state.pool.carouselReservations.find(r => r.reservationId === s.reservationId);
        if (s.pickedBy === null ? !!r : !r || r.seatId !== s.pickedBy || r.definitionId !== s.definitionId || r.itemId !== s.itemId)
            throw Error('invalid-carousel');
        if (r?.status === 'reserved' || !r && state.status === 'open') {
            if (!reservation || reservation.definitionId !== s.definitionId || reservation.seatId !== s.pickedBy)
                throw Error('invalid-carousel');
        }
        else if (reservation)
            throw Error('invalid-carousel');
    }
    if (!state.initialAvailable || !equal(Object.keys(state.initialAvailable).sort(), Object.keys(state.pool.initial).sort()) || Object.entries(state.initialAvailable).some(([id, n]) => !integer(n) || n > state.pool.initial[id]))
        throw Error('invalid-carousel');
    const replayed = drawSlots(state.initialAvailable, state.roundId, state.rngBefore.state, state.id);
    if (!equal(replayed.slots.map(s => [s.definitionId, s.itemId]), state.slots.map(s => [s.definitionId, s.itemId])))
        throw Error('invalid-carousel');
    if (state.status === 'closed' && (state.elapsedMs < state.deadlineMs || state.participants.some(p => !state.receipts.some(r => r.seatId === p.seatId))))
        throw Error('invalid-carousel');
}
export function restoreCarousel(input: unknown): CarouselState { if (typeof input !== 'string')
    canonicalContent(input); const state = JSON.parse(typeof input === 'string' ? input : JSON.stringify(input)) as CarouselState; canonicalContent(state); validateCarousel(state); return state; }
function closeIfDue(state: CarouselState): {
    state: CarouselState;
    events: CarouselEvent[];
} {
    if (state.status === 'closed' || state.elapsedMs < state.deadlineMs || state.participants.some(p => !state.receipts.some(r => r.seatId === p.seatId)))
        return { state, events: [] };
    const returned = state.slots.filter(s => s.pickedBy === null), available = { ...state.pool.available };
    for (const s of returned)
        available[s.definitionId]++;
    return { state: { ...state, status: 'closed', revision: state.revision + 1, pool: { ...state.pool, revision: state.pool.revision + 1, available, carouselReservations: state.pool.carouselReservations.filter(r => r.carouselId !== state.id || state.slots[r.slot].pickedBy !== null) } }, events: [{ type: 'carousel-closed', carouselId: state.id, returnedSlots: returned.map(s => s.slot) }] };
}
export function advanceCarousel(state: CarouselState, elapsedMs: number): CarouselResult {
    try {
        validateCarousel(state);
    }
    catch {
        return fail(state, 'invalid-carousel');
    }
    if (!integer(elapsedMs) || elapsedMs < state.elapsedMs)
        return fail(state, 'invalid-time');
    if (state.status === 'closed')
        return { ok: true, state, events: [] };
    const advanced = elapsedMs === state.elapsedMs ? state : { ...state, elapsedMs, revision: state.revision + 1 }, closed = closeIfDue(advanced);
    return { ok: true, ...closed };
}
export function pickFromCarousel(state: CarouselState, seatId: string, slot: number): CarouselResult {
    try {
        validateCarousel(state);
    }
    catch {
        return fail(state, 'invalid-carousel');
    }
    if (state.status === 'closed')
        return fail(state, 'carousel-closed');
    if (!state.releaseOrder.includes(seatId))
        return fail(state, 'unknown-seat');
    if (state.pool.seats.find(s => s.seatId === seatId)?.released)
        return fail(state, 'seat-eliminated');
    if (state.receipts.some(r => r.seatId === seatId))
        return fail(state, 'already-picked');
    if (state.elapsedMs < state.releaseAtMs[seatId])
        return fail(state, 'seat-locked');
    if (!integer(slot) || slot >= 9)
        return fail(state, 'invalid-slot');
    if (state.slots[slot].pickedBy !== null)
        return fail(state, 'slot-taken');
    const s = state.slots[slot], id = `${state.id}:${seatId}`, receipt: CarouselReceipt = { id, carouselId: state.id, seatId, slot, definitionId: s.definitionId, itemId: s.itemId, holdingSource: id, unitId: null, itemInstanceId: null, status: 'reserved' };
    const picked: CarouselState = { ...state, revision: state.revision + 1, slots: state.slots.map(s => s.slot === slot ? { ...s, pickedBy: seatId } : s), receipts: [...state.receipts, receipt], pool: { ...state.pool, revision: state.pool.revision + 1, carouselReceipts: [...state.pool.carouselReceipts, receipt], carouselReservations: state.pool.carouselReservations.map(r => r.reservationId === s.reservationId ? { ...r, seatId } : r) } };
    const closed = closeIfDue(picked);
    return { ok: true, state: closed.state, events: [{ type: 'carousel-picked', receipt }, ...closed.events] };
}
function planAutoPickFromCarousel(state: CarouselState, seatId: string, match: MatchState): CarouselResult {
    try {
        validateCarousel(state);
    }
    catch {
        return fail(state, 'invalid-carousel');
    }
    if (!match || match.sharedPool?.poolId !== state.pool.poolId || match.sharedPool.seatId !== seatId || !Array.isArray(match.preparation?.units))
        return fail(state, 'invalid-match');
    const copies = (id: string) => match.preparation.units.filter(u => u.team === 'player' && u.definitionId === id).reduce((sum, u) => sum + 3 ** (u.starLevel - 1), 0) + (match.carousel?.pendingUnits.filter(u => u.definitionId === id).length ?? 0);
    const upgrade = (s: CarouselSlot) => { const n = copies(s.definitionId); return n < 9 && n % 3 === 2 ? 1 : 0; };
    const choices = state.slots.filter(s => s.pickedBy === null).sort((a, b) => upgrade(b) - upgrade(a) || cost(b.definitionId) - cost(a.definitionId) || a.slot - b.slot);
    return pickFromCarousel(state, seatId, choices[0]?.slot ?? -1);
}
const cost = (id: string) => UNIT_DEFINITIONS[id].cost;
export function listCarouselSlots(state: CarouselState) { return state.slots.map(s => ({ slot: s.slot, definitionId: s.definitionId, starLevel: 1 as const, items: [s.itemId], pickedBy: s.pickedBy })); }
export { createCarouselMatch };
function planGrantCarouselPick(state: CarouselState, match: MatchState, seatId: string, receiptId?: string, pickSource: 'manual' | 'bot' | 'timeout' | 'disconnected' | 'augment' = 'manual', choiceId: string | null = null): {
    ok: true;
    state: CarouselState;
    match: MatchState;
    events: readonly MatchEvent[];
} | {
    ok: false;
    state: CarouselState;
    match: MatchState;
    reason: CarouselFailure;
    events: readonly [
    ];
} {
    const failure = (reason: CarouselFailure) => ({ ok: false as const, state, match, reason, events: [] as const });
    try {
        validateCarousel(state);
        assertSharedPoolConservation(state.pool, [match]);
    }
    catch {
        return failure('invalid-match');
    }
    const receipt = state.receipts.find(r => r.seatId === seatId && (receiptId === undefined || r.id === receiptId)), seat = state.pool.seats.find(s => s.seatId === seatId);
    if (!receipt || receipt.status === 'released')
        return failure('receipt-mismatch');
    if (match.sharedPool?.seatId !== seatId || !seat || seat.released)
        return failure('seat-eliminated');
    const prior = match.carousel?.receipts.find(r => r.id === receipt.id);
    if (receipt.status === 'granted')
        return prior && equal(prior, receipt) ? { ok: true, state, match, events: [] } : failure('receipt-mismatch');
    if (prior || match.phase === 'combat' || !match.carousel || match.roundDefinitionId !== state.roundId)
        return failure('invalid-match');
    const metadata = match.carousel!;
    const source = { kind: 'carousel' as const, receiptId: receipt.id };
    const unitId = `unit-${match.nextUnitSerial}`, itemInstanceId = `item-${match.nextItemSerial}`;
    if (!integer(match.nextUnitSerial, 1) || match.nextUnitSerial === Number.MAX_SAFE_INTEGER || !integer(match.nextItemSerial, 1) || match.nextItemSerial === Number.MAX_SAFE_INTEGER)
        return failure('invalid-match');
    const granted: CarouselReceipt = { ...receipt, unitId, itemInstanceId, status: 'granted' };
    const preparation = placeCarouselUnit(match, {receiptId:receipt.id,unitId,definitionId:receipt.definitionId});
    const held = preparation ? metadata.heldCarouselUnits : [...metadata.heldCarouselUnits, { receiptId: receipt.id, unitId, definitionId: receipt.definitionId }];
    const resourceProvenance = appendResourceProvenance(match.resourceProvenance, state.roundId, [
        {kind:'unit-acquired',unitId,source},{kind:'item-acquired',itemId:itemInstanceId,source}]);
    const receipts = state.receipts.map(r => r.id === receipt.id ? granted : r), poolReceipts = state.pool.carouselReceipts.map(r => r.id === receipt.id ? granted : r);
    const holdings = [...state.pool.holdings, { seatId, unitId, definitionId: receipt.definitionId, sources: [receipt.holdingSource] }];
    const nextPool: SharedPoolState = { ...state.pool, revision: state.pool.revision + 1, holdings, carouselReceipts: poolReceipts, carouselReservations: state.pool.carouselReservations.filter(r => r.reservationId !== state.slots[receipt.slot].reservationId), seats: state.pool.seats.map(s => s.seatId === seatId ? { ...s, revision: s.revision + 1 } : s) };
    const events: MatchEvent[] = [{ type: 'carouselGranted', receipt: granted }];
    const stamped: MatchEvent[] = events.map((e, i) => ({ ...e, domain: 'match', eventSeq: match.nextMatchEventSeq + i }) as MatchEvent);
    let nextMatch: MatchState = { ...match, preparation:preparation??match.preparation, resourceProvenance, nextUnitSerial: match.nextUnitSerial + 1, nextItemSerial: match.nextItemSerial + 1,
        items: [...match.items, { id: itemInstanceId, definitionId: receipt.itemId, location: { kind: 'inventory' } }],
        carousel: { ...metadata, receipts: [...metadata.receipts, granted], heldCarouselUnits:held, pendingUnits:held }, sharedPool: { ...match.sharedPool, revision: seat.revision + 1 }, nextMatchEventSeq: match.nextMatchEventSeq + events.length };
    nextMatch = applyAngerIssues(nextMatch);
    nextMatch = drainBatch5Inventory(nextMatch);
    nextMatch = appendAugmentFact(nextMatch, { kind: 'carousel', receipt: granted, source: pickSource, choiceId,
      ordinal: metadata.receipts.filter(r => r.carouselId === state.id).length, roster: historyRoster(nextMatch), releaseAtMs: state.releaseAtMs[seatId], eligibilityChoiceIds: match.augments.map(a => a.choiceId) });
    const nextState = { ...state, receipts, pool: nextPool, revision: state.revision + 1 };
    try {
        validateCarousel(nextState);
        assertSharedPoolConservation(nextPool, [nextMatch]);
    }
    catch {
        return failure('invalid-match');
    }
    return { ok: true, state: nextState, match: nextMatch, events: stamped };
}
/** A single public transaction for the server: a failed grant rolls back the slot too. */
export function pickCarouselForSeat(pool: SharedPoolState, carousel: CarouselState, match: MatchState, seatId: string, slot: number, source: 'manual' | 'bot' | 'timeout' | 'disconnected' = 'manual') {
    const bad = (reason: CarouselFailure) => ({ ok: false as const, pool, carousel, state: match, reason, events: [] as readonly (MatchEvent | CarouselEvent)[] });
    if (!equal(pool, carousel.pool))
        return bad('stale-pool');
    try {
        if ((carousel.participants.find(p => p.seatId === seatId)?.priorityChoiceId ?? null) !== carouselPriorityChoice(match))
            return bad('invalid-match');
    } catch { return bad('invalid-match'); }
    const picked = pickFromCarousel(carousel, seatId, slot);
    if (!picked.ok)
        return bad(picked.reason);
    const granted = grantCarouselPick(picked.state, match, seatId, undefined, source);
    if (!granted.ok)
        return bad(granted.reason);
    return { ok: true as const, pool: granted.state.pool, carousel: granted.state, state: granted.match, events: [...picked.events, ...granted.events] };
}
export function autoPickCarouselForSeat(pool: SharedPoolState, carousel: CarouselState, match: MatchState, seatId: string, _reason: 'bot' | 'disconnected' | 'timeout') {
    const picked = autoPickFromCarousel(carousel, seatId, match);
    if (!picked.ok)
        return { ok: false as const, pool, carousel, state: match, reason: picked.reason, events: [] as readonly (MatchEvent | CarouselEvent)[] };
    const slot = picked.state.receipts.find(r => r.seatId === seatId)!.slot;
    return pickCarouselForSeat(pool, carousel, match, seatId, slot, _reason);
}
/** Commit x-4 natural income once, only after the fixed cutoff. 1-1 has no income. */
export function completeCarouselForSeat(state: CarouselState, match: MatchState, seatId: string) {
    const bad = (reason: CarouselFailure) => ({ ok: false as const, state, match, reason, events: [] as readonly MatchEvent[] });
    try {
        validateCarousel(state);
        assertSharedPoolConservation(state.pool, [match]);
    }
    catch {
        return bad('invalid-match');
    }
    if (state.status !== 'closed')
        return bad('invalid-time');
    const receipt = state.receipts.find(r => r.seatId === seatId);
    if (!receipt || receipt.status !== 'granted' || match.sharedPool?.seatId !== seatId || !match.carousel?.receipts.some(r => equal(r, receipt)))
        return bad('receipt-mismatch');
    if (state.roundId === '1-1' || match.roundResults.some(r => r.roundId === state.roundId))
        return { ok: true as const, state, match, events: [] as readonly MatchEvent[] };
    let completedState = state, completedMatch = match;
    const augmentEvents: MatchEvent[] = [];
    try {
        const plan = tableScrapsPick(match, state);
        if (plan) {
            const additional = grantAdditionalCarouselPick(state.pool, state, match, seatId, plan.slot, plan.choiceId);
            if (!additional.ok) return bad(additional.reason);
            completedState = additional.carousel;
            completedMatch = additional.state;
            augmentEvents.push(...additional.events.filter((event): event is MatchEvent => 'domain' in event));
        }
    } catch {
        return bad('invalid-match');
    }
    const result = finishCarouselSupply(completedMatch);
    if (!result.ok)
        return bad('invalid-match');
    const seat = completedState.pool.seats.find(s => s.seatId === seatId)!;
    const pool = { ...completedState.pool, revision: completedState.pool.revision + 1, seats: completedState.pool.seats.map(s => s === seat ? { ...s, revision: s.revision + 1 } : s) };
    return { ok: true as const, state: { ...completedState, pool, revision: completedState.revision + 1 }, match: { ...result.state, sharedPool: { ...result.state.sharedPool!, revision: seat.revision + 1 } }, events: [...augmentEvents, ...result.events] };
}
/** Move previously owned queued units when a legal place/merge exists; never draws or buys. */
export function resolvePendingCarouselUnits(pool: SharedPoolState, match: MatchState): SharedPoolResult {
    const bad = (): SharedPoolResult => ({ ok: false, pool, state: match, reason: 'invalid-seat-state' });
    try {
        assertSharedPoolConservation(pool, [match]);
        if (!match.carousel || match.phase !== 'preparation' || match.multiplayer?.combatRosterLocked)
            return bad();
        const resolved = resolveCarouselPreparation(match);
        let next = resolved.state.augments.some(a=>a.definitionId==='glorious-evolution') ? drainBatch1Gifts(resolved.state) : resolved.state;
        const draft = draftPool(pool), events = [...resolved.events, ...mechanicGrantEvents(resolved.state,next)], poolEvents: SharedPoolEvent[] = [];
        reconcileHoldings(draft, match, next, poolEvents);
        if (next === match)
            return { ok: true, pool, state: match, events: [], poolEvents: [] };
        const stamped = events.map((e, i) => ({ ...e, domain: 'match', eventSeq: match.nextMatchEventSeq + i }) as MatchEvent);
        const seat = pool.seats.find(s => s.seatId === match.sharedPool!.seatId)!;
        draft.seats = draft.seats.map(s => s === seat ? { ...s, revision: s.revision + 1 } : s);
        draft.revision++;
        next = { ...next, sharedPool: { ...match.sharedPool!, revision: seat.revision + 1 }, nextMatchEventSeq: match.nextMatchEventSeq + events.length };
        assertSharedPoolConservation(draft, [next]);
        return { ok: true, pool: draft, state: next, events: stamped, poolEvents };
    }
    catch {
        return bad();
    }
}
export function sellPendingCarouselUnit(pool: SharedPoolState, match: MatchState, unitId: string): SharedPoolResult {
    if (brbShopDisabled(match)) return { ok: false, pool, state: match, reason: 'wrong-phase' };
    try {
        assertSharedPoolConservation(pool, [match]);
        const pending = match.carousel?.pendingUnits.find(u => u.unitId === unitId);
        if (!pending || match.phase !== 'preparation' || match.multiplayer?.combatRosterLocked)
            return { ok: false, pool, state: match, reason: 'unknown-unit' };
        const goldGranted = cost(pending.definitionId), draft = draftPool(pool), seatId = match.sharedPool!.seatId, seat = pool.seats.find(s => s.seatId === seatId)!;
        returnHolding(draft, seatId, unitId);
        draft.seats = draft.seats.map(s => s === seat ? { ...s, revision: s.revision + 1 } : s);
        draft.revision++;
        const state: MatchState = { ...match, gold: match.gold + goldGranted, resourceProvenance: appendResourceProvenance(match.resourceProvenance, match.roundDefinitionId, { kind: 'unit-sold', unitId, context: 'preparation', goldGranted }), carousel: { ...match.carousel!, pendingUnits: match.carousel!.pendingUnits.filter(u => u !== pending), heldCarouselUnits: match.carousel!.heldCarouselUnits.filter(u => u !== pending) }, sharedPool: { ...match.sharedPool!, revision: seat.revision + 1 } };
        assertSharedPoolConservation(draft, [state]);
        return { ok: true, pool: draft, state, events: [], poolEvents: [] };
    }
    catch {
        return { ok: false, pool, state: match, reason: 'invalid-seat-state' };
    }
}
/** Release the current frozen participant's ungranted card without changing its frozen order. */
export function releaseCarouselSeat(state: CarouselState, seatId: string): CarouselResult {
    try {
        validateCarousel(state);
    }
    catch {
        return fail(state, 'invalid-carousel');
    }
    if (!state.releaseOrder.includes(seatId))
        return fail(state, 'unknown-seat');
    let receipt = state.receipts.find(r => r.seatId === seatId);
    if (receipt?.status === 'released')
        return { ok: true, state, events: [] };
    if (receipt?.status === 'granted')
        return fail(state, 'receipt-mismatch'); // Shared elimination owns actual Match/holding removal.
    const slot = receipt?.slot ?? state.slots.find(s => s.pickedBy === null)!.slot, s = state.slots[slot];
    receipt = { id: `${state.id}:${seatId}`, carouselId: state.id, seatId, slot, definitionId: s.definitionId, itemId: s.itemId, holdingSource: `${state.id}:${seatId}`, unitId: null, itemInstanceId: null, status: 'released' };
    const receipts = [...state.receipts.filter(r => r.seatId !== seatId), receipt], available = { ...state.pool.available, [s.definitionId]: state.pool.available[s.definitionId] + 1 };
    const pool: SharedPoolState = { ...state.pool, available, revision: state.pool.revision + 1, carouselReservations: state.pool.carouselReservations.filter(r => r.reservationId !== s.reservationId), carouselReceipts: [...state.pool.carouselReceipts.filter(r => r.id !== receipt!.id), receipt] };
    const released: CarouselState = { ...state, pool, receipts, revision: state.revision + 1, slots: state.slots.map(x => x.slot === slot ? { ...x, pickedBy: seatId } : x) }, closed = closeIfDue(released);
    return { ok: true, state: closed.state, events: [{ type: 'carousel-seat-released', carouselId: state.id, seatId }, ...closed.events] };
}
/** One elimination transaction updates both the frozen carousel and the real pool/Match. */
export function releaseCarouselParticipant(state: CarouselState, match: MatchState, seatId: string) {
    const bad = (reason: CarouselFailure) => ({ ok: false as const, state, match, reason, events: [] as readonly (MatchEvent | CarouselEvent)[], poolEvents: [] as readonly SharedPoolEvent[] });
    try {
        validateCarousel(state);
        assertSharedPoolConservation(state.pool, [match]);
    }
    catch {
        return bad('invalid-match');
    }
    if (match.sharedPool?.seatId !== seatId || match.multiplayer?.status !== 'eliminated' || match.playerHp !== 0)
        return bad('invalid-match');
    if (state.pool.seats.find(s => s.seatId === seatId)?.released)
        return { ok: true as const, state, match, events: [] as readonly (MatchEvent | CarouselEvent)[], poolEvents: [] as readonly SharedPoolEvent[] };
    const receipt = state.receipts.find(r => r.seatId === seatId);
    let staged = state;
    if (receipt?.status !== 'granted') {
        const released = releaseCarouselSeat(state, seatId);
        if (!released.ok)
            return bad(released.reason);
        staged = released.state;
    }
    if (receipt?.status === 'granted') {
        const mark = (r: CarouselReceipt): CarouselReceipt => r.id === receipt.id ? { ...r, status: 'released', unitId: null, itemInstanceId: null } : r;
        staged = { ...staged, receipts: staged.receipts.map(mark), pool: { ...staged.pool, carouselReceipts: staged.pool.carouselReceipts.map(mark) } };
    }
    const released = releaseSeatOnElimination(staged.pool, match);
    if (!released.ok)
        return bad('invalid-match');
    const mark = (r: CarouselReceipt): CarouselReceipt => r.carouselId === state.id && r.seatId === seatId ? { ...r, status: 'released', unitId: null, itemInstanceId: null } : r;
    const pool = { ...released.pool, carouselReceipts: released.pool.carouselReceipts.map(mark) }, nextState = { ...staged, pool, receipts: staged.receipts.map(mark), revision: staged.revision + 1 };
    try {
        validateCarousel(nextState);
    }
    catch {
        return bad('invalid-carousel');
    }
    return { ok: true as const, state: nextState, match: released.state, events: [...released.events, {type:'carousel-seat-released' as const,carouselId:state.id,seatId}], poolEvents: released.poolEvents };
}
export function grantCarouselPick(state: CarouselState, match: MatchState, seatId: string, receiptId?: string, pickSource: 'manual' | 'bot' | 'timeout' | 'disconnected' | 'augment' = 'manual', choiceId: string | null = null): ReturnType<typeof planGrantCarouselPick> {
    try {
        return planGrantCarouselPick(state, match, seatId, receiptId, pickSource, choiceId);
    }
    catch {
        return { ok: false, state, match, reason: 'invalid-match', events: [] };
    }
}
export function autoPickFromCarousel(state: CarouselState, seatId: string, match: MatchState): CarouselResult {
    try {
        return planAutoPickFromCarousel(state, seatId, match);
    }
    catch {
        return fail(state, 'invalid-match');
    }
}

/** Follow the original carousel copy through transformations and every kind of merge. */
function carouselUnitIdentity(match: MatchState, receipt: CarouselReceipt, birthIndex: number) {
    let unitId = receipt.unitId!, definitionId = receipt.definitionId, starLevel = 1;
    let present = true;
    const upgrade = (event: UnitUpgradedEvent) => {
        if (!present || ![event.survivorId, ...event.consumedIds].includes(unitId)) return;
        if (event.definitionId !== definitionId || event.fromStar !== starLevel) throw Error('receipt-mismatch');
        unitId = event.survivorId;
        starLevel = event.toStar;
    };
    for (const fact of match.resourceProvenance.entries.slice(birthIndex + 1)) {
        if (fact.kind === 'unit-transformed' && present && fact.unitId === unitId) {
            if (fact.from !== definitionId || fact.starLevel !== starLevel) throw Error('receipt-mismatch');
            definitionId = fact.to;
        } else if (fact.kind === 'unit-upgraded' || fact.kind === 'unit-upgraded-after-combat') {
            upgrade(fact.event);
        } else if (fact.kind === 'carousel-preparation-settled' || fact.kind === 'carousel-unit-claimed') {
            for (const event of fact.upgrades) upgrade(event);
        } else if ((fact.kind === 'unit-sold' || fact.kind === 'unit-removed' || fact.kind === 'anvil-opened') && fact.unitId === unitId) {
            present = false;
        }
    }
    return present ? { unitId, definitionId, starLevel } : null;
}

/** Restore a server-owned seat alongside its carousel. Offline restoreMatch continues
 * rejecting server metadata; this boundary checks the pool and every carousel birth. */
export function restoreCarouselSeat(carousel: CarouselState, input: unknown, authority?: AugmentHistoryAuthority): MatchState {
    validateCarousel(carousel);
    if (typeof input !== 'string') canonicalContent(input);
    const match = JSON.parse(typeof input === 'string' ? input : JSON.stringify(input)) as MatchState;
    canonicalContent(match);
    assertSharedPoolConservation(carousel.pool, [match]);
    if (match.contentDigest !== CONTENT_DIGEST) throw Error('content-digest');
    const metadata = match.carousel;
    if (!metadata || !Array.isArray(metadata.receipts) || !Array.isArray(metadata.pendingUnits) || !Array.isArray(metadata.heldCarouselUnits) || !equal(metadata.pendingUnits,metadata.heldCarouselUnits) || !Array.isArray(metadata.preparationReceipts) || metadata.openingPending!==undefined)  throw Error('invalid-match');
    // A transformation is evidence only after its independent server checkpoint is authenticated.
    validateAugmentHistory(match, authority);
    validateOnlineBatch1GiftAuthority(carousel.pool, match, authority);
    const ids = new Set<string>();
    for (const receipt of metadata.receipts) {
        const pooled = carousel.pool.carouselReceipts.find(r => r.id === receipt.id);
        const released = carousel.pool.seats.some(s => s.seatId === receipt.seatId && s.released);
        const same = pooled && (equal(pooled, receipt) || released && equal(pooled, {...receipt,status:'released',unitId:null,itemInstanceId:null}));
        if (ids.has(receipt.id) || receipt.status !== 'granted' || receipt.seatId !== match.sharedPool!.seatId || !same) throw Error('receipt-mismatch');
        ids.add(receipt.id);
        const unitFacts = match.resourceProvenance.entries.filter(e => e.kind === 'unit-acquired' && e.source.kind === 'carousel' && e.source.receiptId === receipt.id);
        const itemFacts = match.resourceProvenance.entries.filter(e => e.kind === 'item-acquired' && e.source.kind === 'carousel' && e.source.receiptId === receipt.id);
        if (unitFacts.length !== 1 || unitFacts[0].kind !== 'unit-acquired' || unitFacts[0].unitId !== receipt.unitId || itemFacts.length !== 1 || itemFacts[0].kind !== 'item-acquired' || itemFacts[0].itemId !== receipt.itemInstanceId) throw Error('receipt-mismatch');
        const identity = carouselUnitIdentity(match, receipt, match.resourceProvenance.entries.indexOf(unitFacts[0]));
        const original = match.preparation.units.find(u=>u.id===receipt.unitId);
        const unit = match.preparation.units.find(u=>u.id===identity?.unitId), item = match.items.find(i=>i.id===receipt.itemInstanceId);
        const holding = carousel.pool.holdings.find(h=>h.seatId===receipt.seatId && h.sources.includes(receipt.holdingSource));
        if (original && original.id !== identity?.unitId || unit && (unit.definitionId !== identity?.definitionId || unit.starLevel !== identity.starLevel)
            || holding && (!identity || holding.unitId !== identity.unitId || holding.definitionId !== identity.definitionId || holding.sources.length !== 3 ** (identity.starLevel - 1))
            || !released && unit && !holding || item && item.definitionId !== receipt.itemId) throw Error('receipt-mismatch');
    }
    const pendingIds = new Set<string>();
    for (const pending of metadata.pendingUnits) {
        if (pendingIds.has(pending.unitId) || match.preparation.units.some(u => u.id === pending.unitId) || !metadata.receipts.some(r => r.id === pending.receiptId && r.unitId === pending.unitId && r.definitionId === pending.definitionId)) throw Error('receipt-mismatch');
        pendingIds.add(pending.unitId);
    }
    for (const fact of match.resourceProvenance.entries) if ((fact.kind === 'unit-acquired' || fact.kind === 'item-acquired') && fact.source.kind === 'carousel' && !ids.has(fact.source.receiptId)) throw Error('receipt-mismatch');
    const participant = carousel.participants.find(p=>p.seatId===match.multiplayer?.seatId);
    if (participant && participant.titanicTitanChoiceId !== titanicTitanChoiceId(match)) throw Error('invalid-participants');
    for (const f of match.augmentHistory?.facts ?? []) if(f.kind==='carousel' && f.receipt.carouselId===carousel.id && f.releaseAtMs!==carousel.releaseAtMs[f.seatId]) throw Error('invalid-carousel');
    validateTombRaider(match);
    validateMadChemistOnlineSave(carousel.pool, match, authority);
    if(match.anomalySelection||match.anomalyBinding||match.scheduleReceipts.some(r=>r.kind==='anomaly')||match.resourceProvenance.entries.some(e=>e.kind==='anomaly-selected')) {
      validateHistoricalEquipment(null,match);validatePortableAnomaly(match);
    }
    return match;
}

/** Internal award primitive: the future augment chooses the remaining slot using its explicit RNG.
 * Normal picks remain one per seat. Multiple receipts consume distinct remaining cards, never copies.
 * No client command calls this entry. The history owns the source/ordinal, so no new receipt fields exist. */
export function grantAdditionalCarouselPick(pool: SharedPoolState, carousel: CarouselState, match: MatchState,
  seatId: string, slot: number, choiceId: string): ReturnType<typeof pickCarouselForSeat> {
  const bad = (reason: CarouselFailure) => ({ ok: false as const, pool, carousel, state: match, reason, events: [] as readonly (MatchEvent | CarouselEvent)[] });
  try {
    if (!equal(pool, carousel.pool)) return bad('stale-pool');
    validateCarousel(carousel); assertSharedPoolConservation(pool, [match]);
    if (!match.augmentHistory || !match.augments.some(a => a.choiceId === choiceId && augmentNeedsHistory(a.definitionId)) || match.sharedPool?.seatId !== seatId
      || match.multiplayer?.status !== 'active' || !carousel.participants.every(p => carousel.receipts.some(r => r.seatId === p.seatId && r.status !== 'reserved')))
      return bad('invalid-match');
    const ordinal = carousel.receipts.filter(r => r.seatId === seatId).length;
    if (ordinal < 1 || ordinal > 8) return bad('receipt-mismatch');
    const s = carousel.slots[slot];
    if (!Number.isInteger(slot) || !s) return bad('invalid-slot');
    if (s.pickedBy !== null) return bad('slot-taken');
    const id = `${carousel.id}:${seatId}:extra:${ordinal}`;
    const receipt: CarouselReceipt = { id, carouselId: carousel.id, seatId, slot, definitionId: s.definitionId, itemId: s.itemId,
      holdingSource: id, unitId: null, itemInstanceId: null, status: 'reserved' };
    const closed = carousel.status === 'closed';
    if (closed && pool.available[s.definitionId] < 1) return bad('pool-exhausted');
    const reservation = { carouselId: carousel.id, reservationId: s.reservationId, slot, definitionId: s.definitionId, seatId };
    const reservedPool = { ...pool, revision: pool.revision+1,
      available: closed ? { ...pool.available, [s.definitionId]: pool.available[s.definitionId]-1 } : pool.available,
      carouselReceipts: [...pool.carouselReceipts, receipt], carouselReservations: closed ? [...pool.carouselReservations, reservation]
        : pool.carouselReservations.map(r => r.reservationId === s.reservationId ? reservation : r) };
    const reserved: CarouselState = { ...carousel, pool: reservedPool, revision: carousel.revision+1,
      receipts: [...carousel.receipts, receipt], slots: carousel.slots.map(x => x.slot === slot ? { ...x, pickedBy: seatId } : x) };
    if (!Number.isSafeInteger(match.nextMatchEventSeq) || match.nextMatchEventSeq >= Number.MAX_SAFE_INTEGER - 1) return bad('invalid-match');
    const numbered = { ...match, nextMatchEventSeq: match.nextMatchEventSeq + 1 };
    const granted = grantCarouselPick(reserved, numbered, seatId, id, 'augment', choiceId);
    if (!granted.ok) return bad(granted.reason);
    return { ok: true, pool: granted.state.pool, carousel: granted.state, state: granted.match,
      events: [{type:'carousel-picked', receipt, domain:'match' as const, eventSeq:match.nextMatchEventSeq}, ...granted.events] };
  } catch { return bad('invalid-match'); }
}
