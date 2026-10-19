import { selectOpeningUnit } from '../../src/simulation/opening-unit';
import { beforeAll, describe, expect, it } from 'vitest';
import { assertSharedPoolConservation, type SharedPoolState } from '../../src/server-entry';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { CAROUSEL_RULES_BINDING, type CarouselRules } from '../../src/server/room/carousel';
import { CAROUSEL_DEPARTURE_MS, type Room } from '../../src/server/room/room';
import { seatPushEvents, toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleInput } from '../../src/server/room/types';
import { parseClientMessage, NET_PROTOCOL_VERSION } from '../../src/server/net/messages';
import { ManualClock, type Clock } from '../../src/server/room/clock';
import { DamageResolver, makeRoom, runUntil } from './helpers';

// The real P7 rules after P7-1 (MULTIPLAYER_CONTRACT §21.4–21.6): no carousel at the opening; the first one is 2-4. Batches
// of two by HP then seat index, first batch at 6 s, one batch every 6 s, 6 s tail: releases at 6/6/12/12/18/18/24/24 s in
// the rules' release order, deadline 30 s, then the room's 2 s departure.
const rules = CAROUSEL_RULES_BINDING;
const HUMANS = ['s0', 's1', 's2', 's3'];
const BOTS = ['s4', 's5', 's6', 's7'];
const RELEASES = [6_000, 6_000, 12_000, 12_000, 18_000, 18_000, 24_000, 24_000];

const seatOf = (room: Room, seatId: string) => room.state.seats.find(seat => seat.seatId === seatId)!;
const unitsOf = (room: Room, seatId: string) => seatOf(room, seatId).match.preparation.units.filter(unit => unit.team === 'player');
const placed = (room: Room, seatId: string, kind: 'bench' | 'board') => unitsOf(room, seatId).filter(unit => unit.location.kind === kind).length;
const heldOf = (room: Room, seatId: string) => seatOf(room, seatId).match.carousel!.heldCarouselUnits;
const conserved = (room: Room) => assertSharedPoolConservation(room.state.pool, room.state.seats.map(seat => seat.match));
const types = (events: readonly { readonly type: string }[]) => events.map(event => event.type);
const pick = (room: Room, seatId: string, slot: number, override: { carouselId?: string; revision?: number } = {}) => {
  const carousel = room.state.carousel!.state;
  return room.handle(seatId, { type: 'carousel-pick', carouselId: override.carouselId ?? carousel.id, revision: override.revision ?? carousel.revision, slot });
};
const freeSlots = (room: Room) => room.state.carousel!.state.slots.filter(slot => slot.pickedBy === null);
/** Moves the clock on to the carousel's logical time `ms` (the rules' `releaseAtMs`/`deadlineMs` count from its opening); never back. */
const advanceTo = (room: Room, clock: ManualClock, ms: number) => clock.advance(Math.max(0, room.state.carousel!.startedAt + ms - clock.now()));

/**
 * Plays a started room to its next carousel (or its end) on the clock's timers, running `script` once in each round's
 * preparation and once in each round's battle phase (operations stay open then, contract §15).
 */
function playToCarousel(room: Room, clock: ManualClock, script: { readonly preparation?: (roundId: string) => void; readonly battle?: (roundId: string) => void } = {}) {
  const prepared = new Set<string>(), fought = new Set<string>();
  for (let fired = 0; fired < 3_000; fired++) {
    const { phase, roundId } = room.state;
    if (phase === 'carousel' || phase === 'ended') return room.state;
    if (phase === 'preparation' && !prepared.has(roundId)) { prepared.add(roundId); script.preparation?.(roundId); }
    if (phase === 'battle' && !fought.has(roundId)) { fought.add(roundId); script.battle?.(roundId); }
    if (!clock.runNext()) break;
  }
  throw new Error(`no carousel (phase ${room.state.phase}, round ${room.state.roundId}, fault ${JSON.stringify(room.state.fault)})`);
}
/** Buys shop cards from the left while the seat's bench has room; a refusal (no gold) changes nothing. */
function buyAll(room: Room, seatId: string): void {
  for (let slot = 0; slot < 5 && placed(room, seatId, 'bench') < 9; slot++) room.handle(seatId, { type: 'buy', slot, generation: seatOf(room, seatId).match.shop.generation });
}
/**
 * Units on the 2-4 carousel of this room (seed 35: under random openings and rewards, seed 42 left s0 one bench card short);
 * s1 collects two one-star copies of one of them before it opens, so its pick is a third copy. Checked when s1 picks: a content or rules change that moves the carousel fails there, by name.
 */
