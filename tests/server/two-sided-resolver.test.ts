/**
 * B3: the room's PvP goes through the rules' two-sided entry (contract §10.6). Only proposals come
 * out; nothing is committed until T3. Lineups are the real idle seats of a room at round 2-1.
 */
import { describe, expect, it } from 'vitest';
import { BattleResolveError, PlaceholderBattleResolver, type BattleResolver } from '../../src/server/room/battle-resolver';
import { toCombatReplayFor, toPlayerView } from '../../src/server/room/projection';
import { toCombatReplay, toCombatViewState } from '../../src/server-entry';
import { TwoSidedBattleResolver, resolveTwoSidedPvp } from '../../src/server/room/two-sided-resolver';
import { DEFAULT_BATTLE_MAX_STEPS, type BattleInput, type BattleResult, type SeatState } from '../../src/server/room/types';
import { makeRoom, runUntil } from './helpers';

/** Real seats frozen at the first PvP round (2-1) of an idle placeholder room. */
function pvpSeats(): readonly SeatState[] {
  const { room, clock } = makeRoom(new PlaceholderBattleResolver());
  room.start();
  runUntil(room, clock, state => state.round === 4 && state.phase === 'preparation');
  return room.state.seats;
}
function envelope(seats: readonly SeatState[], a: number, b: number, overrides: Partial<BattleInput> = {}): BattleInput {
  const seat = (index: number) => ({ seatId: seats[index]!.seatId, state: seats[index]!.match });
  return { battleId: `test-room:r4:b${a}${b}`, roomId: 'test-room', round: 4, roundId: '2-1', roundKind: 'pvp', roomRevision: 10, battleSeed: 0x1234_5678,
    maxSteps: DEFAULT_BATTLE_MAX_STEPS, seats: [seat(a), seat(b)], mirrorOf: null, ...overrides };
}
const unitsOf = (result: Extract<BattleResult, { kind: 'two-sided' }>, seatId: string) => new Set(result.battle.mapping.filter(m => m.seatId === seatId && m.kind === 'unit').map(m => m.combatId));

describe('resolveTwoSidedPvp', () => {
  const seats = pvpSeats();

  it('puts both real lineups into ONE battle: the mapping names both seats and the ledger shows both sides acting', () => {
    const result = resolveTwoSidedPvp(envelope(seats, 0, 1));
    expect(result.kind).toBe('two-sided');
    expect(result).toMatchObject({ battleId: 'test-room:r4:b01', round: 4, roomRevision: 10, participants: ['s0', 's1'] });
    expect(new Set(result.battle.mapping.map(m => m.seatId))).toEqual(new Set(['s0', 's1']));
    const a = unitsOf(result, 's0'), b = unitsOf(result, 's1');
    expect(a.size).toBeGreaterThan(0); expect(b.size).toBeGreaterThan(0);
    const actors = new Set(result.battle.events.flatMap(event => 'unitId' in event ? [event.unitId] : 'attackerId' in event ? [event.attackerId] : []));
    expect([...a].some(id => actors.has(id))).toBe(true);
    expect([...b].some(id => actors.has(id))).toBe(true);
    expect(result.battle.initial.units.map(unit => unit.team).sort()).toEqual(['enemy', 'player']);
    expect(result.battle.mirrorOfSeatId).toBeNull();
    for (const proposal of [result.proposals.a, result.proposals.b]) {
      expect(proposal.settlementEligible).toBe(true);
      expect(Number.isSafeInteger(proposal.damage) && proposal.damage >= 0).toBe(true);
    }
    expect(result.proposals.a.seatId).toBe('s0'); expect(result.proposals.b.seatId).toBe('s1');
  });

  it('is a pure function of the envelope: a rerun is deepEqual and keeps the frozen battleSeed', () => {
    const input = envelope(seats, 2, 3);
    const first = resolveTwoSidedPvp(input), second = resolveTwoSidedPvp(input);
    expect(second).toEqual(first);
    expect(first.battle.battleSeed).toBe(input.battleSeed);
    const otherSeed = resolveTwoSidedPvp({ ...input, battleSeed: input.battleSeed + 1 });
    expect(otherSeed.battle.battleSeed).toBe(input.battleSeed + 1);
    expect(otherSeed.battle.initial.rngState).not.toBe(first.battle.initial.rngState);
  });

  it('mirror pairing: the real seat is A, the frozen source is B, and B\'s proposal can never settle', () => {
    const mirror = resolveTwoSidedPvp(envelope(seats, 4, 5, { battleId: 'test-room:r4:m', seats: [{ seatId: 's4', state: seats[4]!.match }], mirrorOf: { seatId: 's5', state: seats[5]!.match } }));
    expect(mirror.participants).toEqual(['s4']);
    expect(mirror.battle.mirrorOfSeatId).toBe('s5');
    expect(mirror.proposals.a.seatId).toBe('s4'); expect(mirror.proposals.a.settlementEligible).toBe(true);
    expect(mirror.proposals.b).toMatchObject({ seatId: 's5', settlementEligible: false, damage: 0, growth: [] });
    // The source seat's own pairing is independent of having been mirrored.
    const own = resolveTwoSidedPvp(envelope(seats, 5, 6));
    expect(own.proposals.a).toMatchObject({ seatId: 's5', settlementEligible: true });
    expect(own.proposals.b).toMatchObject({ seatId: 's6', settlementEligible: true });
    expect(resolveTwoSidedPvp(envelope(seats, 5, 6))).toEqual(own);
  });

  it('keeps the one battle the rules ran, no per-tick frames: the replay is built from it (C6)', () => {
    const result = resolveTwoSidedPvp(envelope(seats, 0, 1));
    expect(result).not.toHaveProperty('frames');
    const replay = toCombatReplay(result.battle);
    expect(replay.ticks).toHaveLength(result.battle.terminal.tick + 1);
    expect(replay.terminal).toEqual(toCombatViewState(result.battle.terminal));
  });

  it('rejects an envelope whose round differs from the seats\' preparation round before touching the rules', () => {
    expect(() => resolveTwoSidedPvp(envelope(seats, 0, 1, { roundId: '2-2' }))).toThrow(BattleResolveError);
    try { resolveTwoSidedPvp(envelope(seats, 0, 1, { roundId: '2-2' })); } catch (error) { expect((error as BattleResolveError).reason).toBe('round-mismatch:2-1'); }
  });

  it('turns a rules refusal (BattleValidationError) into a resolver fault with the stable reason', () => {
    try { resolveTwoSidedPvp(envelope(seats, 0, 1, { maxSteps: 1 })); expect.unreachable(); }
    catch (error) { expect(error).toBeInstanceOf(BattleResolveError); expect((error as BattleResolveError).reason).toBe('battle-validation:step-limit-exceeded'); }
    try { resolveTwoSidedPvp(envelope(seats, 0, 0)); expect.unreachable(); }
    catch (error) { expect((error as BattleResolveError).reason).toBe('battle-validation:seat-collision'); }
  });

  it('never sends PvE or supply rounds to the PvP entry', () => {
    const calls: string[] = [];
    const inner: BattleResolver = { resolveBattle(input) { calls.push(input.roundKind); return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes: [] }; } };
    const resolver = new TwoSidedBattleResolver(inner);
    const pool = makeRoom().room.state.pool;
    resolver.resolveBattle(envelope(seats, 0, 1, { roundKind: 'pve', roundId: '1-2' }), pool);
    resolver.resolveBattle(envelope(seats, 0, 1, { roundKind: 'supply', roundId: '2-4' }), pool);
    expect(calls).toEqual(['pve', 'supply']);
  });
});

