import type { CombatEvent, CombatResult, CombatStartFailure, CombatState } from './combat';
import type { DeploymentFailure, GameState } from './game';
import type { ItemInstance, OwnedAugment, AnomalyBinding, PendingChoice, ScheduleReceipt, StrategyEvent } from './strategy-types';
import type { UnitUpgradedEvent } from './unit-types';
export type { UnitUpgradedEvent } from './unit-types';
export type MatchEvent = CombatEvent | ((UnitUpgradedEvent | StrategyEvent | { readonly type: 'roundSettled'; readonly round: number }) & { readonly domain?: 'match'; readonly eventSeq?: number });
export type ShopSlot = { readonly status: 'available'; readonly definitionId: string } | { readonly status: 'purchased' };
export interface Shop { readonly generation: number; readonly slots: readonly ShopSlot[] }
export interface RoundResult {
  readonly round: number; readonly result: CombatResult; readonly combatTicks: number;
  readonly income: number; readonly goldBefore: number; readonly goldAfter: number;
  readonly xpAwarded: number; readonly levelBefore: number; readonly levelAfter: number;
  readonly xpBefore: number; readonly xpAfter: number; readonly hpBefore: number; readonly hpAfter: number;
  readonly baseDamage: number; readonly survivingEnemyCount: number; readonly playerDamage: number; readonly hpLost: number;
}
export interface MatchBase {
  readonly schemaVersion: 4; readonly rulesVersion: 'm4-v1'; readonly contentVersion: 'm4-slice-v1'; readonly contentDigest: string;
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
  | { readonly phase: 'preparation' | 'choice'; readonly combat: null }
  | { readonly phase: 'combat'; readonly combat: RunningCombat }
  | { readonly phase: 'settlement' | 'gameOver'; readonly combat: FinishedCombat }
);
export type MatchFailure = DeploymentFailure | CombatStartFailure | 'wrong-phase' | 'invalid-slot' | 'stale-shop'
  | 'purchased-slot' | 'insufficient-gold' | 'bench-full' | 'stale-round' | 'unsettled-round' | 'max-level' | 'population-cap' | 'unknown-item' | 'item-not-inventory' | 'invalid-recipe' | 'item-slot-occupied'
  | 'stale-choice' | 'invalid-choice' | 'invalid-target';
export type MatchCommandResult = { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: MatchFailure };
export interface MatchStep { readonly state: MatchState; readonly events: readonly MatchEvent[] }
export interface ProgressionResult { readonly level: number; readonly xp: number; readonly xpRequested: number; readonly xpApplied: number; readonly levelsGained: number }
export type PurchasePlanResult = { readonly ok: true; readonly preparation: GameState; readonly events: readonly UnitUpgradedEvent[] }
  | { readonly ok: false; readonly reason: 'bench-full' };
