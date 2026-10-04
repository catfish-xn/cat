import type { Board, HexCell, Team } from './board';
import type { ResolvedAbility } from './ability-types';
import type { StrategySnapshot, SourcedEffect, ResolvedTrigger, EffectRuntime, EffectSource, EffectAction } from './strategy-types';
import type { DamagePacket } from './ability-types';
import type { StarLevel } from './unit-types';
export const COMBAT_TICK_MS = 50;
export const MAX_COMBAT_TICKS = 1200;
export const MOVE_INTERVAL_TICKS = 5;
export type CombatResult = 'playerWin' | 'enemyWin' | 'draw';
export interface CombatUnit {
  readonly sources?: readonly SourcedEffect[]; readonly triggers?: readonly ResolvedTrigger[]; readonly effectRuntime?: readonly EffectRuntime[];
  readonly id: string; readonly definitionId: string; readonly team: Team; readonly starLevel: StarLevel;
  readonly cell: HexCell; readonly hp: number; readonly maxHp: number;
  readonly attackDamage: number; readonly attackRange: number; readonly attackIntervalTicks: number;
  readonly cooldownTicks: number; readonly moveCooldownTicks: number; readonly alive: boolean; readonly targetId: string | null;
  readonly armor: number; readonly magicResist: number; readonly mana: number; readonly maxMana: number;
  readonly shield: number; readonly shieldExpiresAtTick: number | null; readonly ability: ResolvedAbility;
}
export interface CombatState {
  readonly strategy?: StrategySnapshot; readonly combatId?: string; readonly nextEventSeq?: number; readonly startEffectsApplied?: boolean;
  readonly board: Board; readonly units: readonly CombatUnit[]; readonly tick: number; readonly maxTicks: number;
  readonly status: 'running' | 'finished'; readonly result: CombatResult | null;
}
export type CombatEvent = CombatEventData & { readonly domain?: 'combat'; readonly combatId?: string; readonly eventSeq?: number };
export type CombatEventData =
  | { readonly type: 'effectTriggered'; readonly tick: number; readonly source: EffectSource; readonly effectKey: string; readonly action: EffectAction; readonly targetId: string }
  | { readonly type: 'movement'; readonly tick: number; readonly unitId: string; readonly from: HexCell; readonly to: HexCell }
  | { readonly type: 'attack'; readonly tick: number; readonly attackerId: string; readonly targetId: string }
  | { readonly type: 'cast'; readonly tick: number; readonly sourceId: string; readonly abilityId: string; readonly targetIds: readonly string[]; readonly manaSpent: number }
  | { readonly type: 'shieldChanged'; readonly tick: number; readonly unitId: string; readonly reason: 'granted' | 'expired'; readonly before: number; readonly after: number; readonly expiresAtTick: number | null }
  | { readonly type: 'damage'; readonly tick: number; readonly unitId: string; readonly amount: number; readonly hp: number; readonly physicalAmount: number; readonly magicAmount: number; readonly absorbed: number; readonly hpDamage: number; readonly shield: number; readonly packets?: readonly (DamagePacket & { readonly mitigated: number })[] }
  | { readonly type: 'manaChanged'; readonly tick: number; readonly unitId: string; readonly before: number; readonly spent: number; readonly attackGain: number; readonly damageGain: number; readonly hookGain?: number; readonly overflow: number; readonly after: number }
  | { readonly type: 'death'; readonly tick: number; readonly unitId: string }
  | { readonly type: 'combatFinished'; readonly tick: number; readonly result: CombatResult; readonly reason: 'elimination' | 'timeout' };
export interface CombatStep { readonly state: CombatState; readonly events: readonly CombatEvent[] }
export function compareIds(a: { readonly id: string }, b: { readonly id: string }): number { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }
export function eliminationResult(units: readonly CombatUnit[]): CombatResult | null {
  const player = units.some(unit => unit.alive && unit.team === 'player');
  const enemy = units.some(unit => unit.alive && unit.team === 'enemy');
  return player && enemy ? null : player ? 'playerWin' : enemy ? 'enemyWin' : 'draw';
}
