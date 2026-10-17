/**
 * G23-SERVER-FACTS: the room hands the rules' own G2-3 battle facts (Conqueror / Chem Baron / Junker progress) from each
 * settlement-eligible PvP proposal into its round receipt, verbatim. The rules settle them; a retried commit or a mirror
 * copy pays nothing. Bot-free rooms (makeRoom never drives bots).
 */
import { describe, expect, it } from 'vitest';
import { type BattleResolver } from '../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleResult, RoomState, SeatState } from '../../src/server/room/types';
import { readG23Progress } from '../../src/simulation/g2-3-state';
import { makeRoom, runUntil } from './helpers';

type TwoSided = Extract<BattleResult, { kind: 'two-sided' }>;
const twoSided = (battle: BattleResult): battle is TwoSided => battle.kind === 'two-sided';
const atFirstPvp = (state: RoomState) => state.round === 4 && state.phase === 'preparation';
const progress = (seat: SeatState) => readG23Progress(seat.match)!;
const pvpReceipts = (seat: SeatState, round: number) => progress(seat).economyReceipts.filter(r => r.kind === 'battle' && r.facts.round === round);
function proposalFor(state: RoomState, seatId: string) {
  const battle = state.battles.filter(twoSided).find(candidate => candidate.participants.includes(seatId))!;
  return [battle.proposals.a, battle.proposals.b].find(candidate => candidate.seatId === seatId)!;
}

