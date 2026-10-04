import { describe, expect, it } from 'vitest';
import { validateCombatStart } from '../src/simulation/combat';
import { createGame, deployUnit } from '../src/simulation/game';
import type { Unit } from '../src/simulation/units';

const prep = deployUnit(createGame(), 'unit-1', { kind: 'board', cell: { col: 2, row: 7 } }).state;
const player = prep.units.find(unit => unit.id === 'unit-1')!;
const enemy = prep.units.find(unit => unit.id === 'enemy-1')!;
const bench = (unit: Unit): Unit => ({ ...unit, location: { kind: 'bench', slot: 0 } });
describe('combat start validation', () => {
  it.each([
    { name: 'empty board', units: [], reason: 'missing-both' },
    { name: 'both teams on bench', units: [bench(player), bench(enemy)], reason: 'missing-both' },
    { name: 'player only', units: [player], reason: 'missing-enemy' },
    { name: 'enemy only', units: [enemy], reason: 'missing-player' },
    { name: 'player on bench', units: [bench(player), enemy], reason: 'missing-player' },
    { name: 'enemy on bench', units: [player, bench(enemy)], reason: 'missing-enemy' },
    { name: 'one deployed unit per team', units: [player, enemy], reason: undefined },
  ])('$name', ({ units, reason }) => {
    const state = { ...prep, units }, before = structuredClone(state);
    expect(validateCombatStart(state)).toBe(reason);
    expect(state).toEqual(before);
  });
});
