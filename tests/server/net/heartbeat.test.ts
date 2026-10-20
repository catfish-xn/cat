/**
 * Connection heartbeat: the server pings every connection and sends a `heartbeat` message on the injected clock, drops a
 * peer that stays silent past the timeout (its seat is kept and resumes), and is silent when the option is off. The
 * browser client (WsGameClient) gives a socket up after HEARTBEAT_MISSED silent intervals once it has seen a beat, and
 * reconnects as after any drop.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket as WsSocket } from 'ws';
import { NET_PROTOCOL_VERSION, type ServerMessage } from '../../../src/server/net/messages';
import { HEARTBEAT_MISSED, HEARTBEAT_TIMEOUT_CLOSE, WsGameClient } from '../../../src/rendering/online/ws-client';
import type { ConnectionStatus } from '../../../src/rendering/online/protocol';
import { TIMINGS } from '../helpers';
import { expectOk, flush, messagesOfType, seatTwo, startServer, type NetHarness } from './helpers';

const HEARTBEAT = { intervalMs: 1_000, timeoutMs: 2_500 };

let harness: NetHarness | null = null;
afterEach(async () => { await harness?.close(); harness = null; });

/** A peer that never answers a ping (a dead network): the `ws` client with autoPong off. */
function silentPeer(url: string): Promise<{ socket: WsSocket; inbox: ServerMessage[]; closed: Promise<number> }> {
  return new Promise((resolve, reject) => {
    const socket = new WsSocket(url, { autoPong: false });
    const inbox: ServerMessage[] = [];
    const closed = new Promise<number>(done => socket.on('close', code => done(code)));
    socket.on('message', data => inbox.push(JSON.parse(String(data)) as ServerMessage));
    socket.once('open', () => resolve({ socket, inbox, closed }));
    socket.once('error', reject);
  });
}

/** One interval of the manual clock, then time for pings, pongs and pushes to cross the loopback. */
async function beat(h: NetHarness): Promise<void> { h.clock.advance(HEARTBEAT.intervalMs); await flush(); }

describe('server heartbeat', () => {
  it('sends nothing extra when the option is off', async () => {
    harness = await startServer();
    const client = await harness.connect();
    for (let index = 0; index < 5; index++) await beat(harness);
    expect(messagesOfType(client.inbox, 'heartbeat')).toHaveLength(0);
    expect(client.isOpen).toBe(true);
  });

  it('keeps answering peers connected and sends them a heartbeat every interval', async () => {
    harness = await startServer({ heartbeat: HEARTBEAT });
    const client = await harness.connect();
    for (let index = 0; index < 5; index++) await beat(harness);
    expect(client.isOpen).toBe(true);
    const beats = messagesOfType(client.inbox, 'heartbeat');
    expect(beats.length).toBe(5);
    expect(beats[0]).toEqual({ type: 'heartbeat', intervalMs: HEARTBEAT.intervalMs });
  });

  it('drops a seated peer that went silent, keeps its seat, and lets the token resume it', async () => {
    // A long preparation keeps the room in its first round while the clock walks through the beats.
    harness = await startServer({ heartbeat: HEARTBEAT, timings: { ...TIMINGS, preparationMs: 60_000 } });
    const [a, b] = await seatTwo(harness);
    const seatA = a.seatId!, token = a.token!;
    // A's seat moves to a connection that never answers a ping (the old tab is superseded and closed).
    const silent = await silentPeer(harness.url);
    silent.socket.send(JSON.stringify({ type: 'resume', token, protocolVersion: NET_PROTOCOL_VERSION, commandId: 10_000 }));
    await flush(100);
    expect(silent.inbox.some(message => message.type === 'receipt' && message.ok && message.result.kind === 'resumed')).toBe(true);
    harness.clock.advance(1_000); await a.closed; // the superseded tab closes after its grace period
    await flush();

    for (let index = 0; index < 3; index++) await beat(harness);
    expect(await silent.closed).toBe(1006); // terminated: no close handshake
    await flush();
    expect(b.view!.seats.find(seat => seat.seatId === seatA)!.connected).toBe(false);
    expect(b.isOpen).toBe(true);

    const back = await harness.connect();
    const receipt = await back.resume(token);
    expectOk(receipt);
    expect(receipt.ok && receipt.result.kind === 'resumed' && receipt.result.seatId).toBe(seatA);
    await flush();
    expect(b.view!.seats.find(seat => seat.seatId === seatA)!.connected).toBe(true);
  });
});

