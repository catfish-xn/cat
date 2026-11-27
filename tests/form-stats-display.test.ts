/** A form swapper's back-row stats outside combat (card grid, inspect panel, 3D planning bar) follow the rules' form stats. */
import { expect, it } from 'vitest';
import { planningBase, planningMetersFor } from '../src/presentation/planning-meters';
import { g23FormStats } from '../src/simulation/g2-3-forms';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import type { MatchState } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';

const SWAPPERS = ['elise', 'jayce', 'gangplank', 'swain'];
const { firstRow: front, lastRow: back } = DEFAULT_BOARD.deploymentZones.player;

it('reads the back-row form\'s stats outside combat, as the rules resolve them for a back row', () => {
  for (const id of SWAPPERS) for (const star of [1, 2, 3] as const) {
    const rules = g23FormStats(id, star, 'player', back), shown = planningBase(id, star, 'ranged');
    expect([shown.health, shown.attack, shown.armor, shown.magicResist, shown.attackRange, shown.initialMana, shown.maxMana])
      .toEqual([rules.health, rules.attack, rules.armor, rules.magicResist, rules.attackRange, rules.initialMana, rules.maxMana]);
    expect(planningBase(id, star, 'melee')).toEqual(planningBase(id, star));
    const bar = planningMetersFor({ definitionId: id, team: 'player' }, star, false, 'ranged')!;
    expect([bar.maxHp, bar.mana, bar.maxMana]).toEqual([rules.health, rules.initialMana, rules.maxMana]);
  }
});

it('matches the combat unit the rules build on a back row (the bar in combat reads that unit)', () => {
  for (const id of SWAPPERS) {
    const state = createMatch(42);
    const units: Unit[] = [{ id: 'hero', definitionId: id, team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 3, row: back } } },
      { id: 'enemy', definitionId: 'garen', team: 'enemy', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 0 } } }];
    const match = { ...state, preparation: { ...state.preparation, units } } as MatchState;
    const unit = createCombatWithEvents(match.preparation, buildStrategySnapshot(match), 'form', 42).state.units.find(u => u.id === 'hero')!;
    const shown = planningMetersFor({ definitionId: id, team: 'player' }, 2, false, 'ranged')!;
    expect([unit.maxHp, unit.maxMana, unit.attackRange]).toEqual([shown.maxHp, shown.maxMana, planningBase(id, 2, 'ranged').attackRange]);
    expect(front).toBeLessThan(back);
  }
});