const PAIR_TARGETS = ['nocturne', 'urgot', 'rell', 'renata'];
const copiesOf = (room: Room, seatId: string, definitionId: string) => unitsOf(room, seatId).filter(unit => unit.definitionId === definitionId && unit.starLevel === 1);
function collectPairs(room: Room, seatId: string, reroll: boolean): void {
  for (let rolls = 0; ; rolls++) {
    seatOf(room, seatId).match.shop.slots.forEach((offer, slot) => {
      if (offer.status === 'available' && PAIR_TARGETS.includes(offer.definitionId) && copiesOf(room, seatId, offer.definitionId).length < 2) {
        room.handle(seatId, { type: 'buy', slot, generation: seatOf(room, seatId).match.shop.generation });
      }
    });
    const paired = PAIR_TARGETS.some(definitionId => copiesOf(room, seatId, definitionId).length >= 2);
    if (!reroll || paired || rolls >= 12 || seatOf(room, seatId).match.gold < 4 || !room.handle(seatId, { type: 'reroll' }).ok) return;
  }
}

/** The real two-sided resolver, keeping every frozen input it was given (what each seat fought with). */
class RecordingResolver extends TwoSidedBattleResolver {
  readonly inputs: BattleInput[] = [];
  override resolveBattle(input: BattleInput, pool: SharedPoolState) { this.inputs.push(input); return super.resolveBattle(input, pool); }
  override startBattle(input: BattleInput, pool: SharedPoolState) { this.inputs.push(input); return super.startBattle(input, pool); }
}

describe('P7-1 opening (MULTIPLAYER_CONTRACT §21.5 initialisation order)', () => {
  it('opens like a plain room: the random one-cost unit, the opening economy and the first shop; no carousel at the opening', () => {
    const { room } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    const { room: plain } = makeRoom(new DamageResolver(() => 0));
    // createCarouselMatch → initializeSharedSeat → refreshSharedShops: the same pool and room rng as without the carousel.
    expect(room.state.pool).toEqual(plain.state.pool);
    expect(room.state.rngState).toBe(plain.state.rngState);
    for (const [index, seat] of room.state.seats.entries()) {
      const other = plain.state.seats[index]!.match;
      expect(seat.match.carousel).toEqual({ receipts: [], heldCarouselUnits: [], pendingUnits: [], preparationReceipts: [] });
      expect(unitsOf(room, seat.seatId).map(unit => [unit.definitionId, unit.starLevel, unit.location.kind])).toEqual([[selectOpeningUnit(room.state.pool.seed,seat.seatId), 1, 'board']]);
      for (const key of ['round', 'roundDefinitionId', 'phase', 'gold', 'level', 'xp', 'playerHp', 'items', 'shop', 'preparation'] as const) expect(seat.match[key], key).toEqual(other[key]);
      const view = toSeatPrivateView(seat.match);
      expect(view.heldCarouselUnits).toEqual([]);
      expect('pendingCarouselUnits' in view).toBe(false);
    }
    room.start();
    expect(room.state).toMatchObject({ phase: 'preparation', roundId: '1-2', carousel: null, carouselLedger: [] });
    expect(toPlayerView(room.state, 's0', 0)).toMatchObject({ phase: { kind: 'preparation', roundName: '1-2' }, carousel: null });
    conserved(room);
  });
});

/*
 * One room played to 2-4 and on, step by step (the `it`s share it and run in order). Before 2-4: s0 and s2/s3 fill their
 * bench from the shop; after the 2-3 freeze s0 buys XP to level 5 (its board then has a free place) and s0/s2/s3 refill
 * their bench. s1 collects a pair (PAIR_TARGETS). At 2-4 the rules place each pick: s0 → board, s1 → bench, s2/s3 →
 * holding slot. s3 is disconnected through the carousel.
 */
