/** Exercise the production single writer/projections without opening a port. Only HTTP/ws I/O is replaced. */
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => ({ connect: null as null | ((socket: unknown) => void) }));
vi.mock('node:http', async original => {
  const actual = await original<typeof import('node:http')>();
  const { EventEmitter } = await import('node:events');
  class Http extends EventEmitter {
    listen(_port: number, _host: string, callback: () => void) { callback(); }
    address() { return { port: 0 }; }
    close(callback: () => void) { callback(); }
    closeIdleConnections() {}
  }
  return { ...actual, createServer: () => new Http() };
});
vi.mock('ws', async original => {
  const actual = await original<typeof import('ws')>();
  const { EventEmitter } = await import('node:events');
  class Server extends EventEmitter {
    constructor() { super(); transport.connect = socket => this.emit('connection', socket); }
    close(callback?: () => void) { callback?.(); }
  }
  return { ...actual, WebSocketServer: Server };
});
import { createGameServer, type GameServer } from '../../../src/server/net/server';
import { NET_PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from '../../../src/server/net/messages';
import { ManualClock } from '../../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import { TIMINGS } from '../helpers';

class Socket extends EventEmitter {
  readonly OPEN = 1; readyState = 1; bufferedAmount = 0;
  readonly inbox: ServerMessage[] = []; private id = 1;
  send(text: string) { this.inbox.push(JSON.parse(text)); }
  ping() { this.emit('pong'); }
  close() { if (this.readyState !== 1) return; this.readyState = 3; this.emit('close'); }
  terminate() { this.close(); }
  request(raw: object) { const commandId = this.id++; this.emit('message', Buffer.from(JSON.stringify({ ...raw, protocolVersion: NET_PROTOCOL_VERSION, commandId })), false); return this.inbox.find(m => m.type === 'receipt' && m.commandId === commandId); }
  messages<T extends ServerMessage['type']>(type: T) { return this.inbox.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type); }
}
let server: GameServer | null = null;
afterEach(async () => { await server?.close(); server = null; });
function connect() { const socket = new Socket(); transport.connect!(socket); return socket; }
async function setup() {
  const clock = new ManualClock();
  server = await createGameServer({ port: 0, clock, seed: 42, timings: TIMINGS, bots: { stepMs: 1_000_000 },
    combatStreaming: true, resolver: new TwoSidedBattleResolver(), limits: { maxMessagesPerWindow: 10_000 } });
  const a = connect(), b = connect(); a.request({ type: 'join', name: 'A' }); b.request({ type: 'join', name: 'B' }); a.request({ type: 'start' });
  const joined = a.messages('receipt').find(m => m.ok && m.result.kind === 'joined')!;
  if (!joined.ok || joined.result.kind !== 'joined') throw Error('join');
  return { clock, a, b, token: joined.result.token, seatId: joined.result.seatId, room: server.room! };
}
describe('NET6 production stream with memory transport', () => {
  it('one source serves ordered chunks, cursor resume, keyframe reload and watch tail; settles once', async () => {
    const { clock, a, b, token, seatId, room } = await setup();
    clock.advance(1_000);
    const open = a.messages('combat-open').at(-1)!;
    expect(open.frame.tick).toBe(0); expect(room.state.battles).toHaveLength(0);
    clock.advance(250);
    let nextTick = 1;
    for (const chunk of a.messages('combat-chunk')) {
      expect(chunk.fromTick).toBe(nextTick);
      expect(chunk.ticks.map(f => f.tick)).toEqual(Array.from({ length: chunk.ticks.length }, (_, i) => nextTick + i));
      nextTick = chunk.throughTick + 1;
    }
    a.close(); clock.advance(150);
    const resumed = connect();
    resumed.request({ type: 'resume', token, combat: { battleId: open.battleId, revision: open.revision, nextTick, seatId } });
    expect(resumed.messages('combat-open')).toHaveLength(0);
    expect(resumed.messages('combat-chunk')[0]!.fromTick).toBe(nextTick);
    expect(b.request({ type: 'watch', roomId: room.state.roomId, seatId })).toMatchObject({ ok: true });
    expect(b.messages('combat-open').at(-1)!.battleId).toBe(open.battleId);
    expect(b.messages('combat-open').at(-1)!.unitIds).toEqual([]);
    clock.advance(50);
    expect(b.messages('combat-chunk').at(-1)).toEqual(resumed.messages('combat-chunk').at(-1));
    for (let i = 0; room.state.battles.length === 0 && i < 1_300; i++) clock.advance(50);
    const end = resumed.messages('combat-end').at(-1)!;
    expect(end.terminal).toEqual(room.combatStreamFor(seatId)!.terminal);
    expect(room.state.settlements).toHaveLength(0);
    const fresh = connect(); fresh.request({ type: 'resume', token });
    expect(fresh.messages('combat-open').at(-1)!.initial.tick).toBe(end.throughTick);
    clock.advance(800);
    expect(room.state.settlements).toHaveLength(1); expect(room.state.fault).toBeNull();
    expect(resumed.messages('replay')).toHaveLength(0);
    for (const stream of [...b.messages('combat-chunk'), ...resumed.messages('combat-end')]) expect(JSON.stringify(stream)).not.toMatch(/rngState|bankSamples|liveGold|proposals|mapping/);
  }, 60_000);
  it('a slow client is dropped without blocking ticks or a healthy peer', async () => {
    const { clock, a, b, room } = await setup();
    a.bufferedAmount = 1_048_577;
    clock.advance(1_250);
    expect(a.readyState).toBe(3);
    expect(b.messages('combat-chunk').length).toBeGreaterThan(0);
    expect(room.committedBattleTick).toBe(5); expect(room.state.fault).toBeNull();
  });
  it('refuses old protocol and malformed cursors without advancing or settling', async () => {
    const { a, room } = await setup();
    a.emit('message', Buffer.from(JSON.stringify({ type: 'resume', token: 'x', commandId: 900, protocolVersion: 5 })), false);
    expect(a.messages('receipt').at(-1)).toMatchObject({ ok: false, reason: 'unsupported-protocol' });
    const before = room.state;
    a.request({ type: 'resume', token: 'x', combat: { battleId: 'x', revision: 1, nextTick: -1, seatId: 'x' } } satisfies Omit<Extract<ClientMessage, { type: 'resume' }>, 'commandId' | 'protocolVersion'>);
    expect(a.messages('receipt').at(-1)).toMatchObject({ ok: false, reason: 'invalid-message' });
    expect(room.state).toBe(before);
  });
});
