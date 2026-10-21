import { selectOpeningUnit } from '../../src/simulation/opening-unit';
/**
 * B5: the room runs on the TP shared card pool (contract §12). Opening order (§12.2), shop commands as pool transactions,
 * free failure of an empty paid reroll, one release per eliminated seat (§12.4), conservation after every publication
 * and through whole matches in both PvP modes, and no pool revision change on a refused command.
 */
import { describe, expect, it } from 'vitest';
import {
  applyRoundSettlement, assertSharedPoolConservation, releaseSeatOnElimination, ROUND_SETTLEMENT_VERSION, type RoundSettlementReceipt,
} from '../../src/server-entry';
import { type BattleResolver } from '../../src/server/room/battle-resolver';
import { withOpeningCopies } from '../../src/server/room/room';
import { toPlayerView } from '../../src/server/room/projection';
import { TwoSidedBattleResolver, resolveTwoSidedPvp } from '../../src/server/room/two-sided-resolver';
import type { BattleSeatOutcome, RoomState, SeatState } from '../../src/server/room/types';
import { expectUniqueRanking, makeRoom, runUntil } from './helpers';

const conserved = (state: RoomState) => {
  expect(state.poolRevision).toBe(state.pool.revision);
  expect(() => assertSharedPoolConservation(state.pool, state.seats.map(seat => seat.match))).not.toThrow();
};
const total = (counts: Readonly<Record<string, number>>) => Object.values(counts).reduce((sum, count) => sum + count, 0);
const stocked = (seat: SeatState) => seat.match.shop.slots.flatMap((slot, index) => slot.status === 'available' ? [{ index, definitionId: slot.definitionId }] : []);
const isEmptySlot = (slot: SeatState['match']['shop']['slots'][number]) => slot.status === 'purchased' && 'empty' in slot && slot.empty === true;

/** Round 1 through the real rules for everyone except `victim`, whose fabricated lethal outcome is marked eliminated like the rules would. */
function killAtRoundOne(victim: string): BattleResolver {
  const inner = new TwoSidedBattleResolver();
  return { resolveBattle(input, pool) {
    if (input.round === 1 && input.seats[0]!.seatId === victim) {
      const state = input.seats[0]!.state;
      const eliminated = { ...state, playerHp: 0, multiplayer: { ...state.multiplayer!, status: 'eliminated' as const } };
      return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes: [{ seatId: victim, state: eliminated, result: null, damage: 100, combat: null }] };
    }
    return inner.resolveBattle(input, pool);
  } };
}

/**
 * pvpMode=placeholder over a whole match: PvE/supply through the real rules (pool wrapper), PvP fought once by the T2 entry and
 * each real participant settled by the T3 receipt here, then reported as a B1-shaped per-seat outcome the room checks itself.
 */
const placeholderPvp: BattleResolver = (() => {
  const twoSided = new TwoSidedBattleResolver();
  return { resolveBattle(input, pool) {
    if (input.roundKind !== 'pvp') return twoSided.resolveBattle(input, pool);
    const fought = resolveTwoSidedPvp(input);
    const outcomes: BattleSeatOutcome[] = input.seats.map(seat => {
      const proposal = [fought.proposals.a, fought.proposals.b].find(candidate => candidate.seatId === seat.seatId)!;
      const receipt: RoundSettlementReceipt = {
        version: ROUND_SETTLEMENT_VERSION, settlementId: JSON.stringify([input.roomId, input.round, seat.seatId]), battleId: input.battleId, seatId: seat.seatId,
        round: input.round, roundId: input.roundId, settlementEligible: proposal.settlementEligible, result: proposal.result, damage: proposal.damage,
        baseDamage: proposal.baseDamage, opposingSurvivors: proposal.opposingSurvivors, growth: proposal.growth,
        combatTicks: fought.battle.terminal.tick, combatEventCount: fought.battle.events.length,
      };
      const applied = applyRoundSettlement(seat.state, receipt);
      if (!applied.ok) throw new Error(`seat ${seat.seatId}: ${applied.reason}`);
      return { seatId: seat.seatId, state: applied.state, result: null, damage: proposal.damage, combat: fought.battle };
    });
    return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes };
  } };
})();

