import { describe, expect, it } from 'vitest';
import { assertSharedPoolConservation } from '../../src/server-entry';
import { CAROUSEL_RULES_BINDING, type CarouselRules } from '../../src/server/room/carousel';
import { CAROUSEL_DEPARTURE_MS, type Room } from '../../src/server/room/room';
import { toPlayerView } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { parseClientMessage, NET_PROTOCOL_VERSION } from '../../src/server/net/messages';
import { ManualClock, type Clock } from '../../src/server/room/clock';
import { DamageResolver, makeRoom, runUntil } from './helpers';

// The real P7 rules (MULTIPLAYER_CONTRACT §21.4): batches of two by HP then seat index, first batch at 6 s, one batch every
// 6 s, 6 s tail; eight seats: releases at 6/6/12/12/18/18/24/24 s, deadline 30 s, then the room's 2 s departure.
const rules = CAROUSEL_RULES_BINDING;
const pick = (room: Room, seatId: string, slot: number, override: { carouselId?: string; revision?: number } = {}) => {
  const carousel = room.state.carousel!.state;
  return room.handle(seatId, { type: 'carousel-pick', carouselId: override.carouselId ?? carousel.id, revision: override.revision ?? carousel.revision, slot });
};
const playerUnits = (room: Room, seatId: string) => room.state.seats.find(seat => seat.seatId === seatId)!.match.preparation.units.filter(unit => unit.team === 'player');
const conserved = (room: Room) => assertSharedPoolConservation(room.state.pool, room.state.seats.map(seat => seat.match));

