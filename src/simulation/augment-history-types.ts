import type { MatchState } from './match-types';
import type { Unit } from './unit-types';
import type { AnomalyBinding, ItemInstance } from './strategy-types';
import type { CarouselReceipt } from './carousel-types';
import type { CombatItemGrant, CombatOrigin } from './combat-types';

export const AUGMENT_HISTORY_VERSION = 'augment-history-v1' as const;
export const AUGMENT_HISTORY_LIMITS = { rounds: 256, facts: 65536, commands: 16384, steps: 256 * 900,
  seats: 8, units: 128, deaths: 128 * 901, bytes: 16 * 1024 * 1024, preparationMs: 600000 } as const;
export interface HistoryRoster { readonly units: readonly Unit[]; readonly items: readonly ItemInstance[] }
export interface HistorySeat extends HistoryRoster {
  readonly seatId: string; readonly index: number; readonly hp: number; readonly alive: boolean;
  /** Current full-table position (1..8), including eliminated seats. */
  readonly rank: number; readonly eliminatedRound: number | null;
}
export interface AugmentTakedownActor { readonly unitId: string; readonly definitionId: string; readonly team: 'player' | 'enemy'; readonly eligible: boolean }
export interface AugmentDeath {
  /** A summoned champion identity (distinct from ordinaryHero, which existing consumers retain). */
  readonly championCopy?: true;
  /** Frozen form at this actual death; absent for champions without a form. */
  readonly form?: import('./seat-mechanics/types').UnitForm;
  readonly combatId: string; readonly eventSeq: number; readonly tick: number; readonly unitId: string;
  readonly definitionId: string; readonly team: 'player' | 'enemy'; readonly ownerSeatId: string | null; readonly originalUnitId: string; readonly ordinaryHero: boolean;
  readonly equipment: readonly { readonly definitionId: string; readonly slot: number; readonly temporary: boolean }[];
  /** Chest-generated combat items have no equipment slot; retain their real source/ordinal/tick. */
  readonly combatItemGrants: readonly CombatItemGrant[];
  /** Present only when a history owner requires killing-source attribution. */
  readonly killer?: CombatOrigin | null;
  readonly takedowns?: readonly AugmentTakedownActor[];
}
export interface AugmentGrowth {
  readonly unitId: string; readonly healthFlat: number; readonly healthBps: number;
  readonly attackDamageBps: number; readonly abilityPowerCenti: number;
}
export type PreviousAugmentBattle = { readonly status: 'unavailable' | 'none' } | { readonly status: 'recorded'; readonly round: number; readonly roundId: string; readonly battleId: string; readonly roster: HistoryRoster };
export type AugmentItemTransform = {
  readonly kind: 'augment-item-transform'; readonly choiceId: string; readonly receiptId: string;
  readonly input: ItemInstance; readonly outputs: readonly ItemInstance[];
};
export type AugmentFactData =
  | { readonly kind: 'offer-level'; readonly choiceId: string; readonly generation: number; readonly level: number; readonly xp: number }
  | AugmentItemTransform
  | { readonly kind: 'inventory-transform-entry'; readonly choiceId: string; readonly itemIds: readonly string[] }
  | { readonly kind: 'settled-combat'; readonly settlementId: string; readonly roundKind: 'pve'|'pvp' }
  | { readonly kind:'anomaly-copy-kills'; readonly battleId:string; readonly itemId:string; readonly unitId:string; readonly kills:readonly {readonly eventSeq:number;readonly victimId:string}[] }
  | { readonly kind: 'orb-opened'; readonly choiceId: string; readonly orbId: string; readonly tier: 'prismatic' }
  | { readonly kind: 'acquire'; readonly choiceId: string; readonly definitionId: string; readonly goldBefore: number; readonly hpBefore: number; readonly roster: HistoryRoster; readonly previousBattle: PreviousAugmentBattle; readonly preparationElapsedMs: number }
  | { readonly kind: 'trait-activation'; readonly choiceId: string; readonly roster: HistoryRoster }
  | { readonly kind: 'round-entry'; readonly roster: HistoryRoster }
  | { readonly kind: 'positions'; readonly roster: HistoryRoster }
  | { readonly kind: 'combat-roster'; readonly battleId: string; readonly roster: HistoryRoster }
  | { readonly kind: 'combat-binding'; readonly battleId: string; readonly binding: AnomalyBinding | null }
  | { readonly kind: 'pvp-roster'; readonly battleId: string; readonly seats: readonly HistorySeat[]; readonly mirrorOfSeatId: string | null }
  | { readonly kind: 'table'; readonly stage: 'acquire' | 'entry' | 'settlement'; readonly seats: readonly HistorySeat[] }
  | { readonly kind: 'deaths'; readonly battleId: string; readonly completeThroughTick: number; readonly deaths: readonly AugmentDeath[] }
  | { readonly kind: 'player-damage'; readonly battleId: string; readonly opponentSeatId: string | null; readonly mirror: boolean; readonly hpBefore: number | null; readonly hpAfterDamage: number | null; readonly actualDamage: number | null }
  | { readonly kind: 'carousel'; readonly receipt: CarouselReceipt; readonly source: 'manual' | 'bot' | 'timeout' | 'disconnected' | 'augment'; readonly choiceId: string | null; readonly ordinal: number; readonly roster: HistoryRoster; readonly releaseAtMs: number; readonly eligibilityChoiceIds: readonly string[] }
  | { readonly kind: 'preparation-time'; readonly elapsedMs: number }
  | { readonly kind: 'player-health'; readonly choiceId: string; readonly receiptId: string; readonly hpBefore: number; readonly hpAfter: number; readonly maxHpBefore: number; readonly maxHpAfter: number }
  | { readonly kind: 'summon-growth'; readonly choiceId: string; readonly receiptId: string; readonly definitionId: 'g23-sion'; readonly stacks: number; readonly healthFlat: number; readonly attackDamageBps: number }
  | { readonly kind: 'growth'; readonly choiceId: string; readonly receiptId: string; readonly deltas: readonly AugmentGrowth[] };
export type AugmentHistoryFact = AugmentFactData & {
  readonly sequence: number; readonly seatId: string; readonly round: number; readonly roundId: string; readonly resourcePrefix: number;
};
export interface HistoryCommand { readonly name: string; readonly args: readonly unknown[]; readonly count: number }
export type AugmentHistoryProof = { readonly kind: 'server' } | {
  readonly kind: 'solo';
  /** A validated legacy checkpoint with no history owner; never a recursive history. */
  readonly origin: MatchState; readonly commands: readonly HistoryCommand[];
};
export interface AugmentHistory {
  readonly version: typeof AUGMENT_HISTORY_VERSION; readonly seatId: string;
  readonly facts: readonly AugmentHistoryFact[]; readonly proof: AugmentHistoryProof;
}