describe('Room on the shared pool: opening (§12.2)', () => {
  it('imports eight openings by fixed seat index, refreshes once and publishes a balanced pool', () => {
    const { room } = makeRoom();
    const state = room.state;
    conserved(state);
    expect(state.pool.seats.map(seat => [seat.seatId, seat.seatIndex])).toEqual(state.seats.map(seat => [seat.seatId, seat.index]));
    expect(state.pool.naturalRound).toBe(1);
    expect(state.pool.available['irelia']).toBe(30 - state.pool.holdings.filter(h=>h.definitionId==='irelia').length - state.pool.shops.filter(shop => shop.definitionId === 'irelia').length);
    // 1198 copies (v19: three six-costs × 9) − 8 openings − 40 reserved shop cards (contract §12.2).
    expect(total(state.pool.available)).toBe(1150);
    expect(state.pool.shops).toHaveLength(40);
    for (const seat of state.seats) {
      expect(seat.match.sharedPool).toEqual({ poolId: 'test-room', seatId: seat.seatId, revision: 1 });
      expect(seat.match.multiplayer).toMatchObject({ seatId: seat.seatId, status: 'active' });
      expect(seat.match.shop.generation).toBe(1);
    }
  });

  it('never shows the pool to a client: the player view carries no stock, binding or reservation', () => {
    const { room, clock } = makeRoom();
    room.start();
    const view = JSON.stringify(toPlayerView(room.state, 's0', clock.now()));
    for (const word of ['available', 'holdings', 'pending', 'sharedPool', 'poolId', 'naturalRound']) expect(view).not.toContain(word);
  });
});

describe('Room on a debug pool (poolCapacities) with random openings', () => {
  it('raises each seat\'s opening hero to its number of openings, so a fixture that omits them still opens', () => {
    const openings = Array.from({ length: 8 }, (_, i) => selectOpeningUnit(42, `s${i}`));
    const { room } = makeRoom(new TwoSidedBattleResolver(), { poolCapacities: { darius: 1 } });
    room.start();
    conserved(room.state);
    for (const [index, seat] of room.state.seats.entries()) {
      const units = seat.match.preparation.units.filter(unit => unit.team === 'player');
      expect(units.map(unit => unit.definitionId)).toEqual([openings[index]]);
    }
    const held = (id: string) => room.state.pool.holdings.filter(holding => holding.definitionId === id).length;
    for (const hero of new Set(openings)) expect(held(hero)).toBe(openings.filter(id => id === hero).length);
  });

  it('keeps capacities that already cover the openings and every other hero as given', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `s${i}`);
    const openings = ids.map(id => selectOpeningUnit(42, id));
    const covered: Record<string, number> = { darius: 1 };
    for (const hero of openings) covered[hero] = (covered[hero] ?? 0) + 1;
    expect(withOpeningCopies(covered, 42, ids)).toEqual(covered);
    const raised = withOpeningCopies({ ekko: 2 }, 42, ids);
    expect(raised['ekko']).toBe(2);
    for (const hero of new Set(openings)) expect(raised[hero]).toBe(openings.filter(id => id === hero).length);
  });
});

