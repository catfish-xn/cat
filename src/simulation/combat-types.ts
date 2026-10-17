import {isG23NonCombatant} from './g2-3-summons';
import type { Board, HexCell, Team } from './board';
import type { ResolvedAbility } from './ability-types';
import type { StrategySnapshot, SourcedEffect, ResolvedTrigger, EffectRuntime, EffectSource, EffectAction } from './strategy-types';
import type { DamagePacket } from './ability-types';
import type { StarLevel } from './unit-types';
export const COMBAT_TICK_MS = 50;
export const MAX_COMBAT_TICKS = 1200;
export const MOVE_INTERVAL_TICKS = 5;
export type CombatResult = 'playerWin' | 'enemyWin' | 'draw';
export interface CombatOrigin { readonly parentItemInstanceId?: string | null; readonly ownerId: string; readonly sourceKind: 'attack' | 'ability' | 'trait' | 'item' | 'augment' | 'anomaly' | 'enemyGrowth'; readonly definitionId: string; readonly instanceId: string; readonly effectIndex: number }
export interface ShieldLayer { readonly m8State?: import('./m8/contracts').ShieldState; readonly m8Grant?: Extract<import('./m8/contracts').Effect, { kind: 'grant-shield' }>; readonly endedReason?: import('./m8/contracts').ShieldEndReason;  readonly key: string; readonly source: CombatOrigin; readonly granted: number; readonly remaining: number; readonly absorbed: number; readonly expiresAtTick: number; readonly decayPerTick?: number; readonly grantedAtTick?: number; readonly decayDurationTicks?: number }
export interface CombatStatus { readonly contributionKeys?: readonly string[]; readonly activity?: import('./m8/contracts').CombatActivity;  readonly key: string; readonly kind: 'stun' | 'damageReduction' | 'armorReduction' | 'resistanceFlat' | 'attackSpeed' | 'abilityPower' | 'channel' | 'redirect'; readonly source: CombatOrigin; readonly amount: number; readonly startsAtTick: number; readonly expiresAtTick: number }
export interface CombatTask { readonly cell?: HexCell; readonly shieldEndKey?: string; readonly attachedDot?: boolean;  readonly key: string; readonly kind: 'maddie' | 'bleed' | 'ireliaEnd' | 'leonaEnd' | 'lorisEnd' | 'corki' | 'caitlyn' | 'tristanaBounce' | 'g2Drain' | 'g2Slam' | 'g2Infection' | 'g2SingedSpeed' | 'g2Blast' | 'g2Retaliation' | 'g22Vex' | 'g22Curse' | 'g23Heal' | 'g23Magic' | 'g23Physical' | 'g23True' | 'g23Smeech'; readonly source: CombatOrigin; readonly executeAtTick: number; readonly targetId: string | null; readonly amount: number; readonly ordinal: number; readonly total: number; readonly cancellable: boolean; readonly actionSeq: number;
  readonly inherited?: Extract<import('./m8/contracts').DamageInput, { stage: 'after-mitigation' }>['inherited']; }