describe('G23-SERVER-FACTS: PvP receipts carry the rules\' G2-3 facts', () => {
  it('forwards each proposal\'s g23Facts verbatim and the rules record exactly one G2-3 battle receipt per seat', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, atFirstPvp);
    const before = room.state;
    clock.runNext(); clock.runNext(); // preparation deadline → battle → commit
    const state = room.state;
    expect(state.settlements).toContain('test-room:round-4');
    for (const seat of state.seats) {
      const proposal = proposalFor(state, seat.seatId);
      expect(proposal.g23Facts).toBeDefined();
      const receipt = seat.match.multiplayer!.receipts.at(-1)!;
      expect(receipt.g23Facts).toEqual(proposal.g23Facts);
      // Settled by the rules: one battle receipt for round 4 holding the same facts, and Chem Baron's loss streak follows the result.
      const settled = pvpReceipts(seat, 4);
      expect(settled).toHaveLength(1);
      expect(settled[0]).toMatchObject({ kind: 'battle', facts: proposal.g23Facts });
      const lossesBefore = progress(before.seats.find(old => old.seatId === seat.seatId)!).chem.losses;
      expect(progress(seat).chem.losses).toBe(proposal.result === 'loss' ? lossesBefore + 1 : 0);
    }
  }, 30_000);

  it('advances Conqueror for a seat fielding two Conquerors, once even when the same round is committed again', () => {
    // Only Darius and Draven (both one-cost Conquerors) stock the shops, besides the raised opening copies.
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { poolCapacities: { darius: 20, draven: 20 } });
    room.start();
    const seatOf = () => room.state.seats.find(seat => seat.seatId === 's0')!;
    const playerUnits = () => seatOf().match.preparation.units.filter(unit => unit.team === 'player');
    const missing = () => ['darius', 'draven'].filter(id => !playerUnits().some(unit => unit.definitionId === id));
    // Shop each preparation from round 2 on until s0 holds one of each; rerolls only with gold to spare.
    for (const round of [2, 3, 4]) {
      runUntil(room, clock, state => state.round === round && state.phase === 'preparation');
      for (let attempt = 0; attempt < 10 && missing().length; attempt++) {
        const seat = seatOf();
        const slot = seat.match.shop.slots.findIndex(candidate => candidate.status === 'available' && missing().includes(candidate.definitionId));
        if (slot >= 0) expect(room.handle('s0', { type: 'buy', slot, generation: seat.match.shop.generation }).ok).toBe(true);
        else if (seat.match.gold >= 3) expect(room.handle('s0', { type: 'reroll' }).ok).toBe(true);
        else break;
      }
    }
    expect(room.state).toMatchObject({ round: 4, phase: 'preparation' });
    expect(missing()).toEqual([]);
    // Field exactly one Darius and one Draven: everything else to the bench.
    const fielded = ['darius', 'draven'].map(id => playerUnits().find(unit => unit.definitionId === id)!);
    let benchSlot = 8;
    for (const unit of playerUnits()) if (unit.location.kind === 'board' && !fielded.includes(unit)) {
      expect(room.handle('s0', { type: 'deploy', unitId: unit.id, target: { kind: 'bench', slot: benchSlot-- } }).ok).toBe(true);
    }
    for (const [index, unit] of fielded.entries()) if (unit.location.kind !== 'board') {
      expect(room.handle('s0', { type: 'deploy', unitId: unit.id, target: { kind: 'board', cell: { col: 2 + 2 * index, row: 4 } } }).ok).toBe(true);
    }
    // PvE rounds already settle Conqueror through the rules alone; PvP rounds need the room to forward the facts.
    const conquestBefore = progress(seatOf()).conquest;
    expect(conquestBefore.receipts.every(receipt => !receipt.battleId.startsWith('test-room:'))).toBe(true);

    clock.runNext(); // preparation deadline → battle
    const plan = room.planSettlement(room.state.battles);
    expect(plan.ok).toBe(true); if (!plan.ok) return;
    expect(room.commitSettlement(plan.settlement).ok).toBe(true);
    const after = room.state;
    const facts = proposalFor(after, 's0').g23Facts!;
    expect(facts).toMatchObject({ round: 4, roundKind: 'pvp', conquerorTier: 2 });
    const conquest = progress(after.seats.find(seat => seat.seatId === 's0')!).conquest;
    expect(conquest.receipts).toHaveLength(conquestBefore.receipts.length + 1);
    const added = conquest.receipts.at(-1)!;
    expect(added).toMatchObject({ battleId: facts.battleId, tier: 2, takedownIds: facts.conquestTakedowns });
    expect(conquest.stacks).toBe(conquestBefore.stacks + added.stacksAdded);
    expect(facts.conquestTakedowns.length).toBeGreaterThan(0); expect(added.stacksAdded).toBeGreaterThan(0);

    // A retried commit of the same round is refused before it reaches the rules, and the room's own deadline finds it settled.
    expect(room.commitSettlement(plan.settlement)).toMatchObject({ ok: false, reason: 'duplicate-settlement' });
    clock.runNext();
    const settled = room.state.seats.find(seat => seat.seatId === 's0')!;
    expect(progress(settled).conquest).toEqual(conquest);
    expect(pvpReceipts(settled, 4)).toHaveLength(1);
    expect(settled.match.multiplayer!.receipts).toHaveLength(1);
  }, 30_000);

  it('settles the seat facing a mirror once and gives the mirrored seat nothing extra', () => {
    // Seven survivors from round 2 on, so the first PvP round has one mirror pairing.
    const inner = new TwoSidedBattleResolver();
    const resolver: BattleResolver = { resolveBattle(input, pool) {
      if (input.round === 1 && input.seats[0]!.seatId === 's7') {
        const state = input.seats[0]!.state;
        const eliminated = { ...state, playerHp: 0, multiplayer: { ...state.multiplayer!, status: 'eliminated' as const } };
        return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes: [{ seatId: 's7', state: eliminated, result: null, damage: 100, combat: null }] };
      }
      return inner.resolveBattle(input, pool);
    } };
    const { room, clock } = makeRoom(resolver);
    room.start();
    runUntil(room, clock, atFirstPvp);
    clock.runNext(); clock.runNext();
    const state = room.state;
    expect(state.settlements).toContain('test-room:round-4');
    const mirror = state.battles.filter(twoSided).find(battle => battle.battle.mirrorOfSeatId !== null)!;
    expect(mirror).toBeDefined();
    expect(mirror.participants).toHaveLength(1);
    const ghost = [mirror.proposals.a, mirror.proposals.b].find(proposal => !mirror.participants.includes(proposal.seatId))!;
    expect(ghost.settlementEligible).toBe(false);
    expect(ghost.g23Facts).toBeUndefined();
    for (const seat of state.seats.filter(candidate => candidate.alive)) {
      expect(seat.match.multiplayer!.receipts.at(-1)!.g23Facts).toEqual(proposalFor(state, seat.seatId).g23Facts);
      expect(pvpReceipts(seat, 4)).toHaveLength(1);
    }
  }, 30_000);
});
