/**
 * G3 operations: a room that ends abnormally (resolver error, stalled phase, every player gone) hands the queue back
 * without a restart; GET /healthz reports build identity and live counts; the structured log never carries a credential.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Lobby, type LobbyWatchdog } from '../../src/server/room/lobby';
import type { Room } from '../../src/server/room/room';
import type { BattleJob, BattleResolver } from '../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { SharedPoolState } from '../../src/server-entry';
import type { BattleInput, BattleResult } from '../../src/server/room/types';
import { createJsonLogger, formatLogRecord, parseLogLevel, type LogFields, type LogLevel } from '../../src/server/log';
import { NET_PROTOCOL_VERSION } from '../../src/server/net/messages';
import type { HealthReport } from '../../src/server/net/server';
import { TIMINGS } from './helpers';
import { expectOk, flush, startServer, type NetHarness } from './net/helpers';

const WATCHDOG: LobbyWatchdog = { stallMs: 5_000, abandonMs: 3_000 };

function makeLobby(watchdog: LobbyWatchdog | null = WATCHDOG) {
  const clock = new ManualClock();
  const ended: Room[] = [];
  const lobby = new Lobby({ clock, resolver: new TwoSidedBattleResolver(), seed: 42, timings: TIMINGS, bots: null, watchdog, onEnd: room => ended.push(room) });
  const open = (name = '我') => {
    const joined = lobby.join(name); if (!joined.ok) throw new Error(joined.reason);
    const started = lobby.start(); if (!started.ok) throw new Error(started.reason);
    return { seatId: joined.seatId, room: started.room };
  };
  return { clock, lobby, ended, open };
}

/** Throws in the first battle of `round` only (like CAT_FAULT_INJECT_ROUND); every other battle is the real resolver's. */
class FaultOnce implements BattleResolver {
  private armed = true;
  private readonly inner = new TwoSidedBattleResolver();
  constructor(private readonly round: number) {}
  private trip(input: BattleInput): void { if (this.armed && input.round === this.round) { this.armed = false; throw new Error('injected fault'); } }
  resolveBattle(input: BattleInput, pool: SharedPoolState): BattleResult { this.trip(input); return this.inner.resolveBattle(input, pool); }
  startBattle(input: BattleInput, pool: SharedPoolState): BattleJob { this.trip(input); return this.inner.startBattle(input, pool); }
}

describe('G3 lobby watchdog', () => {
  it('ends a room whose phase deadline task was lost (stalled) and opens the queue again', () => {
    const { clock, ended, open } = makeLobby();
    const { room } = open();
    expect(room.state.phase).toBe('preparation');
    const deadline = room.state.deadlineAt!;
    // A task that died: the room's own deadline timer is gone, nothing will ever publish again.
    (room as unknown as { clearTimer(): void }).clearTimer();
    clock.advance(deadline - clock.now() + WATCHDOG.stallMs - 1);
    expect(room.state.phase).toBe('preparation');
    clock.advance(1);
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toMatchObject({ kind: 'stalled', phase: 'preparation' });
    expect(room.state.ranking).toBeNull();
    expect(ended).toEqual([room]);
    // Nothing of the old room is left on the clock, and a new match starts in the same lobby.
    expect(clock.pending).toBe(0);
    const next = open('下一局');
    expect(next.room).not.toBe(room);
    expect(next.room.state.phase).toBe('preparation');
  });

  it('never fires while the room keeps publishing, even when phases outlast the stall limit', () => {
    const { clock, open } = makeLobby({ stallMs: 50, abandonMs: 0 });
    const { room } = open();
    // TIMINGS phases are far longer than 50 ms: the limit counts from the phase deadline, not from the last publication.
    for (let round = room.state.round; room.state.round < round + 3 && room.state.phase !== 'ended';) clock.runNext();
    expect(room.state.fault).toBeNull();
  });

  it('ends a room once every human seat stayed disconnected for abandonMs; a reconnect in between resets the count', () => {
    const { clock, lobby, ended, open } = makeLobby({ stallMs: 0, abandonMs: WATCHDOG.abandonMs });
    const { seatId, room } = open();
    room.setConnected(seatId, false);
    clock.advance(WATCHDOG.abandonMs - 1);
    room.setConnected(seatId, true);
    clock.advance(WATCHDOG.abandonMs);
    expect(room.state.fault).toBeNull();
    room.setConnected(seatId, false);
    const left = clock.now();
    for (let guard = 0; room.state.phase !== 'ended' && guard < 1_000; guard++) clock.runNext();
    expect(room.state.fault).toEqual({ kind: 'abandoned', idleMs: WATCHDOG.abandonMs });
    expect(clock.now()).toBe(left + WATCHDOG.abandonMs);
    expect(ended).toEqual([room]);
    expect(lobby.join('新玩家').ok).toBe(true);
  });

  it('is off without a watchdog; an abort is reported once through onEnd', () => {
    const { clock, ended, open } = makeLobby(null);
    const { seatId, room } = open();
    room.setConnected(seatId, false);
    clock.advance(4 * TIMINGS.preparationMs);
    // No watchdog: the abandoned room plays on by its own deadlines.
    expect(room.state.fault).toBeNull();
    expect(room.abort({ kind: 'abandoned', idleMs: 0 })).toBe(true);
    expect(room.abort({ kind: 'abandoned', idleMs: 0 })).toBe(false);
    expect(ended).toEqual([room]);
  });
});

