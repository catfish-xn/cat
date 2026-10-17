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
  readonly playerHp?:number;
  readonly g23?:import('./g2-3-match-progress').G23MatchProgress;
  /** Emissary history from the seat's own settled ledger (1..7); omitted when zero. */
  readonly priorPvpWins?: number;
  /** G2-4a: team size from crowns held by bench units, which the board-only snapshot omits; omitted when zero. */
  readonly benchTeamSizeBonus?: number;
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
export interface BattleIdentity {
  readonly battleId: string;
  /** When present, B is a frozen copy of this seat, not a settlement participant. */
  readonly mirrorOfSeatId?: string;
}
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
  readonly mirrorOfSeatId: string | null;
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
  /** New delta from this combat, not accumulated growth. Always empty for a mirror. */
  readonly growth: readonly PersistentGrowth[];
}
export interface BattleResult {
  readonly version: typeof TWO_SIDED_BATTLE_VERSION;
  readonly battleId: string;
  readonly roundId: string;
  readonly battleSeed: number;
  readonly mirrorOfSeatId: string | null;
  readonly winnerSeatId: string | null;
  readonly a: BattleSideResult;
  readonly b: BattleSideResult;
  readonly mapping: readonly BattleIdMapping[];
  readonly initial: CombatState;
  readonly terminal: CombatState;
  readonly events: readonly LedgerCombatEvent[];
}
export interface SideProposal {
  readonly g23Facts?:import('./g2-3-economy').G23BattleFacts;
  readonly battleId: string;
  readonly roundId: string;
  readonly seatId: string;
  /** False for a mirror: no HP, income, XP, growth, reward or receipt may be committed. */
  readonly settlementEligible: boolean;
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
  | 'invalid-mirror' | 'battle-input' | 'invalid-budget' | 'step-limit-exceeded' | 'invalid-result';
export class BattleValidationError extends RangeError {
  constructor(readonly reason: BattleFailure) { super(reason); this.name = 'BattleValidationError'; }
}
