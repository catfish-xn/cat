import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { toSeatPrivateView } from '../../src/server/room/projection';
import { restoreCarouselSeat } from '../../src/simulation/carousel';
import { PlaceholderBattleResolver, type BattleResolver } from '../../src/server/room/battle-resolver';
import type { BattleInput, BattleResult, RoomState, SeatState } from '../../src/server/room/types';
import { runUntil, claimAllOrbs, TIMINGS } from './helpers';
import { runSharedMatchCommand, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import type { SharedPoolState } from '../../src/simulation/shared-pool-types';
import { resolveRoundEconomy } from '../../src/simulation/round-economy';
import { ROUND_SETTLEMENT_VERSION } from '../../src/simulation/round-settlement';
import { needsOpponentHp } from '../../src/simulation/augment-settlement-gold';
import { choiceTimeoutOption } from '../../src/simulation/seat-mechanics/choices';
import { augmentNeedsHistory } from '../../src/simulation/augment-history-owners';
import { tombRaiderOpportunities, TOMB_RAIDER_SOURCE } from '../../src/simulation/augment-pool-batch5-r1';
import { canonicalContent } from '../../src/simulation/content';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/g2-3-item-registry';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { tombRaiderPlan } from '../fixtures/m5/oracle.g2.cjs';

/** Controlled PvP outcomes still go through the actual shared settlement command and Room rank/release commit.
 * PvE uses the real combat runner; no production observation or reward is seeded. */
class RankedEliminationResolver implements BattleResolver {
  readonly losers = new Set<string>();
  private readonly pve = new PlaceholderBattleResolver();
  resolveBattle(input: BattleInput, pool: SharedPoolState): BattleResult {
    if (input.roundKind !== 'pvp') return this.pve.resolveBattle(input, pool);
    let latest = pool;
    const outcomes = input.seats.map(seat => {
      const state = seat.state, loss = this.losers.has(seat.seatId);
      const plan = resolveRoundEconomy({ augments: state.augments, roundId: state.roundDefinitionId,
        result: loss ? 'enemyWin' : 'playerWin', gold: state.gold, streak: state.streak, level: state.level,
        xp: state.xp, hp: state.playerHp, enemySurvivors: loss ? 1 : 0 });
      const result = runSharedMatchCommand(latest, state, { type: 'settleRound', receipt: {
        version: ROUND_SETTLEMENT_VERSION, settlementId: `controlled:${state.round}:${seat.seatId}`,
        battleId: input.battleId, seatId: seat.seatId, round: state.round, roundId: state.roundDefinitionId,
        settlementEligible: true, result: loss ? 'loss' : 'win', damage: plan.playerDamage, baseDamage: plan.baseDamage,
        opposingSurvivors: loss ? 1 : 0, growth: [], combatTicks: 1, combatEventCount: 1,
        ...(needsOpponentHp(state.augments, state.round) ? { opponentHp: 100 } : {}),
      } });
      if (!result.ok) throw new Error(`${seat.seatId}: ${result.reason}`);
      latest = result.pool;
      return { seatId: seat.seatId, state: result.state, result: loss ? 'enemyWin' as const : 'playerWin' as const,
        damage: plan.playerDamage, combat: null };
    });
    return { kind: 'placeholder', battleId: input.battleId, roomRevision: input.roomRevision, round: input.round, outcomes, pool: latest };
  }
}

describe.each([{ id: 'tomb-raider-1', seed: 1, opportunities: 3, grants: 2 },
  { id: 'tomb-raider-2', seed: 0, opportunities: 4, grants: 3 }])('$id actual Room publication, choice and authority', ({ id, seed, opportunities, grants }) => {
  const clock = new ManualClock(), resolver = new RankedEliminationResolver();
  const room = new Room(Array.from({ length: 8 }, (_, index) => ({ seatId: `s${index}`, name: `玩家${index}`, kind: 'human' as const })),
    { ...ROOM_TIMING_DEFAULTS, ...TIMINGS, seed, roomId: `tomb-room-${id}`, clock, resolver, pvpMode: 'placeholder',
      ...(id === 'tomb-raider-2' ? { carousel: CAROUSEL_RULES_BINDING } : {}) });
  let ownerId = '', victims: readonly SeatState[] = [];
  const mine = () => room.state.seats.find(s => s.seatId === ownerId)!;
  beforeAll(() => room.start());
  afterAll(() => room.dispose());
  function answer() {
    for (const seat of room.state.seats) for (let n = 0; n < 16; n++) {
      const c = room.state.seats.find(s => s.seatId === seat.seatId)!.match.pendingChoice;
      if (!c) break;
      const option = c.kind === 'augment'
        ? c.offers.find(id => !augmentNeedsHistory(id) && !['dummify', 'golemify'].includes(id)) ?? c.offers[0]
        : choiceTimeoutOption(c)!;
      expect(room.handle(seat.seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: option })).toMatchObject({ ok: true });
    }
  }
  function reach(round: string) {
    for (let fired = 0; fired < 5000; fired++) {
      claimAllOrbs(room);
      if (room.state.roundId === round && ['preparation', 'choice', 'carousel'].includes(room.state.phase)) return;
      if (room.state.fault || room.state.phase === 'ended') break;
      if (room.state.phase === 'preparation') answer();
      if (!clock.runNext()) break;
    }
    throw new Error(`did not reach ${round}: ${room.state.roundId}/${room.state.phase}, ${JSON.stringify(room.state.fault)}`);
  }
  // Split real combat legs so each test retains Vitest's unchanged deadline.
  for (const round of ['1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7',
    '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '4-1', '4-2']) it(`reaches ${round} through the room`, () => {
    reach(round); expect(room.state.fault).toBeNull();
  });

  it('selects the augment from an actual room offer', () => {
    for (const seat of room.state.seats) {
      if (room.state.seats.some(s => s.match.pendingChoice?.offers.includes(id))) break;
      for (let slot = 0; slot < 3; slot++) {
        const c = room.state.seats.find(s => s.seatId === seat.seatId)!.match.pendingChoice!;
        expect(room.handle(seat.seatId, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot })).toMatchObject({ ok: true });
        if (room.state.seats.some(s => s.match.pendingChoice?.offers.includes(id))) break;
      }
    }
    const owner = room.state.seats.find(s => s.match.pendingChoice?.offers.includes(id));
    expect(owner, JSON.stringify(room.state.seats.map(s => ({ seat: s.seatId, choice: s.match.pendingChoice })))).toBeDefined();
    if (!owner) throw new Error(`no ${id} room offer`); ownerId = owner.seatId;
    const c = owner.match.pendingChoice!;
    expect(room.handle(ownerId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: id })).toMatchObject({ ok: true });
    answer();
    victims = room.state.seats.filter(s => s.seatId !== ownerId).sort((a, b) => b.index - a.index).slice(0, 4);
    expect(mine().match.augmentHistory?.facts.some(f => f.kind === 'table' && f.stage === 'acquire' && f.seats.length === 8)).toBe(true);
  });

  it('equips real completed items through room commands and commits four simultaneous eliminations', () => {
    for (const victim of victims.slice(1)) {
      const seat = () => room.state.seats.find(s => s.seatId === victim.seatId)!;
      let items = seat().match.items.filter(i => i.location.kind === 'inventory');
      const components = items.filter(i => ['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear'].includes(i.definitionId));
      const previousIds = new Set(seat().match.items.map(i => i.id));
      expect(components.length).toBeGreaterThanOrEqual(2);
      expect(room.handle(victim.seatId, { type: 'combine', a: components[0].id, b: components[1].id })).toMatchObject({ ok: true });
      items = seat().match.items.filter(i => !previousIds.has(i.id) && i.location.kind === 'inventory' && ITEM_DEFINITIONS[i.definitionId].kind === 'completed');
      expect(items.length).toBeGreaterThan(0);
      const unit = seat().match.preparation.units.find(u => u.team === 'player' && !UNIT_DEFINITIONS[u.definitionId].summon
        && UNIT_DEFINITIONS[u.definitionId].unitKind !== 'neutral')!;
      expect(room.handle(victim.seatId, { type: 'equip', itemId: items[0].id, unitId: unit.id, slot: 0 })).toMatchObject({ ok: true });
    }
    // Test-only lethal starting HP; equipment, augment, settlement and rank/release are real commands/Room code.
    const holder = room as unknown as { current: RoomState };
    holder.current = { ...holder.current, seats: holder.current.seats.map(s => victims.some(v => v.seatId === s.seatId)
      ? { ...s, hp: 1, match: { ...s.match, playerHp: 1 }, seatRevision: s.seatRevision + 1 } : s) };
    for (const victim of victims) resolver.losers.add(victim.seatId);
    runUntil(room, clock, s => s.roundId === '4-2' && s.phase === 'choice'
      && mine().match.pendingChoice?.payload?.source === TOMB_RAIDER_SOURCE);
    expect(room.state.fault).toBeNull();
    const owner = mine().match, choiceId = owner.augments.find(a => a.definitionId === id)!.choiceId;
    const plan = tombRaiderOpportunities(owner, choiceId);
    expect(plan.map(p => p.seatId)).toEqual(victims.slice(0, opportunities).map(s => s.seatId));
    expect(plan[0].candidates).toEqual([]); expect(plan[1].candidates.length).toBeGreaterThan(0);
    expect(plan[2].candidates.length).toBeGreaterThan(0);
    expect(owner.pendingChoice?.offers).toEqual(plan[1].candidates.map(c => c.definitionId));
    expect(toSeatPrivateView(owner).pendingChoice?.offers).toEqual(owner.pendingChoice?.offers);
    expect(tombRaiderPlan(owner).map((p: { seatId: string }) => p.seatId)).toEqual(plan.map(p => p.seatId));
    for (const victim of victims) expect(room.state.pool.seats.find(s => s.seatId === victim.seatId)?.released).toBe(true);
    const frozen = owner.augmentHistory!.facts.find(f => f.kind === 'table' && f.stage === 'settlement' && f.round === owner.round)!;
    expect(frozen.kind).toBe('table');
    if (frozen.kind === 'table') expect(frozen.seats.find(s => s.seatId === victims[1].seatId)?.items.some(i => i.location.kind === 'unit')).toBe(true);
  });

  it('authenticates the open room choice and rejects history or candidate tampering', () => {
    const state = mine().match, authority = room.augmentHistoryAuthority(ownerId);
    for (const form of ['object', 'json', 'canonical']) {
      expect(restoreSharedOrbSnapshot(room.state.pool, form === 'object' ? state : form === 'json' ? JSON.stringify(state) : canonicalContent(state), authority)).toEqual(state);
      for (const edit of [
        (s: any) => { s.pendingChoice.offers.push('TFT4_Item_OrnnInfinityForce'); },
        (s: any) => { s.augmentHistory.facts.find((f: any) => f.kind === 'table' && f.stage === 'settlement').seats.find((s: any) => s.seatId === victims[1].seatId).items = []; },
        (s: any) => { delete s.augmentHistory; },
      ]) {
        const bad = structuredClone(state); edit(bad);
        expect(() => restoreSharedOrbSnapshot(room.state.pool, form === 'object' ? bad : form === 'json' ? JSON.stringify(bad) : canonicalContent(bad), authority)).toThrow();
      }
    }
  });

  it('chooses every nonempty opportunity through Room and grants each exactly once', () => {
    const serial = mine().match.nextItemSerial, first = mine().match.pendingChoice!;
    expect(room.handle(ownerId, { type: 'choose', choiceId: first.choiceId, generation: first.generation, definitionId: first.offers[0] })).toMatchObject({ ok: true });
    const second = mine().match.pendingChoice!; expect(second.choiceId).not.toBe(first.choiceId);
    expect(room.handle(ownerId, { type: 'choose', choiceId: first.choiceId, generation: first.generation, definitionId: first.offers[0] })).toMatchObject({ ok: false, reason: 'stale-choice' });
    expect(room.handle(ownerId, { type: 'choose', choiceId: second.choiceId, generation: second.generation, definitionId: second.offers[0] })).toMatchObject({ ok: true });
    if (id === 'tomb-raider-2') {
      const third = mine().match.pendingChoice!; expect(third).toBeDefined();
      expect(room.handle(ownerId, { type: 'choose', choiceId: third.choiceId, generation: third.generation, definitionId: third.offers[0] })).toMatchObject({ ok: true });
    }
    expect(mine().match.nextItemSerial).toBe(serial + grants);
    expect(mine().match.seatMechanics?.receipts.filter(r => r.source === TOMB_RAIDER_SOURCE)).toHaveLength(grants);
    expect(mine().match.pendingChoice).toBeNull();
    const authority = room.augmentHistoryAuthority(ownerId);
    expect(restoreSharedOrbSnapshot(room.state.pool, canonicalContent(mine().match), authority)).toEqual(mine().match);
  });

  if (id === 'tomb-raider-2') it('round trips its earned items and history through the real shared-carousel restore boundary', () => {
    reach('4-3'); reach('4-4');
    expect(room.state.phase).toBe('carousel');
    const carousel = room.state.carousel!.state, state = mine().match, authority = room.augmentHistoryAuthority(ownerId);
    for (const input of [state, JSON.stringify(state), canonicalContent(state)]) expect(restoreCarouselSeat(carousel, input, authority)).toEqual(state);
    const bad: any = structuredClone(state);
    bad.seatMechanics.receipts.find((r: any) => r.source === TOMB_RAIDER_SOURCE).optionId = 'TFT4_Item_OrnnInfinityForce';
    for (const input of [bad, JSON.stringify(bad), canonicalContent(bad)]) expect(() => restoreCarouselSeat(carousel, input, authority)).toThrow();
    expect(room.state.fault).toBeNull();
  });
});
