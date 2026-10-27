import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { createGameServer, type GameServer } from '../../../src/server/net/server';
import { ManualClock } from '../../../src/server/room/clock';
import type { RoomState } from '../../../src/server/room/types';
import type { MatchEvent } from '../../../src/server-entry';
import { TIMINGS } from '../helpers';
import { Socket } from './settlement-queue-harness';

// Transport-only fixtures: actual parse/auth/resume/publication, with no listening socket.
// Real combat, payment and save round trips are covered by batch5-survivor-room.test.ts.
const transport = vi.hoisted(() => ({ connect: null as ((socket: EventEmitter) => void) | null }));
vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events');
  return { WebSocketServer: class extends EventEmitter {
    override on(event: string, listener: (...args: unknown[]) => void): this {
      if (event === 'connection') { transport.connect = listener; return this; }
      return super.on(event, listener);
    }
    close(cb?: () => void) { cb?.(); }
  } };
});
vi.mock('node:http', async () => {
  const { EventEmitter } = await import('node:events');
  return { createServer: () => Object.assign(new EventEmitter(), {
    listen(_port: number, _host: string, ready: () => void) { ready(); },
    address: () => ({ port: 12345 }), close: (cb: () => void) => cb(), closeIdleConnections() {},
  }) };
});
let server: GameServer | undefined;
afterEach(async () => { await server?.close(); server = undefined; });
const grant: MatchEvent = { type: 'mechanicGranted', domain: 'match', eventSeq: 123,
  receipt: { receiptId: '["augment-pool-batch5-h4-survivor","round:2-1:augment"]', source: 'augment-pool-batch5-h4-survivor',
    kind: 'gold', amount: 60, round: 24, roundId: '4-7' } };
const unrelated: MatchEvent = { type: 'mechanicFailed', domain: 'match', eventSeq: 124, hook: 'rewards', reason: 'bench-full' };
const events = (socket: Socket) => socket.messages.flatMap(m => m.type === 'state' ? m.events ?? [] : []);
const grants = (socket: Socket) => events(socket).filter(e => e.type === 'mechanicGranted');

async function setup(socket = new Socket()) {
  const clock = new ManualClock();
  server = await createGameServer({ port: 0, clock, seed: 8, roomId: 'survivor-push', timings: TIMINGS, logger: () => {} });
  transport.connect!(socket);
  socket.receive({ type: 'join', commandId: 1, name: 'holder' });
  const joined = socket.messages.find(m => m.type === 'receipt' && m.ok && m.result.kind === 'joined');
  if (joined?.type !== 'receipt' || !joined.ok || joined.result.kind !== 'joined') throw new Error('missing seat credential');
  const { seatId, token } = joined.result;
  socket.receive({ type: 'start', commandId: 2 });
  const room = server.room!, holder = room as unknown as { current: RoomState };
  function publish() {
    // Supply a completed event envelope only; this test does not fabricate a combat/payment.
    holder.current = { ...room.state, seats: room.state.seats.map(s => s.seatId === seatId ? {
      ...s, seatRevision: s.seatRevision + 1,
      serverEvents: { seatRevision: s.seatRevision + 1, events: [grant, grant, unrelated] },
    } : s) };
    const seat = room.state.seats.find(s => s.seatId === seatId)!;
    room.setConnected(seatId, !seat.connected);
  }
  function resume() {
    const replacement = new Socket(); transport.connect!(replacement);
    replacement.receive({ type: 'resume', commandId: 90, token });
    expect(replacement.messages.find(m => m.type === 'receipt' && m.commandId === 90)).toMatchObject({ ok: true });
    return replacement;
  }
  return { room, seatId, publish, resume };
}

it('dedupes by receipt across duplicate entries, republished revisions and resumed connections', async () => {
  const socket = new Socket(), { room, seatId, publish, resume } = await setup(socket);
  publish();
  expect(grants(socket)).toEqual([grant]);
  expect(events(socket)).toContainEqual(unrelated);
  const before = room.state.seats.find(s => s.seatId === seatId)!.match;
  publish();
  expect(grants(socket)).toEqual([grant]);
  socket.close();
  const replacement = resume();
  expect(grants(replacement)).toEqual([]);
  expect(events(replacement)).toContainEqual(unrelated);
  expect(replacement.messages.some(m => m.type === 'state')).toBe(true);
  replacement.close();
  expect(grants(resume())).toEqual([]);
  expect(room.state.seats.find(s => s.seatId === seatId)!.match).toBe(before);
});

it('delivers a previously unseen receipt once after disconnect, then never replays it on resume', async () => {
  const socket = new Socket(), { publish, resume } = await setup(socket);
  socket.close(); publish();
  expect(grants(socket)).toEqual([]);
  const replacement = resume();
  expect(grants(replacement)).toEqual([grant]);
  replacement.close();
  expect(grants(resume())).toEqual([]);
});

it('does not mark a failed state send as delivered', async () => {
  class FailingSocket extends Socket {
    failState = false;
    override send(text: string) {
      if (this.failState && JSON.parse(text).type === 'state') throw new Error('injected send failure');
      super.send(text);
    }
    terminate() { this.close(); }
  }
  const socket = new FailingSocket(), { publish, resume } = await setup(socket);
  socket.failState = true; publish();
  expect(grants(socket)).toEqual([]);
  const replacement = resume();
  expect(grants(replacement)).toEqual([grant]);
  replacement.close();
  expect(grants(resume())).toEqual([]);
});