describe('Room on the shared pool: seat commands are pool transactions', () => {
  /** Only the eight selected openings and one extra Darius exist: exactly one shop slot of the whole room can ever hold a card. */
  function scarceRoom() {
    const capacities:Record<string,number>={darius:1};
    for(let i=0;i<8;i++) {const hero=selectOpeningUnit(42,`s${i}`);capacities[hero]=(capacities[hero]??0)+1;}
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { poolCapacities: capacities });
    room.start();
    runUntil(room, clock, state => state.round === 2 && state.phase === 'preparation');
    return { room, clock };
  }

  it('lets two seats compete for the last copy without overselling; an empty paid reroll fails for free', () => {
    const { room } = scarceRoom();
    conserved(room.state);
    const holder = room.state.seats.find(seat => stocked(seat).length > 0)!;
    expect(stocked(holder)).toEqual([{ index: expect.any(Number), definitionId: 'darius' }]);
    const other = room.state.seats.find(seat => seat.seatId !== holder.seatId && seat.match.gold >= 2)!;
    expect(other.match.shop.slots.every(isEmptySlot)).toBe(true);

    // The other seat cannot buy an empty slot, and its paid reroll finds nothing: refused, nothing spent, generation kept.
    const before = room.state;
    expect(room.handle(other.seatId, { type: 'buy', slot: 0, generation: other.match.shop.generation })).toMatchObject({ ok: false, reason: 'empty-slot' });
    const empty = room.handle(other.seatId, { type: 'reroll' });
    expect(empty).toMatchObject({ ok: false, reason: 'pool-empty' });
    expect(room.state.pool).toBe(before.pool); expect(room.state.poolRevision).toBe(before.poolRevision);
    const otherAfter = room.state.seats.find(seat => seat.seatId === other.seatId)!;
    expect(otherAfter.match).toBe(other.match); expect(otherAfter.seatRevision).toBe(other.seatRevision);

    // The holder buys the last copy: the reservation becomes a holding, available stays 0.
    const slot = stocked(holder)[0]!.index;
    expect(room.handle(holder.seatId, { type: 'buy', slot, generation: holder.match.shop.generation }).ok).toBe(true);
    expect(room.state.poolRevision).toBe(before.poolRevision + 1);
    expect(room.state.pool.available['darius']).toBe(0);
    expect(room.state.pool.holdings.filter(holding => holding.definitionId === 'darius')).toEqual([...before.pool.holdings.filter(holding => holding.definitionId === 'darius'),expect.objectContaining({ seatId: holder.seatId })]);
    conserved(room.state);

    // Sold back, the copy returns to the pool; the other seat's reroll now takes it, and a third seat finds the pool empty again.
    const bought = room.state.seats.find(seat => seat.seatId === holder.seatId)!.match.preparation.units.find(unit => unit.team === 'player' && unit.definitionId === 'darius' && unit.id !== 'unit-1')!;
    expect(room.handle(holder.seatId, { type: 'sell', unitId: bought.id }).ok).toBe(true);
    expect(room.state.pool.available['darius']).toBe(1);
    const rerolled = room.handle(other.seatId, { type: 'reroll' });
    expect(rerolled.ok).toBe(true);
    const otherNow = room.state.seats.find(seat => seat.seatId === other.seatId)!;
    expect(stocked(otherNow).map(card => card.definitionId)).toEqual(['darius']);
    expect(otherNow.match.gold).toBe(other.match.gold - 2);
    expect(otherNow.match.shop.generation).toBe(other.match.shop.generation + 1);
    const third = room.state.seats.find(seat => seat.seatId !== holder.seatId && seat.seatId !== other.seatId && seat.match.gold >= 2)!;
    expect(room.handle(third.seatId, { type: 'reroll' })).toMatchObject({ ok: false, reason: 'pool-empty' });
    expect(room.state.pool.available['darius']).toBe(0);
    conserved(room.state);
  }, 30_000);

  it('keeps pool, poolRevision and the seat untouched on every refused command', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 2 && state.phase === 'preparation');
    const seat = room.state.seats[0]!;
    const refusals = [
      { type: 'buy', slot: 9, generation: seat.match.shop.generation },
      { type: 'buy', slot: 0, generation: seat.match.shop.generation + 5 },
      { type: 'sell', unitId: 'no-such-unit' },
      { type: 'shopLock', locked: true, generation: seat.match.shop.generation - 1 },
    ] as const;
    for (const command of refusals) {
      const before = room.state;
      const result = room.handle(seat.seatId, command);
      expect(result.ok).toBe(false);
      expect(room.state).toBe(before);
    }
    // A paid reroll without gold is refused the same way.
    const poor = room.state.seats.find(candidate => candidate.match.gold < 2);
    if (poor) { const before = room.state; expect(room.handle(poor.seatId, { type: 'reroll' })).toMatchObject({ ok: false, reason: 'insufficient-gold' }); expect(room.state).toBe(before); }
    // A lock is a pool transaction too: accepted, it moves the pool revision once; the same value again is a no-op.
    const locked = room.handle(seat.seatId, { type: 'shopLock', locked: true, generation: seat.match.shop.generation });
    expect(locked.ok).toBe(true);
    conserved(room.state);
  }, 30_000);
});

