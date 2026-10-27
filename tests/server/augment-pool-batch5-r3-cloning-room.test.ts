import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntil, answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { snapshotForBattle } from '../../src/simulation/two-sided-snapshot';
import { compileBattle, startTwoSidedCombat } from '../../src/simulation/two-sided-battle';
import { stepCombat } from '../../src/simulation/combat';
import { buildStrategySnapshot } from '../../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../../src/simulation/combat';
import type { CombatState } from '../../src/simulation/combat-types';
import type { MatchState } from '../../src/simulation/match-types';

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
for (const round of ['2-2', '2-3', '2-4', '2-5', '2-6', '2-7']) it(`B5-74 room reaches ${round}`, () => {
  expect(runUntil(room, clock, s => s.roundId === round && s.phase === (round === '2-4' ? 'settlement' : 'preparation')).roundId).toBe(round);
});
it('authenticates the real eight-seat 2-7 PvE combat from its opening input in all three save forms', () => {
  runUntil(room, clock, s => s.roundId === '2-7' && s.phase === 'battle');
  const match = room.state.seats.find(s => s.seatId === holder)!.match;
  expect(room.state.seats).toHaveLength(8);
  expect(match.combatInputBasis).not.toBeNull();
  expect(match.combat!.units.filter(u => u.itemSummon?.kind === 'cloning-facility')).toHaveLength(1);
  let progressed: CombatState = match.combat!;
  for (let tick = 0; tick < 10 && progressed.status === 'running'; tick++) progressed = stepCombat(progressed).state;
  expect(progressed.tick).toBeGreaterThan(0);
  for (const encode of [(x: unknown) => x, JSON.stringify, canonicalContent]) {
    const restored = restoreSharedOrbSnapshot(room.state.pool, encode(match));
    expect(restored).toEqual(match);
    expect(stepCombat(restored.combat!)).toEqual(stepCombat(match.combat!));
    const later = { ...match, combat: progressed } as MatchState;
    expect(restoreSharedOrbSnapshot(room.state.pool, encode(later))).toEqual(later);
    const alteredLater = structuredClone(later);
    const laterCopy = alteredLater.combat!.units.find(u => u.itemSummon?.kind === 'cloning-facility')!;
    Object.assign(laterCopy, { maxHp: laterCopy.maxHp + 1 });
    expect(() => restoreSharedOrbSnapshot(room.state.pool, encode(alteredLater))).toThrow();
    for (const mutate of [
      (x: any) => { x.combat.units.find((u: any) => u.itemSummon?.kind === 'cloning-facility').maxHp++; },
      (x: any) => { x.combat.units.find((u: any) => u.itemSummon?.kind === 'cloning-facility').itemSummon.healthBps = 10000; },
      (x: any) => {
        x.combat.units.find((u: any) => u.itemSummon?.kind === 'cloning-facility').itemSummon.healthBps = 10000;
        x.combat.strategy.units.find((u: any) => u.itemSummon?.kind === 'cloning-facility').itemSummon.healthBps = 10000;
      },
      (x: any) => { delete x.combat.units.find((u: any) => u.itemSummon?.kind === 'cloning-facility').itemSummon; },
      (x: any) => {
        const enemy = x.combat.units.find((u: any) => u.team === 'enemy');
        enemy.r3Mirror = { choiceId: 'forged', sourceUnitId: enemy.id,
          unit: x.combatInputBasis.inputs.preparation.units.find((u: any) => u.id === enemy.id) };
      },
      (x: any) => {
        // A self-consistent compiled answer is still not proof of owning this augment.
        x.combatInputBasis.inputs.augments.push({ definitionId: 'hall-of-mirrors', choiceId: 'forged', acquiredRound: x.round });
        const basis = x.combatInputBasis;
        x.combat = createCombatWithEvents(basis.inputs.preparation, buildStrategySnapshot(basis.inputs), basis.combatId, basis.battleSeed).state;
      },
    ]) {
      const bad: MatchState = structuredClone(match); mutate(bad);
      expect(() => restoreSharedOrbSnapshot(room.state.pool, encode(bad))).toThrow();
    }
  }
});
