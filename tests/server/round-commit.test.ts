/**
 * B4: the room publishes a whole round atomically through the rules' receipt entry (contract §11.3),
 * resolves timeouts with the rules' commands (§11.4) and ranks same-round eliminations by the §11.5 key.
 */
import { describe, expect, it } from 'vitest';
import { PlaceholderBattleResolver, type BattleResolver } from '../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleResult, RoomState } from '../../src/server/room/types';
import { DamageResolver, expectUniqueRanking, makeRoom, runUntil } from './helpers';

const twoSided = (battle: BattleResult): battle is Extract<BattleResult, { kind: 'two-sided' }> => battle.kind === 'two-sided';

/** Round 1 (PvE) through the real rules for everyone except `victim`, who takes a fabricated lethal outcome: seven survivors from round 2 on. */
function killAtRoundOne(victim: string): BattleResolver {
  const inner = new TwoSidedBattleResolver();
  return { resolveBattle(input) {
    if (input.round === 1 && input.seats[0]!.seatId === victim) {
      return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes: [{ seatId: victim, state: input.seats[0]!.state, result: null, damage: 100, frames: [] }] };
    }
    return inner.resolveBattle(input);
  } };
}
const atFirstPvp = (state: RoomState) => state.round === 4 && state.phase === 'preparation';

