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
import { WsGameClient } from '../../../src/rendering/online/ws-client';
import { RemoteSession } from '../../../src/rendering/online/remote-session';
import type { GameClient } from '../../../src/rendering/online/protocol';
import { CombatStream } from '../../../src/server/room/combat-stream';
import { parseClientMessage } from '../../../src/server/net/messages';
import { TIMINGS } from '../helpers';

class Socket extends EventEmitter {
  readonly OPEN = 1; readyState = 1; bufferedAmount = 0;
  readonly inbox: ServerMessage[] = []; private id = 1;
  receive: ((text: string) => void) | null = null;
  send(text: string) { this.inbox.push(JSON.parse(text)); this.receive?.(text); }
  ping() { this.emit('pong'); }
  close() { if (this.readyState !== 1) return; this.readyState = 3; this.emit('close'); }
  terminate() { this.close(); }
  request(raw: object) { const commandId = this.id++; this.emit('message', Buffer.from(JSON.stringify({ ...raw, protocolVersion: NET_PROTOCOL_VERSION, commandId })), false); return this.inbox.find(m => m.type === 'receipt' && m.commandId === commandId); }
  messages<T extends ServerMessage['type']>(type: T) { return this.inbox.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type); }
}
let server: GameServer | null = null;
afterEach(async () => { await server?.close(); server = null; });
function connect() { const socket = new Socket(); transport.connect!(socket); return socket; }
async function setup(count = 2, combatStreaming = true) {
  const logs: { level: string; event: string; fields: unknown }[] = [];
  const clock = new ManualClock();
  server = await createGameServer({ port: 0, clock, seed: 42, timings: TIMINGS, bots: { stepMs: 1_000_000 },
    logger: (level, event, fields) => { logs.push({ level, event, fields }); },
    combatStreaming, resolver: new TwoSidedBattleResolver(), limits: { maxMessagesPerWindow: 10_000 } });
  const clients = Array.from({ length: count }, (_, index) => { const socket = connect(); socket.request({ type: 'join', name: `seat-${index}` }); return socket; });
  const [a, b] = clients as [Socket, Socket, ...Socket[]]; a.request({ type: 'start' });
  const joined = a.messages('receipt').find(m => m.ok && m.result.kind === 'joined')!;
  if (!joined.ok || joined.result.kind !== 'joined') throw Error('join');
  return { clock, a, b, clients, logs, token: joined.result.token, seatId: joined.result.seatId, room: server.room! };
}
describe('NET6 production stream with memory transport', () => {
  it('opening queues command, close, resume, watch and subsequent authentication in FIFO order', async () => {
    const { clock, a, token, seatId, room } = await setup();
    const work = room as unknown as { clearTimer(): void; freezeAndResolve(): void };
    work.clearTimer(); work.freezeAndResolve();
    const frozen = room.state, seat = frozen.seats.find(s => s.seatId === seatId)!;
    const command = { type: 'command', roomId: frozen.roomId, round: frozen.round,
      seatRevision: seat.seatRevision + 1, command: { type: 'shopLock', locked: true, generation: seat.match.shop.generation } };
    expect(a.request(command)).toBeUndefined();
    a.close();
    const resumed = connect();
    (resumed as unknown as { id: number }).id = 90;
    expect(resumed.request({ type: 'resume', token })).toBeUndefined();
    const watched = frozen.seats.find(s => s.seatId !== seatId)!.seatId;
    expect(resumed.request({ type: 'watch', roomId: frozen.roomId, seatId: watched })).toBeUndefined();
    expect(resumed.request({ ...command, seatRevision: seat.seatRevision + 2,
      command: { ...command.command, locked: false } })).toBeUndefined();
    expect(resumed.messages('receipt')).toEqual([]);
    expect(room.state).toBe(frozen); expect(room.hasCombatStreams).toBe(false);
    for (let n = 0; room.combatInitializationPending && n < 100; n++) expect(clock.fireNext()).toBe(true);
    expect(room.combatInitializationPending).toBe(false); expect(room.state.fault).toBeNull();
    const receipts = resumed.messages('receipt');
    expect(receipts.map(r => r.ok && r.result.kind)).toEqual(['resumed', 'watching', 'applied']);
    expect(room.state.seats.find(s => s.seatId === seatId)).toMatchObject({ connected: true,
      seatRevision: seat.seatRevision + 3, match: { shop: { locked: false } } });
    expect(resumed.messages('combat-open').map(m => m.seatId)).toContain(watched);
    expect(resumed.messages('combat-open').every(m => m.initial.tick === 0)).toBe(true);
  });

  it('#376 legacy resolver fallback shares the seat subscription without introducing live watch packets', async () => {
    const { a, b, clock, room, seatId } = await setup(2, false);
    clock.advance(1_000);
    const before = room.state;
    expect(b.request({ type: 'watch', roomId: room.state.roomId, seatId })).toBeUndefined();
    expect(b.messages('watch-replay')).toHaveLength(1);
    expect(b.messages('watch-replay')[0]!.seatId).toBe(seatId);
    expect(b.messages('watch-replay')[0]!.replay).toEqual(a.messages('replay')[0]!.replay);
    expect(room.state).toBe(before);
    b.request({ type: 'watch', roomId: room.state.roomId, seatId });
    expect(b.messages('watch-replay')).toHaveLength(1);
    b.request({ type: 'watch', roomId: room.state.roomId, seatId: null });
    expect(b.messages('combat-open')).toEqual([]);
    expect(b.messages('combat-chunk')).toEqual([]);
  });
  it('one source serves ordered chunks, cursor resume, keyframe reload and watch tail; settles once', async () => {
    const { clock, a, b, token, seatId, room } = await setup();
    clock.advance(1_000);
    const open = a.messages('combat-open').at(-1)!;
    expect(open.frame.tick).toBe(0); expect(room.state.battles).toHaveLength(0);
    clock.advance(250);
    let nextTick = 1;
    for (const chunk of a.messages('combat-chunk').flatMap(packet => packet.chunks)) {
      expect(chunk.fromTick).toBe(nextTick);
      expect(chunk.ticks.map(f => f.tick)).toEqual(Array.from({ length: chunk.ticks.length }, (_, i) => nextTick + i));
      nextTick = chunk.throughTick + 1;
    }
    a.close(); clock.advance(150);
    const resumed = connect();
    resumed.request({ type: 'resume', token, combat: { battleId: open.battleId, revision: open.revision, nextTick, seatId } });
    expect(resumed.messages('combat-open')).toHaveLength(0);
    expect(resumed.messages('combat-chunk')[0]!.chunks[0]!.fromTick).toBe(nextTick);
    expect(b.request({ type: 'watch', roomId: room.state.roomId, seatId })).toMatchObject({ ok: true });
    expect(b.messages('combat-open').at(-1)!.battleId).toBe(open.battleId);
    expect(b.messages('combat-open').at(-1)!.unitIds).toEqual([]);
    clock.advance(50);
    expect(b.messages('combat-chunk').at(-1)!.chunks).toHaveLength(2);
    const watchedChunk = b.messages('combat-chunk').at(-1)!.chunks.find(chunk => chunk.watch)!;
    expect(watchedChunk.ticks).toEqual(resumed.messages('combat-chunk').at(-1)!.chunks[0]!.ticks);
    expect(watchedChunk).toMatchObject({ watch: true, seatId });
    for (let i = 0; room.state.battles.length === 0 && i < 1_300; i++) clock.advance(50);
    const end = resumed.messages('combat-end').at(-1)!;
    expect(end.terminal).toEqual(room.combatStreamFor(seatId)!.terminal);
    expect(room.state.settlements).toHaveLength(0);
    const fresh = connect(); fresh.request({ type: 'resume', token });
    expect(fresh.messages('combat-open').at(-1)!.initial.tick).toBe(end.throughTick);
    clock.advance(800);
    expect(room.state.settlements).toHaveLength(1); expect(room.state.fault).toBeNull();
    expect(resumed.messages('replay')).toHaveLength(0);
    for (const stream of [...b.messages('combat-chunk'), ...resumed.messages('combat-end')]) expect(JSON.stringify(stream)).not.toMatch(/rngState|bankSamples|liveGold|inputLog|proposals|mapping/);
    expect(b.messages('watch-replay')).toEqual([]);
    expect(b.messages('watch-tail')).toEqual([]);
  }, 60_000);
  it('a slow client is dropped without blocking ticks or a healthy peer', async () => {
    const { clock, a, b, room, logs } = await setup();
    a.bufferedAmount = 1_048_577;
    clock.advance(1_250);
    expect(a.readyState).toBe(3);
    expect(logs.filter(row => row.event === 'connection.backpressure')).toMatchObject([{ level: 'warn', fields: { bufferedAmount: 1_048_577 } }]);
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

it('resumes own and watched cursors independently, switches watch without resetting own, and rejects unauthenticated watches', async () => {
  const { clock, a, b, room, seatId } = await setup();
  clock.advance(1_250);
  const ownOpen = b.messages('combat-open')[0]!;
  const joined = b.messages('receipt').find(m => m.ok && m.result.kind === 'joined')!;
  if (!joined.ok || joined.result.kind !== 'joined') throw Error('join');
  const before = room.state;
  expect(b.request({ type: 'watch', roomId: room.state.roomId, seatId })).toMatchObject({ ok: true, result: { kind: 'watching', seatId } });
  expect(room.state).toBe(before);
  const watchOpen = b.messages('combat-open').at(-1)!;
  expect(watchOpen).toMatchObject({ watch: true, seatId, unitIds: [] });
  clock.advance(100);
  const packet = b.messages('combat-chunk').at(-1)!;
  expect(packet.chunks).toHaveLength(2);
  expect(packet.chunks.find(chunk => !chunk.watch)!.seatId).toBe(ownOpen.seatId);
  const ownNext = packet.chunks.find(chunk => !chunk.watch)!.throughTick;
  const watchNext = packet.chunks.find(chunk => chunk.watch)!.throughTick - 2;
  b.close(); clock.advance(100);
  const resumed = connect();
  expect(resumed.request({ type: 'resume', token: joined.result.token, watchSeatId: seatId,
    combat: { battleId: ownOpen.battleId, revision: ownOpen.revision, nextTick: ownNext, seatId: ownOpen.seatId },
    watchCombat: { battleId: watchOpen.battleId, revision: watchOpen.revision, nextTick: watchNext, seatId } })).toMatchObject({ ok: true });
  expect(resumed.messages('combat-open')).toHaveLength(0);
  expect(resumed.messages('combat-chunk')).toHaveLength(1);
  expect(resumed.messages('combat-chunk')[0]!.chunks).toMatchObject([
    { watch: false, seatId: ownOpen.seatId, fromTick: ownNext }, { watch: true, seatId, fromTick: watchNext },
  ]);
  expect(resumed.request({ type: 'watch', roomId: room.state.roomId, seatId: null })).toMatchObject({ ok: true, result: { kind: 'watching', seatId: null } });
  clock.advance(50);
  expect(resumed.messages('combat-open')).toHaveLength(0);
  expect(resumed.messages('combat-chunk').at(-1)!.chunks).toMatchObject([{ watch: false, seatId: ownOpen.seatId }]);
  expect(connect().request({ type: 'watch', roomId: room.state.roomId, seatId })).toMatchObject({ ok: false, reason: 'not-authenticated' });
  // Resuming the same credential supersedes the previous holder; it can no longer subscribe.
  const replacement = connect(); replacement.request({ type: 'resume', token: joined.result.token });
  expect(resumed.request({ type: 'watch', roomId: room.state.roomId, seatId })).toMatchObject({ ok: false, reason: 'not-authenticated' });
  expect(a.messages('combat-chunk').length).toBeGreaterThan(0);
});

it('eight players with watches get at most one chunk packet per sealed tick, and PvE publishes only at the boundary', async () => {
  const { clock, room, clients } = await setup(8);
  clock.advance(1_000);
  const seats = room.state.seats;
  clients.forEach((client, index) => client.request({ type: 'watch', roomId: room.state.roomId, seatId: seats[(index + 1) % 8]!.seatId }));
  let notifications = 0, statePublications = 0;
  room.subscribeStreams(() => notifications++); room.subscribe(() => statePublications++);
  const spy = vi.spyOn(CombatStream.prototype, 'advancePve');
  try {
    for (let tick = 1; tick <= 30; tick++) {
      const counts = clients.map(client => client.messages('combat-chunk').length), before = notifications, publications = statePublications;
      clock.advance(50);
      expect(notifications - before).toBe(1);
      expect(statePublications - publications).toBeLessThanOrEqual(1);
      clients.forEach((client, index) => {
        const packets = client.messages('combat-chunk');
        expect(packets.length - counts[index]!).toBe(1);
        expect(packets.at(-1)!.chunks).toHaveLength(2);
        expect(new Set(packets.at(-1)!.chunks.map(chunk => chunk.throughTick))).toEqual(new Set([tick]));
      });
    }
    expect(spy).toHaveBeenCalledTimes(30 * 8);
    for (const seat of seats) {
      const view = room.combatStreamFor(seat.seatId)!;
      expect(room.combatStreamFor(seat.seatId)).toBe(view);
      expect(room.combatStreamFor(seat.seatId)!.unitIds).toBe(view.unitIds);
    }
  } finally { spy.mockRestore(); }
});

it('validates both resume cursors and a separate watch selection', () => {
  const cursor = { battleId: 'b', revision: 1, seatId: 's', nextTick: 3 };
  const envelope = { type: 'resume', protocolVersion: NET_PROTOCOL_VERSION, commandId: 1, token: 't', combat: cursor, watchCombat: cursor, watchSeatId: 's' };
  expect(parseClientMessage(JSON.stringify(envelope))).toEqual({ ok: true, message: envelope });
  for (const watchCombat of [{ ...cursor, nextTick: 0 }, { ...cursor, revision: -1 }, { ...cursor, extra: true }, null]) {
    expect(parseClientMessage(JSON.stringify({ ...envelope, watchCombat })).ok).toBe(false);
  }
});

it('jittered production chunks finish playback before the minimum battle tail settles the round', async () => {
  const clock = new ManualClock();
  server = await createGameServer({ port: 0, clock, seed: 42, combatStreaming: true, resolver: new TwoSidedBattleResolver(),
    timings: { ...TIMINGS, battleTailMs: 0 }, bots: { stepMs: 1_000_000 } });
  const backend = connect(), waiting: string[] = [];
  const browser = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
    send(text: string) { backend.emit('message', Buffer.from(text), false); }, close() { backend.close(); } } as unknown as WebSocket;
  let delayed = false;
  backend.receive = text => {
    if (delayed) waiting.push(text); else browser.onmessage?.({ data: text } as MessageEvent);
  };
  const client = new WsGameClient({ url: 'ws://memory', storage: null, createSocket: () => browser });
  const stub: GameClient = { transport: 'local-room', listen: () => () => {}, joinQueue() {}, leaveQueue() {}, startMatch() {},
    send: () => ({ ok: 'pending', commandId: 1 }), reset() {}, dispose() {} };
  const session = new RemoteSession(stub, undefined, () => clock.now());
  client.listen({ lobby() {}, view() {}, state: state => session.receiveState(state), replay: r => session.receiveReplay(r), replayRevised: r => session.reviseReplay(r) });
  client.joinQueue('jitter'); client.startMatch();
  clock.advance(1_000); delayed = true;
  const room = server.room!, played: unknown[] = [];
  for (let tick = 1; room.state.settlements.length === 0 && tick < 1_300; tick++) {
    clock.advance(50);
    // Batches arrive every 150 ms; playback still advances every frame/tick.
    if (tick % 3 === 0) for (const text of waiting.splice(0)) browser.onmessage?.({ data: text } as MessageEvent);
    played.push(...session.advanceDisplay(50));
  }
  for (const text of waiting.splice(0)) browser.onmessage?.({ data: text } as MessageEvent);
  expect(room.state.fault).toBeNull(); expect(room.state.settlements).toHaveLength(1);
  expect(session.playbackDebug().superseded).toBe(0);
  expect(session.playingBack).toBe(false);
  const replay = session.lastBattle!.replay;
  expect(session.lastBattle!.replay.stream?.ended).toBe(true);
  expect(played).toEqual(replay.ticks.flatMap(frame => frame.events));
  expect(replay.ticks.at(-1)!.tick).toBe(replay.terminal.tick);
  client.dispose();
}, 60_000);

it('WsGameClient retains both received prefixes when resuming a watched stream through #376 callbacks', async () => {
  const clock = new ManualClock();
  server = await createGameServer({ port: 0, clock, seed: 42, combatStreaming: true, resolver: new TwoSidedBattleResolver(),
    timings: TIMINGS, bots: { stepMs: 1_000_000 } });
  const backends: Socket[] = [], browsers: WebSocket[] = [];
  const watched: import('../../../src/server-entry').CombatReplay[] = [];
  const own: import('../../../src/server-entry').CombatReplay[] = [];
  const client = new WsGameClient({ url: 'ws://memory', storage: null, backoffMs: [1],
    timers: { set: (callback, ms) => clock.schedule(clock.now() + ms, callback), clear: id => clock.cancel(id as number) },
    createSocket: () => {
      const backend = connect();
      const browser = { readyState: 1, onopen: null, onmessage: null, onclose: null, onerror: null,
        send(text: string) { backend.emit('message', Buffer.from(text), false); },
        close() { Object.assign(browser, { readyState: 3 }); backend.close(); browser.onclose?.({ code: 1006 } as CloseEvent); },
      } as unknown as WebSocket;
      backend.receive = text => browser.onmessage?.({ data: text } as MessageEvent);
      backends.push(backend); browsers.push(browser); return browser;
    } });
  client.listen({ lobby() {}, view() {}, state() {}, replay: replay => own.push(replay), replayRevised: replay => own.push(replay),
    watched: (_seat, replay) => watched.push(replay) });
  try {
    client.joinQueue('viewer');
    const target = connect();
    const joined = target.request({ type: 'join', name: 'target' });
    if (joined?.type !== 'receipt' || !joined.ok || joined.result.kind !== 'joined') throw Error('join');
    client.startMatch(); clock.advance(1_000);
    client.watch(joined.result.seatId); clock.advance(250);
    const ownPrefix = own.at(-1)!, watchPrefix = watched.at(-1)!;
    expect(ownPrefix.ticks.at(-1)!.tick).toBe(5);
    expect(watchPrefix.ticks.at(-1)!.tick).toBe(5);
    browsers[0]!.close(); clock.advance(51);
    expect(browsers).toHaveLength(2);
    browsers[1]!.onopen?.({} as Event);
    expect(backends[1]!.messages('combat-open')).toHaveLength(0);
    expect(own.at(-1)!.ticks.at(-1)!.tick).toBe(6);
    expect(watched.at(-1)!.ticks.at(-1)!.tick).toBe(6);
    expect(own.at(-1)!.ticks.slice(0, ownPrefix.ticks.length)).toEqual(ownPrefix.ticks);
    expect(watched.at(-1)!.ticks.slice(0, watchPrefix.ticks.length)).toEqual(watchPrefix.ticks);
    expect(client.pendingCount).toBe(0);
  } finally { client.dispose(); }
});

it('schedules and completes a real spot check after streamed battles are published', async () => {
  const { clock, room, logs } = await setup(8);
  for (let guard = 0; !logs.some(log => log.event === 'replay.spot-check') && guard < 20_000; guard++) clock.fireNext();
  expect(room.state.fault).toBeNull();
  expect(logs.filter(log => log.event === 'replay.spot-check')).toHaveLength(1);
  expect(logs.find(log => log.event === 'replay.spot-check')!.fields).toMatchObject({ round: 1 });
  expect(logs.filter(log => log.event === 'replay.spot-check-failed')).toEqual([]);
});