export interface CombatMechanic { readonly source: CombatOrigin; readonly mechanic: string; readonly values: Readonly<Record<string, number>>; readonly targetId?: string }
export type CombatMechanics = readonly CombatMechanic[];
export interface CombatRuntime { readonly attackCount: number; readonly castCount: number; readonly attackSpeedBps: number; readonly abilityPowerFlat: number; readonly rangeBonus: number; readonly nextAttackMagic: number; readonly nextAttackPhysical: number; readonly permanentAdBps: number; readonly buddyTriggered: boolean }
/** Finite G2 state; absent in battles without G2 mechanics. No hidden counters outside the snapshot. */
export interface ExpansionState {
  damageDealt: number; damageTaken: number; crystals: number; crystalDamage: number;
  attacksRemaining: number; buffUntilTick: number; lastRetaliationTick: number;
  chainUntilTick: number; chainTargets: string[]; chainCastSeq: number; chainKills: number;
}
export interface G22State { initialized: boolean; rebelTriggered: boolean; wanted: string[]; wantedDeaths: number; mordeUntilTick: number; reaveUntilTick: number; reaveBps: number; exposureFromTick: number; exposureUntilTick: number; exposureBps: number }
export interface G23State {
  ascension:{untilTick:number;nextPulseTick:number;actionSeq:number;takedowns:string[]}|null;
  conquestTakedowns:string[];
  experimentTakedowns:string[];
  cuts: Record<string,number>;
  stationaryTicks:number;
  lastCell:HexCell;
  absorbed: {unitId:string;tick:number;value:number}[];
  highRoller: {actionSeq:number;spell:number;mod:import('./g2-3-progress').G23HighRollerMod;enhanced:boolean;gold:number}[];
}
export interface CombatUnit {
  readonly itemSummonOpeningMaxHp?:number;
  readonly itemBanish?: {readonly ownerId:string;readonly itemInstanceId:string;readonly untilTick:number};
  readonly itemMogulHits?:readonly {readonly packetId:string;readonly tick:number}[];
  readonly openingItemBankGold?:number;
  readonly currentItemBankGold?:number;
  readonly itemSummon?: import('./g2-4b-summons').ItemSummonOrigin;
  readonly deferredItemDamage?: readonly import('./g2-4b-item-kernel').DeferredItemDamage[];
  readonly unreavedMaxMana?: number;
  /** G2-3 form swapper's form, frozen from its preparation row at combat start (seat-mechanics/forms.ts). */
  readonly form?: import('./seat-mechanics/types').UnitForm;
  readonly g23?: G23State;
  readonly g22?: G22State;
  readonly expansion?: ExpansionState;
  readonly itemPrograms?: readonly import('./m8/item-program').BoundItemProgram[];
  readonly startingCell?: HexCell;
  readonly baseCritChanceBps?: number;
  readonly baseCritMultiplierBps?: number;
  readonly attackCone?: { readonly secondaryDamageBps: number };
  readonly triggerLedger?: import('./m8/triggers').TriggerLedger;
  readonly encounterId?: string;
  readonly monsterFamily?: string;
  readonly companionDefinitions?: readonly import('./m8/companions').CompanionDefinition[];
  readonly manaLockedUntilTick?: number;
  readonly unitKind?: 'champion' | 'neutral';
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
  readonly itemGoldReceipts?: readonly import('./g2-4b-item-gold').ItemGoldReceipt[];
  readonly itemRandomStreams?: import('./g2-4b-item-kernel').ItemRandomStreams;
  readonly removedUnitIds?:readonly string[];
  readonly neutralReceipts?: import('./neutral-receipts').NeutralReceipts;
  readonly openingDefinitions?: readonly import('./m8/opening').OpeningDefinition[];
  readonly openingState?: import('./m8/opening').OpeningState;
  readonly damageContributors?: Readonly<Record<string, readonly string[]>>;
  readonly nextTriggerEventSeq?: number;
  readonly companionState?: import('./m8/companions').CompanionState;
  readonly rngState?: number; readonly rngDraws?: number; readonly nextActionSeq?: number;
  readonly strategy?: StrategySnapshot; readonly combatId?: string; readonly nextEventSeq?: number; readonly startEffectsApplied?: boolean;
  readonly board: Board; readonly units: readonly CombatUnit[]; readonly tick: number; readonly maxTicks: number;
  readonly status: 'running' | 'finished'; readonly result: CombatResult | null;
}
/** Engine-level event: every combat event carries a tick; Match/strategy combats add the ledger envelope. */
export type CombatEvent = CombatEventData & { readonly domain?: 'combat'; readonly combatId?: string; readonly eventSeq?: number };
/** B9 replay2: the frozen M8 ledger event (contracts.ts M8CombatEvent). Match, saves, replay, stats and UI use only this. */
export type LedgerCombatEvent = import('./m8/contracts').M8CombatEvent;
/** Events that M8_RULES §10 keeps with their existing fields. */
export type UnchangedCombatEventData =
  | { readonly type: 'targetChanged'; readonly tick: number; readonly unitId: string; readonly before: string | null; readonly after: string | null }
  | { readonly type: 'kill'; readonly tick: number; readonly unitId: string; readonly source: CombatOrigin }
  | { readonly type: 'growth'; readonly tick: number; readonly unitId: string; readonly amountBps: number; readonly totalBps: number }
  | { readonly type: 'effectTriggered'; readonly tick: number; readonly source: EffectSource; readonly effectKey: string; readonly action: EffectAction; readonly targetId: string }
  | { readonly type: 'movement'; readonly tick: number; readonly unitId: string; readonly from: HexCell; readonly to: HexCell }
  | { readonly type: 'attack'; readonly tick: number; readonly attackerId: string; readonly targetId: string }
  | { readonly type: 'unitRevived'; readonly tick: number; readonly unitId: string; readonly source: CombatOrigin; readonly hp: number }
  | { readonly type: 'death'; readonly tick: number; readonly unitId: string }
  | { readonly type: 'combatFinished'; readonly tick: number; readonly result: CombatResult; readonly reason: 'elimination' | 'timeout' };
