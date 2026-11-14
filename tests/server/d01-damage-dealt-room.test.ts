import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as serverEntry from '../../src/server-entry';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleResolver } from '../../src/server/room/battle-resolver';
import type { RoomState, TwoSidedBattleResult } from '../../src/server/room/types';
import { whatYouReallyAreProgress } from '../../src/simulation/augment-d1';
import { drainBatch1Gifts } from '../../src/simulation/augment-pool-grants';
import { readG23Progress, writeG23Progress } from '../../src/simulation/g2-3-state';
import { makeRoom, runUntil } from './helpers';

afterEach(() => vi.restoreAllMocks());

describe('D0 room bilateral authority', () => {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  const holder = room as unknown as { current: RoomState };
  let baseline: RoomState;
  beforeAll(() => {
    room.start();
    runUntil(room, clock, s => s.round === 4 && s.phase === 'battle');
    baseline = { ...room.state, seats: room.state.seats.map(seat => ({ ...seat, hp: 2, seatRevision: seat.seatRevision + 1,
      match: writeG23Progress({ ...seat.match, playerHp: 2 }, {
        ...readG23Progress(seat.match)!, mel: { pvpCasts: 12, savedBattleId: null },
      }),
    })) };
    holder.current = baseline;
  });
  afterEach(() => { holder.current = baseline; });
  afterAll(() => room.dispose());

  it.each([11, 12])('records opponent actual HP loss after overkill/Mel (casts=%i)', casts => {
    holder.current = { ...baseline, seats: baseline.seats.map(seat => ({ ...seat,
      match: writeG23Progress(seat.match, { ...readG23Progress(seat.match)!, mel: { pvpCasts: casts, savedBattleId: null } }),
    })) };
    const before = room.state;
    const battles = before.battles as readonly TwoSidedBattleResult[];
    const plan = room.planSettlement(battles);
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw Error(plan.detail);
    let clipped = 0;
    for (const battle of battles) for (const [own, opposite] of [[battle.proposals.a, battle.proposals.b], [battle.proposals.b, battle.proposals.a]]) {
      const seat = plan.settlement.seats.find(s => s.seatId === own.seatId)!;
      const opponent = plan.settlement.seats.find(s => s.seatId === opposite.seatId)!;
      const loss = opponent.match.roundResults.at(-1)!.hpLost;
      expect(seat.receipt!.damageDealt).toBe(loss);
      expect(seat.match.multiplayer!.receipts.at(-1)!.damageDealt).toBe(loss);
      expect(seat.match.roundResults.at(-1)!.damageDealt).toBe(loss);
      if (opposite.damage > 2) {
        expect(loss).toBe(casts === 12 ? 1 : 2);
        expect(seat.receipt!.damageDealt).not.toBe(opposite.damage);
        clipped++;
      }
    }
    expect(clipped).toBeGreaterThan(0);
    expect(room.state).toBe(before);
    const reversed = room.planSettlement([...battles].reverse());
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) throw Error(reversed.detail);
    // Resolver results retain arrival order; committed seats/pool/ranking must not depend on it.
    expect(reversed.settlement.seats).toEqual(plan.settlement.seats);
    expect(reversed.settlement.pool).toEqual(plan.settlement.pool);
    expect(reversed.settlement.eliminated).toEqual(plan.settlement.eliminated);
  });

  it.each(['round-result', 'receipt', 'both'] as const)('rejects altered %s even when incoming HP remains consistent', variant => {
    const before = room.state, run = serverEntry.runSharedMatchCommand;
    const target = (before.battles[0] as TwoSidedBattleResult).participants[0]!;
    vi.spyOn(serverEntry, 'runSharedMatchCommand').mockImplementation((pool, state, command) => {
      const applied = run(pool, state, command);
      if (!applied.ok || command.type !== 'settleRound' || command.receipt.seatId !== target) return applied;
      return { ...applied, state: { ...applied.state,
        roundResults: variant === 'receipt' ? applied.state.roundResults : applied.state.roundResults.map(r => r.round === state.round ? { ...r, damageDealt: 99 } : r),
        multiplayer: { ...applied.state.multiplayer!, receipts: variant === 'round-result' ? applied.state.multiplayer!.receipts
          : applied.state.multiplayer!.receipts.map(r => r.round === state.round ? { ...r, damageDealt: 99 } : r) },
      } };
    });
    expect(room.planSettlement(before.battles)).toEqual({ ok: false, detail: `seat ${target}: damageDealt disagrees with opponent hpLost` });
    expect(room.state).toBe(before);
    expect(room.state.pool).toBe(before.pool);
  });

  it('records zero against a mirror and keeps the source seat own pairing independent', () => {
    const inner = new TwoSidedBattleResolver();
    const resolver: BattleResolver = { resolveBattle(input, pool) {
      if (input.round === 1 && input.seats[0]!.seatId === 's7') {
        const state = input.seats[0]!.state;
        return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision,
          outcomes: [{ seatId: 's7', state: { ...state, playerHp: 0, multiplayer: { ...state.multiplayer!, status: 'eliminated' } }, result: null, damage: 100, combat: null }] };
      }
      return inner.resolveBattle(input, pool);
    } };
    const { room, clock } = makeRoom(resolver);
    try {
      room.start();
      runUntil(room, clock, s => s.round === 4 && s.phase === 'settlement');
      expect(room.state.fault).toBeNull();
      const battles = room.state.battles as readonly TwoSidedBattleResult[];
      const mirror = battles.find(b => b.battle.mirrorOfSeatId !== null)!;
      expect(mirror).toBeDefined();
      const real = room.state.seats.find(s => s.seatId === mirror.participants[0])!;
      expect(real.match.roundResults.at(-1)!.damageDealt).toBe(0);
      expect(real.match.multiplayer!.receipts.at(-1)!.damageDealt).toBe(0);
      const source = room.state.seats.find(s => s.seatId === mirror.battle.mirrorOfSeatId)!;
      expect(source.match.multiplayer!.receipts).toHaveLength(1);
      const ownBattle = battles.find(b => b.participants.includes(source.seatId))!;
      const ownOpponent = room.state.seats.find(s => s.seatId === ownBattle.participants.find(id => id !== source.seatId))!;
      expect(source.match.roundResults.at(-1)!.damageDealt).toBe(ownOpponent.match.roundResults.at(-1)!.hpLost);
    } finally { room.dispose(); }
  }, 30_000);
});

