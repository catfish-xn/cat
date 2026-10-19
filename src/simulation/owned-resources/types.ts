import type { GameState } from '../game';
import type { MatchState } from '../match-types';
import type { SharedPoolState } from '../shared-pool-types';
import type { AnomalyBinding, ItemInstance } from '../strategy-types';
import type { PersistentGrowth } from '../match-types';
import type { CostTier, Unit, UnitLocation } from '../unit-types';

/** Mechanism input only: content selection must independently authenticate these grants. */
export interface OwnershipGrant {
  readonly id: string;
  readonly seatId: string;
  readonly resources: readonly (
    | { readonly kind: 'unit'; readonly definitionId: string }
    | { readonly kind: 'item'; readonly definitionId: string }
    | { readonly kind: 'duplicator'; readonly maxCost: CostTier }
  )[];
}
export interface OwnershipAuthority { readonly grants: readonly OwnershipGrant[] }
/** Trusted boundary supplied by the caller, never read from a candidate save. */
export interface OwnershipBoundary {
  readonly pool: SharedPoolState;
  readonly states: readonly MatchState[];
  readonly lastSettledRoundId: string | null;
}
export interface OwnedDuplicator { readonly id: string; readonly maxCost: CostTier }
export interface OwnershipSeat {
  readonly seatId: string;
  readonly preparation: GameState;
  readonly items: readonly ItemInstance[];
  readonly duplicators: readonly OwnedDuplicator[];
  readonly nextUnitSerial: number;
  readonly nextItemSerial: number;
  readonly nextDuplicatorSerial: number;
  readonly deploymentCap: number;
  readonly gold: number;
  readonly anomalyBinding: AnomalyBinding | null;
  readonly persistentGrowth: readonly PersistentGrowth[];
}
export type HeldResource = {
  readonly id: string;
  readonly seatId: string;
  readonly source: string;
  readonly boundRound: number;
  readonly returnRound: number;
} & (
  | { readonly kind: 'unit'; readonly unit: Omit<Unit, 'location'>; readonly originLocation: UnitLocation | null; readonly items: readonly ItemInstance[] }
  | { readonly kind: 'item'; readonly item: ItemInstance }
  | { readonly kind: 'duplicator'; readonly duplicator: OwnedDuplicator }
);
export type FullSeatPolicy = 'hold' | 'reject';
export type OwnershipOperation =
  | { readonly kind: 'acquire'; readonly grantId: string; readonly full: FullSeatPolicy }
  | { readonly kind: 'hold-unit'; readonly seatId: string; readonly unitId: string; readonly rounds: number }
  | { readonly kind: 'claim'; readonly seatId: string; readonly holdingId: string; readonly full: FullSeatPolicy }
  | { readonly kind: 'hold-item'; readonly seatId: string; readonly itemId: string }
  | { readonly kind: 'hold-duplicator'; readonly seatId: string; readonly duplicatorId: string }
  | { readonly kind: 'duplicate'; readonly seatId: string; readonly duplicatorId: string; readonly unitId: string; readonly full: FullSeatPolicy }
  | { readonly kind: 'sell'; readonly seatId: string; readonly unitId: string }
  | { readonly kind: 'merge-live'; readonly seatId: string }
  | { readonly kind: 'equip'; readonly seatId: string; readonly itemId: string; readonly unitId: string; readonly slot: number }
  | { readonly kind: 'deploy'; readonly seatId: string; readonly unitId: string; readonly location: UnitLocation }
  /** Q3: every actual catalog/OT settlement, including carousel; exactly the next ordinal. */
  | { readonly kind: 'settle'; readonly roundId: string };
export interface OwnershipTransaction { readonly id: string; readonly operations: readonly OwnershipOperation[] }
export interface OwnershipState {
  readonly pool: SharedPoolState;
  readonly seats: readonly OwnershipSeat[];
  readonly held: readonly HeldResource[];
  readonly settledOrdinal: number;
  readonly acquiredGrantIds: readonly string[];
  /** Accepted facts are the sole source of ownership/ID/use/return receipts. */
  readonly transactions: readonly OwnershipTransaction[];
}
export type OwnershipFailure = 'invalid-state' | 'invalid-transaction' | 'receipt-conflict' | 'unauthorized-grant'
  | 'already-acquired' | 'unknown-seat' | 'unknown-unit' | 'unknown-item' | 'unknown-duplicator'
  | 'unknown-holding' | 'not-inventory' | 'not-returnable' | 'invalid-round' | 'full-seat' | 'pool-empty'
  | 'invalid-target' | 'invalid-location';
export interface OwnershipEvent {
  readonly type: 'ownershipCommitted';
  readonly transactionId: string;
}
export type OwnershipResult = { readonly ok: true; readonly state: OwnershipState; readonly events: readonly OwnershipEvent[] }
  | { readonly ok: false; readonly state: OwnershipState; readonly reason: OwnershipFailure };
