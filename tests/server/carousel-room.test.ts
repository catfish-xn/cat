import { describe, expect, it } from 'vitest';
import { CAROUSEL_DEPARTURE_MS } from '../../src/server/room/room';
import { toPlayerView } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { parseClientMessage, NET_PROTOCOL_VERSION } from '../../src/server/net/messages';
import type { Room } from '../../src/server/room/room';
import { fakeCarousel } from './carousel-fake';
import { DamageResolver, makeRoom, runUntil } from './helpers';

// FAKE_TIMING: released at 1000/2000/3000/4000 ms in pairs (1-1: everyone at 1000), deadline 6000, then the departure.
const pick = (room: Room, seatId: string, slot: number, override: { carouselId?: string; revision?: number } = {}) => {
  const view = room.state.carousel!.view;
  return room.handle(seatId, { type: 'carousel-pick', carouselId: override.carouselId ?? view.id, revision: override.revision ?? view.revision, slot });
};

describe('G1-P7 carousel phase in the room (MULTIPLAYER_CONTRACT §21)', () => {
  it('runs on the rules\' release times, gates nothing itself, auto-picks bots on release and the rest at the deadline', () => {
    const { rules, log } = fakeCarousel({ '1-2': '3-4' });
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    expect(room.state.phase).toBe('carousel');
    expect(room.state.deadlineAt).toBe(6_000 + CAROUSEL_DEPARTURE_MS);
    expect(room.state.carousel!.view.releaseOrder).toEqual(['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']);
    // Preparation commands wait; before its release the rules lock the seat; a stale carousel revision is the room's refusal.
    expect(room.handle('s0', { type: 'reroll' })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    let before = room.state;
    expect(pick(room, 's0', 4)).toMatchObject({ ok: false, reason: 'seat-locked' });
    expect(room.state).toBe(before);
    clock.advance(1_000);
    expect(room.state.carousel!.view.elapsedMs).toBe(1_000);
    before = room.state;
    expect(pick(room, 's0', 4, { revision: before.carousel!.view.revision - 1 })).toMatchObject({ ok: false, reason: 'stale-carousel' });
    expect(pick(room, 's0', 4, { carouselId: 'other' })).toMatchObject({ ok: false, reason: 'stale-carousel' });
    expect(room.state).toBe(before);
    expect(pick(room, 's0', 4)).toMatchObject({ ok: true, seatRevision: 1 });
    before = room.state;
    expect(pick(room, 's1', 4)).toMatchObject({ ok: false, reason: 'slot-taken' });
    expect(pick(room, 's0', 5)).toMatchObject({ ok: false, reason: 'already-picked' });
    expect(room.state).toBe(before);
    // Views: the same public part for everyone; eligible/pickedSlot/receiptId are per seat; no rules internals.
    const view = (seatId: string) => toPlayerView(room.state, seatId, clock.now());
    expect(view('s0').phase.kind).toBe('carousel');
    expect(view('s0').carousel).toMatchObject({ eligible: false, pickedSlot: 4, receiptId: 'pool:carousel:3-4:s0', startedAt: 0, deadlineMs: 6_000 });
    expect(view('s1').carousel).toMatchObject({ eligible: true, pickedSlot: null, receiptId: null });
    expect(view('s2').carousel).toMatchObject({ eligible: false, pickedSlot: null });
    expect(view('s2').carousel!.slots.find(slot => slot.slot === 4)!.pickedBy).toBe('s0');
    expect(Object.keys(view('s2').carousel!).sort()).toEqual(['deadlineMs', 'elapsedMs', 'eligible', 'id', 'pickedSlot', 'receiptId', 'releaseAtMs', 'releaseOrder', 'revision', 'roundId', 'roundName', 'slots', 'startedAt', 'status']);
    // Bots pick when the rules release them; connected players keep their choice until the deadline.
    clock.advance(2_000);
    expect(log.filter(entry => entry.auto).map(entry => [entry.seatId, entry.elapsedMs])).toEqual([['s4', 3_000], ['s5', 3_000]]);
    clock.advance(1_000);
    expect(log.filter(entry => entry.auto).map(entry => entry.seatId)).toEqual(['s4', 's5', 's6', 's7']);
    clock.advance(2_000);
    expect(log.filter(entry => entry.auto && entry.elapsedMs === 6_000).map(entry => entry.seatId)).toEqual(['s1', 's2', 's3']);
    // A late pick meets the closed carousel; the phase holds through the departure, then the round goes on.
    expect(room.state.phase).toBe('carousel');
    expect(pick(room, 's1', 8)).toMatchObject({ ok: false, reason: 'carousel-closed' });
    clock.advance(CAROUSEL_DEPARTURE_MS - 1);
    expect(room.state.phase).toBe('carousel');
    clock.advance(1);
    expect(room.state.phase).toBe('preparation');
    expect(room.state.carousel).toBeNull();
    expect(toPlayerView(room.state, 's0', clock.now()).carousel).toBeNull();
    expect(new Set(log.map(entry => entry.slot)).size).toBe(8);
  });

  it('a disconnected player is picked for at the deadline and resumes onto the same carousel', () => {
    const { rules, log } = fakeCarousel({ '1-2': '3-4' });
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    room.setConnected('s3', false);
    const id = room.state.carousel!.view.id;
    clock.advance(2_000);
    expect(log.some(entry => entry.seatId === 's3')).toBe(false);
    room.setConnected('s3', true);
    expect(toPlayerView(room.state, 's3', clock.now()).carousel).toMatchObject({ id, eligible: true, pickedSlot: null });
    room.setConnected('s3', false);
    clock.advance(4_000);
    expect(log.find(entry => entry.seatId === 's3')).toMatchObject({ auto: true, elapsedMs: 6_000 });
    room.setConnected('s3', true);
    expect(toPlayerView(room.state, 's3', clock.now()).carousel).toMatchObject({ id, eligible: false, pickedSlot: log.find(entry => entry.seatId === 's3')!.slot });
  });

  it('option B: stays until the deadline and departure after every seat holds a unit', () => {
    const { rules } = fakeCarousel({ '1-2': '3-4' });
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    clock.advance(1_000); expect(pick(room, 's0', 4).ok).toBe(true); expect(pick(room, 's1', 5).ok).toBe(true);
    clock.advance(1_000); expect(pick(room, 's2', 6).ok).toBe(true); expect(pick(room, 's3', 7).ok).toBe(true);
    clock.advance(2_000); // the bots are out and picked for: everyone holds a unit, the rules closed the carousel
    expect(room.state.carousel!.view.status).toBe('closed');
    expect(room.state.phase).toBe('carousel');
    clock.advance(2_000 + CAROUSEL_DEPARTURE_MS - 1);
    expect(room.state.phase).toBe('carousel');
    clock.advance(1);
    expect(room.state.phase).toBe('preparation');
  });

  it('1-1 releases everyone at once (rules schedule) and the bots pick at that moment', () => {
    const { rules, log } = fakeCarousel({ '1-2': '1-1' });
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    expect(new Set(Object.values(room.state.carousel!.view.releaseAtMs))).toEqual(new Set([1_000]));
    clock.advance(1_000);
    expect(log.map(entry => entry.seatId)).toEqual(['s4', 's5', 's6', 's7']);
    for (const seatId of ['s0', 's1', 's2', 's3']) expect(toPlayerView(room.state, seatId, clock.now()).carousel!.eligible).toBe(true);
  });

  it('a later carousel releases lowest HP first; unattended seats pick in that order', () => {
    const { rules, log } = fakeCarousel({ '2-4': '2-4' });
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { carousel: rules });
    room.start();
    // A bot takes every human seat over, so all eight seats are picked for the moment they are released.
    for (const seatId of ['s0', 's1', 's2', 's3']) { room.setConnected(seatId, false); expect(room.takeOver(seatId)).toBe(true); }
    const state = runUntil(room, clock, current => current.phase === 'carousel');
    expect(state.roundId).toBe('2-4');
    const expected = state.seats.filter(seat => seat.alive).sort((a, b) => a.hp - b.hp || a.index - b.index).map(seat => seat.seatId);
    expect(new Set(state.seats.map(seat => seat.hp)).size).toBeGreaterThan(1);
    expect(state.carousel!.view.releaseOrder).toEqual(expected);
    runUntil(room, clock, current => current.phase !== 'carousel');
    expect(log.map(entry => entry.seatId)).toEqual(expected);
    expect(room.state.fault).toBeNull();
  });

  it('faults the room when the rules refuse to open the carousel', () => {
    const { rules } = fakeCarousel({ '1-2': '1-1' });
    const { room } = makeRoom(new DamageResolver(() => 0), { carousel: { ...rules, create: () => ({ ok: false, reason: 'pool-exhausted' }) } });
    room.start();
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toEqual({ kind: 'carousel-error', reason: 'pool-exhausted' });
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
  });
});
