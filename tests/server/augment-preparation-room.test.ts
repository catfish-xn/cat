import { afterEach, describe, expect, it } from 'vitest';
import { AUGMENT_PREPARATION_MS, type Room } from '../../src/server/room/room';
import { toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import type { RoomState } from '../../src/server/room/types';
import { makeRoom, runUntil, runUntilClaiming, TIMINGS } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { ManualClock } from '../../src/server/room/clock';

const rooms: Room[] = [];
afterEach(() => { for (const room of rooms.splice(0)) room.dispose(); });
const seat = (state: RoomState, seatId: string) => state.seats.find(s => s.seatId === seatId)!;

/** Records every room phase published per round. */
function track(room: Room) {
  const phases: string[] = [];
  room.subscribe(state => { const key = `${state.roundId}:${state.phase}`; if (phases.at(-1) !== key) phases.push(key); });
  return phases;
}
function toAugmentRound(roundId: string): { room: Room; clock: ManualClock; phases: string[] } {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  rooms.push(room);
  const phases = track(room);
  room.start();
  runUntilClaiming(room, clock, state => state.roundId === roundId && state.phase === 'preparation');
  return { room, clock, phases };
}

describe('v22: the augment choice opens inside a 50 s preparation (2-1, 3-2, 4-2)', () => {
  it('2-1 has no choice phase; preparation lasts AUGMENT_PREPARATION_MS while every seat holds its open augment choice', { timeout: 300_000 }, () => {
    const { room, clock, phases } = toAugmentRound('2-1');
    expect(AUGMENT_PREPARATION_MS).toBe(50_000);
    expect(room.state.deadlineAt! - clock.now()).toBe(50_000);
    // The round id switches at the settlement of 1-4; 2-1 itself never opens a choice phase.
    expect(phases.filter(p => p.startsWith('2-1:') && p !== '2-1:settlement')).toEqual(['2-1:preparation']);
    for (const s of room.state.seats.filter(s => s.alive)) {
      expect(s.match.phase).toBe('choice');
      expect(s.match.pendingChoice).toMatchObject({ kind: 'augment', choiceId: 'round:2-1:augment', returnPhase: 'preparation' });
    }
    // Online view: preparation with its deadline, and the open choice in the seat's private view.
    const view = toPlayerView(room.state, 's0', clock.now());
    expect(view.phase).toMatchObject({ kind: 'preparation', endsAt: room.state.deadlineAt });
    expect(toSeatPrivateView(seat(room.state, 's0').match).pendingChoice).toMatchObject({ choiceId: 'round:2-1:augment' });
  });

  it('shop, board moves and card rerolls are accepted while choosing; an unanswered choice times out to its first option at the deadline', { timeout: 300_000 }, () => {
    const { room, clock } = toAugmentRound('2-1');
    let s0 = seat(room.state, 's0').match;
    const slot = s0.shop.slots.findIndex(entry => entry.status === 'available');
    expect(room.handle('s0', { type: 'buy', slot, generation: s0.shop.generation })).toMatchObject({ ok: true });
    s0 = seat(room.state, 's0').match;
    const bench = s0.preparation.units.find(u => u.team === 'player' && u.location.kind === 'bench')!;
    expect(room.handle('s0', { type: 'deploy', unitId: bench.id, target: { kind: 'board', cell: { col: 2, row: 4 } } })).toMatchObject({ ok: true });
    expect(room.handle('s0', { type: 'reroll' })).toMatchObject({ ok: true });
    let c = seat(room.state, 's0').match.pendingChoice!;
    expect(room.handle('s0', { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: 2 })).toMatchObject({ ok: true });
    s0 = seat(room.state, 's0').match;
    expect(s0.phase).toBe('choice');
    // One block list per draw; their content depends on which one-per-match cards other seats were shown (pool-dependent).
    expect(s0.augmentOffers.at(-1)).toMatchObject({ rerolledIndices: [2] });
    expect(s0.augmentOffers.at(-1)!.externalBlocks).toHaveLength(2);
    c = s0.pendingChoice!;
    expect(room.handle('s0', { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: c.offers[1] })).toMatchObject({ ok: true });
    expect(room.state.phase).toBe('preparation');
    expect(seat(room.state, 's0').match.augments.map(a => a.definitionId)).toContain(c.offers[1]);
    const s1First = seat(room.state, 's1').match.pendingChoice!.offers[0];
    const deadline = room.state.deadlineAt!;
    runUntil(room, clock, state => state.phase !== 'preparation');
    expect(clock.now()).toBe(deadline);
    const s1 = seat(room.state, 's1').match;
    expect(s1.augments.find(a => a.choiceId === 'round:2-1:augment')!.definitionId).toBe(s1First);
    expect(s1.pendingChoice).toBeNull();
    expect(room.state.fault).toBeNull();
    for (const s of room.state.seats.filter(s => s.alive)) expect(restoreSharedOrbSnapshot(room.state.pool, JSON.stringify(s.match), room.augmentHistoryAuthority(s.seatId))).toEqual(s.match);
  });

  it('other rounds keep their own preparation time, and 3-2 merges the same way', { timeout: 600_000 }, () => {
    const { room, clock, phases } = toAugmentRound('2-1');
    runUntilClaiming(room, clock, state => state.roundId === '2-2' && state.phase === 'preparation');
    expect(room.state.deadlineAt! - clock.now()).toBe(TIMINGS.preparationMs);
    runUntilClaiming(room, clock, state => state.roundId === '3-2' && state.phase === 'preparation', 5_000);
    expect(room.state.deadlineAt! - clock.now()).toBe(AUGMENT_PREPARATION_MS);
    expect(phases.some(p => /^(2-1|3-2):choice$/.test(p))).toBe(false);
    for (const s of room.state.seats.filter(s => s.alive)) expect(s.match.pendingChoice).toMatchObject({ kind: 'augment', choiceId: 'round:3-2:augment' });
  });
});
