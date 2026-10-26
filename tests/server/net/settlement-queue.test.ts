import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameServer, type GameServer } from '../../../src/server/net/server';
import { ManualClock } from '../../../src/server/room/clock';
import { PlaceholderBattleResolver } from '../../../src/server/room/battle-resolver';
import { toSeatPrivateView } from '../../../src/server/room/projection';
import type { Room } from '../../../src/server/room/room';
import { DamageResolver, TIMINGS, runUntil } from '../helpers';
import { Socket } from './settlement-queue-harness';

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
type WorkSeam = { settlementWork: Generator<void, void, void> | null; runSettlementSlice(): void; clearTimer(): void; commitPending(): void };
let server: GameServer | null = null;
afterEach(async () => { await server?.close(); server = null; });

async function setup(real = false) {
  const clock = new ManualClock();
  server = await createGameServer({ port: 0, host: '127.0.0.1', clock, seed: 42, roomId: 'queue-test',
    timings: TIMINGS, resolver: real ? new PlaceholderBattleResolver() : new DamageResolver(() => 0), sliceTicks: 1, logger: () => {} });
  const socket = new Socket(); transport.connect!(socket);
  socket.receive({ type: 'join', name: 'human', commandId: 1 });
  socket.receive({ type: 'start', commandId: 2 });
  const room = server.room as Room, work = room as unknown as WorkSeam;
  if (real) {
    runUntil(room, clock, state => state.round === 3 && state.phase === 'battle', 10_000);
  } else {
    work.clearTimer();
    work.settlementWork = (function* () { yield; yield; })();
    work.runSettlementSlice();
  }
  const seat = room.state.seats.find(s => s.kind === 'human')!;
  const command = (commandId: number, locked: boolean, seatRevision: number) => socket.receive({ type: 'command',
    commandId, roomId: room.state.roomId, round: room.state.round, seatRevision,
    command: { type: 'shopLock', locked, generation: seat.match.shop.generation } });
  return { clock, socket, room, seat, command, work };
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

  it('executes an admitted session command after its socket closes and replays its receipt on resume', async () => {
    const { clock, socket, room, seat, command } = await setup();
    command(3, true, seat.seatRevision); socket.close();
    for (let n = 0; n < 20 && room.retained.resolving; n++) expect(clock.fireNext()).toBe(true);
    expect(room.state.seats.find(s => s.seatId === seat.seatId)!.seatRevision).toBe(seat.seatRevision + 1);
    expect(socket.messages.filter(m => m.type === 'receipt' && m.commandId === 3)).toHaveLength(0);
    const joined = socket.messages.find(m => m.type === 'receipt' && m.ok && m.result.kind === 'joined');
    if (joined?.type !== 'receipt' || !joined.ok || joined.result.kind !== 'joined') throw new Error('missing token');
    const replacement = new Socket(); transport.connect!(replacement);
    replacement.receive({ type: 'resume', commandId: 90, token: joined.result.token });
    replacement.receive({ type: 'command', commandId: 3, roomId: room.state.roomId, round: room.state.round,
      seatRevision: seat.seatRevision, command: { type: 'shopLock', locked: true, generation: seat.match.shop.generation } });
    expect(replacement.messages.filter(m => m.type === 'receipt' && m.commandId === 3)).toMatchObject([{ ok: true }]);
    expect(room.state.seats.find(s => s.seatId === seat.seatId)!.seatRevision).toBe(seat.seatRevision + 1);
  });
  it('dedupes a pending command across old and resumed sockets during superseded grace', async () => {
    const { clock, socket, room, seat, command } = await setup();
    command(3, true, seat.seatRevision);
    const joined = socket.messages.find(m => m.type === 'receipt' && m.ok && m.result.kind === 'joined');
    if (joined?.type !== 'receipt' || !joined.ok || joined.result.kind !== 'joined') throw new Error('missing token');
    const replacement = new Socket(); transport.connect!(replacement);
    replacement.receive({ type: 'resume', commandId: 90, token: joined.result.token });
    const repeat = { type: 'command', commandId: 3, roomId: room.state.roomId, round: room.state.round,
      seatRevision: seat.seatRevision, command: { type: 'shopLock', locked: true, generation: seat.match.shop.generation } };
    replacement.receive(repeat); socket.receive(repeat);
    // Changed content cannot claim the original command ID, and a new ID on the old socket is unauthorised.
    socket.receive({ ...repeat, command: { ...repeat.command, locked: false } });
    socket.receive({ ...repeat, commandId: 4 });
    expect(socket.messages.filter(m => m.type === 'receipt' && !m.ok).map(m => m.type === 'receipt' && !m.ok && m.reason)).toEqual(['commandId-conflict', 'not-authenticated']);
    while (room.retained.resolving) expect(clock.fireNext()).toBe(true);
    expect(room.state.seats.find(s => s.seatId === seat.seatId)!.seatRevision).toBe(seat.seatRevision + 1);
    expect(replacement.messages.filter(m => m.type === 'receipt' && m.commandId === 3)).toMatchObject([{ ok: true }]);
    const first = replacement.messages.find(m => m.type === 'receipt' && m.commandId === 3);
    replacement.receive(repeat); socket.receive(repeat);
    expect(replacement.messages.at(-1)).toEqual(first); expect(socket.messages.at(-1)).toEqual(first);
  });

  it('accepts a last-second purchase on the pre-settlement revision and publishes the same private state', async () => {
    const { clock, socket, room, seat, work } = await setup(true);
    expect(room.handle(seat.seatId, { type: 'shopLock', locked: true, generation: seat.match.shop.generation }).ok).toBe(true);
    const before = room.state.seats.find(s => s.seatId === seat.seatId)!;
    work.clearTimer(); work.commitPending();
    expect(room.retained.resolving).toBe(true);
    const slot = before.match.shop.slots.findIndex(offer => offer.status === 'available');
    socket.receive({ type: 'command', commandId: 3, roomId: room.state.roomId, round: room.state.round,
      seatRevision: before.seatRevision, command: { type: 'buy', slot, generation: before.match.shop.generation } });
    expect(socket.messages.filter(m => m.type === 'receipt' && m.commandId === 3)).toHaveLength(0);
    runUntil(room, clock, state => state.phase !== 'battle', 10_000);
    expect(room.state.fault).toBeNull();
    expect(socket.messages.filter(m => m.type === 'receipt' && m.commandId === 3)).toMatchObject([{ ok: true }]);
    const after = room.state.seats.find(s => s.seatId === seat.seatId)!;
    expect(after.match.shop.slots[slot]!.status).toBe('purchased');
    const sent = socket.messages.filter(m => m.type === 'state').at(-1)!;
    expect(sent.type === 'state' && sent.state).toEqual(JSON.parse(JSON.stringify(toSeatPrivateView(after.match))));
  }, 60_000);

  it('holds writers received after the first rebuild until commit and checks their original revisions then', async () => {
    const { clock, socket, room, seat, command, work } = await setup(true);
    expect(room.handle(seat.seatId, { type: 'shopLock', locked: true, generation: seat.match.shop.generation }).ok).toBe(true);
    work.clearTimer(); work.commitPending();
    const originalRevision = room.state.seats[0]!.seatRevision;
    command(3, false, originalRevision);
    expect(clock.fireNext()).toBe(true); // Admits the first batch and freezes, still draining that batch.
    const before = room.state;
    expect(before.seats[0]!.seatRevision).toBe(originalRevision + 1);
    command(4, true, originalRevision + 1); command(4, true, originalRevision + 1);
    // This request explicitly targets the post-commit revision; the server must not rewrite either request.
    command(5, true, originalRevision + 2);
    room.setConnected(seat.seatId, false);
    socket.receive({ type: 'walk', commandId: 6, roomId: before.roomId, scene: 'board', to: { x: 1, y: 1 } });
    let observedCommit = false;
    expect(room.deferDuringSettlement(() => { observedCommit = room.state.settlements.includes(`${before.roomId}:round-3`); })).toBe(true);
    expect(room.state).toBe(before);
    expect(socket.messages.filter(m => m.type === 'receipt' && m.commandId >= 4)).toHaveLength(0);
    // More than nine new arrival batches cannot interrupt the frozen calculation.
    let batches = 0;
    while (room.state.phase === 'battle' && batches < 10_000) {
      room.setConnected(seat.seatId, batches % 2 === 0);
      expect(clock.fireNext()).toBe(true);
      batches++;
    }
    expect(batches).toBeGreaterThan(9);
    expect(observedCommit).toBe(true);
    expect(room.state.fault).toBeNull();
    expect(socket.messages.filter(m => m.type === 'receipt' && m.commandId === 4)).toMatchObject([
      { ok: false, reason: 'seat-revision-mismatch' }, { ok: false, reason: 'seat-revision-mismatch' },
    ]);
    expect(socket.messages.filter(m => m.type === 'receipt' && m.commandId === 5)).toMatchObject([{ ok: true }]);
    expect(room.state.seats[0]!.seatRevision).toBe(originalRevision + 3);
    expect(room.walks).toHaveLength(1);
    expect(room.retained.resolving).toBe(false);
    // The rejected command's receipt remains deduped after commit.
    command(4, true, originalRevision + 1);
    expect(socket.messages.at(-1)).toMatchObject({ type: 'receipt', commandId: 4, ok: false, reason: 'seat-revision-mismatch' });
  }, 60_000);

});
