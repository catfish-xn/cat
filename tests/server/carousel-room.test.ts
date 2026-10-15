import { describe, expect, it } from 'vitest';
import { planCarouselBatches } from '../../src/server/room/carousel';
import { toPlayerView } from '../../src/server/room/projection';
import { parseClientMessage, NET_PROTOCOL_VERSION } from '../../src/server/net/messages';
import { fakeCarousel } from './carousel-fake';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { DamageResolver, makeRoom, runUntil } from './helpers';

const SCHEDULE = { firstBatchMs: 0, batchIntervalMs: 1_000, tailMs: 2_000 };

describe('G1-P7 carousel release plan', () => {
  it('orders by authoritative HP ascending, seat index on a tie, in pairs', () => {
    const seats = [{ seatId: 'a', index: 0, hp: 50 }, { seatId: 'b', index: 1, hp: 20 }, { seatId: 'c', index: 2, hp: 50 }, { seatId: 'd', index: 3, hp: 90 }, { seatId: 'e', index: 4, hp: 20 }];
    const plan = planCarouselBatches(seats, { firstBatchMs: 500, batchIntervalMs: 3_000, tailMs: 4_000 }, 10_000);
    expect(plan.batches).toEqual([
      { seatIds: ['b', 'e'], opensAt: 10_500 }, { seatIds: ['a', 'c'], opensAt: 13_500 }, { seatIds: ['d'], opensAt: 16_500 },
    ]);
    expect(plan.endsAt).toBe(20_500);
  });
});

