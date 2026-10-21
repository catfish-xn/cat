/**
 * Browser WebSocket client (work order C4) driven under Node against the real game server on a
 * ManualClock: pending commands, receipts and the state push that confirms them, pipelining,
 * resume after a dropped socket or a page reload, superseded sessions, queue drops and replays played once.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { ServerMessage } from '../../src/server/net/messages';
import type { MatchState } from '../../src/simulation/match-types';
import type { CombatReplay } from '../../src/server-entry';
import type { ConfirmedCommand, ConnectionStatus, LobbyView, PlayerView, RefusedCommand } from '../../src/rendering/online/protocol';
import { tokenStorageKey, WsGameClient } from '../../src/rendering/online/ws-client';
import { DamageResolver, TIMINGS } from './helpers';
import { startServer, type NetHarness } from './net/helpers';
import { toSeatPrivateView } from '../../src/server/room/projection';

type Seen =
  | { kind: 'lobby'; view: LobbyView } | { kind: 'view'; view: PlayerView } | { kind: 'state'; state: MatchState; confirmed: readonly ConfirmedCommand[] }
  | { kind: 'replay'; replay: CombatReplay } | { kind: 'refused'; refusal: RefusedCommand } | { kind: 'connection'; status: ConnectionStatus };

class MemoryStorage { readonly map = new Map<string, string>(); getItem(key: string) { return this.map.get(key) ?? null; } setItem(key: string, value: string) { this.map.set(key, value); } removeItem(key: string) { this.map.delete(key); } }

interface Probe {
  readonly client: WsGameClient;
  readonly seen: Seen[];
  readonly sockets: WebSocket[];
  readonly storage: MemoryStorage;
  /** Every raw server message, to assert on wire order. */
  readonly wire: ServerMessage[];
  last<K extends Seen['kind']>(kind: K): Extract<Seen, { kind: K }> | null;
  count(kind: Seen['kind']): number;
}

let harness: NetHarness | null = null;
const probes: Probe[] = [];
afterEach(async () => { for (const probe of probes.splice(0)) probe.client.dispose(); await harness?.close(); harness = null; });

function probe(url: string, storage = new MemoryStorage()): Probe {
  const seen: Seen[] = [], sockets: WebSocket[] = [], wire: ServerMessage[] = [];
  const client = new WsGameClient({
    url, storage, backoffMs: [20, 40],
    createSocket: target => {
      const socket = new WebSocket(target);
      socket.addEventListener('message', event => wire.push(JSON.parse(String(event.data)) as ServerMessage));
      sockets.push(socket); return socket;
    },
  });
  client.listen({
    lobby: view => seen.push({ kind: 'lobby', view }), view: view => seen.push({ kind: 'view', view }),
    state: (state, confirmed) => seen.push({ kind: 'state', state, confirmed: confirmed ?? [] }), replay: replay => seen.push({ kind: 'replay', replay }),
    refused: refusal => seen.push({ kind: 'refused', refusal }), connection: status => seen.push({ kind: 'connection', status }),
  });
  const result: Probe = {
    client, seen, sockets, storage, wire,
    last: kind => { for (let index = seen.length - 1; index >= 0; index--) if (seen[index]!.kind === kind) return seen[index] as never; return null; },
    count: kind => seen.filter(entry => entry.kind === kind).length,
  };
  probes.push(result);
  return result;
}

