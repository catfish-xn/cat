import { expect, it } from 'vitest';
import { createMatch, startMatchCombat } from '../src/simulation/match';
import type { CombatState } from '../src/simulation/combat';
import { carryAugmentCombatDeaths, readAugmentCombatAttributions, readAugmentCombatDeaths, sampleAugmentDeath } from '../src/simulation/augment-death-samples';

it('empty ticks retain death attribution, detach readers and isolate history forks', () => {
  const started = startMatchCombat(createMatch(42));
  if (!started.ok) throw new Error(started.reason);
  const initial = started.state.combat!, unit = initial.units[0];
  const killer = { ownerId: 'attacker', sourceKind: 'attack' as const, definitionId: 'attacker', instanceId: 'attacker', effectIndex: 0 };
  const state = (tick: number): CombatState => ({ ...initial, tick });
  const first = carryAugmentCombatDeaths(initial, { state: state(1), events: [
    sampleAugmentDeath({ type: 'death', tick: 1, unitId: unit.id, combatId: 'sample', eventSeq: 0 }, unit, killer, []),
  ] }).state;
  const expected = readAugmentCombatDeaths(first, true, true), attributes = readAugmentCombatAttributions(first);
  let empty = first;
  for (let tick = 2; tick <= 5; tick++) empty = carryAugmentCombatDeaths(empty, { state: state(tick), events: [] }).state;
  expect(readAugmentCombatDeaths(empty, true, true)).toEqual(expected);
  expect(readAugmentCombatAttributions(empty)).toEqual(attributes);
  const fork = carryAugmentCombatDeaths(empty, { state: state(6), events: [
    sampleAugmentDeath({ type: 'death', tick: 6, unitId: unit.id, combatId: 'sample', eventSeq: 1 }, unit, null, []),
  ] }).state;
  expect(readAugmentCombatDeaths(fork, true, true)).toHaveLength(2);
  expect(readAugmentCombatDeaths(empty, true, true)).toEqual(expected);
  const detached = readAugmentCombatDeaths(empty, true, true) as unknown as { unitId: string }[];
  detached[0].unitId = 'changed'; detached.length = 0;
  expect(readAugmentCombatDeaths(first, true, true)).toEqual(expected);
  expect(readAugmentCombatAttributions(first)).toEqual(attributes);
});
