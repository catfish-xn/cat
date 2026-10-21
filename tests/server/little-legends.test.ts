import { afterEach, describe, expect, it } from 'vitest';
import { NET_PROTOCOL_VERSION, parseClientMessage } from '../../src/server/net/messages';
import { ManualClock } from '../../src/server/room/clock';
import { Lobby } from '../../src/server/room/lobby';
import { toSeatPublic } from '../../src/server/room/projection';
import { ROOM_DEFAULT_LEGEND, ROOM_LITTLE_LEGENDS } from '../../src/server/protocol';
import { DamageResolver, TIMINGS } from './helpers';
import { expectOk, startServer, type NetHarness } from './net/helpers';

/** Little legends are cosmetic: a join may name one, the room publishes it in SeatPublic, nothing else reads it. */
const join = (extra: Record<string, unknown>) => parseClientMessage(JSON.stringify({ type: 'join', protocolVersion: NET_PROTOCOL_VERSION, commandId: 3, name: '甲', ...extra }));
const makeLobby = () => new Lobby({ clock: new ManualClock(), resolver: new DamageResolver(() => 0), seed: 42, timings: TIMINGS, queueTimeoutMs: null });

describe('little legends: join field', () => {
  it('keeps a listed legend, turns an unknown one into the default and omits a missing one', () => {
    expect(join({ legend: ROOM_LITTLE_LEGENDS[1] })).toMatchObject({ ok: true, message: { legend: ROOM_LITTLE_LEGENDS[1] } });
    expect(join({ legend: 'not-a-legend' })).toMatchObject({ ok: true, message: { legend: ROOM_DEFAULT_LEGEND } });
    const plain = join({});
    expect(plain.ok && 'legend' in plain.message).toBe(false);
  });
  it('refuses a legend that is not a short string', () => {
    expect(join({ legend: 3 })).toMatchObject({ ok: false, code: 'invalid-message' });
    expect(join({ legend: 'x'.repeat(33) })).toMatchObject({ ok: false, code: 'invalid-message' });
  });
});

describe('little legends: room seats', () => {
  it('seats a human with the legend it joined with, the default without one, and fill-in bots with the others', () => {
    const lobby = makeLobby();
    const picked = ROOM_LITTLE_LEGENDS.at(-1)!;
    const a = lobby.join('甲', picked), b = lobby.join('乙');
    if (!a.ok || !b.ok) throw new Error('join');
    const started = lobby.start();
    if (!started.ok) throw new Error('start');
    const seats = started.room.state.seats;
    expect(seats.find(seat => seat.seatId === a.seatId)!.legend).toBe(picked);
    expect(seats.find(seat => seat.seatId === b.seatId)!.legend).toBe(ROOM_DEFAULT_LEGEND);
    const bots = seats.filter(seat => seat.kind === 'bot');
    expect(bots.length).toBeGreaterThan(0);
    for (const bot of bots) {
      expect(ROOM_LITTLE_LEGENDS).toContain(bot.legend);
      expect(bot.legend).not.toBe(ROOM_DEFAULT_LEGEND);
    }
    expect(new Set(bots.map(bot => bot.legend)).size).toBe(Math.min(bots.length, ROOM_LITTLE_LEGENDS.length - 1));
    for (const seat of seats) expect(toSeatPublic(seat).legend).toBe(seat.legend);
  });
});

describe('little legends: over the wire', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });
  it('shows every seat the legend another player picked', async () => {
    harness = await startServer();
    const a = await harness.connect(), b = await harness.connect();
    const picked = ROOM_LITTLE_LEGENDS[2]!;
    const joinedA = await a.join('甲', picked), joinedB = await b.join('乙', 'something-newer');
    expectOk(joinedA); expectOk(joinedB);
    expectOk(await a.start());
    const seatA = joinedA.ok && joinedA.result.kind === 'joined' ? joinedA.result.seatId : '';
    const seatB = joinedB.ok && joinedB.result.kind === 'joined' ? joinedB.result.seatId : '';
    const view = await b.waitForView(next => next.seats.length > 0);
    expect(view.seats.find(seat => seat.seatId === seatA)?.legend).toBe(picked);
    expect(view.seats.find(seat => seat.seatId === seatB)?.legend).toBe(ROOM_DEFAULT_LEGEND);
  });
});
