import type { CombatEvent, CombatResult, CombatStartFailure, CombatState } from './combat';
import type { DeploymentFailure, GameState } from './game';

export type ShopSlot = { readonly status: 'available'; readonly definitionId: string } | { readonly status: 'purchased' };
export interface Shop { readonly generation: number; readonly slots: readonly ShopSlot[] }
export interface RoundResult {
  readonly round: number;
  readonly result: CombatResult;
  readonly combatTicks: number;
  readonly income: number;
  readonly goldBefore: number;
  readonly goldAfter: number;
}
export interface MatchBase {
  readonly seed: number;
  readonly rngState: number;
  readonly round: number;
  readonly gold: number;
  readonly shop: Shop;
  readonly nextUnitSerial: number;
  readonly preparation: GameState;
  readonly roundResults: readonly RoundResult[];
}
export type RunningCombat = CombatState & { readonly status: 'running'; readonly result: null };
export type FinishedCombat = CombatState & { readonly status: 'finished'; readonly result: CombatResult };
export type MatchState = MatchBase & (
  | { readonly phase: 'preparation'; readonly combat: null }
  | { readonly phase: 'combat'; readonly combat: RunningCombat }
  | { readonly phase: 'settlement'; readonly combat: FinishedCombat }
);
export type MatchFailure = DeploymentFailure | CombatStartFailure | 'wrong-phase' | 'invalid-slot' | 'stale-shop'
  | 'purchased-slot' | 'insufficient-gold' | 'bench-full' | 'stale-round' | 'unsettled-round';
export type MatchCommandResult = { readonly ok: true; readonly state: MatchState }
  | { readonly ok: false; readonly state: MatchState; readonly reason: MatchFailure };
export interface MatchStep { readonly state: MatchState; readonly events: readonly CombatEvent[] }
