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
 * Seed 2, seat s2: loses 4-7, claims the parked 4-7 item+forge orb at 5-7 (forge left waiting), and is out by 6-1.
 */
const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 2, combatStreaming: true });
const seatId = 's2', mine = () => room.state.seats.find(s => s.seatId === seatId)!.match;
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
it('restores the same orb after elimination forfeits the waiting forge', () => {
  expect(room.state.seats.find(s => s.seatId === seatId)!.alive).toBe(false);
  const state = mine(), mixed = mixedOrbs(state);
  expect(mixed.map(o => [o.orb.roundId, o.orb.entries.map(e => e.payload.kind), o.statuses]))
    .toEqual([['4-7', ['item', 'forge'], ['granted', 'forfeited']]]);
  roundTrips(state);
});
