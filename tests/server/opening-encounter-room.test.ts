/**
 * Opening encounters PR8 (server): the public opening-encounter projection every seat and spectator receives, the
 * owner-only progress in the private seat view, the opening anvils (v22: two 基础装备锻造器 units on each bench, each
 * opened on its own room deadline, one choiceId at a time), bots answering them, and the wind-up monkey's `nextSharedRound(...).openingResolution` published by the Room (simultaneous
 * eliminations, end of match) without re-deriving ranks, re-releasing stock or re-applying damage.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ManualClock } from '../../src/server/room/clock';
import { Room, ROOM_TIMING_DEFAULTS, type RoomOptions } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { BotDriver } from '../../src/server/room/bot-driver';
import { toPlayerView, toPublicOpeningEncounter, toSeatPrivateView } from '../../src/server/room/projection';
import type { RoomState, SeatSpec, SeatState } from '../../src/server/room/types';
import type { MatchState } from '../../src/simulation/match-types';
import { createOpeningEncounter, readOpeningEncounterView } from '../../src/server-entry';
import { monkeyOutcome } from '../../src/simulation/opening-monkey';
import { getMultiplayerRoundByOrdinal } from '../../src/simulation/multiplayer-round';
import { expectUniqueRanking, runUntil, SEATS, TIMINGS } from './helpers';
import { ANVIL, anvilChoiceId, benchAnvils, openAnvil } from './anvil-room-helpers';

const encounterOf = (seed: number) => createOpeningEncounter(seed).selection.encounterId;
function findSeed(match: (seed: number) => boolean): number {
  for (let seed = 1; seed < 400_000; seed++) if (match(seed)) return seed;
  throw new Error('no seed');
}
const FORGE_SEED = findSeed(seed => encounterOf(seed) === 'component-anvils');
const MONKEY_DAMAGE_SEED = findSeed(seed => encounterOf(seed) === 'wind-up-monkey' && monkeyOutcome(seed) === 'damage');
const MEL_SEED = findSeed(seed => encounterOf(seed) === 'mels-blessing');
/** Room/match round ordinal of 3-5 (the multiplayer schedule opens on 1-2). */
const MONKEY_ORDINAL = (() => { for (let ordinal = 1; ordinal < 60; ordinal++) if (getMultiplayerRoundByOrdinal(ordinal).roundId === '3-5') return ordinal; throw new Error('no 3-5'); })();

const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });
function openRoom(seed: number, seats: readonly SeatSpec[] = SEATS, overrides: Partial<RoomOptions> = {}) {
  const clock = new ManualClock();
  const room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, ...TIMINGS, roomId: `pr8-${seed}`, seed, clock, resolver: new TwoSidedBattleResolver(), ...overrides });
  disposers.push(() => room.dispose());
  return { room, clock };
}
const seatOf = (state: RoomState, seatId: string): SeatState => state.seats.find(seat => seat.seatId === seatId)!;
/** Every key anywhere in a JSON value. */
function keysOf(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const entry of value) keysOf(entry, into);
  else if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) { into.add(key); keysOf(entry, into); }
  return into;
}
const FORBIDDEN_PUBLIC = ['seed', 'selectionRng', 'rngState', 'facts', 'receipts', 'poolId', 'seatId', 'offers', 'pendingChoice',
  'openingForgeProgress', 'openingMelProgress', 'masterworkOptions', 'forgesPending', 'thresholdReached', 'selection', 'context'];

