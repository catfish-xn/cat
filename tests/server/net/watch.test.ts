import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { NET_PROTOCOL_VERSION, parseClientMessage, type ServerMessage } from '../../../src/server/net/messages';
import type { TestClient } from '../../../src/server/net/test-client';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import { mirrorCombatReplay, toCombatReplayFor } from '../../../src/server/room/projection';
import type { Room } from '../../../src/server/room/room';
import type { RoomState } from '../../../src/server/room/types';
import type { CombatReplay } from '../../../src/server-entry';
import { WsGameClient } from '../../../src/rendering/online/ws-client';
import { runUntil } from '../helpers';
import { expectOk, flush, hasKey, messagesOfType, seatTwo, startServer, type NetHarness } from './helpers';

type WatchReplay = Extract<ServerMessage, { type: 'watch-replay' }>;
let harness: NetHarness | null = null;
const browserClients: WsGameClient[] = [];
const cleanup = async () => {
  for (const client of browserClients.splice(0)) client.dispose();
  await harness?.close(); harness = null;
};
afterEach(cleanup);
afterAll(cleanup);

/** Watch is connection-level: never use TestClient.send, which waits for a receipt. */
function watch(client: TestClient, seatId: string | null, roomId = 'net-room'): number {
  const commandId = client.commandCounter;
  client.commandCounter = commandId + 1;
  client.sendRaw(JSON.stringify({ type: 'watch', protocolVersion: NET_PROTOCOL_VERSION, commandId, roomId, seatId }));
  return commandId;
}
async function watchReplay(client: TestClient, seatId: string): Promise<WatchReplay> {
  const from = client.inbox.length;
  watch(client, seatId);
  return client.waitFor<WatchReplay>(message => message.type === 'watch-replay' && message.seatId === seatId, 5_000, from);
}
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));
async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) { if (predicate()) return; await flush(10); }
  throw new Error('watch condition did not become observable');
}

/** Same room-state seam as live-bank-wire.test.ts; only arrange a real D11 gold reader before freezing. */
function bindAvarice(room: Room): void {
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => {
    const unit = seat.match.preparation.units.find(entry => entry.team === 'player' && entry.location.kind === 'board')!;
    expect(unit).toBeDefined();
    return { ...seat, match: { ...seat.match, anomalyBinding: {
      definitionId: 'avarice-incarnate', unitId: unit.id, choiceId: 'test-watch-avarice', boundRound: seat.match.round,
    } } };
  }) };
}

/** All seats human so both sides have their own wire replay, and a third connection watches side B. */
async function liveBattle() {
  harness = await startServer({}, new TwoSidedBattleResolver());
  const clients: TestClient[] = [];
  for (let index = 0; index < 8; index++) {
    const client = await harness.connect(); expectOk(await client.join(`watch-${index}`)); clients.push(client);
  }
  expectOk(await clients[0]!.start());
  await Promise.all(clients.map(client => client.waitFor(message => message.type === 'state')));
  const room = harness.server.room!;
  runUntil(room, harness.clock, state => state.round === 5 && state.phase === 'preparation');
  bindAvarice(room);
  runUntil(room, harness.clock, state => state.phase === 'battle');
  const battle = room.state.battles.find(entry => entry.kind === 'two-sided');
  expect(battle?.kind).toBe('two-sided');
  if (battle?.kind !== 'two-sided') throw new Error('expected PvP');
  const a = clients.find(client => client.seatId === battle.battle.a.seatId)!;
  const b = clients.find(client => client.seatId === battle.battle.b.seatId)!;
  const observer = clients.find(client => !battle.participants.includes(client.seatId!))!;
  await Promise.all(clients.map(client => client.waitFor(message => message.type === 'replay' && message.round === 5)));
  await b.waitFor(message => message.type === 'state' && message.seatRevision === room.state.seats.find(seat => seat.seatId === b.seatId)!.seatRevision);
  return { h: harness, room, clients, a, b, observer, battle };
}
async function revise(h: NetHarness, target: TestClient): Promise<void> {
  h.clock.advance(400);
  const seat = h.server.room!.state.seats.find(seat => seat.seatId === target.seatId)!;
  expectOk(await target.command({ type: 'buyXp' }, { round: h.server.room!.state.round, seatRevision: seat.seatRevision }));
}
async function finishBattle(h: NetHarness): Promise<void> {
  for (let guard = 0; h.server.room!.state.phase === 'battle' && guard < 400; guard++) {
    h.clock.advance(200); await flush(5);
  }
  expect(h.server.room!.state.phase).not.toBe('battle');
  expect(h.server.room!.state.fault).toBeNull();
  await flush();
}