describe('Room in pvpMode=two-sided', () => {
  it('drops the whole round when the rules refuse one battle: nothing is staged and no HP moves', () => {
    const inner = new TwoSidedBattleResolver();
    let calls = 0;
    const resolver: BattleResolver = { resolveBattle(input, pool) { return inner.resolveBattle(input.roundKind === 'pvp' && ++calls === 3 ? { ...input, maxSteps: 1 } : input, pool); } };
    const { room, clock } = makeRoom(resolver);
    room.start();
    runUntil(room, clock, state => state.round === 4 && state.phase === 'preparation');
    const hpBefore = room.state.seats.map(seat => seat.hp), matchesBefore = room.state.seats.map(seat => seat.match);
    clock.runNext();
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toMatchObject({ kind: 'resolver-error', reason: 'battle-validation:step-limit-exceeded' });
    expect(room.state.battles).toEqual([]);
    expect(room.state.seats.map(seat => seat.hp)).toEqual(hpBefore);
    expect(room.state.seats.map(seat => seat.match)).toEqual(matchesBefore);
    expect(room.state.settlements).toHaveLength(3);
  }, 20_000);

  it('in pvpMode=placeholder a two-sided result is refused instead of being settled by the room', () => {
    const resolver = new TwoSidedBattleResolver();
    const { room, clock } = makeRoom(resolver, { pvpMode: 'placeholder' });
    room.start();
    runUntil(room, clock, state => state.round === 4 && state.phase === 'preparation');
    const hpBefore = room.state.seats.map(seat => seat.hp);
    clock.runNext();
    expect(room.state.fault?.kind).toBe('invalid-results');
    expect(room.state.seats.map(seat => seat.hp)).toEqual(hpBefore);
  }, 20_000);

  it('replay: side A plays as-is, side B mirrored, and a mirror source gets only its own battle', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 4 && state.phase === 'preparation');
    clock.runNext();
    expect(room.state.phase).toBe('battle');
    const battles = room.state.battles.filter((battle): battle is Extract<BattleResult, { kind: 'two-sided' }> => battle.kind === 'two-sided');
    expect(battles).toHaveLength(4);
    const real = battles[0]!;
    const [aId, bId] = [real.battle.a.seatId, real.battle.b.seatId];
    const a = toCombatReplayFor(room.state, aId)!, b = toCombatReplayFor(room.state, bId)!;
    expect(toCombatReplayFor(room.state, aId)!.replay).toBe(a.replay); // built once per battle
    expect(a.replay.ticks).toHaveLength(real.battle.terminal.tick + 1);
    expect(b.replay.ticks).toHaveLength(a.replay.ticks.length);
    expect(b.replay.initial.units.find(unit => unit.id.includes(`"${bId}"`))!.team).toBe('player');
    expect(toPlayerView(room.state, aId, clock.now()).opponentSeatId).toBe(bId);
  }, 20_000);
});