describe('PR8 public opening-encounter projection', () => {
  it('every seat (and an eliminated spectator) gets the same public whitelist, built from the pool context', () => {
    const { room } = openRoom(FORGE_SEED);
    room.start();
    const state = room.state;
    const expected = readOpeningEncounterView(state.seats[0]!.match, state.pool.openingEncounter);
    expect(expected).toMatchObject({ encounterId: 'component-anvils', enabled: true, statusTextZh: '本局奇遇效果已启用', revealedFacts: [] });
    const views = state.seats.map(seat => toPlayerView(state, seat.seatId, 0).openingEncounter);
    for (const view of views) expect(view).toEqual(expected);
    // Same context → the same (cached) object; nothing private is in it.
    expect(toPublicOpeningEncounter(state)).toBe(toPublicOpeningEncounter(state));
    const keys = keysOf(JSON.parse(JSON.stringify(views[0])));
    for (const key of FORBIDDEN_PUBLIC) expect(keys.has(key), key).toBe(false);
    expect(Object.keys(views[0]!).sort()).toEqual(['champion', 'configVersion', 'descriptionZh', 'effectStatus', 'enabled', 'encounterId', 'nameEn', 'nameZh',
      'portalId', 'readiness', 'revealedFacts', 'sourceEncounterId', 'statusTextZh'].sort());
  });
  it('the anvils, the forge progress and the opened candidates reach the owning seat only, through its private seat view', () => {
    // v22 anvil units: 蔚's two forges arrive as two component anvils on each bench; opening one opens its forge choice.
    const { room } = openRoom(FORGE_SEED);
    room.start();
    expect(room.state.phase).toBe('preparation');
    const offersBySeat = new Map<string, readonly string[]>(), phaseDeadline = room.state.deadlineAt!;
    for (const seat of room.state.seats) {
      const anvils = benchAnvils(seat.match);
      expect(anvils.map(unit => unit.definitionId)).toEqual([ANVIL.component, ANVIL.component]);
      expect(seat.match.pendingChoice).toBeNull();
      expect((toSeatPrivateView(seat.match) as { openingForgeProgress?: unknown }).openingForgeProgress)
        .toMatchObject({ source: 'opening-encounter', forgesGranted: 2, forgesResolved: 0, forgesPending: 2 });
      // v23: a fill-in bot's anvil deadline is capped at the phase's own deadline (it never extends the phase).
      const choice = openAnvil(room, seat.seatId, anvils[0]!.id, false, seat.controller === 'bot' ? phaseDeadline : undefined);
      const mine = toSeatPrivateView(seatOf(room.state, seat.seatId).match, seatOf(room.state, seat.seatId).choiceDeadline) as ReturnType<typeof toSeatPrivateView> & { openingMelProgress?: unknown };
      expect(mine.pendingChoice).toMatchObject({ kind: 'forge', choiceId: anvilChoiceId(anvils[0]!.id), payload: { kind: 'forge', source: 'anvil-unit' } });
      expect(mine.pendingChoice!.offers).toHaveLength(4);
      expect(mine.choiceDeadline).toMatchObject({ choiceId: choice.choiceId });
      expect(mine.openingMelProgress).toBeNull();
      offersBySeat.set(seat.seatId, choice.offers);
      // The choice id fits the wire's id limit.
      expect(choice.choiceId.length).toBeLessThanOrEqual(256);
    }
    const state = room.state;
    for (const seat of state.seats) {
      // The public view of every other seat names none of this seat's candidates, its choice id or its deadline.
      const publicJson = JSON.stringify(toPlayerView(state, state.seats[(seat.index + 1) % 8]!.seatId, 0));
      expect(publicJson).not.toContain(seat.match.pendingChoice!.choiceId);
      expect(publicJson).not.toContain(JSON.stringify(seat.match.pendingChoice!.offers));
      expect(publicJson).not.toContain('forgesPending');
      expect(publicJson).not.toContain('choiceDeadline');
    }
    // Candidates are personal (independent substreams): not every seat sees the same four.
    expect(new Set([...offersBySeat.values()].map(offers => offers.join(','))).size).toBeGreaterThan(1);
  });
  // v22 (opening encounters batch A) enables Mel's blessing: the public view shows the enabled status, never the progress.
  it('Mel progress is private and starts below the threshold; the public view shows only the enabled status', () => {
    const { room } = openRoom(MEL_SEED);
    room.start();
    const state = room.state, seat = state.seats[0]!;
    expect(toPlayerView(state, seat.seatId, 0).openingEncounter).toMatchObject({ encounterId: 'mels-blessing', enabled: true, statusTextZh: '本局奇遇效果已启用' });
    expect((toSeatPrivateView(seat.match) as { openingMelProgress?: unknown }).openingMelProgress).toEqual({ encounterId: 'mels-blessing', thresholdHp: 40,
      thresholdReached: false, rewardStatus: 'waiting-threshold', triggeredRound: null, hpBefore: null, hpAfter: null });
    expect(JSON.stringify(toPlayerView(state, seat.seatId, 0))).not.toContain('thresholdHp');
  });
});

