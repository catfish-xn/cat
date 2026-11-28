import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, type S13Unit } from '../src/simulation/combat-s13-state';
import { battle, freeze, unit } from './combat-helpers';

function body(id: string, team: CombatUnit['team'], col: number, row: number, patch: Partial<CombatUnit> = {}): S13Unit {
  return unit(id, team, col, row, { definitionId: 'draven', ability: resolveAbility('draven-ability', 1),
    hp: 10000, maxHp: 10000, maxMana: 100000, attackRange: 1, attackDamage: 0,
    baseAttackSpeedBps: 10000, runtime: { ...EMPTY_RUNTIME }, statuses: [], tasks: [], shieldLayers: [], ...patch }) as S13Unit;
}

describe('melee approach after an ally dies on an attack hex', () => {
  // The corner target has two attack hexes: (1,0) is held by a living ally, (0,1) is where an ally died.
  const units = () => [
    body('a-dead', 'player', 0, 1, { alive: false, hp: 0, targetId: 'e', meleeApproach: { targetId: 'e', cell: { col: 0, row: 1 } } }),
    body('b-live', 'player', 1, 0, { targetId: 'e', targetEngaged: true, meleeApproach: { targetId: 'e', cell: { col: 1, row: 0 } } }),
    body('c-walker', 'player', 3, 2),
    body('e', 'enemy', 0, 0, { cooldownTicks: 1000, moveCooldownTicks: 1000 }),
  ];

  it('lets a living ally walk onto the hex the dead body stood on', () => {
    let state: CombatState = freeze(battle(units(), { rngState: 42, rngDraws: 0 }));
    for (let i = 0; i < 30; i++) state = stepCombat(state).state;
    const walker = state.units.find(u => u.id === 'c-walker')!;
    expect(walker.cell).toEqual({ col: 0, row: 1 });
    expect(walker.meleeApproach).toEqual({ targetId: 'e', cell: { col: 0, row: 1 } });
    expect(state.units.find(u => u.id === 'a-dead')!.meleeApproach).toBeUndefined();
  });

});

describe('melee retarget when the nearest enemy is walled off', () => {
  // e-near at (3,3) is ringed by frozen allies of the walker; z-far at (0,0) still has an open attack hex.
  const wall = (id: string, col: number, row: number) => body(id, 'player', col, row, { cooldownTicks: 1000, moveCooldownTicks: 1000 });
  const foe = (id: string, col: number, row: number) => body(id, 'enemy', col, row, { cooldownTicks: 1000, moveCooldownTicks: 1000 });
  const units = () => [
    body('p', 'player', 3, 6),
    foe('e-near', 3, 3),
    wall('w1', 4, 3), wall('w2', 4, 4), wall('w3', 3, 4), wall('w4', 2, 3), wall('w5', 3, 2), wall('w6', 4, 2),
    foe('z-far', 0, 0),
  ];

  it('walks to a reachable enemy instead of waiting on the nearest one', () => {
    let state: CombatState = freeze(battle(units(), { rngState: 42, rngDraws: 0 }));
    const start = { col: 3, row: 6 };
    for (let i = 0; i < 10; i++) state = stepCombat(state).state;
    const p = state.units.find(u => u.id === 'p')!;
    expect(p.targetId).toBe('z-far');
    expect(p.cell).not.toEqual(start);
  });
});
