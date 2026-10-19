import { describe, expect, it } from 'vitest';
import { PlaceholderBattleResolver } from '../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleInput, BattleResult, SharedPoolState } from '../../src/server/room/types';
import { DamageResolver, expectUniqueRanking, makeRoom, runUntil } from './helpers';

describe('Room: start and command gate', () => {
  it('opens with exactly eight seats, room-derived seeds and one authoritative HP per seat', () => {
    const { room } = makeRoom();
    expect(room.state.phase).toBe('waiting');
    room.start();
    const state = room.state;
    expect(state.seats).toHaveLength(8);
    expect(state.round).toBe(1); expect(state.roundId).toBe('1-2'); expect(state.phase).toBe('preparation');
    expect(state.deadlineAt).toBe(1_000);
    expect(new Set(state.seats.map(seat => seat.seed)).size).toBe(8);
    for (const seat of state.seats) { expect(seat.hp).toBe(seat.match.playerHp); expect(seat.alive).toBe(true); expect(seat.rank).toBeNull(); }
    // B5 §12.2 opening: eight seat imports and one fair first refresh, each one pool revision; copied, never computed.
    expect(state.poolRevision).toBe(9); expect(state.poolRevision).toBe(state.pool.revision);
  });
  it('rejects commands from unknown seats and in the wrong phase without touching any reference', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0));
    const before = room.state;
    expect(room.handle('s0', { type: 'reroll' })).toEqual({ ok: false, reason: 'wrong-phase', state: before.seats[0]!.match });
    expect(room.handle('nobody', { type: 'reroll' })).toEqual({ ok: false, reason: 'unknown-seat', state: null });
    expect(room.state).toBe(before);
    room.start();
    const started = room.state;
    clock.advance(1_000); // preparation deadline → frozen → battle
    expect(room.state.phase).toBe('battle');
    const inBattle = room.state;
    // T10 §15.2: a battle accepts operations only; a choice command is a room-phase refusal that touches nothing.
    const refused = room.handle('s1', { type: 'choose', choiceId: 'none', generation: 0, definitionId: 'none' });
    expect(refused).toEqual({ ok: false, reason: 'wrong-phase', state: inBattle.seats[1]!.match });
    expect(room.state).toBe(inBattle);
    expect(inBattle.seats[1]!.match.round).toBe(started.seats[1]!.match.round);
  });
  it('passes a preparation command to the rules and keeps a rules refusal free of side effects', () => {
    const { room } = makeRoom(new DamageResolver(() => 0));
    room.start();
    const before = room.state; const seat = before.seats[2]!;
    const refused = room.handle('s2', { type: 'buy', slot: 99, generation: seat.match.shop.generation });
    expect(refused.ok).toBe(false);
    if (!refused.ok) { expect(refused.reason).toBe('invalid-slot'); expect(refused.state).toBe(seat.match); }
    expect(room.state).toBe(before);
    const accepted = room.handle('s2', { type: 'shopLock', locked: true, generation: seat.match.shop.generation });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.seatRevision).toBe(1);
    expect(room.state.seats[2]!.match).toBe(accepted.state);
    expect(room.state.seats[2]!.match.shop.locked).toBe(true);
    expect(room.state.roomRevision).toBeGreaterThan(before.roomRevision);
    expect(room.state.seats[0]!.match).toBe(before.seats[0]!.match);
  });
});

