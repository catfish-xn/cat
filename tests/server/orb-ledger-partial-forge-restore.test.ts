import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import type { MatchState } from '../../src/simulation/match-types';
import { getMultiplayerRoundById } from '../../src/simulation/multiplayer-round';

/**
 * Regression (v26 batch-4 CI): validateMultiplayerOrbLedger's "partial anvil orb status" check accepted only
 * granted+revealed(forge). A real room also leaves a claimed component orb's forge 'carried' after a PvE loss parked it
 * (8f794062) and the claim could not place the forge's unit, and elimination's forfeitUnclaimedOrbs later turns that waiting forge
 * 'forfeited' beside the granted item. Both room checkpoints were rejected on restore.
 * Seed 9, seat s2: loses 4-7, claims the parked 4-7 item+forge orb at 5-7 (forge left waiting), is still in at 6-1's
 * preparation with that forge waiting, and is the last seat out in 6-1 (the room ends there).
 * Wind-up batch 2 (2026-11-16, scene change approved by Fable): seed 2's s2 no longer parks that orb. Searched seeds 0..135 for a
 * seat with the 5-7 orb [granted, carried]: 23 seats; most stay in past 6-2 or the room ends first; seed 9 s2 is the first
 * eliminated with the forge still waiting (in 6-1). The elimination check moves from 6-1's preparation to the room's end.
 * Cast wind-up batch 4 (2026-11-17, scene change; premises and assertions unchanged): Powder's new release timing changes the
 * route, so seed 9's s2 is out before 6-1. Searched seeds 0..47 (non-streamed rooms, every seat): seed 10 s3 is the first seat
 * whose 5-7 orb is [granted, carried], still in at 6-1's preparation with that forge waiting (the only mixed orb), and the last
 * seat out in 6-1 (the room ends there).
 * #739 (ranged basic attacks settle when the shot lands; scene change approved by Fable, premises and assertions unchanged):
 * seed 10's s3 no longer gets the [granted, carried] 4-7 orb. Searched seeds 0..199 (non-streamed rooms, every seat) with the
 * same premises: seed 75 s0 is the first, still in at 6-1's preparation with that forge waiting (the only mixed orb), and
 * the last seat out in 6-1 (the room ends there).
 */
const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 75, combatStreaming: true });
const seatId = 's0', mine = () => room.state.seats.find(s => s.seatId === seatId)!.match;
afterAll(() => room.dispose());
const mixedOrbs = (state: MatchState) => state.m8.loot.frozen.rounds.flatMap(r => r.orbs).map(orb => ({ orb,
  statuses: orb.entries.map(e => state.m8.loot.direct.find(d => d.dropId === e.dropId)?.status) })).filter(o => new Set(o.statuses).size > 1);
const roundTrips = (state: MatchState) => {
  const authority = room.augmentHistoryAuthority(seatId);
  for (const input of [state, JSON.stringify(state)]) expect(restoreSharedOrbSnapshot(room.state.pool, input, authority)).toEqual(state);
  // The relaxed shape is still forge-only: a waiting non-forge entry beside granted ones is rejected.
  const bad = structuredClone(state) as any, { orb } = mixedOrbs(state)[0];
  const item = orb.entries.find(e => e.payload.kind !== 'forge')!;
  Object.assign(bad.m8.loot.direct.find((d: any) => d.dropId === item.dropId), { status: 'revealed', receiptId: null });
  bad.m8.loot.receipts = bad.m8.loot.receipts.filter((r: any) => r.dropId !== item.dropId);
  for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreSharedOrbSnapshot(room.state.pool, input, authority)).toThrow();
};
it('starts the room', () => { room.start(); });
// Streamed combat advances one tick per timer, so each step replays a bounded slice of every seat's battle.
const reach = (roundId: string, phase: 'preparation' | 'settlement', tick = Infinity) => {
  const ordinal = getMultiplayerRoundById(roundId).ordinal;
  runUntilClaiming(room, clock, s => s.round > ordinal || s.round === ordinal && (s.phase === phase
    || phase === 'settlement' && s.phase === 'battle' && room.committedBattleTick >= tick), 5000);
};
const SLICES = [1, 150, 300, 450, 600, 900];
const ROUNDS = ['1-3','1-4','2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2','3-3','3-4','3-5','3-6','3-7',
  '4-1','4-2','4-3','4-4','4-5','4-6','4-7','5-1','5-2','5-3','5-4','5-5','5-6','5-7'];
for (const roundId of ROUNDS) {
  if (!roundId.endsWith('-4')) it(`reaches ${roundId} preparation`, () => reach(roundId, 'preparation'));
  if (roundId === '5-7') break;
  for (const tick of SLICES) it(`streams ${roundId} through tick ${tick}`, () => reach(roundId, 'settlement', tick));
  it(`settles ${roundId}`, () => reach(roundId, 'settlement'));
}
it('restores the claimed 4-7 orb whose forge stays carried beside the granted item', () => {
  const state = mine(), mixed = mixedOrbs(state);
  expect(state.m8.loot.carry?.some(row => row.deliverRoundId === '5-7')).toBe(true);
  expect(mixed.map(o => [o.orb.roundId, o.orb.entries.map(e => e.payload.kind), o.statuses]))
    .toEqual([['4-7', ['item', 'forge'], ['granted', 'carried']]]);
  roundTrips(state);
});
for (const tick of SLICES) it(`streams 5-7 through tick ${tick}`, () => reach('5-7', 'settlement', tick));
it('settles 5-7', () => reach('5-7', 'settlement'));
it('reaches 6-1', () => reach('6-1', 'preparation'));
it('premise: before the elimination the seat is still in and the same 4-7 forge still waits, carried', () => {
  expect(room.state.seats.find(s => s.seatId === seatId)!.alive, 'premise: alive before the elimination').toBe(true);
  const state = mine();
  expect(mixedOrbs(state).map(o => [o.orb.roundId, o.orb.entries.map(e => e.payload.kind), o.statuses]), 'premise: forge waiting')
    .toEqual([['4-7', ['item', 'forge'], ['granted', 'carried']]]);
  expect(state.m8.loot.carry?.some(row => row.deliverRoundId === '5-7'), 'premise: the carried row').toBe(true);
});
for (const tick of [1, 150, 300]) it(`streams 6-1 through tick ${tick}`, () => reach('6-1', 'settlement', tick));
// The seat is the last one out in 6-1, so the room ends there instead of reaching 6-2.
it('plays 6-1 to the end of the room', () => {
  runUntilClaiming(room, clock, s => s.phase === 'ended', 5000);
  expect(room.state.phase).toBe('ended');
  expect(room.state.roundId).toBe('6-1');
});
it('restores the same orb after elimination forfeits the waiting forge', () => {
  expect(room.state.seats.find(s => s.seatId === seatId)!.alive).toBe(false);
  const state = mine(), mixed = mixedOrbs(state);
  expect(mixed.map(o => [o.orb.roundId, o.orb.entries.map(e => e.payload.kind), o.statuses]))
    .toEqual([['4-7', ['item', 'forge'], ['granted', 'forfeited']]]);
  roundTrips(state);
});
