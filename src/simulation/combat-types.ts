import type { Board, HexCell, Team } from './board';
import type { ResolvedAbility } from './ability-types';
import type { StrategySnapshot, SourcedEffect, ResolvedTrigger, EffectRuntime, EffectSource, EffectAction } from './strategy-types';
import type { DamagePacket } from './ability-types';
import type { StarLevel } from './unit-types';
export const COMBAT_TICK_MS = 50;
export const MAX_COMBAT_TICKS = 1200;
export const MOVE_INTERVAL_TICKS = 5;
export type CombatResult = 'playerWin' | 'enemyWin' | 'draw';
export interface CombatOrigin { readonly ownerId: string; readonly sourceKind: 'attack' | 'ability' | 'trait' | 'item' | 'augment' | 'anomaly' | 'enemyGrowth'; readonly definitionId: string; readonly instanceId: string; readonly effectIndex: number }
export interface ShieldLayer { readonly m8State?: import('./m8/contracts').ShieldState; readonly m8Grant?: Extract<import('./m8/contracts').Effect, { kind: 'grant-shield' }>; readonly endedReason?: import('./m8/contracts').ShieldEndReason;  readonly key: string; readonly source: CombatOrigin; readonly granted: number; readonly remaining: number; readonly absorbed: number; readonly expiresAtTick: number; readonly decayPerTick?: number; readonly grantedAtTick?: number; readonly decayDurationTicks?: number }
export interface CombatStatus { readonly contributionKeys?: readonly string[]; readonly activity?: import('./m8/contracts').CombatActivity;  readonly key: string; readonly kind: 'stun' | 'damageReduction' | 'armorReduction' | 'resistanceFlat' | 'attackSpeed' | 'abilityPower' | 'channel' | 'redirect'; readonly source: CombatOrigin; readonly amount: number; readonly startsAtTick: number; readonly expiresAtTick: number }
export interface CombatTask { readonly shieldEndKey?: string; readonly attachedDot?: boolean;  readonly key: string; readonly kind: 'maddie' | 'bleed' | 'ireliaEnd' | 'leonaEnd' | 'lorisEnd' | 'corki' | 'caitlyn' | 'tristanaBounce'; readonly source: CombatOrigin; readonly executeAtTick: number; readonly targetId: string | null; readonly amount: number; readonly ordinal: number; readonly total: number; readonly cancellable: boolean; readonly actionSeq: number;
  readonly inherited?: Extract<import('./m8/contracts').DamageInput, { stage: 'after-mitigation' }>['inherited']; }
export interface CombatMechanic { readonly source: CombatOrigin; readonly mechanic: string; readonly values: Readonly<Record<string, number>>; readonly targetId?: string }
export type CombatMechanics = readonly CombatMechanic[];
export interface CombatRuntime { readonly attackCount: number; readonly castCount: number; readonly attackSpeedBps: number; readonly abilityPowerFlat: number; readonly rangeBonus: number; readonly nextAttackMagic: number; readonly nextAttackPhysical: number; readonly permanentAdBps: number; readonly buddyTriggered: boolean }
export interface CombatUnit {
  readonly mechanismDefinitions?: import('./m8/runtime-types').MechanismDefinitions;
  readonly mechanismState?: import('./m8/runtime-types').MechanismState;
  readonly maxHpBasis?: { readonly base: number; readonly flat: number; readonly bps: number; readonly bonusBps: number };

  /** G03 frozen authorization projection; supplied by the content compiler, never inferred from damage source. */
  readonly spellCrit?: import('./m8/contracts').SpellCritAuthorization;
  readonly attackDamageBase?: number; readonly attackDamagePercentBps?: number;
  readonly abilityPower?: number; readonly baseAttackSpeedBps?: number; readonly attackSpeedBonusBps?: number; readonly shieldLayers?: readonly ShieldLayer[]; readonly statuses?: readonly CombatStatus[]; readonly tasks?: readonly CombatTask[]; readonly mechanics?: CombatMechanics; readonly runtime?: CombatRuntime;
  readonly sources?: readonly SourcedEffect[]; readonly triggers?: readonly ResolvedTrigger[]; readonly effectRuntime?: readonly EffectRuntime[];
  readonly id: string; readonly definitionId: string; readonly team: Team; readonly starLevel: StarLevel;
  readonly cell: HexCell; readonly hp: number; readonly maxHp: number;
  readonly attackDamage: number; readonly attackRange: number; readonly attackIntervalTicks: number;
  readonly cooldownTicks: number; readonly moveCooldownTicks: number; readonly alive: boolean; readonly targetId: string | null;
  readonly armor: number; readonly magicResist: number; readonly mana: number; readonly maxMana: number;
  readonly shield: number; readonly shieldExpiresAtTick: number | null; readonly ability: ResolvedAbility;
}
export interface CombatState {
  readonly rngState?: number; readonly rngDraws?: number; readonly nextActionSeq?: number;
  readonly strategy?: StrategySnapshot; readonly combatId?: string; readonly nextEventSeq?: number; readonly startEffectsApplied?: boolean;
  readonly board: Board; readonly units: readonly CombatUnit[]; readonly tick: number; readonly maxTicks: number;
  readonly status: 'running' | 'finished'; readonly result: CombatResult | null;
}
export type CombatEvent = CombatEventData & { readonly domain?: 'combat'; readonly combatId?: string; readonly eventSeq?: number };
export type CombatEventData =
  | { readonly type: 'maxHpChanged'; readonly tick: number; readonly unitId: string; readonly source: CombatOrigin; readonly beforeMax: number; readonly afterMax: number; readonly beforeHp: number; readonly afterHp: number; readonly countsAsHeal: false }
  | { readonly type: 'statChanged'; readonly tick: number; readonly unitId: string; readonly source: CombatOrigin; readonly stat: 'attackSpeedBps' | 'abilityPower' | 'range'; readonly before: number; readonly after: number }
  | { readonly type: 'targetChanged'; readonly tick: number; readonly unitId: string; readonly before: string | null; readonly after: string | null }
  | { readonly type: 'heal'; readonly outcome?: import('./m8/contracts').HealOutcome; readonly tick: number; readonly unitId: string; readonly source: CombatOrigin; readonly requested: number; readonly actual: number; readonly overheal: number; readonly hp: number }
  | { readonly type: 'statusChanged'; readonly tick: number; readonly unitId: string; readonly status: CombatStatus; readonly reason: 'applied' | 'expired' | 'cleansed' | 'death-cleanup' | 'combat-end' | 'control-cancelled' | 'replaced'; readonly group?: import('./m8/contracts').StatusGroup; readonly activity?: import('./m8/contracts').CombatActivity }
  | { readonly type: 'shieldLayerChanged'; readonly tick: number; readonly unitId: string; readonly layer: ShieldLayer; readonly reason: 'granted' | 'absorbed' | 'expired' | 'decayed'; readonly endReason?: import('./m8/contracts').ShieldEndReason }
  | { readonly type: 'packetDamage'; readonly tick: number; readonly source: CombatOrigin; readonly unitId: string; readonly damageType: 'physical' | 'magic' | 'true'; readonly outcome?: import('./m8/contracts').DamageOutcome; readonly raw: number; readonly mitigated: number; readonly absorbed: number; readonly hpDamage: number; readonly actionSeq: number; readonly packetOrdinal: number; readonly critical: boolean; readonly redirected: boolean }
  | { readonly type: 'kill'; readonly tick: number; readonly unitId: string; readonly source: CombatOrigin }
  | { readonly type: 'growth'; readonly tick: number; readonly unitId: string; readonly amountBps: number; readonly totalBps: number }
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
