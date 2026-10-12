import type { Unit } from './unit-types';
import type { CombatState, LedgerCombatEvent } from './combat-types';
import type { GameState } from './game';
import type { MatchBase, PersistentGrowth } from './match-types';
import type { StrategySnapshot, ItemInstance, OwnedAugment, AnomalyBinding } from './strategy-types';
import type { TemporaryEquipment } from './m8/contracts';

export const PLAYER_BATTLE_SNAPSHOT_VERSION = 'two-sided-snapshot-v1';
export const TWO_SIDED_BATTLE_VERSION = 'two-sided-battle-v1';
/** Server-private frozen assets. No economy, shop, random stream or resolved combat numbers. */
export interface PlayerBattleSnapshot {
  readonly version: typeof PLAYER_BATTLE_SNAPSHOT_VERSION;
  readonly contentDigest: string;
  readonly seatId: string;
  readonly roundId: string;
  readonly level: number;
  readonly units: readonly Unit[];
  readonly items: readonly ItemInstance[];
  readonly temporaryEquipment: readonly TemporaryEquipment[];
  readonly augments: readonly OwnedAugment[];
  readonly anomalyBinding: AnomalyBinding | null;
  readonly persistentGrowth: readonly PersistentGrowth[];
  readonly augmentProgress: MatchBase['augmentProgress'];
}
export interface BattleIdentity { readonly battleId: string }
export interface BattleIdMapping {
  readonly seatId: string;
  readonly kind: 'unit' | 'item' | 'temporary-item' | 'augment' | 'anomaly';
  readonly originalId: string;
  readonly combatId: string;
}
/** Rules input; deliberately distinct from B1's scheduling envelope named BattleInput. */
export interface BattleInput {
  readonly version: typeof TWO_SIDED_BATTLE_VERSION;
  readonly battleId: string;
  readonly battleSeed: number;
  readonly a: PlayerBattleSnapshot;
  readonly b: PlayerBattleSnapshot;
  readonly mapping: readonly BattleIdMapping[];
  readonly preparation: GameState;
  readonly strategy: StrategySnapshot;
}
export interface BattleSurvivor {
  readonly unitId: string;
  readonly definitionId: string;
  readonly starLevel: Unit['starLevel'];
  readonly hp: number;
}
export interface BattleSideResult {
  readonly seatId: string;
  readonly survivors: readonly BattleSurvivor[];
  /** New delta from this combat, not the accumulated pre-battle growth. */
  readonly growth: readonly PersistentGrowth[];
}
export interface BattleResult {
  readonly version: typeof TWO_SIDED_BATTLE_VERSION;
  readonly battleId: string;
  readonly roundId: string;
  readonly battleSeed: number;
  readonly winnerSeatId: string | null;
  readonly a: BattleSideResult;
  readonly b: BattleSideResult;
  readonly mapping: readonly BattleIdMapping[];
  readonly initial: CombatState;
  readonly terminal: CombatState;
  readonly events: readonly LedgerCombatEvent[];
}
export interface SideProposal {
  readonly battleId: string;
  readonly roundId: string;
  readonly seatId: string;
  readonly result: 'win' | 'loss' | 'draw';
  readonly baseDamage: number;
  readonly opposingSurvivors: number;
  /** Unclamped requested damage; does not read/write any HP or receipt. */
  readonly damage: number;
  readonly growth: readonly PersistentGrowth[];
  /** One shared complete ledger in combat IDs; use mapping for ownership. */
  readonly events: readonly LedgerCombatEvent[];
}
export type BattleFailure = 'snapshot-version' | 'content-digest' | 'invalid-snapshot' | 'wrong-phase'
  | 'seat-collision' | 'round-mismatch' | 'round-kind' | 'invalid-seed' | 'invalid-battle-id'
  | 'battle-input' | 'invalid-budget' | 'step-limit-exceeded' | 'invalid-result';
export class BattleValidationError extends RangeError {
  constructor(readonly reason: BattleFailure) { super(reason); this.name = 'BattleValidationError'; }
}