describe('PR8 opening anvils: their own deadlines and bots', () => {
  const openingReceipts = (seat: SeatState) => (seat.match.seatMechanics?.receipts ?? []).filter(receipt => receipt.source === 'anvil-unit');
  it('each opened anvil times out on its own deadline to its first offer, one choiceId at a time', () => {
    // A 120 s preparation holds both anvils of every seat (the deadline-extension case is in anvil-choice-deadline.test.ts).
    const { room, clock } = openRoom(FORGE_SEED, SEATS, { preparationMs: 120_000 });
    room.start();
    const firsts = new Map(room.state.seats.map(seat => [seat.seatId, openAnvil(room, seat.seatId, benchAnvils(seat.match)[0]!.id)] as const));
    clock.advance(30_000 - 1);
    for (const seat of room.state.seats) expect(seat.match.pendingChoice?.choiceId).toBe(firsts.get(seat.seatId)!.choiceId);
    clock.advance(1);
    expect(room.state.fault).toBeNull();
    expect(room.state.phase).toBe('preparation');
    for (const seat of room.state.seats) expect(seat.match.pendingChoice).toBeNull();
    // The second anvil, opened now, gets a fresh deadline of its own (openAnvil checks it is now + 30 s).
    const seconds = new Map(room.state.seats.map(seat => [seat.seatId, openAnvil(room, seat.seatId, benchAnvils(seat.match)[0]!.id)] as const));
    expect(room.state.deadlineAt).toBe(120_000);
    clock.advance(30_000);
    expect(room.state.fault).toBeNull();
    for (const seat of room.state.seats) {
      expect(seat.match.pendingChoice).toBeNull();
      expect(openingReceipts(seat).map(receipt => [receipt.receiptId, (receipt as { optionId?: string }).optionId, (receipt as { timedOut?: boolean }).timedOut]))
        .toEqual([[firsts.get(seat.seatId)!.choiceId, firsts.get(seat.seatId)!.offers[0], true], [seconds.get(seat.seatId)!.choiceId, seconds.get(seat.seatId)!.offers[0], true]]);
      expect((toSeatPrivateView(seat.match) as { openingForgeProgress?: unknown }).openingForgeProgress).toMatchObject({ forgesResolved: 2, forgesPending: 0 });
    }
  });
  it('a player\'s pick of the first anvil cancels its deadline; the second opens with a new choiceId and only it times out', () => {
    const { room, clock } = openRoom(FORGE_SEED, SEATS, { preparationMs: 120_000 });
    room.start();
    const [firstAnvil, secondAnvil] = benchAnvils(seatOf(room.state, 's0').match);
    const first = openAnvil(room, 's0', firstAnvil!.id);
    clock.advance(10_000);
    expect(room.handle('s0', { type: 'choose', choiceId: first.choiceId, generation: first.generation, definitionId: first.offers[2]! })).toMatchObject({ ok: true });
    expect(seatOf(room.state, 's0').choiceDeadline).toBeUndefined();
    const second = openAnvil(room, 's0', secondAnvil!.id);
    expect(second.choiceId).not.toBe(first.choiceId);
    expect((toSeatPrivateView(seatOf(room.state, 's0').match) as { openingForgeProgress?: unknown }).openingForgeProgress).toMatchObject({ forgesResolved: 1, forgesPending: 1 });
    clock.advance(30_000);
    const receipts = openingReceipts(seatOf(room.state, 's0'));
    expect(receipts.map(receipt => [(receipt as { optionId?: string }).optionId, (receipt as { timedOut?: boolean }).timedOut]))
      .toEqual([[first.offers[2], false], [second.offers[0], true]]);
    expect(room.state.phase).toBe('preparation');
    expect(room.state.fault).toBeNull();
  });
  it('bot seats open and answer both anvils themselves before any deadline', () => {
    const bots: readonly SeatSpec[] = SEATS.map(seat => ({ ...seat, kind: 'bot' }));
    const { room, clock } = openRoom(FORGE_SEED, bots);
    const driver = new BotDriver(room, FORGE_SEED, { stepMs: 10 });
    disposers.push(() => driver.dispose());
    room.start();
    runUntil(room, clock, state => state.seats.every(seat => openingReceipts(seat).length === 2) || state.phase !== 'preparation', 500);
    expect(room.state.fault).toBeNull();
    for (const seat of room.state.seats) {
      const resolved = openingReceipts(seat);
      expect(resolved, seat.seatId).toHaveLength(2);
      for (const receipt of resolved) expect((receipt as { timedOut?: boolean }).timedOut, seat.seatId).toBe(false);
    }
  });
});

