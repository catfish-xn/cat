import { afterEach, describe, expect, it, vi } from 'vitest';
import * as serverEntry from '../../src/server-entry';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState, TwoSidedBattleResult } from '../../src/server/room/types';
import { readG23Progress, writeG23Progress } from '../../src/simulation/g2-3-state';
import { makeRoom, runUntil } from './helpers';

// Shared by mel-save-settlement*.test.ts; each streaming mode runs in its own file (own worker).
const disposers: (() => void)[] = [];
/** Registers the per-file cleanup; call once at the top level of a test file. */
export const disposeAfterEach = () => afterEach(() => { for (const dispose of disposers.splice(0)) dispose(); });

/** Transaction vector: seed the live seat after real PvP inputs freeze, forcing the deadline to re-plan on it. */
export function melRoom(casts = 12, savedBattleId: string | null = null, hp = 2, combatStreaming = false, seedBeforeTerminal = false) {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { combatStreaming });
  disposers.push(() => room.dispose());
  room.start();
  runUntil(room, clock, state => state.round === 4 && state.phase === 'preparation');
  clock.runNext();
  expect(room.state.phase).toBe('battle');
  if (combatStreaming && !seedBeforeTerminal) runUntil(room, clock, state => state.battles.length > 0, 20_000);
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => ({
    ...seat, hp, seatRevision: seat.seatRevision + 1,
    match: writeG23Progress({ ...seat.match, playerHp: hp }, {
      ...readG23Progress(seat.match)!, mel: { pvpCasts: casts, savedBattleId },
    }),
  })) };
  if (combatStreaming && seedBeforeTerminal) runUntil(room, clock, state => state.battles.length > 0, 20_000);
  return { room, clock, holder };
}

export function registerMelSave(combatStreaming: boolean): void {
describe(`Room: Mel save at PvP settlement (stream=${combatStreaming})`, () => {
  const fixture = (casts = 12, savedBattleId: string | null = null, hp = 2) => melRoom(casts, savedBattleId, hp, combatStreaming);
  it('keeps a rescued seat alive at 1 HP, preserves raw damage and commits the save exactly once', () => {
    const { room, clock } = fixture();
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
    const { room, clock } = fixture(casts, savedBattleId);
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
    const { room } = fixture();
    expect(room.state.phase).toBe('battle');
    const before = room.state;
    const battles = before.battles as readonly TwoSidedBattleResult[];
    const battle = battles.find(battle => battle.proposals.a.damage > 2 || battle.proposals.b.damage > 2)!;
    const side = battle.proposals.a.damage > 2 ? 'a' : 'b';
    const edited = { ...battle, proposals: { ...battle.proposals, [side]: { ...battle.proposals[side], damage: battle.proposals[side].damage + 1 } } };
    expect(room.planSettlement(battles.map(candidate => candidate === battle ? edited : candidate))).toMatchObject({ ok: false, detail: expect.stringContaining('invalid-receipt') });
    expect(room.state).toBe(before);
  }, 20_000);

  it.each(['missing', 'wrong battleId', 'wrong source', 'duplicate'] as const)(
    'rejects lethal damage returning 1 HP with a %s playerSaved event', variant => {
      const { room, clock } = fixture();
      const before = room.state;
      const battles = before.battles as readonly TwoSidedBattleResult[];
      const proposal = battles.flatMap(battle => [battle.proposals.a, battle.proposals.b]).find(p => p.damage > 2)!;
      const run = serverEntry.runSharedMatchCommand;
      let corrupted = 0;
      const spy = vi.spyOn(serverEntry, 'runSharedMatchCommand').mockImplementation((pool, state, command) => {
        const applied = run(pool, state, command);
        if (command.type !== 'settleRound' || command.receipt.seatId !== proposal.seatId || !applied.ok) return applied;
        expect(Math.max(0, state.playerHp - command.receipt.damage)).toBe(0);
        expect(applied.state.playerHp).toBe(1);
        const saves = applied.events.filter(event => event.type === 'playerSaved');
        expect(saves).toHaveLength(1);
        const save = saves[0]!;
        const events: serverEntry.MatchEvent[] = applied.events.filter(event => event.type !== 'playerSaved');
        if (variant === 'wrong battleId') events.push({ ...save, battleId: `${save.battleId}:other` });
        if (variant === 'wrong source') events.push({ ...save, source: 'other' } as unknown as serverEntry.MatchEvent);
        if (variant === 'duplicate') events.push(save, save);
        corrupted++;
        // Leave HP and its record consistent so only the missing/invalid save evidence can reject this result.
        return { ...applied, events };
      });
      disposers.push(() => spy.mockRestore());
      const detail = `seat ${proposal.seatId}: rules HP 1 disagrees with the room HP 2 - ${proposal.damage}`;
      expect(room.planSettlement(battles)).toEqual({ ok: false, detail });
      expect(room.state).toBe(before);
      clock.runNext();
      expect(corrupted).toBe(2);
      expect(room.state.fault).toEqual({ kind: 'invalid-results', detail });
      expect(room.state.seats).toEqual(before.seats);
      expect(room.state.pool).toBe(before.pool);
      expect(room.state.settlements).toEqual(before.settlements);
    }, 20_000,
  );

  it('rejects a room/rules HP mismatch even when the rules return 1 HP', () => {
    const { room, holder } = fixture();
    expect(room.state.phase).toBe('battle');
    const battles = room.state.battles as readonly TwoSidedBattleResult[];
    const proposal = battles.flatMap(battle => [battle.proposals.a, battle.proposals.b]).find(p => p.damage > 2)!;
    holder.current = { ...holder.current, seats: holder.current.seats.map(seat => seat.seatId === proposal.seatId ? { ...seat, hp: 3 } : seat) };
    const before = room.state;
    expect(room.planSettlement(battles)).toEqual({ ok: false, detail: `seat ${proposal.seatId}: rules HP record disagrees with the room settlement` });
    expect(room.state).toBe(before);
  }, 20_000);
});
}
