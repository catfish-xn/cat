import type { Board, HexCell, Team } from './board';

export const COMBAT_TICK_MS = 50;
export const MAX_COMBAT_TICKS = 1200;
export const MOVE_INTERVAL_TICKS = 5;
export type CombatResult = 'playerWin' | 'enemyWin' | 'draw';
export interface CombatUnit {
  readonly id: string;
  readonly definitionId: string;
  readonly team: Team;
  readonly cell: HexCell;
  readonly hp: number;
  readonly maxHp: number;
  readonly attackDamage: number;
  readonly attackRange: number;
  readonly attackIntervalTicks: number;
  readonly cooldownTicks: number;
  readonly moveCooldownTicks: number;
  readonly alive: boolean;
  readonly targetId: string | null;
}
export interface CombatState {
  readonly board: Board;
  readonly units: readonly CombatUnit[];
  readonly tick: number;
  readonly maxTicks: number;
  readonly status: 'running' | 'finished';
  readonly result: CombatResult | null;
}
export type CombatEvent =
  | { readonly type: 'movement'; readonly tick: number; readonly unitId: string; readonly from: HexCell; readonly to: HexCell }
  | { readonly type: 'attack'; readonly tick: number; readonly attackerId: string; readonly targetId: string }
  | { readonly type: 'damage'; readonly tick: number; readonly unitId: string; readonly amount: number; readonly hp: number }
  | { readonly type: 'death'; readonly tick: number; readonly unitId: string }
  | { readonly type: 'combatFinished'; readonly tick: number; readonly result: CombatResult; readonly reason: 'elimination' | 'timeout' };
export interface CombatStep { readonly state: CombatState; readonly events: readonly CombatEvent[] }
/** Code-point comparison avoids locale-dependent ordering. */
export function compareIds(a: { readonly id: string }, b: { readonly id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
export function eliminationResult(units: readonly CombatUnit[]): CombatResult | null {
  const player = units.some(unit => unit.alive && unit.team === 'player');
  const enemy = units.some(unit => unit.alive && unit.team === 'enemy');
  return player && enemy ? null : player ? 'playerWin' : enemy ? 'enemyWin' : 'draw';
}