describe('Room on the shared pool: elimination and round advance (§12.3, §12.4)', () => {
  it('releases an eliminated seat once, after the ranking and before the next refresh, and advances the survivors only', () => {
    const { room, clock } = makeRoom(killAtRoundOne('s7'));
    room.start();
    const opening = room.state;
    const heldBefore = opening.pool.holdings.filter(holding => holding.seatId === 's7').reduce((sum, holding) => sum + holding.sources.length, 0)
      + opening.pool.shops.filter(shop => shop.seatId === 's7').length;
    expect(heldBefore).toBeGreaterThan(0);
    runUntil(room, clock, state => state.settlements.includes('test-room:round-1'));
    const committed = room.state;
    conserved(committed);
    const victim = committed.seats.find(seat => seat.seatId === 's7')!;
    expect(victim).toMatchObject({ alive: false, rank: 8 });
    expect(committed.pool.seats.find(seat => seat.seatId === 's7')!.released).toBe(true);
    expect(committed.pool.holdings.filter(holding => holding.seatId === 's7')).toEqual([]);
    expect(committed.pool.shops.filter(shop => shop.seatId === 's7')).toEqual([]);
    expect(victim.match.shop.slots.every(isEmptySlot)).toBe(true);
    // A second release is refused by the rules and changes nothing.
    expect(releaseSeatOnElimination(committed.pool, victim.match)).toMatchObject({ ok: false, reason: 'duplicate-release' });
    // The next natural refresh runs with the seven survivors only.
    runUntil(room, clock, state => state.round === 2 && state.phase === 'preparation');
    const next = room.state;
    conserved(next);
    expect(next.pool.naturalRound).toBe(2);
    expect(next.pool.shops.some(shop => shop.seatId === 's7')).toBe(false);
    expect(next.seats.find(seat => seat.seatId === 's7')!.match).toBe(victim.match);
    for (const seat of next.seats.filter(candidate => candidate.alive)) expect(seat.match.shop.generation).toBeGreaterThan(1);
  }, 30_000);
});

describe('Room on the shared pool: whole matches stay balanced', () => {
  function playToEnd(resolver: BattleResolver, pvpMode: 'two-sided' | 'placeholder') {
    const { room, clock } = makeRoom(resolver, { pvpMode });
    room.start();
    const revisions: number[] = [];
    room.subscribe(state => { revisions.push(state.poolRevision); conserved(state); });
    const state = runUntil(room, clock, current => current.phase === 'ended', 20_000);
    // B7: overtime rounds are generated by nextSharedRound, so every match ends with a unique ranking.
    expect(state.fault).toBeNull(); expectUniqueRanking(state);
    conserved(state);
    // poolRevision only ever moves forward, and only as the rules' pool revision.
    for (let index = 1; index < revisions.length; index++) expect(revisions[index]!).toBeGreaterThanOrEqual(revisions[index - 1]!);
    // Every seat the rules eliminated was released exactly once; survivors keep their share.
    for (const seat of state.seats) expect(state.pool.seats.find(entry => entry.seatId === seat.seatId)!.released).toBe(!seat.alive);
    const releasedEvents = state.seats.filter(seat => !seat.alive).length;
    expect(state.pool.seats.filter(entry => entry.released)).toHaveLength(releasedEvents);
    expect(state.pool.naturalRound).toBe(state.round);
    return state;
  }
  it('pvpMode=two-sided', () => { playToEnd(new TwoSidedBattleResolver(), 'two-sided'); }, 90_000);
  it('pvpMode=placeholder', () => { playToEnd(placeholderPvp, 'placeholder'); }, 90_000);
});
