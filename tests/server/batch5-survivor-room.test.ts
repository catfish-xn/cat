import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { recordAugmentSettlementTable, restoreSharedOrbSnapshot } from '../../src/server-entry';
import { recordRoomSettlementTable, tableFacts } from '../../src/server/room/augment-history';
import { seatPushEvents, toCombatReplayFor } from '../../src/server/room/projection';
import { ManualClock } from '../../src/server/room/clock';
import { Room } from '../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoundSettlement, SeatCommand, SeatState } from '../../src/server/room/types';
import type { MatchEvent, MatchState } from '../../src/simulation/match-types';
import { runUntil, SEATS, TIMINGS } from './helpers';
import { validateRewards } from '../fixtures/m5/augment-rewards-oracle.cjs';
import { CATALOG, COST, ROUNDS, xp, entryXp, benchXp } from '../fixtures/m5/oracle.g2.cjs';

const SOURCE = 'augment-pool-batch5-h4-survivor';
const grants = (events: readonly MatchEvent[]) => events.filter(e => e.type === 'mechanicGranted' && e.receipt.source === SOURCE);
const receipts = (state: MatchState) => state.seatMechanics!.receipts.filter(r => r.source === SOURCE);

describe.each([
  { combatStreaming: false, holderDies: false }, { combatStreaming: false, holderDies: true },
  { combatStreaming: true, holderDies: false }, { combatStreaming: true, holderDies: true },
])('Survivor through real room battles (stream: $combatStreaming, holder dies: $holderDies)', ({ combatStreaming, holderDies }) => {
  const committedPlans: RoundSettlement[] = [];
  // Observe the actual staged result without replacing any settlement behavior.
  class ObservedRoom extends Room {
    override commitSettlement(settlement: RoundSettlement) {
      committedPlans.push(settlement);
      return super.commitSettlement(settlement);
    }
  }
  const clock = new ManualClock();
  const room = new ObservedRoom(SEATS.map(s => s.seatId === 's7' ? { ...s, kind: 'human' } : s),
    { ...TIMINGS, roomId: 'test-room', seed: 8, clock, combatStreaming, resolver: new TwoSidedBattleResolver() });
  const holder = () => room.state.seats.find(s => s.seatId === 's7')!;
  const published: MatchEvent[] = [];
  const finalRound = holderDies ? 25 : 24;
  let lastRevision = -1;
  let payoutPlan: RoundSettlement | undefined;
  let disconnected = false;
  beforeAll(() => {
    room.subscribe(state => {
      const seat = state.seats.find(s => s.seatId === 's7')!;
      if (seat.seatRevision === lastRevision) return;
      lastRevision = seat.seatRevision;
      published.push(...grants(seatPushEvents(seat)));
      // Every notification containing the receipt must already contain its numbered event.
      if (receipts(seat.match).length && published.length === 1)
        expect(published[0]).toMatchObject({ receipt: receipts(seat.match)[0], domain: 'match' });
    });
    room.start();
  });
  afterAll(() => room.dispose());
  function command(seat: SeatState, value: SeatCommand) {
    const result = seat.controller === 'bot' ? room.handleBot(seat.seatId, seat.controlEpoch, value) : room.handle(seat.seatId, value);
    expect(result).toMatchObject({ ok: true });
  }

  // One real round per test keeps each step within the existing test budget.
  // Only public commands are used: no injected HP, outcomes, ranks or settlement states.
  for (let round = 1; round <= finalRound; round++) it(`plays and settles round ${round} without an early grant`, () => {
    for (let fired = 0; !(room.state.round === round && room.state.phase === 'settlement'); fired++) {
      expect(fired).toBeLessThan(2_000);
      expect(room.state.round).toBeLessThanOrEqual(round);
      expect(room.state.fault).toBeNull();
      if (room.state.round === round && room.state.phase === 'preparation') {
        for (const seat of room.state.seats) {
          if (!seat.alive) continue;
          // In the dying-holder vector, one opening win keeps s0 in the same final elimination batch.
          const sell = ['s2', ...(!holderDies || round >= 2 ? ['s0'] : []), ...(round >= 2 ? ['s1'] : []), ...(holderDies && round >= 3 ? ['s7'] : [])].includes(seat.seatId);
          if (sell) for (const unit of seat.match.preparation.units.filter(u => u.team === 'player'))
            command(seat, { type: 'sell', unitId: unit.id });
        }
        if (round === 4 && !holder().match.augments.some(a => a.definitionId === 'survivor')) {
          const seat = holder(), choice = seat.match.pendingChoice!;
          expect(choice.offers).toContain('survivor');
          command(seat, { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'survivor' });
          expect(holder().match.gold).toBe(seat.match.gold);
          expect(receipts(holder().match)).toHaveLength(0);
          const pending = holder().match;
          expect(recordAugmentSettlementTable(pending, tableFacts(room.state.seats))).toEqual({ state: pending, events: [] });
          expect(recordAugmentSettlementTable(pending, tableFacts(room.state.seats)).state).toBe(pending);
        }
      }
      if (room.state.round === finalRound && !disconnected) {
        expect(room.setConnected('s7', false)).toBe(true);
        disconnected = true;
      }
      if (!combatStreaming && round === 24 && !holderDies && room.state.round === round && room.state.phase === 'battle' && !payoutPlan) {
        const planned = room.planSettlement(room.state.battles);
        expect(planned.ok).toBe(true);
        if (!planned.ok) throw new Error(planned.detail);
        payoutPlan = planned.settlement;
        expect(payoutPlan.eliminated.map(s => s.seatId).sort()).toEqual(['s0', 's1', 's2']);
        const reversed = room.planSettlement([...room.state.battles].reverse());
        expect(reversed.ok && reversed.settlement.seats).toEqual(planned.settlement.seats);
      }
      expect(clock.runNext()).toBe(true);
    }
    expect(room.state.fault).toBeNull();
    expect(receipts(holder().match)).toHaveLength(!holderDies && round === 24 ? 1 : 0);
    expect(published).toHaveLength(!holderDies && round === 24 ? 1 : 0);
  });

  it('publishes a single numbered grant after simultaneous elimination, or none for a dying holder', () => {
    const seat = holder();
    if (holderDies) {
      expect(seat.alive).toBe(false);
      expect(seat.eliminatedRound).toBe(25);
      expect(room.state.seats.filter(s => s.eliminatedRound === 25).map(s => s.seatId)).toEqual(['s0', 's1', 's2', 's7']);
      expect(receipts(seat.match)).toEqual([]);
      expect(grants(seat.serverEvents?.events ?? [])).toEqual([]);
      return;
    }
    payoutPlan ??= committedPlans.find(plan => plan.round === finalRound);
    expect(payoutPlan!.eliminated.map(s => s.seatId).sort()).toEqual(['s0', 's1', 's2']);
    const before = payoutPlan!.seats.find(s => s.seatId === seat.seatId)!;
    const receipt = { receiptId: JSON.stringify([SOURCE, 'round:2-1:augment']), source: SOURCE,
      round: 24, roundId: '4-7', kind: 'gold', amount: 60 };
    expect(seat.alive).toBe(true);
    expect(seat.match.gold).toBe(before.match.gold + 60);
    expect(receipts(seat.match)).toEqual([receipt]);
    expect(published).toEqual([{ type: 'mechanicGranted', receipt, domain: 'match', eventSeq: before.match.nextMatchEventSeq }]);
    expect(seat.serverEvents).toEqual({ seatRevision: seat.seatRevision, events: [...before.events, ...published] });
    expect(seat.match.nextMatchEventSeq).toBe(before.match.nextMatchEventSeq + 1);
    const command = { type: 'recordAugmentSettlementTable', seats: tableFacts(room.state.seats) };
    const env = { CATALOG, COST, ROUNDS, xp, entryXp, benchXp };
    expect(() => validateRewards(before.match, seat.match, command, published, env)).not.toThrow();
    // Co-forged balance/receipt/event must still disagree with the independently derived 60 gold.
    const forgedReceipt = { ...receipt, amount: 61 };
    const forged = { ...seat.match, gold: seat.match.gold + 1, seatMechanics: { ...seat.match.seatMechanics!,
      receipts: seat.match.seatMechanics!.receipts.map(r => r.source === SOURCE ? forgedReceipt : r) } };
    expect(() => validateRewards(before.match, forged, command,
      published.map(e => e.type === 'mechanicGranted' ? { ...e, receipt: forgedReceipt } : e), env)).toThrow(/independent H4/);
    const state = room.state;
    expect(room.commitSettlement(payoutPlan!)).toMatchObject({ ok: false, reason: 'duplicate-settlement' });
    expect(room.state).toBe(state);
    expect(published).toHaveLength(1);
  });

  it('retains the committed state and event after disconnect during settlement and repeated reconnects', () => {
    const seat = holder(), pool = room.state.pool;
    expect(disconnected).toBe(true);
    expect(seat.connected).toBe(false);
    for (const connected of [true, false, true]) {
      expect(room.setConnected(seat.seatId, connected)).toBe(true);
      expect(holder().connected).toBe(connected);
      expect(holder().match).toBe(seat.match);
      expect(holder().seatRevision).toBe(seat.seatRevision);
      expect(holder().serverEvents).toBe(seat.serverEvents);
      expect(room.state.pool).toBe(pool);
      expect(recordRoomSettlementTable(room.state.seats).find(s => s.seatId === seat.seatId)).toBe(holder());
      expect(published).toHaveLength(holderDies ? 0 : 1);
    }
  });

  it('round trips authenticated object/JSON saves and never reissues a saved receipt or event', () => {
    const seat = holder(), authority = room.augmentHistoryAuthority(seat.seatId), table = tableFacts(room.state.seats);
    for (const input of [seat.match, JSON.stringify(seat.match)]) {
      const restored = restoreSharedOrbSnapshot(room.state.pool, input, authority);
      expect(restored).toEqual(seat.match);
      const again = recordAugmentSettlementTable(restored, table);
      expect(again.state).toBe(restored);
      expect(again.events).toEqual([]);
      const seats = room.state.seats.map(s => s === seat ? { ...s, match: restored, serverEvents: undefined } : s);
      expect(recordRoomSettlementTable(seats).find(s => s.seatId === seat.seatId)).toBe(seats[seat.index]);
      for (const edit of [
        (s: MatchState) => ({ ...s, gold: s.gold + 60 }),
        (s: MatchState) => ({ ...s, nextMatchEventSeq: s.nextMatchEventSeq + 1 }),
        (s: MatchState) => ({ ...s, augmentHistory: { ...s.augmentHistory!, facts: s.augmentHistory!.facts.filter(f => f.kind !== 'table' || f.stage !== 'settlement') } }),
      ]) expect(() => restoreSharedOrbSnapshot(room.state.pool, typeof input === 'string' ? JSON.stringify(edit(restored)) : edit(restored), authority)).toThrow();
    }
  });

  it('repeated replay projection and the next round do not grant again', () => {
    const before = holder().match;
    const replay = toCombatReplayFor(room.state, holder().seatId);
    expect(toCombatReplayFor(room.state, holder().seatId)).toEqual(replay);
    expect(holder().match).toBe(before);
    runUntil(room, clock, s => s.round === finalRound + 1 && s.phase === 'settlement');
    expect(room.state.fault).toBeNull();
    expect(receipts(holder().match)).toEqual(receipts(before));
    expect(published).toHaveLength(holderDies ? 0 : 1);
  });
});