describe('G1-P7 carousel phase in the room, bound to the rules (MULTIPLAYER_CONTRACT §21)', () => {
  it('opens the match with the 1-1 carousel on createCarouselMatch seats: no free unit, no gold, no component, no shop', () => {
    const { room } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    for (const seat of room.state.seats) {
      expect(seat.match.carousel).toMatchObject({ openingPending: true, receipts: [], pendingUnits: [] });
      expect(seat.match.preparation.units.filter(unit => unit.team === 'player')).toEqual([]);
      expect(seat.match).toMatchObject({ gold: 0, items: [] });
      expect(seat.match.shop.generation).toBe(0);
    }
    room.start();
    expect(room.state.phase).toBe('carousel');
    expect(room.state.roundId).toBe('1-2');
    const carousel = room.state.carousel!.state;
    expect(carousel).toMatchObject({ roundId: '1-1', status: 'open', deadlineMs: 30_000, releaseOrder: ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'] });
    expect(carousel.releaseAtMs).toEqual({ s0: 6_000, s1: 6_000, s2: 12_000, s3: 12_000, s4: 18_000, s5: 18_000, s6: 24_000, s7: 24_000 });
    expect(room.state.deadlineAt).toBe(30_000 + CAROUSEL_DEPARTURE_MS);
    // One publication: the pool the carousel reserved its nine cards on is the room's pool; the room rng moved past the draw.
    expect(room.state.pool).toBe(carousel.pool);
    expect(room.state.rngState).toBe(carousel.rngAfter.state);
    expect(room.state.carouselLedger).toEqual([{ carouselId: carousel.id, seatId: null, events: [{ type: 'carousel-created', carouselId: carousel.id, roundId: '1-1' }] }]);
    conserved(room);
  });

  it('runs on the rules\' release times, auto-picks bots on release and the rest at the deadline, then deals the first shop', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    // Preparation commands wait; before its release the rules lock the seat; a stale carousel revision is the room's refusal.
    expect(room.handle('s0', { type: 'reroll' })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    let before = room.state;
    expect(pick(room, 's0', 4)).toMatchObject({ ok: false, reason: 'seat-locked' });
    expect(room.state).toBe(before);
    clock.advance(6_000);
    expect(room.state.carousel!.state.elapsedMs).toBe(6_000);
    before = room.state;
    expect(pick(room, 's0', 4, { revision: before.carousel!.state.revision - 1 })).toMatchObject({ ok: false, reason: 'stale-carousel' });
    expect(pick(room, 's0', 4, { carouselId: 'other' })).toMatchObject({ ok: false, reason: 'stale-carousel' });
    expect(room.state).toBe(before);
    const slot4 = before.carousel!.state.slots[4]!;
    const picked = pick(room, 's0', 4);
    expect(picked).toMatchObject({ ok: true, seatRevision: 1 });
    // The pick and its grant are one transaction: unit, item, pool, carousel and the returned events published together.
    expect(playerUnits(room, 's0').map(unit => unit.definitionId)).toEqual([slot4.definitionId]);
    const s0 = room.state.seats.find(seat => seat.seatId === 's0')!;
    expect(s0.match.items.map(item => item.definitionId)).toEqual([slot4.itemId]);
    expect(s0.match.gold).toBe(0);
    expect(s0.serverEvents?.events.some(event => event.type === 'carouselGranted')).toBe(true);
    expect(room.state.pool).toBe(room.state.carousel!.state.pool);
    expect(room.state.carouselLedger.at(-1)!.seatId).toBe('s0');
    expect(room.state.carouselLedger.at(-1)!.events.map(event => event.type)).toEqual(['carousel-picked', 'carouselGranted']);
    conserved(room);
    before = room.state;
    const revision = before.carousel!.state.revision;
    expect(pick(room, 's1', 4)).toMatchObject({ ok: false, reason: 'slot-taken' });
    expect(pick(room, 's0', 5)).toMatchObject({ ok: false, reason: 'already-picked' });
    expect(pick(room, 's1', 9, { revision })).toMatchObject({ ok: false, reason: 'invalid-slot' });
    expect(room.state).toBe(before);
    // Views: the same public part for everyone; eligible/pickedSlot/receiptId are per seat; no rules internals.
    const view = (seatId: string) => toPlayerView(room.state, seatId, clock.now());
    expect(view('s0').phase).toMatchObject({ kind: 'carousel', round: 1, roundName: '1-1' });
    expect(view('s0').carousel).toMatchObject({ roundId: '1-1', eligible: false, pickedSlot: 4, receiptId: `${room.state.carousel!.state.id}:s0`, startedAt: 0, deadlineMs: 30_000, autoPicked: [] });
    expect(view('s1').carousel).toMatchObject({ eligible: true, pickedSlot: null, receiptId: null });
    expect(view('s2').carousel).toMatchObject({ eligible: false, pickedSlot: null });
    expect(view('s2').carousel!.slots[4]).toEqual({ slot: 4, definitionId: slot4.definitionId, starLevel: 1, items: [slot4.itemId], pickedBy: 's0' });
    expect(Object.keys(view('s2').carousel!).sort()).toEqual(['autoPicked', 'deadlineMs', 'elapsedMs', 'eligible', 'id', 'pickedSlot', 'receiptId', 'releaseAtMs', 'releaseOrder', 'revision', 'roundId', 'roundName', 'slots', 'startedAt', 'status']);
    // Bots pick when the rules release them; connected players keep their choice until the deadline.
    clock.advance(12_000);
    expect(room.state.carousel!.auto).toEqual({ s4: 'bot', s5: 'bot' });
    clock.advance(6_000);
    expect(room.state.carousel!.auto).toEqual({ s4: 'bot', s5: 'bot', s6: 'bot', s7: 'bot' });
    expect(room.state.carousel!.state.status).toBe('open');
    clock.advance(6_000);
    expect(room.state.carousel!.auto).toEqual({ s4: 'bot', s5: 'bot', s6: 'bot', s7: 'bot', s1: 'timeout', s2: 'timeout', s3: 'timeout' });
    expect(room.state.carousel!.state.status).toBe('closed');
    expect(view('s1').carousel!.autoPicked).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7']);
    // A late pick meets the closed carousel; the phase holds through the departure, then the round goes on.
    expect(room.state.phase).toBe('carousel');
    expect(pick(room, 's1', 8)).toMatchObject({ ok: false, reason: 'carousel-closed' });
    clock.advance(CAROUSEL_DEPARTURE_MS - 1);
    expect(room.state.phase).toBe('carousel');
    clock.advance(1);
    expect(room.state.phase).toBe('preparation');
    expect(room.state.carousel).toBeNull();
    expect(toPlayerView(room.state, 's0', clock.now()).carousel).toBeNull();
    // The match-long ledger keeps every event of the carousel after its phase: creation, eight picks and grants, the close.
    const logged = room.state.carouselLedger.flatMap(entry => entry.events.map(event => event.type));
    expect(logged.filter(type => type === 'carousel-picked')).toHaveLength(8);
    expect(logged.filter(type => type === 'carouselGranted')).toHaveLength(8);
    expect(logged.filter(type => type === 'carousel-created' || type === 'carousel-closed')).toEqual(['carousel-created', 'carousel-closed']);
    for (const seat of room.state.seats) {
      expect(seat.match.preparation.units.filter(unit => unit.team === 'player')).toHaveLength(1);
      expect(seat.match.items).toHaveLength(1);
      expect(seat.match.carousel!.openingPending).toBe(false);
      expect(seat.match.shop.generation).toBeGreaterThan(0);
      expect(seat.match.xp).toBe(0);
    }
    conserved(room);
  });

  it('a disconnected player is picked for at the deadline (not on release) and resumes onto the same carousel', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    room.setConnected('s3', false);
    const id = room.state.carousel!.state.id;
    clock.advance(12_000);
    expect(room.state.carousel!.state.receipts.some(receipt => receipt.seatId === 's3')).toBe(false);
    room.setConnected('s3', true);
    expect(toPlayerView(room.state, 's3', clock.now()).carousel).toMatchObject({ id, eligible: true, pickedSlot: null });
    room.setConnected('s3', false);
    clock.advance(18_000);
    expect(room.state.carousel!.auto.s3).toBe('disconnected');
    room.setConnected('s3', true);
    const slot = room.state.carousel!.state.receipts.find(receipt => receipt.seatId === 's3')!.slot;
    expect(toPlayerView(room.state, 's3', clock.now()).carousel).toMatchObject({ id, eligible: false, pickedSlot: slot, autoPicked: expect.arrayContaining(['s3']) });
    expect(playerUnits(room, 's3')).toHaveLength(1);
  });

  it('a timer firing early, with time passing during the catch-up, never skips a release batch (real clocks do both)', () => {
    const inner = new ManualClock();
    let reads = 0, inTimer = false;
    const clock: Clock = {
      now: () => inner.now() + (inTimer && reads++ > 0 ? 1 : 0),
      schedule: (at, fn) => inner.schedule(at - 1 > inner.now() ? at - 1 : at, () => { reads = 0; inTimer = true; try { fn(); } finally { inTimer = false; } }),
      cancel: handle => inner.cancel(handle),
    };
    const { room } = makeRoom(new DamageResolver(() => 0), { carousel: rules, clock });
    room.start();
    inner.advance(18_000);
    expect(room.state.carousel!.state.elapsedMs).toBe(18_000);
    expect(room.state.carousel!.auto).toEqual({ s4: 'bot', s5: 'bot' });
    inner.advance(6_000);
    expect(room.state.carousel!.auto).toEqual({ s4: 'bot', s5: 'bot', s6: 'bot', s7: 'bot' });
    inner.advance(6_000 + CAROUSEL_DEPARTURE_MS);
    expect(room.state.phase).toBe('preparation');
  });

  it('option B: stays until the deadline and departure after every seat holds a unit', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    clock.advance(6_000); expect(pick(room, 's0', 0).ok).toBe(true); expect(pick(room, 's1', 1).ok).toBe(true);
    clock.advance(6_000); expect(pick(room, 's2', 2).ok).toBe(true); expect(pick(room, 's3', 3).ok).toBe(true);
    clock.advance(12_000); // the bots are out and picked for: everyone holds a unit, the rules keep it open to the deadline
    expect(room.state.carousel!.state.receipts).toHaveLength(8);
    expect(room.state.carousel!.state.status).toBe('open');
    clock.advance(6_000);
    expect(room.state.carousel!.state.status).toBe('closed');
    expect(room.state.phase).toBe('carousel');
    clock.advance(CAROUSEL_DEPARTURE_MS - 1);
    expect(room.state.phase).toBe('carousel');
    clock.advance(1);
    expect(room.state.phase).toBe('preparation');
  });

  it('2-4 releases lowest HP first, replaces the component supply, settles the round once and the match plays to its end', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { carousel: rules });
    room.start();
    // A bot takes every human seat over, so all eight seats are picked for the moment they are released.
    for (const seatId of ['s0', 's1', 's2', 's3']) { room.setConnected(seatId, false); expect(room.takeOver(seatId)).toBe(true); }
    runUntil(room, clock, current => current.phase !== 'carousel');
    const state = runUntil(room, clock, current => current.phase === 'carousel', 20_000);
    expect(state.roundId).toBe('2-4');
    expect(state.seats.every(seat => !seat.alive || seat.match.pendingChoice === null)).toBe(true);
    const alive = state.seats.filter(seat => seat.alive);
    const expected = [...alive].sort((a, b) => a.hp - b.hp || a.index - b.index).map(seat => seat.seatId);
    expect(state.carousel!.state.releaseOrder).toEqual(expected);
    const resultsBefore = new Map(alive.map(seat => [seat.seatId, seat.match.roundResults.length]));
    runUntil(room, clock, current => current.phase !== 'carousel');
    expect(room.state.fault).toBeNull();
    for (const seat of room.state.seats.filter(candidate => candidate.alive)) {
      expect(seat.match.roundResults.length).toBe(resultsBefore.get(seat.seatId)! + 1);
      expect(seat.match.roundResults.at(-1)!.roundId).toBe('2-4');
      expect(seat.match.carousel!.receipts.map(receipt => receipt.carouselId.split(':').at(-1))).toEqual(['1-1', '2-4']);
    }
    // x-4 completion (the supply round's settlement) is in the ledger once per alive seat.
    const completions = room.state.carouselLedger.filter(entry => entry.carouselId.endsWith(':carousel:2-4') && entry.events.some(event => event.type === 'roundSettled'));
    expect(completions.map(entry => entry.seatId).sort()).toEqual(room.state.seats.filter(seat => seat.alive).map(seat => seat.seatId).sort());
    conserved(room);
    const ended = runUntil(room, clock, current => current.phase === 'ended', 200_000);
    expect(ended.fault).toBeNull();
    expect(ended.ranking).toHaveLength(8);
  }, 120_000);

  it('faults the room when the rules refuse to open the carousel', () => {
    const refusing: CarouselRules = { ...rules, createCarousel: (pool, _roundId, rng) => ({ ok: false, pool, rng, reason: 'pool-exhausted', events: [] }) };
    const { room } = makeRoom(new DamageResolver(() => 0), { carousel: refusing });
    room.start();
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toEqual({ kind: 'carousel-error', reason: 'create:pool-exhausted' });
    expect(toPlayerView(room.state, 's0', 0).fault?.kind).toBe('carousel-error');
  });

  it('accepts carousel-pick on the wire (protocol 3) with exactly carouselId, revision and a non-negative slot', () => {
    const envelope = (command: unknown) => JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 1, type: 'command', roomId: 'r', round: 1, seatRevision: 0, command });
    expect(NET_PROTOCOL_VERSION).toBe(3);
    const ok = { type: 'carousel-pick', carouselId: 'pool:carousel:1-1', revision: 3, slot: 2 };
    expect(parseClientMessage(envelope(ok))).toMatchObject({ ok: true, message: { command: ok } });
    expect(parseClientMessage(envelope({ ...ok, slot: -1 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(envelope({ ...ok, seatId: 's1' }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(envelope({ type: 'carousel-pick', slot: 1 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    // A protocol 2 client is told which version to speak instead of meeting an unknown command later.
    expect(parseClientMessage(JSON.stringify({ protocolVersion: 2, commandId: 1, type: 'command', roomId: 'r', round: 1, seatRevision: 0, command: ok })))
      .toMatchObject({ ok: false, code: 'unsupported-protocol', detail: 'protocolVersion must be 3' });
  });
});