describe('Room: settlement', () => {
  it('commits nothing when one battle of the round throws', () => {
    let calls = 0;
    const resolver = { resolveBattle(input: BattleInput): BattleResult {
      if (++calls === 2) throw new Error('boom');
      return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes: input.seats.map(seat => ({ seatId: seat.seatId, state: seat.state, result: null, damage: 50, combat: null })) };
    } };
    const { room, clock } = makeRoom(resolver);
    room.start();
    const hpBefore = room.state.seats.map(seat => seat.hp);
    clock.advance(1_000);
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toMatchObject({ kind: 'resolver-error', message: 'boom' });
    expect(room.state.seats.map(seat => seat.hp)).toEqual(hpBefore);
    expect(room.state.seats.every(seat => seat.alive && seat.rank === null)).toBe(true);
    expect(room.state.settlements).toEqual([]); expect(room.state.ranking).toBeNull();
  });
  it('faults instead of committing a round whose results miss a seat', () => {
    const resolver = { resolveBattle(input: BattleInput): BattleResult {
      return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes: input.seats.slice(0, 0).map(seat => ({ seatId: seat.seatId, state: seat.state, result: null, damage: 0, combat: null })) };
    } };
    const { room, clock } = makeRoom(resolver);
    room.start(); clock.advance(1_000);
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault?.kind).toBe('invalid-results');
    expect(room.state.settlements).toEqual([]);
  });
  it('applies the same RoundSettlement only once', () => {
    const { room, clock } = makeRoom(new DamageResolver(seatId => seatId === 's3' ? 30 : 0));
    room.start(); clock.advance(1_000);
    expect(room.state.phase).toBe('battle');
    const plan = room.planSettlement(room.state.battles);
    expect(plan.ok).toBe(true); if (!plan.ok) return;
    const first = room.commitSettlement(plan.settlement);
    expect(first.ok).toBe(true);
    const after = room.state;
    expect(after.seats[3]!.hp).toBe(70);
    expect(after.settlements).toEqual(['test-room:round-1']);
    const second = room.commitSettlement(plan.settlement);
    expect(second).toEqual({ ok: false, reason: 'duplicate-settlement', state: after });
    expect(room.state).toBe(after);
    clock.runNext(); // the room's own battle deadline finds the settlement already committed
    expect(room.state.seats[3]!.hp).toBe(70);
    expect(room.state.settlements).toEqual(['test-room:round-1']);
    expect(room.state.phase).toBe('settlement');
  });
  it('ranks several seats that reach zero in the same round uniquely, independent of result order', () => {
    const damage: Record<string, number> = { s0: 100, s1: 120, s2: 100, s3: 90, s4: 150, s5: 100, s6: 0, s7: 100 };
    const { room, clock } = makeRoom(new DamageResolver(seatId => damage[seatId]!));
    room.start(); clock.advance(1_000);
    const results = room.state.battles;
    const forward = room.planSettlement(results), reversed = room.planSettlement([...results].reverse());
    const rotated = room.planSettlement([...results.slice(3), ...results.slice(0, 3)]);
    expect(forward.ok && reversed.ok && rotated.ok).toBe(true);
    if (!forward.ok || !reversed.ok || !rotated.ok) return;
    expect(reversed.settlement.eliminated).toEqual(forward.settlement.eliminated);
    expect(rotated.settlement.finalRanking).toEqual(forward.settlement.finalRanking);
    // Raw HP after damage: s4 -50, s1 -20, s0/s2/s5/s7 0 (seat order breaks the tie), then survivors s3 (10) and s6 (100).
    expect(forward.settlement.eliminated).toEqual([
      { seatId: 's4', rank: 8 }, { seatId: 's1', rank: 7 }, { seatId: 's7', rank: 6 }, { seatId: 's5', rank: 5 }, { seatId: 's2', rank: 4 }, { seatId: 's0', rank: 3 },
    ]);
    expect(forward.settlement.finalRanking).toBeNull();
    clock.runNext();
    expect(room.state.seats.filter(seat => seat.alive).map(seat => seat.seatId)).toEqual(['s3', 's6']);
    expect(room.state.seats.find(seat => seat.seatId === 's4')).toMatchObject({ hp: 0, alive: false, rank: 8, eliminatedRound: 1 });
    expect(room.state.ranking).toBeNull();
  });
  it('gives every seat a unique final rank when all eight reach zero together', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 100, false));
    room.start(); clock.advance(1_000);
    expect(room.state.phase).toBe('ended'); expect(room.state.fault).toBeNull();
    expectUniqueRanking(room.state);
    expect(room.state.ranking!.map(entry => entry.seatId)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7']);
  });
  it('uses the raw HP before the seat order when zero is reached from different heights', () => {
    const { room, clock } = makeRoom(new DamageResolver(seatId => seatId === 's7' ? 100 : seatId === 's6' ? 101 : 1, false));
    room.start(); clock.advance(1_000);
    const eliminated = room.state.seats.filter(seat => !seat.alive).map(seat => [seat.seatId, seat.rank]);
    expect(eliminated).toEqual([['s6', 8], ['s7', 7]]);
  });
});