/** B9 replay2 payloads, field-for-field the frozen M8CombatEvent members (pinned by tests/m8-b9-replay2-events.test.ts). */
export type ReplayTwoEventData =
  | { readonly type: 'activityChanged'; readonly tick: number; readonly activity: import('./m8/contracts').CombatActivity; readonly reason: 'applied' | 'refreshed' | import('./m8/contracts').ActivityEndReason }
  | { readonly type: 'cast'; readonly tick: number; readonly receipt: import('./m8/contracts').CastReceipt }
  | { readonly type: 'packetDamage'; readonly tick: number; readonly outcome: import('./m8/contracts').DamageOutcome }
  | { readonly type: 'heal'; readonly tick: number; readonly outcome: import('./m8/contracts').HealOutcome }
  | { readonly type: 'manaChanged'; readonly tick: number; readonly outcome: import('./m8/contracts').ManaOutcome }
  | { readonly type: 'statusChanged'; readonly tick: number; readonly group: import('./m8/contracts').StatusGroup; readonly reason: 'applied' | 'refreshed' | import('./m8/contracts').StatusEndReason }
  | { readonly type: 'shieldLayerChanged'; readonly tick: number; readonly layer: import('./m8/contracts').ShieldState; readonly reason: 'granted' | 'absorbed' | 'decayed' | import('./m8/contracts').ShieldEndReason }
  | { readonly type: 'statChanged'; readonly tick: number; readonly unitId: string; readonly source: import('./m8/contracts').Source; readonly stat: import('./m8/contracts').Stat; readonly before: number; readonly after: number }
  | { readonly type: 'maxHpChanged'; readonly tick: number; readonly unitId: string; readonly source: import('./m8/contracts').Source; readonly beforeMax: number; readonly afterMax: number; readonly beforeHp: number; readonly afterHp: number; readonly countsAsHeal: false };
/** Pre-S13 combat path only (M3/M4 legacy units and lower-level trigger seams); never part of an M8 ledger. */
export type LegacyCombatEventData =
  | { readonly type: 'cast'; readonly tick: number; readonly sourceId: string; readonly abilityId: string; readonly targetIds: readonly string[]; readonly manaSpent: number }
  | { readonly type: 'shieldChanged'; readonly tick: number; readonly unitId: string; readonly reason: 'granted' | 'expired'; readonly before: number; readonly after: number; readonly expiresAtTick: number | null }
  | { readonly type: 'damage'; readonly tick: number; readonly unitId: string; readonly amount: number; readonly hp: number; readonly physicalAmount: number; readonly magicAmount: number; readonly absorbed: number; readonly hpDamage: number; readonly shield: number; readonly packets?: readonly (DamagePacket & { readonly mitigated: number })[] }
  | { readonly type: 'manaChanged'; readonly tick: number; readonly unitId: string; readonly before: number; readonly spent: number; readonly attackGain: number; readonly damageGain: number; readonly hookGain?: number; readonly overflow: number; readonly after: number };
export type CombatEventData = UnchangedCombatEventData | ReplayTwoEventData | LegacyCombatEventData | import('./seat-mechanics/combat-events').G23CombatEventData;
export interface CombatStep { readonly state: CombatState; readonly events: readonly CombatEvent[] }
export function compareIds(a: { readonly id: string }, b: { readonly id: string }): number { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }
export function eliminationResult(units: readonly CombatUnit[]): CombatResult | null {
  const player = units.some(unit => unit.alive && !isG23NonCombatant(unit) && unit.team === 'player');
  const enemy = units.some(unit => unit.alive && !isG23NonCombatant(unit) && unit.team === 'enemy');
  return player && enemy ? null : player ? 'playerWin' : enemy ? 'enemyWin' : 'draw';
}
