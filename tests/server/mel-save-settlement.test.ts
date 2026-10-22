import { afterEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState, TwoSidedBattleResult } from '../../src/server/room/types';
import { readG23Progress, writeG23Progress } from '../../src/simulation/g2-3-state';
import { makeRoom, runUntil } from './helpers';

const disposers: (() => void)[] = [];
afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

/** Transaction vector: seed the live seat after real PvP inputs freeze, forcing the deadline to re-plan on it. */
function melRoom(casts = 12, savedBattleId: string | null = null, hp = 2) {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  disposers.push(() => room.dispose());
  room.start();
  runUntil(room, clock, state => state.round === 4 && state.phase === 'preparation');
  clock.runNext();
  expect(room.state.phase).toBe('battle');
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => ({
    ...seat, hp, seatRevision: seat.seatRevision + 1,
    match: writeG23Progress({ ...seat.match, playerHp: hp }, {
      ...readG23Progress(seat.match)!, mel: { pvpCasts: casts, savedBattleId },
    }),
  })) };
  return { room, clock, holder };
}

describe('Room: Mel save at PvP settlement', () => {
  it('keeps a rescued seat alive at 1 HP, preserves raw damage and commits the save exactly once', () => {
    const { room, clock } = melRoom();
    expect(room.state.fault).toBeNull();
    expect(room.state.phase).toBe('battle');
    const battles = room.state.battles as readonly TwoSidedBattleResult[];
    const proposal = battles.flatMap(battle => [battle.proposals.a, battle.proposals.b]).find(p => p.damage > 2)!;
    expect(proposal).toBeDefined();
    const before = room.state;
    const plan = room.planSettlement(battles);
    expect(plan.ok).toBe(true); if (!plan.ok) return;
    const saved = plan.settlement.seats.find(seat => seat.seatId === proposal.seatId)!;
    expect(saved).toMatchObject({ hpBefore: 2, damage: proposal.damage, hpAfterRaw: 2 - proposal.damage, hpAfter: 1 });
    expect(saved.match.playerHp).toBe(1);
    expect(saved.match.multiplayer!.status).toBe('active');
    expect(saved.match.roundResults.at(-1)).toMatchObject({ hpBefore: 2, hpAfter: 1, playerDamage: proposal.damage, hpLost: 1 });
    expect(saved.events.filter(event => event.type === 'playerSaved')).toHaveLength(1);
    expect(plan.settlement.eliminated.some(entry => entry.seatId === saved.seatId)).toBe(false);
    const reversed = room.planSettlement([...battles].reverse());
    expect(reversed.ok && reversed.settlement.seats).toEqual(plan.settlement.seats);
    expect(room.state).toBe(before);
    expect(room.commitSettlement(plan.settlement).ok).toBe(true);
    const committed = room.state;
    const seat = committed.seats.find(candidate => candidate.seatId === saved.seatId)!;
    expect(seat).toMatchObject({ hp: 1, alive: true, rank: null, eliminatedRound: null });
    expect(committed.pool.seats.find(candidate => candidate.seatId === seat.seatId)?.released).toBe(false);
    const saves = readG23Progress(seat.match)!.economyReceipts.filter(receipt => receipt.kind === 'mel-save');
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ battleId: proposal.battleId, round: 4 });
    expect(room.commitSettlement(plan.settlement)).toMatchObject({ ok: false, reason: 'duplicate-settlement' });
    expect(room.state).toBe(committed);
    clock.runNext();
    expect(room.state.fault).toBeNull();
    expect(room.state.seats.find(candidate => candidate.seatId === saved.seatId)!.hp).toBe(1);
  }, 20_000);

  it.each([
    { casts: 11, savedBattleId: null, label: 'fewer than twelve casts' },
    { casts: 12, savedBattleId: 'prior-save', label: 'an already spent save' },
  ])('still eliminates lethal damage with $label', ({ casts, savedBattleId }) => {
    const { room, clock } = melRoom(casts, savedBattleId);
    expect(room.state.fault).toBeNull();
    const battles = room.state.battles as readonly TwoSidedBattleResult[];
    const proposal = battles.flatMap(battle => [battle.proposals.a, battle.proposals.b]).find(p => p.damage > 2)!;
    clock.runNext();
    expect(room.state.fault).toBeNull();
    const seat = room.state.seats.find(candidate => candidate.seatId === proposal.seatId)!;
    expect(seat).toMatchObject({ hp: 0, alive: false, eliminatedRound: 4 });
    expect(seat.match.playerHp).toBe(0);
    expect(seat.match.roundResults.at(-1)).toMatchObject({ hpBefore: 2, hpAfter: 0, playerDamage: proposal.damage, hpLost: 2 });
    expect(seat.serverEvents!.events.some(event => event.type === 'playerSaved')).toBe(false);
  }, 20_000);

  it('rejects edited damage even when Mel would save the seat', () => {
    const { room } = melRoom();
    expect(room.state.phase).toBe('battle');
    const before = room.state;
    const battles = before.battles as readonly TwoSidedBattleResult[];
    const battle = battles.find(battle => battle.proposals.a.damage > 2 || battle.proposals.b.damage > 2)!;
    const side = battle.proposals.a.damage > 2 ? 'a' : 'b';
    const edited = { ...battle, proposals: { ...battle.proposals, [side]: { ...battle.proposals[side], damage: battle.proposals[side].damage + 1 } } };
    expect(room.planSettlement(battles.map(candidate => candidate === battle ? edited : candidate))).toMatchObject({ ok: false, detail: expect.stringContaining('invalid-receipt') });
    expect(room.state).toBe(before);
  }, 20_000);

  it('rejects a room/rules HP mismatch even when the rules return 1 HP', () => {
    const { room, holder } = melRoom();
    expect(room.state.phase).toBe('battle');
    const battles = room.state.battles as readonly TwoSidedBattleResult[];
    const proposal = battles.flatMap(battle => [battle.proposals.a, battle.proposals.b]).find(p => p.damage > 2)!;
    holder.current = { ...holder.current, seats: holder.current.seats.map(seat => seat.seatId === proposal.seatId ? { ...seat, hp: 3 } : seat) };
    const before = room.state;
    expect(room.planSettlement(battles)).toEqual({ ok: false, detail: `seat ${proposal.seatId}: rules HP record disagrees with the room settlement` });
    expect(room.state).toBe(before);
  }, 20_000);
});