describe('G1-P7 carousel phase in the room', () => {
  it('opens before the first preparation, gates picks by release and closes with automatic picks', () => {
    const { rules, log } = fakeCarousel(['1-2'], SCHEDULE);
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    let state = room.state;
    expect(state.phase).toBe('carousel');
    expect(state.carousel!.batches.map(batch => batch.seatIds)).toEqual([['s0', 's1'], ['s2', 's3'], ['s4', 's5'], ['s6', 's7']]);
    expect(state.carousel!.openBatches).toBe(1);
    expect(state.deadlineAt).toBe(3_000 + 2_000);
    // Preparation commands wait; a seat whose batch has not opened cannot pick yet.
    expect(room.handle('s0', { type: 'reroll' })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(room.handle('s2', { type: 'carouselPick', slot: 0 })).toMatchObject({ ok: false, reason: 'carousel-not-released' });
    expect(room.state).toBe(state);
    const picked = room.handle('s0', { type: 'carouselPick', slot: 4 });
    expect(picked).toMatchObject({ ok: true, seatRevision: 1 });
    expect(room.state.carousel!.picks).toEqual({ s0: 4 });
    // The rules refuse a taken slot and a second pick; nothing is published.
    state = room.state;
    expect(room.handle('s1', { type: 'carouselPick', slot: 4 })).toMatchObject({ ok: false, reason: 'carousel-slot-taken' });
    expect(room.handle('s0', { type: 'carouselPick', slot: 5 })).toMatchObject({ ok: false, reason: 'carousel-already-picked' });
    expect(room.state).toBe(state);
    // Views: everyone sees the same slots and takers; canPick/myPick are per seat.
    const v0 = toPlayerView(room.state, 's0', clock.now()), v1 = toPlayerView(room.state, 's1', clock.now()), v2 = toPlayerView(room.state, 's2', clock.now());
    expect(v0.phase.kind).toBe('carousel');
    expect(v0.carousel).toMatchObject({ canPick: false, myPick: 4, openBatches: 1 });
    expect(v1.carousel).toMatchObject({ canPick: true, myPick: null });
    expect(v2.carousel).toMatchObject({ canPick: false, myPick: null });
    expect(v2.carousel!.slots.find(slot => slot.slot === 4)!.pickedBy).toBe('s0');
    expect(JSON.stringify(v2)).not.toContain('"rules"');
    // Batches open on the clock; bot seats are picked for as soon as theirs opens.
    clock.advance(1_000); expect(room.state.carousel!.openBatches).toBe(2);
    clock.advance(1_000); expect(room.state.carousel!.openBatches).toBe(3);
    expect(log.filter(entry => entry.cause === 'bot').map(entry => entry.seatId)).toEqual(['s4', 's5']);
    clock.advance(1_000);
    expect(log.filter(entry => entry.cause === 'bot').map(entry => entry.seatId)).toEqual(['s4', 's5', 's6', 's7']);
    expect(room.state.phase).toBe('carousel');
    // The close picks for every connected player who did not choose, then the round goes on.
    clock.advance(2_000);
    expect(log.filter(entry => entry.cause === 'timeout').map(entry => entry.seatId)).toEqual(['s1', 's2', 's3']);
    expect(room.state.phase).toBe('preparation');
    expect(room.state.carousel).toBeNull();
    expect(toPlayerView(room.state, 's0', clock.now()).carousel).toBeNull();
    expect(new Set(log.map(entry => entry.slot)).size).toBe(8);
  });

  it('picks for a disconnected seat when its batch opens and keeps the carousel across a reconnect', () => {
    const { rules, log } = fakeCarousel(['1-2'], SCHEDULE);
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    room.setConnected('s3', false);
    const before = toPlayerView(room.state, 's2', clock.now()).carousel;
    clock.advance(1_000);
    expect(log).toEqual([{ seatId: 's3', slot: 0, cause: 'disconnected' }]);
    room.setConnected('s3', true);
    // The resumed seat's view is rebuilt from the room state: same carousel, its unit already taken.
    const resumed = toPlayerView(room.state, 's3', clock.now()).carousel!;
    expect(resumed.carouselId).toBe(before!.carouselId);
    expect(resumed).toMatchObject({ myPick: 0, canPick: false, openBatches: 2 });
  });

  it('stays open until its deadline after every seat holds a unit (option B)', () => {
    const { rules } = fakeCarousel(['1-2'], { firstBatchMs: 0, batchIntervalMs: 1_000, tailMs: 5_000 });
    const { room, clock } = makeRoom(new DamageResolver(() => 0), { carousel: rules });
    room.start();
    expect(room.handle('s0', { type: 'carouselPick', slot: 4 }).ok).toBe(true);
    expect(room.handle('s1', { type: 'carouselPick', slot: 5 }).ok).toBe(true);
    clock.advance(1_000);
    expect(room.handle('s2', { type: 'carouselPick', slot: 6 }).ok).toBe(true);
    expect(room.handle('s3', { type: 'carouselPick', slot: 7 }).ok).toBe(true);
    clock.advance(2_000); // the last pair (bots) is out and picked for: everyone holds a unit
    expect(Object.keys(room.state.carousel!.picks)).toHaveLength(8);
    expect(room.state.carousel!.openBatches).toBe(4);
    expect(room.state.phase).toBe('carousel');
    clock.advance(4_999);
    expect(room.state.phase).toBe('carousel');
    clock.advance(1);
    expect(room.state.phase).toBe('preparation');
  });

  it('releases a later carousel lowest HP first, after the round it opens', () => {
    const { rules, log } = fakeCarousel(['2-4'], SCHEDULE);
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { carousel: rules });
    room.start();
    // Every seat is unattended, so each one is picked for the moment its batch opens: the log is the release order.
    for (const seatId of ['s0', 's1', 's2', 's3']) room.setConnected(seatId, false);
    const state = runUntil(room, clock, current => current.phase === 'carousel');
    expect(state.roundId).toBe('2-4');
    const expected = state.seats.filter(seat => seat.alive).sort((a, b) => a.hp - b.hp || a.index - b.index).map(seat => seat.seatId);
    expect(new Set(state.seats.map(seat => seat.hp)).size).toBeGreaterThan(1);
    expect(state.carousel!.batches.flatMap(batch => batch.seatIds)).toEqual(expected);
    runUntil(room, clock, current => current.phase !== 'carousel');
    expect(log.map(entry => entry.seatId)).toEqual(expected);
    expect(room.state.fault).toBeNull();
    expect(room.state.roundId).toBe('2-4');
  });

  it('faults the room when the rules refuse to open the carousel', () => {
    const { rules } = fakeCarousel(['1-2']);
    const { room } = makeRoom(new DamageResolver(() => 0), { carousel: { ...rules, create: () => ({ ok: false, reason: 'carousel-closed' }) } });
    room.start();
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toEqual({ kind: 'carousel-error', reason: 'carousel-closed' });
    expect(toPlayerView(room.state, 's0', 0).fault?.kind).toBe('carousel-error');
  });

  it('accepts carouselPick on the wire (protocol 3) with exactly a non-negative slot', () => {
    const envelope = (command: unknown) => JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 1, type: 'command', roomId: 'r', round: 1, seatRevision: 0, command });
    expect(NET_PROTOCOL_VERSION).toBe(3);
    expect(parseClientMessage(envelope({ type: 'carouselPick', slot: 2 }))).toMatchObject({ ok: true, message: { command: { type: 'carouselPick', slot: 2 } } });
    expect(parseClientMessage(envelope({ type: 'carouselPick', slot: -1 }))).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(parseClientMessage(envelope({ type: 'carouselPick', slot: 1, definitionId: 'irelia' }))).toMatchObject({ ok: false, code: 'invalid-message' });
  });
});
