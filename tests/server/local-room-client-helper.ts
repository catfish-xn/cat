/**
 * The in-browser GameClient over the real room (C3). It lives in src/rendering/online but has no
 * DOM dependency when a ManualClock is injected, so it is exercised here next to the room it drives.
 */
import { describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import type { MatchState } from '../../src/simulation/match-types';
import { LOCAL_ROOM_DEFAULTS, LocalRoomClient, type LocalRoomOptions } from '../../src/rendering/online/local-room-client';
import { readLocalRoomOptions } from '../../src/rendering/online/mode';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import { toSeatPrivateView } from '../../src/server/room/projection';
import type { ClientListeners, LobbyView, PlayerView } from '../../src/rendering/online/protocol';
import { assertSharedPoolConservation, type CombatReplay } from '../../src/server-entry';

const OPTIONS: Omit<LocalRoomOptions, 'clock'> = { seed: 42, preparationMs: 1_000, choiceMs: 500, settlementMs: 200, myName: '测试', faultAtRound: null, pvpMode: 'two-sided', carousel: false };

function harness(overrides: Partial<LocalRoomOptions> = {}, { carousel = false } = {}) {
  const clock = new ManualClock();
  // The browser's local room opens the rules' carousel like the network server (server/main.ts); most cases here keep it
  // off (OPTIONS) so their rounds stay the pre-P7 ones, and `carousel` turns it on through the client's own option.
  const client = new LocalRoomClient({ ...OPTIONS, clock, ...overrides, ...(carousel ? { carousel: true } : {}) });
  const log = { lobby: [] as LobbyView[], view: [] as PlayerView[], state: [] as MatchState[], replay: [] as CombatReplay[] };
  const listeners: ClientListeners = { lobby: v => log.lobby.push(v), view: v => log.view.push(v),
    state: s => log.state.push(s), replay: r => log.replay.push(r) };
  client.listen(listeners);
  const flush = () => new Promise<void>(resolve => queueMicrotask(resolve));
  /** Fires room timers one at a time (flushing the coalesced pushes) until the predicate holds. */
  const runUntil = async (predicate: () => boolean, maxTimers = 3_000) => {
    for (let fired = 0; fired < maxTimers; fired++) { await flush(); if (predicate()) return; if (!clock.runNext()) break; }
    await flush(); if (!predicate()) throw new Error(`never reached: last view ${JSON.stringify(log.view.at(-1)?.phase)}`);
  };
  return { clock, client, log, flush, runUntil, last: () => log.view.at(-1)! };
}

export function registerLocalRoomClient(mode: 'fast' | 'timing'): void {
describe('LocalRoomClient', () => {
  if (mode === 'fast') it('reports transport local-room, queues me, and fills seven bot seats on start', async () => {
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
  if (mode === 'fast') it('opens the shared carousel by default, like the network server; ?carousel=0 turns it off', () => {
    expect(LOCAL_ROOM_DEFAULTS.carousel).toBe(true);
    expect(readLocalRoomOptions('?mode=online').carousel).toBe(true);
    expect(readLocalRoomOptions('?mode=online&carousel=0').carousel).toBe(false);
  });
  if (mode === 'fast') it('forwards commands to the room unchanged and keeps a refusal free of side effects', async () => {
    const { client, log, flush } = harness();
    client.joinQueue('a'); client.startMatch();
    const before = log.state.at(-1)!, roomBefore = client.currentRoom!.state.seats[0]!.match;
    const refused = client.send({ type: 'buy', slot: 0, generation: before.shop.generation + 1 });
    expect(refused.ok).toBe(false); if (!refused.ok) { expect(refused.reason).toBe('stale-shop'); expect(refused.state).toBe(before); }
    expect(client.currentRoom!.state.seats[0]!.match).toBe(roomBefore);
    // Round 1 starts with 0 gold, so the accepted command is the free shop lock.
    const accepted = client.send({ type: 'shopLock', locked: true, generation: before.shop.generation });
    expect(accepted.ok).toBe(true);
    // B7: the result carries the display copy of the room's private seat view, as the network client would show it.
    if (accepted.ok) { expect(accepted.state.shop.locked).toBe(true); expect(accepted.state).toEqual(toDisplayMatch(toSeatPrivateView(client.currentRoom!.state.seats[0]!.match))); }
    await flush();
    // The command result already carried the state; the room push does not repeat it.
    expect(log.state).toHaveLength(1);
    expect(client.currentRoom!.state.seats[0]!.seatRevision).toBe(1);
  });
  if (mode === 'timing') it('plays the room from the first preparation to the final ranking, pushing one replay per battle round', async () => {
    const { client, log, runUntil, last } = harness();
    client.joinQueue('a'); client.startMatch();
    await runUntil(() => last().phase.kind === 'combat');
    expect(log.replay).toHaveLength(1);
    expect(log.replay[0]!.ticks).toHaveLength(log.replay[0]!.terminal.tick + 1);
    await runUntil(() => last().phase.kind === 'ended', 6_000);
    const view = last();
    // B7: overtime runs until one seat is left, so the match always ends with a unique ranking.
    expect(view.fault).toBeNull();
    expect(view.ranking!.map(seat => seat.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // The HP shown for my seat is the rules' HP of my last pushed state.
    expect(view.seats.find(seat => seat.seatId === view.mySeatId)!.hp).toBe(log.state.at(-1)!.playerHp);
    // One replay per round in which my seat still fought; an eliminated seat gets views, not battles.
    const rounds = new Set(log.view.filter(v => v.phase.kind === 'combat' && v.seats.find(seat => seat.seatId === v.mySeatId)!.alive).map(v => v.phase.round));
    expect(log.replay.length).toBe(rounds.size);
    // A replay is combat view data (CombatViewState), never a MatchState; the settled state arrives as the room's own seat state after the commit.
    expect(log.replay.every(replay => 'tick' in replay.initial && !('shop' in replay.initial) && !('rngState' in replay.initial))).toBe(true);
    // My last pushed state is the display copy of my seat's private view, the same as the network sends.
    const mine = client.currentRoom!.state.seats.find(seat => seat.seatId === view.mySeatId)!;
    expect(log.state.at(-1)!).toEqual(toDisplayMatch(toSeatPrivateView(mine.match)));
    expect(client.send({ type: 'reroll' })).toMatchObject({ ok: false, reason: 'wrong-phase' });
  }, 60_000);
  if (mode === 'fast') it('surfaces a room fault as view.fault with readable text and no ranking', async () => {
    const { client, runUntil, last } = harness({ faultAtRound: 2 });
    client.joinQueue('a'); client.startMatch();
    await runUntil(() => last().phase.kind === 'ended');
    const view = last();
    expect(view.ranking).toBeNull();
    expect(view.fault).toMatchObject({ kind: 'resolver-error' });
    expect(view.fault!.detail).toContain('faultAt=2');
  });
  if (mode === 'fast') it('returns to the lobby after reset and can queue a new match', async () => {
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
  if (mode === 'timing') it('opens the 2-4 carousel through the client: my pick is a room transaction, and the unit reaches my next preparation', async () => {
    const { client, log, flush, runUntil, last } = harness({}, { carousel: true });
    client.joinQueue('a'); client.startMatch();
    // P7-1: no carousel at the opening; the first one is 2-4, after the 1-x PvE rounds and 2-1..2-3.
    await runUntil(() => last().phase.kind === 'carousel');
    const room = client.currentRoom!, me = last().mySeatId;
    const opened = last().carousel!;
    expect(opened).toMatchObject({ roundId: '2-4', status: 'open', pickedSlot: null, receiptId: null, eligible: false });
    expect(opened.releaseOrder).toHaveLength(8); expect(opened.releaseOrder).toContain(me);
    expect(opened.slots.every(slot => slot.pickedBy === null)).toBe(true);
    // Before my release a pick is refused and changes nothing (no state push, same carousel revision).
    const statesBefore = log.state.length, revisionBefore = room.state.carousel!.state.revision;
    const early = client.send({ type: 'carousel-pick', carouselId: opened.id, revision: opened.revision, slot: 0 });
    expect(early).toMatchObject({ ok: false, reason: 'seat-locked' });
    await flush();
    expect(room.state.carousel!.state.revision).toBe(revisionBefore); expect(log.state).toHaveLength(statesBefore);
    // My batch is released on the room clock; the view says so.
    await runUntil(() => last().carousel?.eligible === true);
    const released = last().carousel!;
    expect(released.elapsedMs).toBeGreaterThanOrEqual(released.releaseAtMs[me]!);
    const choice = released.slots.find(slot => slot.pickedBy === null)!;
    const stale = client.send({ type: 'carousel-pick', carouselId: released.id, revision: released.revision - 1, slot: choice.slot });
    expect(stale).toMatchObject({ ok: false, reason: 'stale-carousel' });
    const picked = client.send({ type: 'carousel-pick', carouselId: released.id, revision: released.revision, slot: choice.slot });
    expect(picked.ok).toBe(true);
    await flush();
    const after = last().carousel!;
    expect(after).toMatchObject({ pickedSlot: choice.slot, eligible: false });
    expect(after.receiptId).not.toBeNull();
    expect(after.slots.find(slot => slot.slot === choice.slot)!.pickedBy).toBe(me);
    // One pick per seat.
    const other = after.slots.find(slot => slot.pickedBy === null)!;
    expect(client.send({ type: 'carousel-pick', carouselId: after.id, revision: after.revision, slot: other.slot })).toMatchObject({ ok: false, reason: 'already-picked' });
    // The carousel closes (bots pick or are auto-picked), and the round goes on to its preparation with my unit.
    await runUntil(() => last().phase.kind === 'preparation' && last().carousel === null);
    // Every seat holds exactly one carousel receipt, from its own pick or the rules' auto-pick.
    for (const seat of room.state.seats) expect(seat.match.carousel!.receipts.filter(receipt => receipt.carouselId === released.id)).toHaveLength(1);
    const mine = log.state.at(-1)!.preparation.units.filter(unit => unit.team === 'player' && unit.definitionId === choice.definitionId);
    expect(mine.length).toBeGreaterThan(0);
    expect(log.state.at(-1)!).toEqual(toDisplayMatch(toSeatPrivateView(room.state.seats.find(seat => seat.seatId === me)!.match)));
    assertSharedPoolConservation(room.state.pool, room.state.seats.map(seat => seat.match));
    expect(last().fault).toBeNull();
    client.dispose();
  }, 60_000);
  if (mode === 'fast') it('refuses the ninth seat with a visible lobby error', () => {
    const { client, log } = harness();
    for (let i = 0; i < 8; i++) (client as unknown as { lobby: { join(name: string): unknown } }).lobby.join(`other ${i}`);
    client.joinQueue('late');
    expect(log.lobby.at(-1)!.queue).toHaveLength(8);
    expect(log.lobby.at(-1)).toMatchObject({ joined: false, canStart: false });
    expect(log.lobby.at(-1)!.error).toContain('已满');
  });
});

}