describe('P7-1: the 2-4 carousel of a played room, bound to the rules (MULTIPLAYER_CONTRACT §21.6)', () => {
  const resolver = new RecordingResolver();
  const { room, clock } = makeRoom(resolver, { carousel: rules, seed: 35 });
  const opened: string[] = [];
  room.subscribe(state => { if (state.phase === 'carousel' && opened.at(-1) !== state.roundId) opened.push(state.roundId); });
  const carousel = () => room.state.carousel!.state;
  const releaseOf = (seatId: string) => carousel().releaseAtMs[seatId]!;
  const picked: Record<string, { readonly slot: number; readonly definitionId: string; readonly unitId: string }> = {};
  let carouselId = '';

  beforeAll(() => {
    room.start();
    playToCarousel(room, clock, {
      preparation: roundId => { for (const seatId of ['s0', 's2', 's3']) buyAll(room, seatId); collectPairs(room, 's1', roundId.startsWith('2-')); },
      battle: roundId => {
        if (roundId !== '2-3') return;
        while (seatOf(room, 's0').match.level < 5) if (!room.handle('s0', { type: 'buyXp' }).ok) break;
        for (const seatId of ['s0', 's2', 's3']) buyAll(room, seatId);
        // Random openings leave s0's bench one short after the XP spend; reroll on its own content stream until it is full.
        while (placed(room, 's0', 'bench') < 9 && room.handle('s0', { type: 'reroll' }).ok) buyAll(room, 's0');
      },
    });
    carouselId = room.state.carousel?.state.id ?? '';
  }, 60_000);

  it('opens the first carousel at 2-4 (the rules\' opensCarousel), releasing by HP on the rules\' schedule', () => {
    expect(opened).toEqual(['2-4']);
    expect(room.state).toMatchObject({ phase: 'carousel', roundId: '2-4', fault: null });
    for (const seat of room.state.seats) expect(rules.opensCarousel(seat.match)).toBe(true);
    const state = carousel();
    expect(state).toMatchObject({ roundId: '2-4', status: 'open', deadlineMs: 30_000 });
    expect(state.releaseOrder).toEqual([...room.state.seats].sort((a, b) => a.hp - b.hp || a.index - b.index).map(seat => seat.seatId));
    expect(state.releaseOrder.map(seatId => state.releaseAtMs[seatId])).toEqual(RELEASES);
    expect(room.state.deadlineAt).toBe(room.state.carousel!.startedAt + 30_000 + CAROUSEL_DEPARTURE_MS);
    // One publication: the pool the carousel reserved its nine cards on is the room's pool; the room rng moved past the draw.
    expect(room.state.pool).toBe(state.pool);
    expect(room.state.rngState).toBe(state.rngAfter.state);
    expect(room.state.carouselLedger).toEqual([{ carouselId, seatId: null, events: [{ type: 'carousel-created', carouselId, roundId: '2-4' }] }]);
    expect(toPlayerView(room.state, 's0', clock.now()).phase).toMatchObject({ kind: 'carousel', roundName: '2-4' });
    // The seats as the script left them: s0 bench full under a free board place, s1 bench room, s2/s3 bench and board full.
    expect([placed(room, 's0', 'bench'), placed(room, 's0', 'board'), seatOf(room, 's0').match.level]).toEqual([9, 4, 5]);
    expect(placed(room, 's1', 'bench')).toBeLessThan(9);
    for (const seatId of ['s2', 's3']) expect([placed(room, seatId, 'bench'), placed(room, seatId, 'board')]).toEqual([9, seatOf(room, seatId).match.level]);
    conserved(room);
  });

  it('waits for the release: operations wait, the rules lock an unreleased seat, a stale carousel is the room\'s refusal', () => {
    const before = room.state;
    expect(room.handle('s0', { type: 'reroll' })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(pick(room, 's0', 0)).toMatchObject({ ok: false, reason: 'seat-locked' });
    expect(pick(room, 's0', 0, { revision: before.carousel!.state.revision - 1 })).toMatchObject({ ok: false, reason: 'stale-carousel' });
    expect(pick(room, 's0', 0, { carouselId: 'other' })).toMatchObject({ ok: false, reason: 'stale-carousel' });
    expect(room.state).toBe(before);
  });

  it('picks for a bot when the rules release it, never for a disconnected player before the deadline', () => {
    room.setConnected('s3', false);
    advanceTo(room, clock, releaseOf('s3'));
    const released = carousel().releaseOrder.filter(seatId => releaseOf(seatId) <= carousel().elapsedMs);
    expect(room.state.carousel!.auto).toEqual(Object.fromEntries(released.filter(seatId => BOTS.includes(seatId)).map(seatId => [seatId, 'bot'])));
    expect(carousel().receipts.some(receipt => receipt.seatId === 's3')).toBe(false);
    // Resuming meets the same carousel, released; dropping again leaves the pick to the deadline.
    room.setConnected('s3', true);
    expect(toPlayerView(room.state, 's3', clock.now()).carousel).toMatchObject({ id: carouselId, eligible: true, pickedSlot: null });
    room.setConnected('s3', false);
  });

  it('s0 (bench full, board below its level): the pick goes straight onto the board, with its item', () => {
    advanceTo(room, clock, releaseOf('s0'));
    const slot = freeSlots(room)[0]!;
    const before = new Set(unitsOf(room, 's0').map(unit => unit.id));
    const result = pick(room, 's0', slot.slot);
    expect(result).toMatchObject({ ok: true, seatRevision: seatOf(room, 's0').seatRevision });
    if (!result.ok) return;
    const unit = unitsOf(room, 's0').find(candidate => !before.has(candidate.id))!;
    expect(unit).toMatchObject({ definitionId: slot.definitionId, starLevel: 1, location: { kind: 'board' } });
    expect([placed(room, 's0', 'bench'), placed(room, 's0', 'board'), heldOf(room, 's0')]).toEqual([9, 5, []]);
    expect(seatOf(room, 's0').match.items.at(-1)).toMatchObject({ definitionId: slot.itemId, location: { kind: 'inventory' } });
    expect(types(result.events)).toEqual(['carouselGranted']);
    expect(room.state.carouselLedger.at(-1)).toMatchObject({ carouselId, seatId: 's0' });
    expect(types(room.state.carouselLedger.at(-1)!.events)).toEqual(['carousel-picked', 'carouselGranted']);
    picked.s0 = { slot: slot.slot, definitionId: slot.definitionId, unitId: unit.id };
    conserved(room);
  });

  it('s1 (bench room): the pick lands on the bench as a third one-star copy; nothing merges during the carousel', () => {
    advanceTo(room, clock, releaseOf('s1'));
    const target = freeSlots(room).find(slot => copiesOf(room, 's1', slot.definitionId).length === 2);
    expect(target, `s1 holds a pair of a unit still on the carousel (${freeSlots(room).map(slot => slot.definitionId).join(',')})`).toBeDefined();
    const before = new Set(unitsOf(room, 's1').map(unit => unit.id));
    const result = pick(room, 's1', target!.slot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unit = unitsOf(room, 's1').find(candidate => !before.has(candidate.id))!;
    expect(unit).toMatchObject({ definitionId: target!.definitionId, starLevel: 1, location: { kind: 'bench' } });
    expect(copiesOf(room, 's1', target!.definitionId)).toHaveLength(3);
    expect(types(result.events)).not.toContain('unitUpgraded');
    picked.s1 = { slot: target!.slot, definitionId: target!.definitionId, unitId: unit.id };
  });

  it('the rules refuse a taken slot, a second pick and a slot out of range; nothing is published', () => {
    advanceTo(room, clock, releaseOf('s2'));
    const before = room.state;
    expect(pick(room, 's2', picked.s1!.slot)).toMatchObject({ ok: false, reason: 'slot-taken' });
    expect(pick(room, 's1', freeSlots(room)[0]!.slot)).toMatchObject({ ok: false, reason: 'already-picked' });
    expect(pick(room, 's2', 9)).toMatchObject({ ok: false, reason: 'invalid-slot' });
    expect(room.state).toBe(before);
  });

  it('s2 (bench and board full): the pick waits in the holding slot, owned but neither placed nor fighting', () => {
    advanceTo(room, clock, releaseOf('s2'));
    const slot = freeSlots(room)[0]!;
    const before = unitsOf(room, 's2');
    const result = pick(room, 's2', slot.slot);
    expect(result.ok).toBe(true);
    const held = heldOf(room, 's2');
    expect(held).toEqual([{ receiptId: `${carouselId}:s2`, unitId: expect.any(String), definitionId: slot.definitionId }]);
    expect(unitsOf(room, 's2')).toEqual(before);
    // The deprecated alias mirrors the canonical field; the pool counts the held card as the seat's holding.
    expect(seatOf(room, 's2').match.carousel!.pendingUnits).toEqual(held);
    expect(room.state.pool.holdings.some(holding => holding.seatId === 's2' && holding.unitId === held[0]!.unitId)).toBe(true);
    // Only the seat's own view carries it, under the P7-1 name.
    const view = toSeatPrivateView(seatOf(room, 's2').match);
    expect(view.heldCarouselUnits).toEqual(held);
    expect('pendingCarouselUnits' in view).toBe(false);
    expect(toSeatPrivateView(seatOf(room, 's1').match).heldCarouselUnits).toEqual([]);
    expect(JSON.stringify(toPlayerView(room.state, 's1', clock.now()))).not.toContain(held[0]!.unitId);
    picked.s2 = { slot: slot.slot, definitionId: slot.definitionId, unitId: held[0]!.unitId };
    conserved(room);
  });

  it('at the deadline the disconnected player is picked for (into its holding slot); the phase holds through the departure', () => {
    advanceTo(room, clock, 30_000);
    expect(carousel().status).toBe('closed');
    expect(room.state.carousel!.auto).toEqual({ s4: 'bot', s5: 'bot', s6: 'bot', s7: 'bot', s3: 'disconnected' });
    const receipt = carousel().receipts.find(candidate => candidate.seatId === 's3')!;
    expect(heldOf(room, 's3')).toEqual([{ receiptId: receipt.id, unitId: receipt.unitId, definitionId: receipt.definitionId }]);
    room.setConnected('s3', true);
    expect(toPlayerView(room.state, 's3', clock.now()).carousel).toMatchObject({ id: carouselId, eligible: false, pickedSlot: receipt.slot, autoPicked: expect.arrayContaining(['s3']) });
    expect(pick(room, 's1', 0)).toMatchObject({ ok: false, reason: 'carousel-closed' });
    expect(room.state.phase).toBe('carousel');
    clock.advance(CAROUSEL_DEPARTURE_MS - 1);
    expect(room.state.phase).toBe('carousel');
    clock.advance(1);
    expect(room.state.phase).not.toBe('carousel');
    expect(room.state.carousel).toBeNull();
    expect(toPlayerView(room.state, 's0', clock.now()).carousel).toBeNull();
    const logged = room.state.carouselLedger.flatMap(entry => types(entry.events));
    expect(logged.filter(type => type === 'carousel-picked')).toHaveLength(8);
    expect(logged.filter(type => type === 'carouselGranted')).toHaveLength(8);
    expect(logged.filter(type => type === 'carousel-created' || type === 'carousel-closed')).toEqual(['carousel-created', 'carousel-closed']);
    // x-4 completion (the supply round's economy) once per seat, in the carousel ledger.
    const completions = room.state.carouselLedger.filter(entry => entry.seatId !== null && entry.events.some(event => event.type === 'roundSettled'));
    expect(completions.map(entry => entry.seatId).sort()).toEqual([...HUMANS, ...BOTS].sort());
    conserved(room);
  });

  it('settles 2-4 once and merges the carousel copy only at the next preparation, published with the seat', () => {
    runUntil(room, clock, state => state.phase === 'preparation' && state.roundId === '2-5');
    expect(room.state.fault).toBeNull();
    for (const seat of room.state.seats) {
      expect(seat.match.roundResults.filter(result => result.roundId === '2-4')).toHaveLength(1);
      expect(seat.match.carousel!.receipts.map(receipt => receipt.id)).toEqual([`${carouselId}:${seat.seatId}`]);
      expect(seat.match.carousel!.preparationReceipts).toEqual([`${carouselId}:${seat.seatId}`]);
    }
    const s1 = seatOf(room, 's1');
    const merged = unitsOf(room, 's1').filter(unit => unit.definitionId === picked.s1!.definitionId);
    expect(merged.map(unit => unit.starLevel)).toEqual([2]);
    expect(types(s1.serverEvents!.events)).toEqual(expect.arrayContaining(['unitUpgraded', 'carouselPreparationSettled']));
    expect(types(seatPushEvents(s1))).toContain('unitUpgraded');
    // The board pick stays where the rules put it; the holding slots stay full (no place opened at the round entry).
    expect(unitsOf(room, 's0').find(unit => unit.id === picked.s0!.unitId)?.location.kind).toBe('board');
    expect(heldOf(room, 's2').map(unit => unit.unitId)).toEqual([picked.s2!.unitId]);
    expect(heldOf(room, 's3')).toHaveLength(1);
    conserved(room);
  });

  it('keeps a held unit while nothing frees a place; a sell that frees a bench slot moves it in, in the same publication', () => {
    const level = seatOf(room, 's2').match.level;
    const xp = room.handle('s2', { type: 'buyXp' });
    expect(xp.ok && seatOf(room, 's2').match.level === level).toBe(true);
    expect(heldOf(room, 's2').map(unit => unit.unitId)).toEqual([picked.s2!.unitId]);
    const sold = unitsOf(room, 's2').find(unit => unit.location.kind === 'bench')!;
    const revision = seatOf(room, 's2').seatRevision;
    const result = room.handle('s2', { type: 'sell', unitId: sold.id });
    expect(result).toMatchObject({ ok: true, seatRevision: revision + 1 });
    if (!result.ok) return;
    expect(heldOf(room, 's2')).toEqual([]);
    expect(unitsOf(room, 's2').find(unit => unit.id === picked.s2!.unitId)).toMatchObject({ starLevel: 1, location: sold.location });
    expect(types(result.events)).toEqual(expect.arrayContaining(['carouselPendingClaimed', 'carouselPreparationSettled']));
    expect(toSeatPrivateView(seatOf(room, 's2').match).heldCarouselUnits).toEqual([]);
    conserved(room);
  });

  it('a held unit never fights: frozen without it at 2-5 (the board pick fights), and it cannot be sold under the lock', () => {
    const held = heldOf(room, 's3')[0]!;
    const from = resolver.inputs.length;
    runUntil(room, clock, state => state.phase === 'battle');
    const frozen = (seatId: string) => resolver.inputs.slice(from).flatMap(input => [...input.seats, ...(input.mirrorOf ? [input.mirrorOf] : [])]).find(seat => seat.seatId === seatId)!.state;
    expect(frozen('s3').preparation.units.some(unit => unit.id === held.unitId)).toBe(false);
    expect(frozen('s3').carousel!.heldCarouselUnits).toEqual([held]);
    expect(frozen('s0').preparation.units.find(unit => unit.id === picked.s0!.unitId)?.location.kind).toBe('board');
    const before = room.state;
    expect(room.handle('s3', { type: 'sell', unitId: held.unitId })).toMatchObject({ ok: false, reason: 'unknown-unit' });
    expect(room.state).toBe(before);
  });

  it('sells a held unit through the rules in the next preparation: its price once, the card back to the pool, the item kept', () => {
    runUntil(room, clock, state => state.phase === 'preparation' && state.roundId === '2-6');
    const [held] = heldOf(room, 's3');
    expect(held).toBeDefined();
    const seat = seatOf(room, 's3').match;
    const available = room.state.pool.available[held!.definitionId]!;
    const result = room.handle('s3', { type: 'sell', unitId: held!.unitId });
    expect(result.ok).toBe(true);
    const after = seatOf(room, 's3').match;
    expect(heldOf(room, 's3')).toEqual([]);
    expect(after.gold).toBe(seat.gold + UNIT_DEFINITIONS[held!.definitionId]!.cost);
    expect(after.items).toEqual(seat.items);
    expect(room.state.pool.available[held!.definitionId]).toBe(available + 1);
    expect(room.state.pool.holdings.some(holding => holding.unitId === held!.unitId && holding.seatId === 's3')).toBe(false);
    expect(room.handle('s3', { type: 'sell', unitId: held!.unitId })).toMatchObject({ ok: false });
    conserved(room);
  });
});

describe('P7 carousel timing and refusals, each on its own room played to 2-4', () => {
  it('option B: stays open to the deadline and the departure after every seat holds a unit', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { carousel: rules });
    room.start();
    playToCarousel(room, clock);
    const state = room.state.carousel!.state;
    for (const seatId of state.releaseOrder) {
      advanceTo(room, clock, state.releaseAtMs[seatId]!);
      if (HUMANS.includes(seatId)) expect(pick(room, seatId, freeSlots(room)[0]!.slot).ok).toBe(true);
    }
    expect(room.state.carousel!.state.receipts).toHaveLength(8);
    expect(room.state.carousel!.auto).toEqual({ s4: 'bot', s5: 'bot', s6: 'bot', s7: 'bot' });
    advanceTo(room, clock, 30_000 - 1);
    expect(room.state.carousel!.state.status).toBe('open');
    advanceTo(room, clock, 30_000);
    expect(room.state.carousel!.state.status).toBe('closed');
    clock.advance(CAROUSEL_DEPARTURE_MS - 1);
    expect(room.state.phase).toBe('carousel');
    clock.advance(1);
    expect(room.state.phase).not.toBe('carousel');
    expect(room.state.fault).toBeNull();
  }, 60_000);

  it('a timer firing early, with time passing during the catch-up, never skips a batch; idle players time out at the deadline', () => {
    const inner = new ManualClock();
    let reads = 0, inTimer = false;
    const clock: Clock = {
      now: () => inner.now() + (inTimer && reads++ > 0 ? 1 : 0),
      schedule: (at, fn) => inner.schedule(at - 1 > inner.now() ? at - 1 : at, () => { reads = 0; inTimer = true; try { fn(); } finally { inTimer = false; } }),
      cancel: handle => inner.cancel(handle),
    };
    const { room } = makeRoom(new TwoSidedBattleResolver(), { carousel: rules, clock });
    room.start();
    playToCarousel(room, inner);
    const state = room.state.carousel!.state;
    for (const at of [6_000, 12_000, 18_000, 24_000]) {
      advanceTo(room, inner, at);
      expect(room.state.carousel!.state.elapsedMs).toBe(at);
      const releasedBots = state.releaseOrder.filter(seatId => BOTS.includes(seatId) && state.releaseAtMs[seatId]! <= at);
      expect(Object.keys(room.state.carousel!.auto).sort(), `at ${at} ms`).toEqual(releasedBots.sort());
    }
    // The connected players never picked: the deadline picks for them, in release order, as `timeout`.
    advanceTo(room, inner, 30_000);
    expect(room.state.carousel!.state.status).toBe('closed');
    expect(room.state.carousel!.auto).toEqual({ s0: 'timeout', s1: 'timeout', s2: 'timeout', s3: 'timeout', s4: 'bot', s5: 'bot', s6: 'bot', s7: 'bot' });
    advanceTo(room, inner, 30_000 + CAROUSEL_DEPARTURE_MS);
    expect(room.state.phase).not.toBe('carousel');
    expect(room.state.fault).toBeNull();
    for (const seat of room.state.seats) expect(seat.match.carousel!.receipts).toHaveLength(1);
  }, 60_000);

  it('faults the room when the rules refuse to open the 2-4 carousel', () => {
    const refusing: CarouselRules = { ...rules, createCarousel: (pool, _roundId, rng) => ({ ok: false, pool, rng, reason: 'pool-exhausted', events: [] }) };
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { carousel: refusing });
    room.start();
    expect(playToCarousel(room, clock)).toMatchObject({ phase: 'ended', roundId: '2-4', fault: { kind: 'carousel-error', reason: 'create:pool-exhausted' } });
    expect(toPlayerView(room.state, 's0', 0).fault?.kind).toBe('carousel-error');
  }, 60_000);
});

