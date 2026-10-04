import { DEFAULT_BOARD } from '../src/simulation/board';
import type { CombatState, CombatUnit } from '../src/simulation/combat';

/** Zero armor and unreachable Mana threshold isolate the original movement/attack contracts. */
export function unit(id: string, team: CombatUnit['team'], col: number, row: number, overrides: Partial<CombatUnit> = {}): CombatUnit {
  return { id, team, definitionId: 'sentinel', starLevel: 1, cell: { col, row }, hp: 100, maxHp: 100,
    attackDamage: 40, attackRange: 1, attackIntervalTicks: 20, cooldownTicks: 0,
    moveCooldownTicks: 0, alive: true, targetId: null, armor: 0, magicResist: 0, mana: 0, maxMana: 100_000,
    shield: 0, shieldExpiresAtTick: null,
    ability: { id: 'test-bolt', kind: 'damage', amount: 60, damageType: 'magic', radius: 0 }, ...overrides };
}
export function battle(units: readonly CombatUnit[], overrides: Partial<CombatState> = {}): CombatState {
  return { board: DEFAULT_BOARD, units, tick: 0, maxTicks: 1200, status: 'running', result: null, ...overrides };
}
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