describe('Room: real resolver end to end', () => {
  it('runs a whole idle match on the manual clock until the rules decide it', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const seen = new Set<string>();
    const unsubscribe = room.subscribe(state => seen.add(state.phase));
    const state = runUntil(room, clock, current => current.phase === 'ended');
    unsubscribe();
    // Overtime follows the catalog's final round until one seat is left (§11.5, B7): always a unique ranking.
    expect(state.fault).toBeNull();
    expectUniqueRanking(state);
    expect(state.round).toBeGreaterThan(4);
    expect([...seen]).toEqual(expect.arrayContaining(['preparation', 'choice', 'frozen', 'battle', 'settlement', 'ended']));
    // The rules' HP is the room's authoritative HP after every published round.
    for (const seat of state.seats) expect(seat.match.playerHp).toBe(seat.hp);
    expect(state.settlements.length).toBe(state.round);
  }, 60_000);
  it('pairs survivors on pvp rounds and freezes two seats per real pairing', () => {
    const twoSided = new TwoSidedBattleResolver();
    const inputs: BattleInput[] = [];
    const resolver = { resolveBattle(input: BattleInput, pool: SharedPoolState) { inputs.push(input); return twoSided.resolveBattle(input, pool); } };
    const { room, clock } = makeRoom(resolver);
    room.start();
    runUntil(room, clock, current => current.round === 4 && current.phase === 'preparation');
    expect(room.state.roundKind).toBe('pvp');
    // G1-P6: preparation shows candidates only; the pairings are drawn at the freeze.
    expect(room.state.pairings).toEqual([]);
    expect(Object.keys(room.state.opponentCandidates)).toHaveLength(8);
    inputs.length = 0;
    clock.runNext();
    expect(room.state.pairings).toHaveLength(8);
    expect(inputs).toHaveLength(4);
    expect(inputs.every(input => input.seats.length === 2 && input.mirrorOf === null && input.roundKind === 'pvp')).toBe(true);
    expect(new Set(inputs.flatMap(input => input.seats.map(seat => seat.seatId))).size).toBe(8);
  }, 30_000);
});

describe('Room: choice window and stuck seats', () => {
  it('opens a choice window at a round with a pending choice and moves on as soon as every seat chose', () => {
    // Room seed 1: every seat's first offer at 2-1 closes the choice (no follow-up forge choice from the chosen augment).
    const { room, clock } = makeRoom(new PlaceholderBattleResolver(), { seed: 1 });
    room.start();
    runUntil(room, clock, current => current.round === 4);
    expect(room.state.phase).toBe('choice');
    // T10 §15.2: the choice window also accepts operations; they neither close nor skip the choice.
    expect(room.handle('s0', { type: 'buyXp' })).not.toMatchObject({ reason: 'wrong-phase' });
    expect(room.state.seats[0]!.match.phase).toBe('choice');
    const deadline = room.state.deadlineAt!;
    for (const seat of room.state.seats) {
      const pending = seat.match.pendingChoice!;
      expect(pending.step).toBe('offer');
      const chosen = room.handle(seat.seatId, { type: 'choose', choiceId: pending.choiceId, generation: pending.generation, definitionId: pending.offers[0]! });
      expect(chosen.ok).toBe(true);
    }
    expect(room.state.phase).toBe('preparation');
    expect(clock.now()).toBeLessThan(deadline);
    expect(room.state.deadlineAt).toBe(clock.now() + 1_000);
  });
  it('re-arms the settlement a bounded number of times for a seat the rules refuse to advance, then faults', () => {
    const { room, clock } = makeRoom(new DamageResolver(() => 0));
    room.start(); clock.advance(1_000); clock.runNext();
    expect(room.state.phase).toBe('settlement');
    const seats = room.state.seats;
    clock.runNext(); expect(room.state.phase).toBe('settlement');
    clock.runNext(); expect(room.state.phase).toBe('settlement');
    clock.runNext();
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toEqual({ kind: 'seat-stuck', seatId: 's0', reason: 'wrong-phase' });
    expect(room.state.seats.map(seat => seat.match)).toEqual(seats.map(seat => seat.match));
    expect(room.state.ranking).toBeNull();
  });
});