/** Test seam (as in g2-4a-forge-timeout): replaces seats' live states as a seat transaction would. */
function seedSeats(room: Room, change: (seat: SeatState) => { readonly hp: number; readonly match: MatchState } | null): void {
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => {
    const next = change(seat);
    return next ? { ...seat, hp: next.hp, match: next.match, seatRevision: seat.seatRevision + 1 } : seat;
  }) };
}
/** Explicit low-HP boundary fixture (same as the rules' PR5 test): only HP and the last round record's tail are lowered. */
const withHp = (match: MatchState, hp: number): MatchState => ({ ...match, playerHp: hp,
  roundResults: match.roundResults.map((record, index) => index === match.roundResults.length - 1 ? { ...record, hpAfter: hp } : record) });

describe('PR8 wind-up monkey: openingResolution in the Room', () => {
  /** The room at the settlement of 3-4, the batch before the monkey; played once, each test resumes a fresh room from it. */
  let snapshot: RoomState | null = null;
  beforeAll(() => {
    const { room, clock } = openRoom(MONKEY_DAMAGE_SEED);
    room.start();
    runUntil(room, clock, state => state.round === MONKEY_ORDINAL - 1 && state.phase === 'settlement', 5_000);
    expect(room.state.fault).toBeNull();
    expect(toPlayerView(room.state, 's0', 0).openingEncounter).toMatchObject({ encounterId: 'wind-up-monkey', revealedFacts: [] });
    snapshot = room.state;
  }, 60_000);
  /** A fresh room holding the snapshot; `advance()` is its settlement deadline (nextSharedRound into 3-5). */
  function beforeMonkey() {
    const { room, clock } = openRoom(MONKEY_DAMAGE_SEED);
    (room as unknown as { current: RoomState }).current = snapshot!;
    const advance = () => (room as unknown as { advanceRound(): void }).advanceRound();
    return { room, clock, advance };
  }
  it('simultaneous eliminations take the batch\'s ranks; survivors take the rules\' HP; the match goes on', () => {
    const { room, clock, advance } = beforeMonkey();
    const hp: Record<string, number> = { s0: 5, s1: 10, s2: 10, s3: 60, s4: 50, s5: 40, s6: 30, s7: 20 };
    seedSeats(room, seat => ({ hp: hp[seat.seatId]!, match: withHp(seat.match, hp[seat.seatId]!) }));
    const releasedBefore = room.state.pool.seats.filter(seat => seat.released).length;
    advance(); // settlement deadline → nextSharedRound into 3-5
    const state = room.state;
    expect(state.fault).toBeNull();
    expect(state.round).toBe(MONKEY_ORDINAL);
    expect(state.ranking).toBeNull();
    expect(state.phase).not.toBe('ended');
    // §11.5 on the batch: HP before (asc) → seat index (desc) for the worst rank; s2 (index 2) is worse than s1.
    expect(seatOf(state, 's0')).toMatchObject({ alive: false, hp: 0, rank: 8, eliminatedRound: MONKEY_ORDINAL });
    expect(seatOf(state, 's2')).toMatchObject({ alive: false, hp: 0, rank: 7 });
    expect(seatOf(state, 's1')).toMatchObject({ alive: false, hp: 0, rank: 6 });
    for (const seatId of ['s3', 's4', 's5', 's6', 's7']) expect(seatOf(state, seatId)).toMatchObject({ alive: true, hp: hp[seatId]! - 10, rank: null });
    for (const seat of state.seats) expect(seat.hp).toBe(seat.match.playerHp);
    // The rules released the three seats once inside the batch; the room released nothing more.
    expect(state.pool.seats.filter(seat => seat.released).length).toBe(releasedBefore + 3);
    // Everyone, the eliminated included, sees the shared result.
    for (const seat of state.seats) expect(toPlayerView(state, seat.seatId, 0).openingEncounter!.revealedFacts).toEqual([{ nodeId: '3-5', outcome: 'damage' }]);
    // The next round goes on with the five survivors only.
    runUntil(room, clock, next => next.round === MONKEY_ORDINAL + 1 || next.phase === 'ended', 2_000);
    expect(room.state.fault).toBeNull();
  });
  it('a batch that leaves one survivor ends the match in one publication with the full ranking', () => {
    const { room, advance } = beforeMonkey();
    const hp: Record<string, number> = { s0: 3, s1: 9, s2: 10, s3: 4, s4: 7, s5: 11, s6: 2, s7: 1 };
    seedSeats(room, seat => ({ hp: hp[seat.seatId]!, match: withHp(seat.match, hp[seat.seatId]!) }));
    const publications: RoomState[] = [];
    const unlisten = room.subscribe(state => publications.push(state));
    advance();
    unlisten();
    const state = room.state;
    expect(state.fault).toBeNull();
    expect(state.phase).toBe('ended');
    expect(publications).toHaveLength(1);
    expectUniqueRanking(state);
    expect(seatOf(state, 's5')).toMatchObject({ alive: true, rank: 1, hp: 1 });
    expect(state.ranking!.map(entry => entry.seatId)).toEqual(['s5', 's2', 's1', 's4', 's3', 's0', 's6', 's7']);
  });
  it('a batch that eliminates every seat still ranks 1–8 and ends the match', () => {
    const { room, advance } = beforeMonkey();
    const hp: Record<string, number> = { s0: 3, s1: 9, s2: 10, s3: 4, s4: 7, s5: 10, s6: 2, s7: 1 };
    seedSeats(room, seat => ({ hp: hp[seat.seatId]!, match: withHp(seat.match, hp[seat.seatId]!) }));
    advance();
    const state = room.state;
    expect(state.fault).toBeNull();
    expect(state.phase).toBe('ended');
    expectUniqueRanking(state);
    expect(state.seats.every(seat => !seat.alive && seat.hp === 0)).toBe(true);
    // Equal HP before (s2, s5 at 10): the higher seat index ranks worse.
    expect(state.ranking!.map(entry => entry.seatId)).toEqual(['s2', 's5', 's1', 's4', 's3', 's0', 's6', 's7']);
    // An eliminated seat still gets its final state push (eliminatedRound is the room round).
    for (const seat of state.seats) expect(seat.eliminatedRound).toBe(state.round);
  });
});