describe('watch wire contract', () => {
  it('accepts start/stop on the current protocol and validates room/seat shapes', () => {
    const envelope = { type: 'watch', protocolVersion: NET_PROTOCOL_VERSION, commandId: 7, roomId: 'net-room' };
    for (const seatId of ['other', null]) expect(parseClientMessage(JSON.stringify({ ...envelope, seatId }))).toEqual({ ok: true, message: { ...envelope, seatId } });
    for (const bad of [{ seatId: 1 }, { seatId: '' }, { seatId: 'other', roomId: 1 }, { seatId: 'other', roomId: '' }, { seatId: 'other', extra: true }])
      expect(parseClientMessage(JSON.stringify({ ...envelope, ...bad })).ok).toBe(false);
    expect(parseClientMessage(JSON.stringify(envelope)).ok).toBe(false);
  });

  describe('sends the watched replay once, without a receipt, rule mutation or dedupe entry fixture', () => {
    let observer: TestClient, target: TestClient, room: Room;
    beforeAll(async () => { harness = await startServer(); });
    beforeAll(async () => {
      [observer, target] = await seatTwo(harness!); room = harness!.server.room!;
      runUntil(room, harness!.clock, state => state.phase === 'battle');
    });
    it('sends the watched replay once, without a receipt, rule mutation or dedupe entry', async () => {
    await observer.waitFor(message => message.type === 'replay'); await flush();
    const before = room.state, dedupe = harness!.server.retained.dedupeEntries;
    const from = observer.inbox.length, targetFrom = target.inbox.length;
    const commandId = watch(observer, target.seatId!);
    const replay = await observer.waitFor<WatchReplay>(message => message.type === 'watch-replay', 5_000, from);
    expect(replay).toEqual({ type: 'watch-replay', roomId: room.state.roomId, round: room.state.round,
      seatId: target.seatId, battleId: toCombatReplayFor(room.state, target.seatId!)!.battleId,
      replay: wire(toCombatReplayFor(room.state, target.seatId!)!.replay) });
    watch(observer, target.seatId!); await flush();
    expect(messagesOfType(observer.inbox.slice(from), 'watch-replay')).toHaveLength(1);
    expect(observer.inbox.some(message => message.type === 'receipt' && message.commandId === commandId)).toBe(false);
    expect(target.inbox.slice(targetFrom)).toEqual([]);
    expect(room.state).toBe(before);
    expect(harness!.server.retained.dedupeEntries).toBe(dedupe);
    expect(hasKey(replay, 'unitIds')).toBe(false);
  });
  });

  it('ignores invalid rooms, self/nonexistent seats and unauthenticated watches without affecting another watcher', async () => {
    harness = await startServer();
    const [a, b] = await seatTwo(harness), outsider = await harness.connect(), room = harness.server.room!;
    runUntil(room, harness.clock, state => state.phase === 'battle');
    await watchReplay(b, a.seatId!); await flush();
    const before = room.state, bFrom = b.inbox.length, aFrom = a.inbox.length;
    watch(a, 'missing-seat'); watch(a, a.seatId!); watch(a, b.seatId!, 'another-room');
    watch(outsider, b.seatId!); await flush();
    expect(messagesOfType(a.inbox.slice(aFrom), 'watch-replay')).toEqual([]);
    expect(messagesOfType(outsider.inbox, 'watch-replay')).toEqual([]);
    expect(b.inbox.slice(bFrom)).toEqual([]);
    expect(room.state).toBe(before);
    await watchReplay(a, b.seatId!); // invalid requests did not poison the connection
    const from = a.inbox.length;
    watch(a, 'missing-seat'); watch(a, b.seatId!);
    await a.waitFor(message => message.type === 'watch-replay', 5_000, from); // invalid seat cleared the old watch
  });

  describe('sends nothing for an identical battle replacement and sends a whole replay again for the next battle fixture', () => {
    let observer: TestClient, target: TestClient, room: Room;
    beforeAll(async () => { harness = await startServer({}, new TwoSidedBattleResolver()); });
    beforeAll(async () => {
      [observer, target] = await seatTwo(harness!); room = harness!.server.room!;
      runUntil(room, harness!.clock, state => state.phase === 'battle');
    });
    it('sends nothing for an identical battle replacement and sends a whole replay again for the next battle', async () => {
    const opening = await watchReplay(observer, target.seatId!);
    const from = observer.inbox.length;
    // A publication with new battle identities but identical public records must exercise replayTail's null path.
    (room as unknown as { replace(state: RoomState): void }).replace({ ...room.state, battles: wire(room.state.battles) });
    await flush();
    expect(messagesOfType(observer.inbox.slice(from), 'watch-replay')).toEqual([]);
    expect(messagesOfType(observer.inbox.slice(from), 'watch-tail')).toEqual([]);

    runUntil(room, harness!.clock, state => state.round > opening.round && state.phase === 'battle');
    const next = await observer.waitFor<WatchReplay>(message => message.type === 'watch-replay' && message.round === room.state.round, 5_000, from);
    await flush();
    expect(next).toEqual({ type: 'watch-replay', roomId: room.state.roomId, round: room.state.round,
      seatId: target.seatId, battleId: toCombatReplayFor(room.state, target.seatId!)!.battleId,
      replay: wire(toCombatReplayFor(room.state, target.seatId!)!.replay) });
    expect(next.battleId).not.toBe(opening.battleId);
    expect(messagesOfType(observer.inbox.slice(from), 'watch-replay')).toEqual([next]);
    expect(messagesOfType(observer.inbox.slice(from), 'watch-tail')).toEqual([]);
  });
  });

  it('WsGameClient resends its current watch after disconnect/resume and receives a fresh replay', async () => {
    harness = await startServer();
    const sockets: WebSocket[] = [], replays: { seatId: string; replay: CombatReplay }[] = [];
    let greeted = false, joined = false, active = false;
    const storage = new Map<string, string>();
    const client = new WsGameClient({ url: harness.url, backoffMs: [10],
      storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); } },
      createSocket: url => { const socket = new WebSocket(url); sockets.push(socket); return socket; },
    });
    browserClients.push(client);
    client.listen({ lobby: view => { greeted = true; joined = view.joined; }, view: view => { active = view.phase.kind === 'preparation'; }, state() {}, replay() {},
      watched: (seatId, replay) => replays.push({ seatId, replay }) });
    await until(() => greeted);
    client.joinQueue('observer'); await until(() => joined);
    const target = await harness.connect(); expectOk(await target.join('target')); expectOk(await target.start());
    await until(() => active);
    const room = harness.server.room!;
    runUntil(room, harness.clock, state => state.phase === 'battle');
    client.watch(target.seatId!); await until(() => replays.length === 1);
    sockets[0]!.close();
    await until(() => sockets.length === 2 && replays.length === 2);
    expect(replays[1]).toEqual(replays[0]);
    expect(replays[1]).toEqual({ seatId: target.seatId, replay: wire(toCombatReplayFor(room.state, target.seatId!)!.replay) });
    expect(harness.server.connectionCount).toBe(2);
  }, 20_000);

  it('does not confuse a reused battleId in a new round or a new battleId in the same round with a tail', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const [observer, target] = await seatTwo(harness), room = harness.server.room!;
    runUntil(room, harness.clock, state => state.phase === 'battle');
    const opening = await watchReplay(observer, target.seatId!);
    // Publish cloned results without advancing the clock: isolate each part of the connection's battle key.
    const publish = (state: RoomState) => (room as unknown as { replace(state: RoomState): void }).replace(state);
    let from = observer.inbox.length;
    const round = opening.round + 1;
    publish({ ...room.state, round, battles: wire(room.state.battles).map(battle => ({ ...battle, round })) });
    const reused = await observer.waitFor<WatchReplay>(message => message.type === 'watch-replay' && message.round === round, 5_000, from);
    expect(reused).toEqual({ ...opening, round });
    await flush();
    expect(messagesOfType(observer.inbox.slice(from), 'watch-replay')).toEqual([reused]);
    expect(messagesOfType(observer.inbox.slice(from), 'watch-tail')).toEqual([]);

    from = observer.inbox.length;
    const battleId = `${opening.battleId}:replacement`;
    publish({ ...room.state, battles: room.state.battles.map(battle => battle.battleId === opening.battleId ? { ...battle, battleId } : battle) });
    const replaced = await observer.waitFor<WatchReplay>(message => message.type === 'watch-replay' && message.battleId === battleId, 5_000, from);
    expect(replaced).toEqual({ ...reused, battleId });
    await flush();
    expect(messagesOfType(observer.inbox.slice(from), 'watch-replay')).toEqual([replaced]);
    expect(messagesOfType(observer.inbox.slice(from), 'watch-tail')).toEqual([]);
  });
});

