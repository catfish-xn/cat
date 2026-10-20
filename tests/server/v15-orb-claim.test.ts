/**
 * v15 server wiring (docs/V15_RELEASE.md "Claude 配套", MULTIPLAYER_CONTRACT claimOrb): protocol 4, the claimOrb and
 * per-card rerollAugment wire commands, claims at once in preparation and queued during a battle (settled by the rules
 * after it), the bot preparation entry claiming through claimBotPreparationOrbs, and the public view carrying only the
 * orbs' count and tiers. The rules themselves are covered by tests/loot-orb-claim.test.ts; here only what the server forwards.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { NET_PROTOCOL_VERSION, parseClientMessage, validateClientCommand } from '../../src/server/net/messages';
import { MULTIPLAYER_NET_PROTOCOL_VERSION } from '../../src/simulation/m8/version';
import { BotDriver } from '../../src/server/room/bot-driver';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState, SeatState } from '../../src/server/room/types';
import { readPublicOrbSummary } from '../../src/server-entry';
import { readLootView } from '../../src/simulation/match';
import type { MatchState } from '../../src/simulation/match-types';
import { makeRoom, runUntil, SEATS, TIMINGS } from './helpers';

const seat = (state: RoomState, seatId: string): SeatState => state.seats.find(candidate => candidate.seatId === seatId)!;
const unclaimed = (match: MatchState) => readLootView(match).unclaimedOrbs ?? [];
const receipts = (match: MatchState) => readLootView(match).claimReceipts ?? [];
const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

describe('v15 wire: protocol 4, claimOrb and per-card rerollAugment', () => {
  it('runs on the rules\' protocol 4 and refuses a protocol 3 client with a message naming both versions', () => {
    expect(NET_PROTOCOL_VERSION).toBe(4);
    expect(NET_PROTOCOL_VERSION).toBe(MULTIPLAYER_NET_PROTOCOL_VERSION);
    const old = parseClientMessage(JSON.stringify({ type: 'join', protocolVersion: 3, commandId: 1, name: 'x' }));
    expect(old).toMatchObject({ ok: false, code: 'unsupported-protocol', commandId: 1 });
    if (!old.ok) { expect(old.detail).toContain('must be 4'); expect(old.detail).toContain('got 3'); }
    expect(parseClientMessage(JSON.stringify({ type: 'join', protocolVersion: 4, commandId: 1, name: 'x' }))).toMatchObject({ ok: true });
  });

  it('claimOrb carries exactly round and orbId; anything else is invalid', () => {
    const command = { type: 'claimOrb', round: 3, orbId: 'orb:1-2:0' };
    expect(validateClientCommand(command)).toEqual(command);
    for (const value of [{ ...command, seatId: 's1' }, { ...command, gold: 9 }, { type: 'claimOrb', round: 3 }, { type: 'claimOrb', orbId: 'x' },
      { ...command, orbId: '' }, { ...command, round: -1 }, { ...command, round: 1.5 }, { ...command, orbId: 7 }])
      expect(() => validateClientCommand(value)).toThrow();
    const message = parseClientMessage(JSON.stringify({ type: 'command', protocolVersion: 4, commandId: 2, roomId: 'r', round: 3, seatRevision: 0, command }));
    expect(message).toMatchObject({ ok: true, message: { command } });
  });

  it('rerollAugment requires the card index', () => {
    const command = { type: 'rerollAugment', choiceId: 'c', generation: 0, optionIndex: 0 };
    expect(validateClientCommand(command)).toEqual(command);
    expect(() => validateClientCommand({ type: 'rerollAugment', choiceId: 'c', generation: 0 })).toThrow(/optionIndex/);
  });
});

describe('v15 room: orb claims through the gate', () => {
  it('in preparation a human claims at once; other seats see only the count and tiers', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    disposers.push(() => room.dispose());
    room.start();
    runUntil(room, clock, state => state.phase === 'preparation' && unclaimed(seat(state, 's0').match).length > 0);
    const before = seat(room.state, 's0');
    const orb = unclaimed(before.match)[0]!;
    // Public: the count and tiers the rules publish, nothing that names an orb.
    const othersView = toPlayerView(room.state, 's1', clock.now()).seats.find(entry => entry.seatId === 's0')!;
    expect(othersView.orbs).toEqual({ count: unclaimed(before.match).length, tiers: unclaimed(before.match).map(o => o.tier) });
    expect(othersView.orbs).toEqual({ ...readPublicOrbSummary(before.match) });
    const publicWire = JSON.stringify(toPlayerView(room.state, 's1', clock.now()));
    for (const own of unclaimed(before.match)) expect(publicWire).not.toContain(own.orbId);
    expect(publicWire).not.toContain('queued');
    // Private: the seat's own view lists the orb as the rules project it.
    expect(toSeatPrivateView(before.match).unclaimedOrbs?.map(o => o.orbId)).toContain(orb.orbId);
    const result = room.handle('s0', { type: 'claimOrb', round: before.match.round, orbId: orb.orbId });
    expect(result).toMatchObject({ ok: true });
    const after = seat(room.state, 's0');
    expect(after.seatRevision).toBe(before.seatRevision + 1);
    expect(unclaimed(after.match).map(o => o.orbId)).not.toContain(orb.orbId);
    expect(receipts(after.match).length).toBeGreaterThan(receipts(before.match).length);
    expect(toSeatPrivateView(after.match).orbClaimReceipts?.length).toBe(receipts(after.match).length);
    // A second claim of the same orb changes nothing.
    const published = room.state;
    expect(room.handle('s0', { type: 'claimOrb', round: after.match.round, orbId: orb.orbId })).toMatchObject({ ok: false });
    expect(room.state).toBe(published);
  }, 20_000);

  it('during my battle a claim is only queued (no resource moves) and the rules settle it with the round', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    disposers.push(() => room.dispose());
    room.start();
    runUntil(room, clock, state => state.phase === 'battle' && unclaimed(seat(state, 's0').match).some(o => !o.queued));
    const before = seat(room.state, 's0');
    const orb = unclaimed(before.match).find(o => !o.queued)!;
    const round = room.state.round;
    expect(room.handle('s0', { type: 'claimOrb', round: before.match.round, orbId: orb.orbId })).toMatchObject({ ok: true });
    const queued = seat(room.state, 's0').match;
    expect(unclaimed(queued).find(o => o.orbId === orb.orbId)?.queued).toBe(true);
    expect(toSeatPrivateView(queued).unclaimedOrbs?.find(o => o.orbId === orb.orbId)?.queued).toBe(true);
    expect(queued.gold).toBe(before.match.gold);
    expect(queued.preparation.units).toEqual(before.match.preparation.units);
    expect(receipts(queued)).toEqual(receipts(before.match));
    // Public: still only count and tiers; the queue is private.
    expect(JSON.stringify(toPlayerView(room.state, 's1', clock.now()))).not.toContain(orb.orbId);
    // Repeating the claim is refused and publishes nothing.
    const published = room.state;
    expect(room.handle('s0', { type: 'claimOrb', round: queued.round, orbId: orb.orbId })).toMatchObject({ ok: false, reason: 'already-claimed' });
    expect(room.state).toBe(published);
    // The settlement of this round (on the latest live seat) pays the queued orb out.
    runUntil(room, clock, state => state.round === round && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    const settled = seat(room.state, 's0').match;
    expect(unclaimed(settled).map(o => o.orbId)).not.toContain(orb.orbId);
    expect(receipts(settled).length).toBeGreaterThan(receipts(queued).length);
  }, 20_000);
});

describe('v15 room: a claim while the round is frozen', () => {
  it('is held without touching the frozen inputs and queued by the rules at battle entry', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { sliceTicks: 10 });
    disposers.push(() => room.dispose());
    room.start();
    runUntil(room, clock, state => state.round === 4 && state.phase === 'preparation');
    clock.fireNext(); // the preparation deadline freezes the round; the first slice is only scheduled
    expect(room.state.phase).toBe('frozen');
    const before = seat(room.state, 's0');
    const orb = unclaimed(before.match).find(o => !o.queued)!;
    const published = room.state;
    expect(room.handle('s0', { type: 'claimOrb', round: before.match.round, orbId: orb.orbId })).toMatchObject({ ok: true, seatRevision: before.seatRevision });
    // Held only: nothing is published while the round is frozen.
    expect(room.state).toBe(published);
    expect(room.handle('s0', { type: 'claimOrb', round: before.match.round, orbId: orb.orbId })).toMatchObject({ ok: false, reason: 'already-claimed' });
    expect(room.handle('s0', { type: 'claimOrb', round: before.match.round, orbId: 'no-such-orb' })).toMatchObject({ ok: false, reason: 'unknown-orb' });
    expect(room.handle('s0', { type: 'claimOrb', round: before.match.round + 1, orbId: orb.orbId })).toMatchObject({ ok: false, reason: 'stale-round' });
    expect(room.state).toBe(published);
    while (room.state.phase === 'frozen') expect(clock.fireNext()).toBe(true);
    expect(room.state.fault).toBeNull();
    const entered = seat(room.state, 's0').match;
    if (room.state.phase === 'battle') {
      expect(unclaimed(entered).find(o => o.orbId === orb.orbId)?.queued).toBe(true);
      expect(receipts(entered)).toEqual(receipts(before.match));
    } else expect(unclaimed(entered).map(o => o.orbId)).not.toContain(orb.orbId);
  }, 20_000);
});

describe('v15 bot preparation entry', () => {
  it('every bot seat claims all of its orbs at each preparation entry, outside its policy budget', () => {
    const clock = new ManualClock();
    const seats = SEATS.map(spec => ({ ...spec, kind: 'bot' as const }));
    const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, ...TIMINGS, preparationMs: 30_000, roomId: 'orb-bots', seed: 42, clock, resolver: new TwoSidedBattleResolver() });
    const bots = new BotDriver(room, 42, { stepMs: 50 });
    disposers.push(() => { bots.dispose(); room.dispose(); });
    room.start();
    let checked = 0;
    for (const round of [2, 3, 4]) {
      runUntil(room, clock, state => state.round === round && state.phase === 'preparation');
      const owed = room.state.seats.filter(entry => entry.match.phase === 'preparation' && unclaimed(entry.match).length > 0).map(entry => entry.seatId);
      // One step interval (plus the seat stagger) later every bot has claimed, before the deadline.
      const deadline = room.state.deadlineAt!;
      runUntil(room, clock, state => state.phase !== 'preparation' || clock.now() >= deadline - 1
        || state.seats.every(entry => entry.match.phase !== 'preparation' || unclaimed(entry.match).length === 0));
      expect(room.state.phase).toBe('preparation');
      for (const entry of room.state.seats) if (entry.match.phase === 'preparation') expect(unclaimed(entry.match), entry.seatId).toEqual([]);
      checked += owed.length;
    }
    expect(checked).toBeGreaterThan(0);
    expect(room.state.fault).toBeNull();
  }, 20_000);
});
