import type { CombatEvent, CombatResult, CombatStartFailure, CombatState } from './combat';
import type { DeploymentFailure, GameState } from './game';
import type { ItemInstance, OwnedAugment, AnomalyBinding, PendingChoice, ScheduleReceipt, StrategyEvent } from './strategy-types';
import type { UnitUpgradedEvent } from './unit-types';
export type { UnitUpgradedEvent } from './unit-types';
export type MatchEvent = CombatEvent | ((UnitUpgradedEvent | StrategyEvent | { readonly type: 'roundSettled'; readonly round: number }) & { readonly domain?: 'match'; readonly eventSeq?: number });
export type ShopSlot = { readonly status: 'available'; readonly definitionId: string } | { readonly status: 'purchased' };
export interface Shop { readonly generation: number; readonly slots: readonly ShopSlot[]; readonly locked?: boolean }
export interface Streak { readonly kind: 'win' | 'loss' | null; readonly count: number }
export type RoundKind = 'pvp' | 'pve' | 'supply';
export interface PersistentGrowth { readonly unitId: string; readonly attackDamageBps: number }
export interface RoundResult {
  readonly round: number; readonly roundId: string; readonly result: CombatResult | 'supply'; readonly combatTicks: number;
  readonly settlementId: string; readonly roundKind: RoundKind;
  readonly incomeBreakdown: { readonly base: number; readonly win: number; readonly interest: number; readonly streak: number };
  readonly interestBasis: number; readonly streakBefore: Streak; readonly streakAfter: Streak; readonly xpRequested: number;
  readonly income: number; readonly goldBefore: number; readonly goldAfter: number;
  readonly xpAwarded: number; readonly levelBefore: number; readonly levelAfter: number;
  readonly xpBefore: number; readonly xpAfter: number; readonly hpBefore: number; readonly hpAfter: number;
  readonly baseDamage: number; readonly survivingEnemyCount: number; readonly playerDamage: number; readonly hpLost: number;
}
/** B6 freezes the existing enemy projection once. Full PvE content/loot remains B7/B8. */
export interface RoundPreparation {
  readonly version: 'm8-b6-preparation-v1';
  readonly roundId: string;
  readonly encounterId: string | null;
  readonly contentStatus: 'pending-b7-b8' | 'not-pve';
  readonly enemies: readonly import('./unit-types').Unit[];
}
export interface MatchBase {
  readonly m8: Pick<import('./m8/contracts').M8MatchExtension, 'round' | 'encounterPlan'> & {readonly preparation: RoundPreparation};

  readonly equipmentState: import('./m8/equipment').EquipmentState;
  readonly temporaryEquipment: readonly import('./m8/contracts').TemporaryEquipment[];
  readonly schemaVersion: 5; readonly rulesVersion: 'm5-14.24b-v1'; readonly contentVersion: 's13-14.24b-slice-v1'; readonly contentDigest: string;
  readonly commandProtocolVersion: 2; readonly rngAlgorithm: 'lcg32-v1'; readonly tickMs: 50;
  readonly roundDefinitionId: string; readonly streak: Streak; readonly outcome: 'victory' | 'defeat' | null;
  readonly battleSeedRngState: number; readonly persistentGrowth: readonly PersistentGrowth[];
  readonly augmentProgress: { readonly pumpingRounds: number; readonly investmentHp: number };
  readonly items: readonly ItemInstance[]; readonly nextItemSerial: number; readonly augments: readonly OwnedAugment[];
  readonly anomalyBinding: AnomalyBinding | null; readonly pendingChoice: PendingChoice | null;
  readonly scheduleReceipts: readonly ScheduleReceipt[]; readonly choiceRngState: number; readonly rewardRngState: number; readonly nextMatchEventSeq: number;
  readonly seed: number; readonly rngState: number; readonly round: number; readonly gold: number;
  readonly level: number; readonly xp: number; readonly playerHp: number;
  readonly shop: Shop; readonly nextUnitSerial: number; readonly preparation: GameState; readonly roundResults: readonly RoundResult[];
}
export type RunningCombat = CombatState & { readonly status: 'running'; readonly result: null };
export type FinishedCombat = CombatState & { readonly status: 'finished'; readonly result: CombatResult };
export type MatchState = MatchBase & (
  | { readonly phase: 'preparation'; readonly combat: null }
  | { readonly phase: 'choice'; readonly combat: FinishedCombat | null }
  | { readonly phase: 'combat'; readonly combat: RunningCombat }
  | { readonly phase: 'settlement' | 'gameOver'; readonly combat: FinishedCombat | null }
);
export type MatchFailure = DeploymentFailure | CombatStartFailure | 'wrong-phase' | 'invalid-slot' | 'stale-shop'
  | 'purchased-slot' | 'insufficient-gold' | 'bench-full' | 'stale-round' | 'unsettled-round' | 'max-level' | 'population-cap' | 'unknown-item' | 'item-not-inventory' | 'invalid-recipe' | 'item-slot-occupied'
  | 'stale-choice' | 'invalid-choice' | 'invalid-target'
  | import('./m8/ui-contracts').EquipmentFailure;
export type MatchCommandResult = { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: MatchFailure };
export interface MatchStep { readonly state: MatchState; readonly events: readonly MatchEvent[] }
export interface ProgressionResult { readonly level: number; readonly xp: number; readonly xpRequested: number; readonly xpApplied: number; readonly levelsGained: number }
export type PurchasePlanResult = { readonly ok: true; readonly preparation: GameState; readonly events: readonly UnitUpgradedEvent[] }
  | { readonly ok: false; readonly reason: 'bench-full' };