describe('Room: whole-round commit through T3 receipts', () => {
  it('publishes the round once: every seat HP is the rules\' playerHp and each real seat holds exactly one receipt', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, atFirstPvp);
    const before = room.state;
    const hpBefore = new Map(before.seats.map(seat => [seat.seatId, seat.hp] as const));
    clock.runNext(); // preparation deadline → frozen → battle
    expect(room.state.phase).toBe('battle');
    // Nothing is published while the battle plays: HP and seat states are the frozen ones.
    expect(room.state.seats.map(seat => seat.hp)).toEqual(before.seats.map(seat => seat.hp));
    expect(room.state.seats.every(seat => seat.match.multiplayer!.receipts.length === 0)).toBe(true);
    clock.runNext(); // battle deadline → commit
    const state = room.state;
    expect(state.settlements).toContain('test-room:round-4');
    expect(state.phase === 'settlement' || state.phase === 'choice').toBe(true);
    const battles = state.battles.filter(twoSided);
    expect(battles).toHaveLength(4);
    for (const seat of state.seats) {
      expect(seat.match.playerHp).toBe(seat.hp);
      const receipts = seat.match.multiplayer!.receipts;
      expect(receipts).toHaveLength(1);
      const battle = battles.find(candidate => candidate.participants.includes(seat.seatId))!;
      const proposal = [battle.proposals.a, battle.proposals.b].find(candidate => candidate.seatId === seat.seatId)!;
      expect(receipts[0]).toMatchObject({ settlementId: JSON.stringify(['test-room', 4, seat.seatId]), battleId: battle.battleId, round: 4, roundId: '2-1', damage: proposal.damage, result: proposal.result });
      expect(seat.hp).toBe(Math.max(0, hpBefore.get(seat.seatId)! - proposal.damage));
      expect(seat.match.roundResults.at(-1)).toMatchObject({ round: 4, playerDamage: proposal.damage });
      expect(seat.alive).toBe(seat.hp > 0);
    }
  }, 20_000);

  it('applies the same round commit only once', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, atFirstPvp);
    clock.runNext();
    const plan = room.planSettlement(room.state.battles);
    expect(plan.ok).toBe(true); if (!plan.ok) return;
    const again = room.planSettlement([...room.state.battles].reverse());
    expect(again.ok && again.settlement.seats).toEqual(plan.settlement.seats);
    const first = room.commitSettlement(plan.settlement);
    expect(first.ok).toBe(true);
    const after = room.state;
    const second = room.commitSettlement(plan.settlement);
    expect(second).toEqual({ ok: false, reason: 'duplicate-settlement', state: after });
    expect(room.state).toBe(after);
    clock.runNext(); // the room's own battle deadline finds the round already committed
    expect(room.state.settlements).toEqual(['test-room:round-1', 'test-room:round-2', 'test-room:round-3', 'test-room:round-4']);
    expect(room.state.seats.every(seat => seat.match.multiplayer!.receipts.length === 1)).toBe(true);
  }, 20_000);

  it('discards the whole round when one receipt fails: no HP, no receipt, no state change for anyone', () => {
    const inner = new TwoSidedBattleResolver();
    let tampered = 0;
    const resolver: BattleResolver = { resolveBattle(input) {
      const result = inner.resolveBattle(input);
      if (result.kind === 'two-sided' && tampered++ === 2) return { ...result, proposals: { ...result.proposals, a: { ...result.proposals.a, damage: result.proposals.a.damage + 1 } } };
      return result;
    } };
    const { room, clock } = makeRoom(resolver);
    room.start();
    runUntil(room, clock, atFirstPvp);
    const before = room.state;
    const seen: RoomState[] = [];
    room.subscribe(state => seen.push(state));
    clock.runNext();
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toMatchObject({ kind: 'invalid-results' });
    expect((room.state.fault as { detail: string }).detail).toContain('invalid-receipt');
    expect(room.state.seats.map(seat => seat.hp)).toEqual(before.seats.map(seat => seat.hp));
    expect(room.state.seats.map(seat => seat.match)).toEqual(before.seats.map(seat => seat.match));
    expect(room.state.seats.every(seat => seat.match.multiplayer!.receipts.length === 0 && seat.alive)).toBe(true);
    expect(room.state.settlements).toHaveLength(3);
    // No intermediate publication either: no observed state carried a round-4 receipt or a changed HP.
    expect(seen.every(state => state.seats.every(seat => seat.match.multiplayer!.receipts.length === 0 && seat.hp === before.seats.find(s => s.seatId === seat.seatId)!.hp))).toBe(true);
  }, 20_000);

  it('never commits the mirror proposal; the mirror source settles through its own pairing', () => {
    const { room, clock } = makeRoom(killAtRoundOne('s7'));
    room.start();
    runUntil(room, clock, atFirstPvp);
    expect(room.state.seats.filter(seat => seat.alive)).toHaveLength(7);
    const mirrorRow = room.state.pairings.find(pairing => pairing.opponent.kind === 'mirror')!;
    const sourceSeatId = (mirrorRow.opponent as { sourceSeatId: string }).sourceSeatId;
    clock.runNext(); clock.runNext();
    expect(room.state.fault).toBeNull();
    expect(room.state.settlements).toContain('test-room:round-4');
    const battles = room.state.battles.filter(twoSided);
    const mirrorBattle = battles.find(battle => battle.battleId === mirrorRow.battleId)!;
    expect(mirrorBattle.participants).toEqual([mirrorRow.seatId]);
    expect(mirrorBattle.proposals.b).toMatchObject({ seatId: sourceSeatId, settlementEligible: false, damage: 0 });
    const seatOf = (seatId: string) => room.state.seats.find(seat => seat.seatId === seatId)!;
    expect(seatOf(mirrorRow.seatId).match.multiplayer!.receipts.map(receipt => receipt.battleId)).toEqual([mirrorRow.battleId]);
    const source = seatOf(sourceSeatId);
    expect(source.match.multiplayer!.receipts).toHaveLength(1);
    expect(source.match.multiplayer!.receipts[0]!.battleId).not.toBe(mirrorRow.battleId);
    expect(battles.find(battle => battle.battleId === source.match.multiplayer!.receipts[0]!.battleId)!.participants).toContain(sourceSeatId);
    expect(source.hp).toBe(source.match.playerHp);
    expect(seatOf('s7')).toMatchObject({ alive: false, hp: 0, rank: 8, eliminatedRound: 1 });
  }, 20_000);

  it('eliminates seats round by round down to a unique ranking (overtime after 6-7, B7), and ranks later eliminations better', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const started = Date.now();
    const state = runUntil(room, clock, current => current.phase === 'ended', 20_000);
    const seconds = (Date.now() - started) / 1000;
    expect(seconds).toBeLessThan(30);
    expect(state.settlements.length).toBe(state.round);
    for (const seat of state.seats) expect(seat.match.playerHp).toBe(seat.hp);
    const eliminated = state.seats.filter(seat => !seat.alive);
    expect(eliminated.length).toBe(7);
    for (const a of eliminated) for (const b of eliminated) if (a.eliminatedRound! < b.eliminatedRound!) expect(a.rank!).toBeGreaterThan(b.rank!);
    expect(state.fault).toBeNull();
    expectUniqueRanking(state);
  }, 60_000);

  it('ranks three seats that reach zero in one round by raw HP, then HP before, then seat index, in any arrival order', () => {
    // Placeholder PvP results (test mode): s1 overkilled the most, s2 and s3 tie on raw HP and HP before → seat index decides.
    const damage: Record<string, number> = { s0: 0, s1: 130, s2: 100, s3: 100, s4: 0, s5: 0, s6: 0, s7: 0 };
    const { room, clock } = makeRoom(new DamageResolver(seatId => damage[seatId]!), { pvpMode: 'placeholder' });
    room.start(); clock.advance(1_000);
    const results = room.state.battles;
    const forward = room.planSettlement(results), reversed = room.planSettlement([...results].reverse());
    expect(forward.ok && reversed.ok).toBe(true); if (!forward.ok || !reversed.ok) return;
    expect(reversed.settlement.eliminated).toEqual(forward.settlement.eliminated);
    expect(forward.settlement.eliminated).toEqual([{ seatId: 's1', rank: 8 }, { seatId: 's3', rank: 7 }, { seatId: 's2', rank: 6 }]);
    expect(forward.settlement.finalRanking).toBeNull();
  });

  it('resolves choice and loot timeouts with the rules\' commands, never with a client-style fallback', () => {
    const { room, clock } = makeRoom(new PlaceholderBattleResolver());
    room.start();
    runUntil(room, clock, current => current.round === 4 && current.phase === 'choice');
    const pending = room.state.seats.map(seat => seat.match.pendingChoice!.choiceId);
    clock.runNext(); // choice deadline → every seat timed out to its first offer
    expect(room.state.phase).toBe('preparation');
    for (const [index, seat] of room.state.seats.entries()) {
      expect(seat.match.pendingChoice).toBeNull();
      expect(seat.match.scheduleReceipts.some(receipt => receipt.eventId === pending[index])).toBe(true);
    }
  }, 20_000);
});