describe('G3 network server', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  const BUILD = { sha: 'abc123', contentDigest: 'fnv1a32-utf16:00000001', lootReplayDigest: 'fnv1a32-utf16:00000002' };

  it('recovers from a resolver error: last view to everyone, credentials released, the next match starts', async () => {
    const records: { level: LogLevel; event: string; fields: LogFields }[] = [];
    harness = await startServer({ logger: (level, event, fields = {}) => records.push({ level, event, fields }), build: BUILD }, new FaultOnce(2));
    const { server, clock } = harness;
    const a = await harness.connect(), b = await harness.connect();
    expectOk(await a.join('甲')); expectOk(await b.join('乙'));
    expectOk(await a.start());
    const first = server.room!;
    for (let guard = 0; first.state.phase !== 'ended' && guard < 2_000; guard++) clock.runNext();
    expect(first.state.fault).toMatchObject({ kind: 'resolver-error' });
    expect(first.state.round).toBe(2);
    // Both players see why the match ended.
    const views = await Promise.all([a, b].map(client => client.waitForView(view => view.phase.kind === 'ended')));
    for (const view of views) expect(view.fault?.kind).toBe('resolver-error');
    await flush();
    // The room's credentials died with it: an old token no longer resumes, and nothing of the room runs on.
    expect(server.retained.sessions).toBe(0);
    expect(first.retained).toEqual({ timers: 0, listeners: 1, frozenInputs: 0, pendingSettlement: false, resolving: false });
    expect(server.health()).toMatchObject({ room: { phase: 'ended', fault: 'resolver-error' }, seatsOnline: 0, queue: 0 });
    const stale = await a.resume(a.token!);
    expect(stale).toMatchObject({ ok: false, reason: 'invalid-token' });
    // Same connections queue again and play past the round that failed.
    expectOk(await a.join('甲'));
    expectOk(await b.join('乙'));
    expect(server.health()).toMatchObject({ queue: 2, seatsOnline: 2 });
    expectOk(await b.start());
    const second = server.room!;
    expect(second).not.toBe(first);
    for (let guard = 0; second.state.round < 3 && second.state.phase !== 'ended' && guard < 2_000; guard++) clock.runNext();
    expect(second.state.fault).toBeNull();
    expect(second.state.round).toBe(3);
    await flush();
    expect(server.health()).toMatchObject({ room: { phase: second.state.phase, round: 3, fault: null, humans: 2, humansConnected: 2 }, seatsOnline: 2, queue: 0 });
    // The log tells the story with structured records and never carries a credential.
    const events = records.map(record => record.event);
    expect(events).toEqual(expect.arrayContaining(['seat.joined', 'room.started', 'room.phase', 'room.ended', 'room.released', 'queue.start']));
    expect(records.find(record => record.event === 'room.ended')).toMatchObject({ level: 'warn', fields: { result: 'fault', fault: 'resolver-error' } });
    const text = JSON.stringify(records);
    for (const token of [a.token, b.token]) expect(text).not.toContain(token);
    expect(text).not.toMatch(/"token"/);
  }, 60_000);

  it('ends a match every player left (abandoned) and lets the next one start', async () => {
    harness = await startServer({ watchdog: { stallMs: 0, abandonMs: 2_000 } }, new TwoSidedBattleResolver());
    const { server, clock } = harness;
    const a = await harness.connect();
    expectOk(await a.join('甲')); expectOk(await a.start());
    await a.waitFor(message => message.type === 'state');
    const first = server.room!;
    a.close();
    await flush();
    expect(first.state.seats.find(seat => seat.seatId === a.seatId)!.connected).toBe(false);
    clock.advance(2_000);
    await flush();
    expect(first.state.fault).toEqual({ kind: 'abandoned', idleMs: 2_000 });
    expect(server.retained.sessions).toBe(0);
    const c = await harness.connect();
    expectOk(await c.join('丙')); expectOk(await c.start());
    expect(server.room).not.toBe(first);
    expect(server.room!.state.phase).toBe('preparation');
  }, 30_000);

  it('answers GET /healthz (also under a proxy prefix) with build identity and counts, 426 elsewhere', async () => {
    harness = await startServer({ build: BUILD, processStats: () => ({ uptimeSec: 12, rssBytes: 3456 }) });
    const base = `http://127.0.0.1:${harness.server.port}`;
    const empty = await (await fetch(`${base}/healthz`)).json() as HealthReport;
    expect(empty).toEqual({ status: 'ok', ...BUILD, netProtocol: NET_PROTOCOL_VERSION, roomProtocol: 1, room: null, seatsOnline: 0, queue: 0, capacity: 8, connections: 0, uptimeSec: 12, rssBytes: 3456 });
    const a = await harness.connect();
    expectOk(await a.join('甲'));
    const response = await fetch(`${base}/ws/healthz`);
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ queue: 1, seatsOnline: 1, connections: 1, room: null });
    expectOk(await a.start());
    await a.waitFor(message => message.type === 'view');
    expect(await (await fetch(`${base}/healthz?x=1`)).json()).toMatchObject({ room: { roomId: 'net-room', phase: 'preparation', round: 1, humans: 1, humansConnected: 1, alive: 8, fault: null }, queue: 0, seatsOnline: 1 });
    expect((await fetch(`${base}/`)).status).toBe(426);
    expect((await fetch(`${base}/healthz`, { method: 'POST' })).status).toBe(405);
    // The WebSocket upgrade still works on any path, the health endpoint never carries a token or a name.
    expect(JSON.stringify(harness.server.health())).not.toContain(a.token!);
    expect(JSON.stringify(harness.server.health())).not.toContain('甲');
  }, 30_000);
});

describe('G3 structured log', () => {
  it('orders ts, level, event, roomId, seatId first, drops undefined and credential keys, and filters by level', () => {
    expect(formatLogRecord('T', 'info', 'seat.joined', { connection: 3, seatId: 's1', roomId: 'r', token: 'secret-value', extra: undefined }))
      .toBe('{"ts":"T","level":"info","event":"seat.joined","roomId":"r","seatId":"s1","connection":3}');
    const lines: string[] = [];
    const log = createJsonLogger({ level: 'warn', write: line => lines.push(line), now: () => 'T' });
    log('info', 'room.phase', { phase: 'preparation' });
    log('warn', 'room.ended', { fault: 'stalled' });
    log('error', 'task.failed', { error: 'x' });
    expect(lines.map(line => JSON.parse(line).event)).toEqual(['room.ended', 'task.failed']);
    expect(parseLogLevel(undefined)).toBe('info');
    expect(parseLogLevel(' DEBUG ')).toBe('debug');
    expect(() => parseLogLevel('verbose')).toThrow(RangeError);
  });
});
