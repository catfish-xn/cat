import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameServer, type GameServer } from '../../../src/server/net/server';
import { NET_PROTOCOL_VERSION, type ServerMessage } from '../../../src/server/net/messages';
import { ManualClock } from '../../../src/server/room/clock';
import type { Room } from '../../../src/server/room/room';
import { DamageResolver, TIMINGS } from '../helpers';

// Exercise the real parse/auth/dedupe/write queue with an in-memory transport; no listening port is required.
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
class Socket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  readonly messages: ServerMessage[] = [];
  send(text: string) { this.messages.push(JSON.parse(text) as ServerMessage); }
  close() { this.readyState = 3; this.emit('close'); }
  ping() {}
  receive(message: object) { this.emit('message', Buffer.from(JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, ...message })), false); }
}
type WorkSeam = { settlementWork: Generator<void, void, void> | null; runSettlementSlice(): void; clearTimer(): void };
let server: GameServer | null = null;
afterEach(async () => { await server?.close(); server = null; });

async function setup() {
  const clock = new ManualClock();
  server = await createGameServer({ port: 0, host: '127.0.0.1', clock, seed: 42, roomId: 'queue-test',
    timings: TIMINGS, resolver: new DamageResolver(() => 0), sliceTicks: 1, logger: () => {} });
  const socket = new Socket(); transport.connect!(socket);
  socket.receive({ type: 'join', name: 'human', commandId: 1 });
  socket.receive({ type: 'start', commandId: 2 });
  const room = server.room as Room, work = room as unknown as WorkSeam;
  work.clearTimer();
  work.settlementWork = (function* () { yield; yield; })();
  work.runSettlementSlice();
  const seat = room.state.seats.find(s => s.kind === 'human')!;
  const command = (commandId: number, locked: boolean, seatRevision: number) => socket.receive({ type: 'command',
    commandId, roomId: room.state.roomId, round: room.state.round, seatRevision,
    command: { type: 'shopLock', locked, generation: seat.match.shop.generation } });
  return { clock, socket, room, seat, command };
}

describe('commands arriving during sliced settlement', () => {
  it('keeps FIFO and dedupe, validates revisions when dequeued, and still parses other messages', async () => {
    const { clock, socket, room, seat, command } = await setup();
    const revision = seat.seatRevision;
    command(3, true, revision); command(3, true, revision); command(4, false, revision + 1);
    expect(socket.messages.filter(m => m.type === 'receipt' && m.commandId >= 3)).toHaveLength(0);
    // A malformed frame is answered while all valid commands are still waiting.
    socket.emit('message', Buffer.from('{'), false);
    expect(socket.messages.at(-1)?.type).toBe('error');
    for (let n = 0; n < 20 && room.retained.resolving; n++) expect(clock.fireNext()).toBe(true);
    const receipts = socket.messages.filter(m => m.type === 'receipt' && m.commandId >= 3);
    expect(receipts.map(m => m.type === 'receipt' && m.commandId)).toEqual([3, 3, 4]);
    expect(receipts.every(m => m.type === 'receipt' && m.ok)).toBe(true);
    expect(room.state.seats.find(s => s.seatId === seat.seatId)!.seatRevision).toBe(revision + 2);
  });

  it('does not apply a queued command after its connection closes', async () => {
    const { clock, socket, room, seat, command } = await setup();
    command(3, true, seat.seatRevision); socket.close();
    for (let n = 0; n < 20 && room.retained.resolving; n++) expect(clock.fireNext()).toBe(true);
    expect(room.state.seats.find(s => s.seatId === seat.seatId)!.seatRevision).toBe(seat.seatRevision);
    expect(socket.messages.filter(m => m.type === 'receipt' && m.commandId === 3)).toHaveLength(0);
  });
});