/**
 * Why the room never calls `releaseCarouselParticipant`: it is needed only for an elimination while a carousel is active
 * (MULTIPLAYER_CONTRACT §21.5 scope note, PR #123). Eliminations happen only at a round settlement, and the carousel phase
 * closes (deadline plus departure, `finishCarousel`) before the round goes on. A seat eliminated later releases through
 * `releaseSeatOnElimination`, which the rules accept once the closed carousel has left no reservation; it returns the
 * holdings, and `carouselReceipts` stay `granted` by design (ownership is the holdings). These pin both halves on one match.
 */
describe('a whole carousel match: 2-4 by HP, no overlap with eliminations, a later elimination returns the picks', () => {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { carousel: rules });
  const seat = (seatId: string) => seatOf(room, seatId);
  type Snapshot = typeof room.state;
  const opened: string[] = [];
  const overlaps: string[] = [];
  const reservationsAfterClose: number[] = [];
  let firstOpen: Snapshot | null = null, firstClosed: Snapshot | null = null;
  let participants: readonly string[] = [];
  let previousPhase = '';
  // Battle rounds since the latest carousel, counted when each battle phase starts.
  let fightsSinceCarousel = 0, lastFight = '';
  let beforeDeath = room.state;
  let death: { readonly state: Snapshot; readonly afterCarousel: string; readonly fightsSinceCarousel: number } | null = null;

  beforeAll(() => {
    room.subscribe(state => {
      if (state.phase === 'carousel' && state.carousel) {
        if (opened.at(-1) !== state.roundId) {
          opened.push(state.roundId); participants = state.carousel.state.releaseOrder; fightsSinceCarousel = 0;
          firstOpen ??= state;
        }
        for (const seatId of participants) {
          if (!state.seats.find(candidate => candidate.seatId === seatId)!.alive) overlaps.push(`${state.roundId}:${seatId}`);
        }
      }
      if (previousPhase === 'carousel' && state.phase !== 'carousel') { reservationsAfterClose.push(state.pool.carouselReservations.length); firstClosed ??= state; }
      if (state.phase === 'battle' && lastFight !== state.roundId) { lastFight = state.roundId; fightsSinceCarousel++; }
      previousPhase = state.phase;
      if (state.seats.find(candidate => candidate.seatId === 's0')!.alive) { beforeDeath = state; return; }
      death ??= { state, afterCarousel: opened.at(-1)!, fightsSinceCarousel };
    });
    room.start();
    // s0 stays connected and retains the timeout carousel picks through 5-4. From 5-5 it sells the older picks,
    // keeping the latest pick for the elimination/pool-return assertion. s1–s3 use takeover picks.
    for (const seatId of ['s1', 's2', 's3']) { room.setConnected(seatId, false); expect(room.takeOver(seatId)).toBe(true); }
    const prepared = new Set<string>();
    for (let fired = 0; fired < 200_000 && room.state.phase !== 'ended'; fired++) {
      if (room.state.phase === 'preparation' && seat('s0').alive && !prepared.has(room.state.roundId)) {
        prepared.add(room.state.roundId);
        const receipts = seat('s0').match.carousel!.receipts;
        const picks = new Set((room.state.roundId >= '5-5' ? receipts.slice(-1) : receipts).map(receipt => receipt.unitId));
        for (const unit of unitsOf(room, 's0').filter(candidate => !picks.has(candidate.id))) expect(room.handle('s0', { type: 'sell', unitId: unit.id }).ok).toBe(true);
      }
      if (!clock.runNext()) break;
    }
  }, 120_000);

  it('2-4 releases lowest HP first, replaces the component supply, settles the round once and the match plays to its end', () => {
    const open = firstOpen!;
    expect(open.roundId).toBe('2-4');
    expect(open.seats.every(candidate => !candidate.alive || candidate.match.pendingChoice === null)).toBe(true);
    const alive = open.seats.filter(candidate => candidate.alive);
    expect(open.carousel!.state.releaseOrder).toEqual([...alive].sort((a, b) => a.hp - b.hp || a.index - b.index).map(candidate => candidate.seatId));
    const closed = firstClosed!;
    expect(closed.fault).toBeNull();
    for (const before of alive) {
      const after = closed.seats.find(candidate => candidate.seatId === before.seatId)!;
      expect(after.match.roundResults.length).toBe(before.match.roundResults.length + 1);
      expect(after.match.roundResults.at(-1)!.roundId).toBe('2-4');
      expect(after.match.carousel!.receipts.map(receipt => receipt.carouselId.split(':').at(-1))).toEqual(['2-4']);
    }
    assertSharedPoolConservation(closed.pool, closed.seats.map(candidate => candidate.match));
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toBeNull();
    expect(room.state.ranking).toHaveLength(8);
  });

  it('no carousel participant is eliminated while its carousel is open, and every closed carousel leaves no reservation', () => {
    expect(opened).toEqual(['2-4', '3-4', '4-4', '5-4', '6-4']);
    expect(overlaps).toEqual([]);
    expect(reservationsAfterClose).toEqual(opened.map(() => 0));
    // Not vacuous: seats did die over the match, every one of them at a settlement after some carousel.
    expect(room.state.seats.filter(candidate => !candidate.alive).length).toBeGreaterThan(0);
  });

  it('a seat eliminated at the first fight after a carousel, still holding that pick, returns its holdings to the pool', () => {
    expect(death).not.toBeNull();
    const { state: atDeath, afterCarousel } = death!;
    // Seed 42: s0 dies at 5-6, two fights after the 5-4 carousel. Only this line names the round; a content or rules change that
    // moves the death fails here, and the rest follows from what the match recorded.
    expect(atDeath.roundId).toBe('5-6');
    expect(death!.fightsSinceCarousel).toBe(2);
    const was = beforeDeath.seats.find(candidate => candidate.seatId === 's0')!.match;
    // One granted receipt per carousel opened so far, the latest from the carousel just before the death.
    expect(was.carousel!.receipts.map(receipt => receipt.carouselId.split(':').at(-1))).toEqual(opened.slice(0, opened.indexOf(afterCarousel) + 1));
    expect(was.carousel!.receipts.every(receipt => receipt.status === 'granted')).toBe(true);
    // The latest pick is still s0's (one copy, never merged), and the pool counts it as s0's holding.
    const latest = was.carousel!.receipts.at(-1)!;
    expect(was.preparation.units.some(unit => unit.id === latest.unitId)).toBe(true);
    expect(beforeDeath.pool.holdings.some(holding => holding.seatId === 's0' && holding.unitId === latest.unitId)).toBe(true);
    expect(atDeath.fault).toBeNull();
    for (const after of [atDeath, room.state]) {
      expect(after.pool.seats.find(candidate => candidate.seatId === 's0')!.released).toBe(true);
      expect(after.pool.holdings.filter(holding => holding.seatId === 's0')).toEqual([]);
      assertSharedPoolConservation(after.pool, after.seats.map(candidate => candidate.match));
    }
  });
});

describe('carousel-pick on the wire', () => {
  it('accepts carousel-pick (protocol 3) with exactly carouselId, revision and a non-negative slot', () => {
    const envelope = (command: unknown) => JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 1, type: 'command', roomId: 'r', round: 1, seatRevision: 0, command });
    expect(NET_PROTOCOL_VERSION).toBe(3);
    const ok = { type: 'carousel-pick', carouselId: 'pool:carousel:2-4', revision: 3, slot: 2 };
    expect(parseClientMessage(envelope(ok))).toMatchObject({ ok: true, message: { command: ok } });
    expect(parseClientMessage(envelope({ ...ok, slot: -1 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(envelope({ ...ok, seatId: 's1' }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(envelope({ type: 'carousel-pick', slot: 1 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    // A protocol 2 client is told which version to speak instead of meeting an unknown command later.
    expect(parseClientMessage(JSON.stringify({ protocolVersion: 2, commandId: 1, type: 'command', roomId: 'r', round: 1, seatRevision: 0, command: ok })))
      .toMatchObject({ ok: false, code: 'unsupported-protocol', detail: 'protocolVersion must be 3' });
  });
});
