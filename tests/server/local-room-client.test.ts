/**
 * The in-browser GameClient over the real room (C3). It lives in src/rendering/online but has no
 * DOM dependency when a ManualClock is injected, so it is exercised here next to the room it drives.
 */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import type { MatchState } from '../../src/simulation/match-types';
import { LocalRoomClient, type LocalRoomOptions } from '../../src/rendering/online/local-room-client';
import type { ClientListeners, CombatFrame, LobbyView, PlayerView } from '../../src/rendering/online/protocol';

const OPTIONS: Omit<LocalRoomOptions, 'clock'> = { seed: 42, preparationMs: 1_000, choiceMs: 500, settlementMs: 200, myName: '测试', faultAtRound: null, pvpMode: 'placeholder' };

function harness(overrides: Partial<LocalRoomOptions> = {}) {
  const clock = new ManualClock();
  const client = new LocalRoomClient({ ...OPTIONS, clock, ...overrides });
  const log = { lobby: [] as LobbyView[], view: [] as PlayerView[], state: [] as MatchState[], combat: [] as (readonly CombatFrame[])[] };
  const listeners: ClientListeners = { lobby: v => log.lobby.push(v), view: v => log.view.push(v),
    state: s => log.state.push(s), combat: f => log.combat.push(f) };
  client.listen(listeners);
  const flush = () => new Promise<void>(resolve => queueMicrotask(resolve));
  /** Fires room timers one at a time (flushing the coalesced pushes) until the predicate holds. */
  const runUntil = async (predicate: () => boolean, maxTimers = 3_000) => {
    for (let fired = 0; fired < maxTimers; fired++) { await flush(); if (predicate()) return; if (!clock.runNext()) break; }
    await flush(); if (!predicate()) throw new Error(`never reached: last view ${JSON.stringify(log.view.at(-1)?.phase)}`);
  };
  return { clock, client, log, flush, runUntil, last: () => log.view.at(-1)! };
}

describe('LocalRoomClient', () => {
  it('reports transport local-room, queues me, and fills seven bot seats on start', async () => {
    const { client, log, last } = harness();
    expect(client.transport).toBe('local-room');
    expect(log.lobby.at(-1)).toMatchObject({ joined: false, canStart: false, capacity: 8, error: null });
    client.joinQueue('  ');
    expect(log.lobby.at(-1)).toMatchObject({ joined: true, canStart: true, queue: [{ name: '测试', kind: 'human', me: true }] });
    client.startMatch();
    expect(log.lobby.at(-1)).toMatchObject({ joined: false, queue: [] });
    const view = last();
    expect(view.phase.kind).toBe('preparation'); expect(view.phase.endsAt).toBe(1_000);
    expect(view.seats).toHaveLength(8); expect(view.seats.filter(seat => seat.kind === 'bot')).toHaveLength(7);
    expect(view.seats.find(seat => seat.seatId === view.mySeatId)).toMatchObject({ kind: 'human', name: '测试', hp: 100 });
    expect(log.state).toHaveLength(1); expect(log.state[0]!.phase).toBe('preparation');
    expect(view.fault).toBeNull();
  });
  it('forwards commands to the room unchanged and keeps a refusal free of side effects', async () => {
    const { client, log, flush } = harness();
    client.joinQueue('a'); client.startMatch();
    const before = log.state.at(-1)!;
    const refused = client.send({ type: 'buy', slot: 0, generation: before.shop.generation + 1 });
    expect(refused.ok).toBe(false); if (!refused.ok) { expect(refused.reason).toBe('stale-shop'); expect(refused.state).toBe(before); }
    expect(client.currentRoom!.state.seats[0]!.match).toBe(before);
    // Round 1 starts with 0 gold, so the accepted command is the free shop lock.
    const accepted = client.send({ type: 'shopLock', locked: true, generation: before.shop.generation });
    expect(accepted.ok).toBe(true);
    if (accepted.ok) { expect(accepted.state.shop.locked).toBe(true); expect(client.currentRoom!.state.seats[0]!.match).toBe(accepted.state); }
    await flush();
    // The command result already carried the state; the room push does not repeat it.
    expect(log.state).toHaveLength(1);
    expect(client.currentRoom!.state.seats[0]!.seatRevision).toBe(1);
  });
  it('plays the room from the first preparation to the final ranking, pushing frames once per battle round', async () => {
    const { client, log, runUntil, last } = harness();
    client.joinQueue('a'); client.startMatch();
    await runUntil(() => last().phase.kind === 'combat');
    expect(log.combat).toHaveLength(1);
    expect(log.combat[0]!.every(frame => frame.events.every(event => 'tick' in event))).toBe(true);
    await runUntil(() => last().phase.kind === 'ended');
    const view = last();
    expect(view.fault).toBeNull(); expect(view.ranking).not.toBeNull();
    expect(view.ranking!.map(seat => seat.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const rounds = new Set(log.view.filter(v => v.phase.kind === 'combat').map(v => v.phase.round));
    expect(log.combat.length).toBe(rounds.size);
    // Frames are combat view data (CombatState), never a MatchState; the settled state arrives as the room's own seat state after the commit.
    expect(log.combat[0]!.every(frame => 'tick' in frame.state && !('shop' in frame.state))).toBe(true);
    const roomMatches = client.currentRoom!.state.seats.map(seat => seat.match);
    expect(roomMatches).toContain(log.state.at(-1)!);
    expect(client.send({ type: 'reroll' })).toMatchObject({ ok: false, reason: 'wrong-phase' });
  }, 20_000);
  it('surfaces a room fault as view.fault with readable text and no ranking', async () => {
    const { client, runUntil, last } = harness({ faultAtRound: 2 });
    client.joinQueue('a'); client.startMatch();
    await runUntil(() => last().phase.kind === 'ended');
    const view = last();
    expect(view.ranking).toBeNull();
    expect(view.fault).toMatchObject({ kind: 'resolver-error' });
    expect(view.fault!.detail).toContain('faultAt=2');
  });
  it('returns to the lobby after reset and can queue a new match', async () => {
    const { client, log, runUntil, last } = harness({ faultAtRound: 1 });
    client.joinQueue('a'); client.startMatch();
    await runUntil(() => last().phase.kind === 'ended');
    client.reset();
    expect(last().phase.kind).toBe('lobby');
    expect(log.lobby.at(-1)).toMatchObject({ joined: false, queue: [] });
    client.joinQueue('b'); client.startMatch();
    expect(last().phase.kind).toBe('preparation'); expect(last().fault).toBeNull();
    client.dispose();
  });
  it('refuses the ninth seat with a visible lobby error', () => {
    const { client, log } = harness();
    for (let i = 0; i < 8; i++) (client as unknown as { lobby: { join(name: string): unknown } }).lobby.join(`other ${i}`);
    client.joinQueue('late');
    expect(log.lobby.at(-1)!.queue).toHaveLength(8);
    expect(log.lobby.at(-1)).toMatchObject({ joined: false, canStart: false });
    expect(log.lobby.at(-1)!.error).toContain('已满');
  });
});