async function until(predicate: () => boolean, what: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
const lobbyJoined = (p: Probe) => p.last('lobby')?.view.joined === true;
const inMatch = (p: Probe) => p.last('state') !== null && p.last('view') !== null && p.last('view')!.view.phase.kind !== 'lobby';

/** Two browser clients join, A starts, both hold their first view and state. */
async function seatTwo(h: NetHarness): Promise<[Probe, Probe]> {
  const a = probe(h.url), b = probe(h.url);
  await until(() => a.last('lobby') !== null && b.last('lobby') !== null, 'first lobby');
  a.client.joinQueue('甲'); await until(() => lobbyJoined(a), 'A queued');
  b.client.joinQueue('乙'); await until(() => lobbyJoined(b) && a.last('lobby')!.view.queue.length === 2, 'B queued');
  a.client.startMatch();
  await until(() => inMatch(a) && inMatch(b), 'match started');
  return [a, b];
}

describe('WsGameClient: pending commands', () => {
  it('keeps the local state until the receipt and confirms through the following state push; a refusal changes nothing', async () => {
    harness = await startServer();
    const [a, b] = await seatTwo(harness);
    expect(a.client.transport).toBe('websocket');
    expect(JSON.parse(a.storage.getItem(tokenStorageKey(harness.url))!).token).toEqual(expect.any(String));
    const before = a.last('state')!.state, statesBefore = a.count('state');
    const sent = a.client.send({ type: 'shopLock', locked: !before.shop.locked, generation: before.shop.generation });
    expect(sent).toEqual({ ok: 'pending', commandId: expect.any(Number) });
    if (sent.ok !== 'pending') throw new Error('not pending');
    expect(a.count('state')).toBe(statesBefore); // nothing changes locally while pending
    expect(a.client.pendingCount).toBe(1);
    await until(() => a.count('state') > statesBefore, 'confirming state');
    const confirmed = a.last('state')!;
    expect(confirmed.confirmed.map(entry => entry.commandId)).toEqual([sent.commandId]);
    expect(confirmed.state.shop.locked).toBe(!before.shop.locked);
    // Receipt precedes the state on the wire.
    const receiptAt = a.wire.findIndex(message => message.type === 'receipt' && message.commandId === sent.commandId);
    expect(a.wire.slice(receiptAt + 1).some(message => message.type === 'state')).toBe(true);
    // A rule refusal: no state push, the gold and shop stay, the reason reaches the UI.
    const goldBefore = confirmed.state.gold, states = a.count('state');
    const stale = a.client.send({ type: 'buy', slot: 0, generation: confirmed.state.shop.generation + 99 });
    if (stale.ok !== 'pending') throw new Error('not pending');
    await until(() => a.last('refused') !== null, 'refusal');
    expect(a.last('refused')!.refusal).toEqual({ commandId: stale.commandId, reason: 'stale-shop', retry: false });
    expect(a.count('state')).toBe(states);
    expect(a.last('state')!.state.gold).toBe(goldBefore);
    // B never saw A's shop: its own state only, and its view lists A's public data.
    expect(b.last('view')!.view.seats.some(seat => seat.name === '甲')).toBe(true);
    // B7: the wire carries only the private seat view (no seed/RNG); B's display state is built from B's own seat.
    for (const message of b.wire) if (message.type === 'state') { expect('seed' in message.state).toBe(false); expect('rngState' in message.state).toBe(false); }
    const seatB = harness.server.room!.state.seats.find(seat => seat.seatId === b.last('view')!.view.mySeatId)!;
    expect(b.last('state')!.state.shop).toEqual(JSON.parse(JSON.stringify(toSeatPrivateView(seatB.match).shop)));
  });

  it('pipelines consecutive commands with increasing seatRevision and reports a stale one once nothing is in flight', async () => {
    harness = await startServer();
    const [a] = await seatTwo(harness);
    const base = a.last('state')!.state;
    const first = a.client.send({ type: 'shopLock', locked: !base.shop.locked, generation: base.shop.generation });
    const second = a.client.send({ type: 'shopLock', locked: Boolean(base.shop.locked), generation: base.shop.generation });
    if (first.ok !== 'pending' || second.ok !== 'pending') throw new Error('not pending');
    expect(second.commandId).toBe(first.commandId + 1);
    await until(() => a.client.pendingCount === 0 && a.seen.filter(entry => entry.kind === 'state').flatMap(entry => (entry as { confirmed: readonly ConfirmedCommand[] }).confirmed).length === 2, 'both confirmed');
    expect(Boolean(a.last('state')!.state.shop.locked)).toBe(Boolean(base.shop.locked));
    expect(a.last('refused')).toBeNull();
    // A failing command followed by a pipelined one: the second was decided against a revision that never came.
    const now = a.last('state')!.state;
    a.client.send({ type: 'buy', slot: 0, generation: now.shop.generation + 99 });
    const follower = a.client.send({ type: 'shopLock', locked: !now.shop.locked, generation: now.shop.generation });
    if (follower.ok !== 'pending') throw new Error('not pending');
    await until(() => a.seen.filter(entry => entry.kind === 'refused').length === 2, 'two refusals');
    const refusals = a.seen.filter((entry): entry is Extract<Seen, { kind: 'refused' }> => entry.kind === 'refused').map(entry => entry.refusal);
    expect(refusals[0]).toMatchObject({ reason: 'stale-shop', retry: false });
    expect(refusals[1]).toEqual({ commandId: follower.commandId, reason: 'seat-revision-mismatch', retry: true });
    // Retrying by hand works.
    const retry = a.client.send({ type: 'shopLock', locked: !now.shop.locked, generation: now.shop.generation });
    if (retry.ok !== 'pending') throw new Error('not pending');
    await until(() => a.last('state')!.confirmed.some(entry => entry.commandId === retry.commandId), 'retry confirmed');
  });
});

describe('WsGameClient: reconnect and resume', () => {
  it('reconnects a dropped socket with the stored token and restores view → state in snapshot order', async () => {
    harness = await startServer();
    const [a, b] = await seatTwo(harness);
    const seatA = a.last('view')!.view.mySeatId;
    const seen = a.seen.length, wire = a.wire.length;
    a.sockets[0]!.close(); // network drop
    await until(() => a.seen.slice(seen).some(entry => entry.kind === 'connection' && entry.status.kind === 'reconnecting'), 'reconnecting');
    await until(() => b.last('view')!.view.seats.find(seat => seat.seatId === seatA)!.connected === false, 'B sees A offline');
    expect(a.client.send({ type: 'reroll' })).toMatchObject({ ok: false }); // nothing is sent while offline
    await until(() => a.client.connection?.kind === 'online' && a.sockets.length === 2, 'resumed');
    await until(() => a.wire.slice(wire).some(message => message.type === 'state'), 'snapshot');
    const order = a.wire.slice(wire).map(message => message.type);
    expect(order.slice(0, 4)).toEqual(['lobby', 'receipt', 'view', 'state']);
    await until(() => b.last('view')!.view.seats.find(seat => seat.seatId === seatA)!.connected === true, 'B sees A back');
    // The commandId counter continues above the seat's last id: the next command is new, not a replay.
    const resumed = a.wire.slice(wire).find(message => message.type === 'receipt')!;
    const lastId = resumed.type === 'receipt' && resumed.ok && resumed.result.kind === 'resumed' ? resumed.result.lastCommandId : -1;
    const state = a.last('state')!.state;
    const next = a.client.send({ type: 'shopLock', locked: !state.shop.locked, generation: state.shop.generation });
    if (next.ok !== 'pending') throw new Error('not pending');
    expect(next.commandId).toBeGreaterThan(lastId);
    await until(() => a.last('state')!.confirmed.some(entry => entry.commandId === next.commandId), 'applied after resume');
  });

  it('returns a reloaded page to its seat from storage and supersedes the old tab, which stops for good', async () => {
    harness = await startServer();
    const [a, b] = await seatTwo(harness);
    const seatA = a.last('view')!.view.mySeatId;
    const reloaded = probe(harness.url, a.storage); // same localStorage: a reload, a reopened tab or a second tab of the same page
    await until(() => inMatch(reloaded), 'reloaded page in match');
    expect(reloaded.last('view')!.view.mySeatId).toBe(seatA);
    await until(() => a.client.connection?.kind === 'superseded', 'old tab superseded');
    expect(a.client.send({ type: 'reroll' })).toMatchObject({ ok: false });
    // The reloaded page acts (still in the preparation phase); B is unaffected.
    const state = reloaded.last('state')!.state;
    const sent = reloaded.client.send({ type: 'shopLock', locked: !state.shop.locked, generation: state.shop.generation });
    if (sent.ok !== 'pending') throw new Error('not pending');
    await until(() => reloaded.last('state')!.confirmed.some(entry => entry.commandId === sent.commandId), 'reloaded command applied');
    expect(b.last('view')!.view.seats.find(seat => seat.seatId === seatA)!.connected).toBe(true);
    harness.clock.advance(1_000); // server closes the superseded socket (4001)
    await until(() => a.sockets[0]!.readyState === WebSocket.CLOSED, 'old socket closed');
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(a.sockets).toHaveLength(1); // no reconnect after being superseded
    expect(a.client.connection?.kind).toBe('superseded');
  });

  it('treats a queue drop as leaving the queue and a dead token as a lost seat', async () => {
    harness = await startServer();
    const c = probe(harness.url);
    await until(() => c.last('lobby') !== null, 'lobby');
    c.client.joinQueue('丙'); await until(() => lobbyJoined(c), 'queued');
    c.sockets[0]!.close();
    await until(() => c.client.connection?.kind === 'online' && c.sockets.length === 2, 'reconnected');
    expect(c.client.hasToken).toBe(false);
    expect(c.storage.getItem(tokenStorageKey(harness.url))).toBeNull();
    expect(c.seen.some(entry => entry.kind === 'connection' && entry.status.kind === 'seat-lost')).toBe(true);
    await until(() => c.last('lobby')!.view.queue.length === 0, 'queue empty');
    expect(c.last('lobby')!.view).toMatchObject({ joined: false, error: expect.stringContaining('退出队列') });
    // A token the server does not know (restart, ended match): back to matchmaking, token cleared.
    const stale = new MemoryStorage();
    stale.setItem(tokenStorageKey(harness.url), JSON.stringify({ url: harness.url, token: 'not-a-token' }));
    const d = probe(harness.url, stale);
    await until(() => d.seen.some(entry => entry.kind === 'connection' && entry.status.kind === 'seat-lost'), 'seat lost');
    expect(stale.getItem(tokenStorageKey(harness.url))).toBeNull();
    expect(d.last('lobby')!.view.joined).toBe(false);
  });
});

describe('WsGameClient: persistent seat token (C7)', () => {
  it('keeps one token per server address; a closed tab reopened on the same address resumes its seat', async () => {
    harness = await startServer();
    const [a] = await seatTwo(harness);
    const seatA = a.last('view')!.view.mySeatId;
    const stored = JSON.parse(a.storage.getItem(tokenStorageKey(harness.url))!) as { url: string; token: string };
    expect(stored.url).toBe(harness.url);
    // Another server address never sees this seat.
    expect(a.storage.getItem(tokenStorageKey('ws://127.0.0.1:1'))).toBeNull();
    // Close the tab (dispose, socket gone), then open the same address with the same storage.
    a.client.dispose();
    await until(() => harness!.server.room!.state.seats.find(seat => seat.seatId === seatA)!.connected === false, 'seat shown disconnected');
    const reopened = probe(harness.url, a.storage);
    await until(() => inMatch(reopened), 'reopened page in match');
    expect(reopened.last('view')!.view.mySeatId).toBe(seatA);
    expect(harness.server.room!.state.seats.find(seat => seat.seatId === seatA)!.connected).toBe(true);
  });

  it('clears the token once the match ended, and when a new match revoked the seat', async () => {
    harness = await startServer({}, new DamageResolver(() => 100, false));
    const [a, b] = await seatTwo(harness);
    harness.clock.advance(TIMINGS.preparationMs); // everyone dies at once → ended
    await until(() => a.last('view')?.view.phase.kind === 'ended' && b.last('view')?.view.phase.kind === 'ended', 'ended');
    expect(a.storage.getItem(tokenStorageKey(harness.url))).toBeNull();
    expect(a.client.hasToken).toBe(false);
    // B still holds a token written before the end in a second storage (an old tab): a new match revokes it.
    b.storage.setItem(tokenStorageKey(harness.url), JSON.stringify({ url: harness.url, token: 'stale' }));
    const c = probe(harness.url);
    await until(() => c.last('lobby') !== null, 'lobby for C');
    c.client.joinQueue('丙'); await until(() => lobbyJoined(c), 'C queued');
    c.client.startMatch();
    await until(() => inMatch(c), 'second match started');
    await until(() => b.last('lobby') !== null && b.client.currentSeatId === null, 'B told its seat is gone');
    expect(b.storage.getItem(tokenStorageKey(harness.url))).toBeNull();
    expect(b.last('lobby')!.view.joined).toBe(false);
  });
});

describe('WsGameClient: battle replay', () => {
  it('hands each battle over once as a replay, even after a resume snapshot repeats it', async () => {
    harness = await startServer({}, new DamageResolver(() => 1));
    const [a] = await seatTwo(harness);
    for (let fired = 0; fired < 200 && a.count('replay') === 0; fired++) { harness.clock.runNext(); await new Promise(resolve => setTimeout(resolve, 5)); }
    await until(() => a.count('replay') === 1, 'replay');
    const sent = a.wire.filter((message): message is Extract<ServerMessage, { type: 'replay' }> => message.type === 'replay');
    expect(sent).toHaveLength(1);
    expect(a.last('replay')!.replay).toEqual(sent[0]!.replay);
    expect(a.wire.some(message => (message as { type: string }).type === 'combat')).toBe(false);
    // Same battle again in a resume snapshot: not replayed.
    a.sockets[0]!.close();
    await until(() => a.client.connection?.kind === 'online' && a.sockets.length === 2, 'resumed');
    await until(() => a.wire.filter(message => message.type === 'replay').length === 2, 'snapshot replay');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(a.count('replay')).toBe(1);
  });
});

describe('WsGameClient: little-legend walks', () => {
  it('sends a walk with no receipt or pending command and hands every seat the room\'s walk with its server time', async () => {
    harness = await startServer();
    const [a, b] = await seatTwo(harness);
    const room = harness.server.room!;
    for (let fired = 0; fired < 50 && room.state.phase !== 'preparation'; fired++) harness.clock.runNext();
    await until(() => a.last('view')!.view.phase.kind === 'preparation', 'preparation');
    const walks: { seatId: string; serverNow: number }[] = [];
    b.client.listen({ lobby() {}, view() {}, state() {}, replay() {}, legend: (walk, serverNow) => walks.push({ seatId: walk.seatId, serverNow }) });
    expect(a.client.walk({ scene: 'board', from: { x: 9, y: 9 }, to: { x: 1, y: 2 } })).toBe(true);
    expect(a.client.pendingCount).toBe(0);
    await until(() => walks.length === 1, 'legend push');
    expect(walks[0]).toEqual({ seatId: a.last('view')!.view.mySeatId, serverNow: harness.clock.now() });
    expect(a.wire.some(message => message.type === 'receipt' && message.ok === false)).toBe(false);
  });
});