describe('watch live-bank revisions and connection cleanup', () => {
  it('mirrors side B exactly like its own replay and streams continuous revisions through the final settled replay', async () => {
    const { h, room, a, b, observer, battle } = await liveBattle();
    const opening = await watchReplay(observer, b.seatId!);
    const ownB = messagesOfType(b.inbox, 'replay').find(message => message.round === 5)!;
    const ownA = messagesOfType(a.inbox, 'replay').find(message => message.round === 5)!;
    expect(opening.replay).toEqual(ownB.replay);
    expect(opening.replay).toEqual(mirrorCombatReplay(ownA.replay));
    expect(opening.replay.initial.units.length).toBeGreaterThan(0);
    expect(opening.replay.initial.units).not.toEqual(ownA.replay.initial.units);
    await revise(h, b); await finishBattle(h);
    const tails = messagesOfType(observer.inbox, 'watch-tail').filter(message => message.battleId === battle.battleId);
    expect(tails.length).toBeGreaterThan(1);
    const ownTails = messagesOfType(b.inbox, 'replay-tail').filter(message => message.battleId === battle.battleId);
    const aTails = messagesOfType(a.inbox, 'replay-tail').filter(message => message.battleId === battle.battleId);
    let shown = opening.replay;
    let previousFrom = -1;
    for (const tail of tails) {
      expect(tail).toMatchObject({ roomId: room.state.roomId, round: 5, seatId: b.seatId });
      expect(Number.isInteger(tail.fromTick)).toBe(true);
      expect(tail.fromTick).toBeGreaterThanOrEqual(0);
      expect(tail.fromTick).toBeLessThanOrEqual(shown.ticks.length); // no missing prefix; replacements may overlap
      expect(tail.fromTick).toBeGreaterThanOrEqual(previousFrom);
      previousFrom = tail.fromTick;
      expect(tail.ticks.length).toBeGreaterThan(0);
      for (let index = 1; index < tail.ticks.length; index++) expect(tail.ticks[index]!.tick).toBe(tail.ticks[index - 1]!.tick + 1);
      expect(ownTails).toContainEqual({ type: 'replay-tail', roomId: tail.roomId, round: tail.round, battleId: tail.battleId,
        fromTick: tail.fromTick, ticks: tail.ticks, terminal: tail.terminal });
      expect(aTails.some(aTail => {
        if (aTail.fromTick !== tail.fromTick) return false;
        const mirrored = mirrorCombatReplay({ initial: ownA.replay.initial, ticks: aTail.ticks, terminal: aTail.terminal });
        return JSON.stringify(mirrored.ticks) === JSON.stringify(tail.ticks) && JSON.stringify(mirrored.terminal) === JSON.stringify(tail.terminal);
      })).toBe(true);
      for (const key of ['bankSamples', 'liveGold', 'currentItemBankGold', 'openingItemBankGold', 'proposals', 'mapping']) expect(hasKey(tail, key)).toBe(false);
      shown = { initial: shown.initial, ticks: [...shown.ticks.slice(0, tail.fromTick), ...tail.ticks], terminal: tail.terminal };
    }
    // Adopting the finished live run replaces the BattleResult object, but the same battle only sends tails.
    expect(room.state.battles.find(entry => entry.battleId === battle.battleId)).not.toBe(battle);
    expect(messagesOfType(observer.inbox, 'watch-replay').filter(message => message.round === opening.round && message.battleId === battle.battleId)).toEqual([opening]);
    const final = observer.inbox.filter(message => (message.type === 'watch-replay' || message.type === 'watch-tail') && message.battleId === battle.battleId).at(-1);
    expect(final).toEqual(tails.at(-1));
    expect(tails.at(-1)!.terminal.status).toBe('finished');
    expect(shown.terminal.status).toBe('finished');
    expect(shown.ticks.at(-1)!.tick).toBe(shown.terminal.tick);
    expect(shown).toEqual(wire(toCombatReplayFor(room.state, b.seatId!)!.replay));
  }, 180_000);

  it('stops tails on null; closed and superseded observers receive no later revisions', async () => {
    const { h, b, observer, clients, battle } = await liveBattle();
    const stopped = observer;
    const closed = clients.find(client => client !== stopped && !battle.participants.includes(client.seatId!))!;
    const detached = clients.find(client => client !== stopped && client !== closed && !battle.participants.includes(client.seatId!))!;
    await watchReplay(stopped, b.seatId!); await watchReplay(closed, b.seatId!); await watchReplay(detached, b.seatId!);
    watch(stopped, null); await flush();
    await closed.close();
    const replacement = await h.connect(); expectOk(await replacement.resume(detached.token!));
    await detached.waitFor(message => message.type === 'error' && message.code === 'session-superseded');
    const starts = [stopped, closed, detached].map(client => client.inbox.length);
    const ownFrom = b.inbox.length;
    await revise(h, b);
    for (let guard = 0; !messagesOfType(b.inbox.slice(ownFrom), 'replay-tail').length && guard < 100; guard++) {
      h.clock.advance(200); await flush(5);
    }
    expect(messagesOfType(b.inbox.slice(ownFrom), 'replay-tail').length).toBeGreaterThan(0); // positive control
    for (const [index, client] of [stopped, closed, detached].entries()) {
      expect(messagesOfType(client.inbox.slice(starts[index]), 'watch-tail')).toEqual([]);
      expect(messagesOfType(client.inbox.slice(starts[index]), 'watch-replay')).toEqual([]);
    }
    expect(messagesOfType(replacement.inbox, 'watch-replay')).toEqual([]); // watch belongs to the old connection
    await Promise.all([...clients, replacement].filter(client => client.isOpen).map(client => client.close()));
    await until(() => h.server.connectionCount === 0);
    expect(h.server.retained.connections).toBe(0); // public retained-connection count; no watch-count hook is exported
    h.clock.advance(200); await flush();
    expect(h.server.connectionCount).toBe(0);
  }, 180_000);
});