/* ---------------- browser client ---------------- */

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly sent: string[] = [];
  closedWith: number | null = null;
  send(text: string) { this.sent.push(text); }
  close(code = 1000) { this.closedWith = code; this.readyState = 3; }
  open() { this.readyState = 1; this.onopen?.(); }
  push(message: ServerMessage) { this.onmessage?.({ data: JSON.stringify(message) }); }
}

class FakeTimers {
  private next = 1;
  readonly pending = new Map<number, { callback: () => void; ms: number }>();
  set = (callback: () => void, ms: number) => { const handle = this.next++; this.pending.set(handle, { callback, ms }); return handle; };
  clear = (handle: unknown) => { this.pending.delete(handle as number); };
  /** Fires every pending timer of exactly this delay. */
  fire(ms: number): number {
    const due = [...this.pending].filter(([, timer]) => timer.ms === ms);
    for (const [handle, timer] of due) { this.pending.delete(handle); timer.callback(); }
    return due.length;
  }
}

function fakeClient() {
  const sockets: FakeSocket[] = [], statuses: ConnectionStatus[] = [], timers = new FakeTimers();
  const client = new WsGameClient({
    url: 'ws://test', storage: null, backoffMs: [5], timers,
    createSocket: () => { const socket = new FakeSocket(); sockets.push(socket); return socket as unknown as WebSocket; },
  });
  client.listen({ lobby: () => {}, view: () => {}, state: () => {}, replay: () => {}, connection: status => statuses.push(status) });
  return { client, sockets, statuses, timers };
}
const LOBBY: ServerMessage = { type: 'lobby', view: { queue: [], capacity: 8, joined: false, canStart: false, error: null } };
const TIMEOUT = 100 * HEARTBEAT_MISSED;

describe('WsGameClient heartbeat', () => {
  it('never arms a deadline against a server that sends no heartbeat', () => {
    const { client, sockets, timers } = fakeClient();
    sockets[0]!.open(); sockets[0]!.push(LOBBY);
    expect(timers.pending.size).toBe(0);
    client.dispose();
  });

  it('restarts the deadline on every message', () => {
    const { client, sockets, timers } = fakeClient();
    sockets[0]!.open();
    sockets[0]!.push({ type: 'heartbeat', intervalMs: 100 });
    expect([...timers.pending.values()].map(timer => timer.ms)).toEqual([TIMEOUT]);
    sockets[0]!.push(LOBBY);
    expect([...timers.pending.values()].map(timer => timer.ms)).toEqual([TIMEOUT]); // replaced, not stacked
    client.dispose();
    expect(timers.pending.size).toBe(0);
  });

  it('gives a silent socket up, shows reconnecting and opens a new socket', () => {
    const { client, sockets, statuses, timers } = fakeClient();
    sockets[0]!.open(); sockets[0]!.push(LOBBY);
    sockets[0]!.push({ type: 'heartbeat', intervalMs: 100 });
    expect(timers.fire(TIMEOUT)).toBe(1);
    expect(sockets[0]!.closedWith).toBe(HEARTBEAT_TIMEOUT_CLOSE);
    expect(sockets[0]!.onclose).toBeNull(); // the late close event of the dead socket changes nothing
    expect(statuses.at(-1)).toMatchObject({ kind: 'reconnecting', attempt: 1 });
    expect(timers.fire(5)).toBe(1);
    expect(sockets).toHaveLength(2);
    sockets[1]!.open();
    expect(statuses.at(-1)).toEqual({ kind: 'online' });
    // The new socket waits for its own first beat before it arms a deadline again.
    sockets[1]!.push(LOBBY);
    expect(timers.pending.size).toBe(0);
    client.dispose();
  });
});
