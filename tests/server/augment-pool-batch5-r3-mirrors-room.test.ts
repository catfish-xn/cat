import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntil, answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { restoreBattleInput, compileBattle, startTwoSidedCombat } from '../../src/simulation/two-sided-battle';
import { snapshotForBattle } from '../../src/simulation/two-sided-snapshot';
import type { MatchState } from '../../src/simulation/match-types';

const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 0 });
let holder: string;
let before: MatchState;
afterAll(() => room.dispose());
for (const round of ['1-2', '1-3', '1-4', '2-1']) it(`B5-78 room reaches ${round}`, () => {
  if (round === '1-2') room.start();
  expect(runUntil(room, clock, s => s.roundId === round && s.phase === 'preparation').roundId).toBe(round);
});
it('B5-78 selects from the real room offer, buys and deploys two front-row heroes, and authenticates the seat save', () => {
  const seat = room.state.seats.find(s => s.match.pendingChoice?.offers.includes('hall-of-mirrors'))!;
  expect(seat).toBeDefined(); holder = seat.seatId;
  const c = seat.match.pendingChoice!, first = seat.match.preparation.units.find(u => u.team === 'player')!;
  expect(room.handle(holder, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'hall-of-mirrors' })).toMatchObject({ ok: true });
  expect(room.handle(holder, { type: 'deploy', unitId: first.id, target: { kind: 'board', cell: { col: 2, row: 4 } } })).toMatchObject({ ok: true });
  const shop = room.state.seats.find(s => s.seatId === holder)!.match.shop;
  const slot = shop.slots.findIndex(s => s.status === 'available' && s.definitionId !== first.definitionId);
  expect(slot).toBeGreaterThanOrEqual(0);
  expect(room.handle(holder, { type: 'buy', slot, generation: shop.generation })).toMatchObject({ ok: true });
  const second = room.state.seats.find(s => s.seatId === holder)!.match.preparation.units.find(u => u.team === 'player' && u.id !== first.id)!;
  expect(second).toBeDefined();
  expect(room.handle(holder, { type: 'deploy', unitId: second.id, target: { kind: 'board', cell: { col: 4, row: 4 } } })).toMatchObject({ ok: true });
  answerOpenChoices(room); before = room.state.seats.find(s => s.seatId === holder)!.match;
  const other = room.state.seats.find(s => s.seatId !== holder)!;
  const input = compileBattle(snapshotForBattle(before, holder), snapshotForBattle(other.match, other.seatId), 42);
  expect(restoreBattleInput(canonicalContent(input))).toEqual(input);
  const combat = startTwoSidedCombat(input), copies = combat.units.filter(u => u.team === 'player' && u.r3Mirror);
  expect(copies).toHaveLength(2); expect(copies.every(u => u.definitionId === first.definitionId)).toBe(true);
  for (const encode of [(x: unknown) => x, JSON.stringify, canonicalContent]) {
    expect(restoreSharedOrbSnapshot(room.state.pool, encode(before))).toEqual(before);
    const bad = structuredClone(before); Object.assign(bad.augments.find(a => a.definitionId === 'hall-of-mirrors')!, { acquiredRound: 1 });
    expect(() => restoreSharedOrbSnapshot(room.state.pool, encode(bad))).toThrow();
  }
});
it('B5-78 completes the actual two-sided room battle and keeps the original owned heroes after settlement', () => {
  runUntil(room, clock, s => s.roundId === '2-1' && s.phase === 'settlement');
  expect(room.state.fault).toBeNull();
  const result = room.state.battles.find(b => b.kind === 'two-sided' && b.participants.includes(holder));
  expect(result?.kind).toBe('two-sided');
  if (result?.kind !== 'two-sided') throw new Error('missing two-sided room battle');
  const team = result.battle.a.seatId === holder ? 'player' : 'enemy';
  expect(result.battle.initial.units.filter(u => u.team === team && u.r3Mirror)).toHaveLength(2);
  const match = room.state.seats.find(s => s.seatId === holder)!.match;
  expect(match.roundResults.at(-1)?.roundKind).toBe('pvp');
  expect(match.preparation.units.map(u => [u.id,u.definitionId,u.starLevel])).toEqual(before.preparation.units.map(u => [u.id,u.definitionId,u.starLevel]));
  expect(restoreSharedOrbSnapshot(room.state.pool, canonicalContent(match))).toEqual(match);
});
