import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntil, answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { snapshotForBattle } from '../../src/simulation/two-sided-snapshot';
import { compileBattle, startTwoSidedCombat } from '../../src/simulation/two-sided-battle';

const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 9 });
let holder: string;
afterAll(() => room.dispose());
for (const round of ['1-2', '1-3', '1-4', '2-1']) it(`B5-74 room reaches ${round}`, () => {
  if (round === '1-2') room.start();
  expect(runUntil(room, clock, s => s.roundId === round && s.phase === 'preparation').roundId).toBe(round);
});
it('B5-74 reaches a real eight-seat offer, selects and deploys with public room commands', () => {
  runUntil(room, clock, s => s.roundId === '2-1' && s.phase === 'preparation');
  for (const seat of room.state.seats) for (let slot = 0; slot < 3 && !room.state.seats.some(s => s.match.pendingChoice?.offers.includes('cloning-facility')); slot++) {
    const c = room.state.seats.find(s => s.seatId === seat.seatId)!.match.pendingChoice!;
    expect(room.handle(seat.seatId, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot })).toMatchObject({ ok: true });
  }
  const seat = room.state.seats.find(s => s.match.pendingChoice?.offers.includes('cloning-facility'))!;
  expect(seat).toBeDefined(); holder = seat.seatId;
  const c = seat.match.pendingChoice!, unit = seat.match.preparation.units.find(u => u.team === 'player')!;
  expect(room.handle(holder, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'cloning-facility' })).toMatchObject({ ok: true });
  expect(room.handle(holder, { type: 'deploy', unitId: unit.id, target: { kind: 'board', cell: { col: 3, row: 6 } } })).toMatchObject({ ok: true });
  answerOpenChoices(room);
  const match = room.state.seats.find(s => s.seatId === holder)!.match;
  const other = room.state.seats.find(s => s.seatId !== holder)!;
  const combat = startTwoSidedCombat(compileBattle(snapshotForBattle(match, holder), snapshotForBattle(other.match, other.seatId), 42));
  expect(combat.units.filter(u => u.itemSummon?.kind === 'cloning-facility')).toHaveLength(1);
  for (const encode of [(x: unknown) => x, JSON.stringify, canonicalContent]) {
    expect(restoreSharedOrbSnapshot(room.state.pool, encode(match))).toEqual(match);
    const bad = structuredClone(match); Object.assign(bad.augments.find(a => a.definitionId === 'cloning-facility')!, { choiceId: 'forged' });
    expect(() => restoreSharedOrbSnapshot(room.state.pool, encode(bad))).toThrow();
  }
});
it('B5-74 resolves through the actual room resolver and settles without persisting combat copies', () => {
  const before = room.state.seats.find(s => s.seatId === holder)!.match;
  runUntil(room, clock, s => s.roundId === '2-1' && s.phase === 'settlement');
  expect(room.state.fault).toBeNull();
  const match = room.state.seats.find(s => s.seatId === holder)!.match;
  expect(match.roundResults.at(-1)?.roundKind).toBe('pvp');
  expect(match.preparation.units.map(u => u.id).sort()).toEqual(before.preparation.units.map(u => u.id).sort());
  expect(match.preparation.units.some(u => u.id.includes('b5-r3'))).toBe(false);
  expect(restoreSharedOrbSnapshot(room.state.pool, canonicalContent(match))).toEqual(match);
});