it('D1 room settlement awards the remaining point once and claims Warwick through the shared pool', () => {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  try {
    room.start();
    runUntil(room, clock, s => s.round === 5 && s.phase === 'battle');
    const battle = (room.state.battles as readonly TwoSidedBattleResult[]).find(b => b.proposals.b.damage > 0 || b.proposals.a.damage > 0)!;
    const target = battle.proposals.b.damage > 0 ? battle.proposals.a.seatId : battle.proposals.b.seatId;
    const holder = room as unknown as { current: RoomState };
    // D1 is deliberately unavailable in offers. Seed only its owned effect and prior 34-point authority;
    // this real battle, settlement, reward orb and pool claim use production public commands.
    holder.current = { ...holder.current, seats: holder.current.seats.map(s => s.seatId !== target ? s : { ...s,
      seatRevision: s.seatRevision + 1,
      match: drainBatch1Gifts({ ...s.match, augments: [{ definitionId: 'what-you-really-are', choiceId: 'd1-room-fixture', acquiredRound: 4 }],
        roundResults: s.match.roundResults.map(r => r.round === 4 ? { ...r, damageDealt: 34 } : r),
        multiplayer: { ...s.match.multiplayer!, receipts: s.match.multiplayer!.receipts.map(r => ({ ...r, damageDealt: 34 })) } }),
    }) };
    const plan = room.planSettlement(room.state.battles);
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw Error(plan.detail);
    const staged = plan.settlement.seats.find(s => s.seatId === target)!;
    expect(whatYouReallyAreProgress(staged.match)).toEqual({ count: 35, completedRound: 5 });
    const granted = staged.match.seatMechanics!.receipts.filter(r => r.receiptId.includes('what-you-really-are'));
    expect(granted).toHaveLength(3);
    const grantEvents = staged.events.filter(e => e.type === 'mechanicGranted' && e.receipt.receiptId.includes('what-you-really-are'));
    expect(grantEvents).toHaveLength(2); // Acquisition was already committed; only Warwick and Sterak are new.
    expect(new Set(grantEvents.map(e => e.type === 'mechanicGranted' ? e.receipt.receiptId : '')).size).toBe(2);
    expect(room.commitSettlement(plan.settlement).ok).toBe(true);
    expect(room.commitSettlement(plan.settlement)).toMatchObject({ ok: false, reason: 'duplicate-settlement' });
    runUntil(room, clock, s => s.round === 6 && s.phase === 'preparation');
    const current = () => room.state.seats.find(s => s.seatId === target)!.match;
    const unitReceipt = current().seatMechanics!.receipts.find(r => r.kind === 'unit' && r.definitionId === 'warwick')!;
    if (unitReceipt.kind !== 'unit' || unitReceipt.resolution !== 'orb') throw Error('Warwick was not queued');
    expect(room.handle(target, { type: 'claimOrb', round: 6, orbId: unitReceipt.orbId! })).toMatchObject({ ok: true });
    expect(current().preparation.units.some(u => u.definitionId === 'warwick')).toBe(true);
    serverEntry.assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
    expect(current().seatMechanics!.receipts.filter(r => r.receiptId.includes('what-you-really-are'))).toEqual(granted);
  } finally { room.dispose(); }
}, 30_000);
