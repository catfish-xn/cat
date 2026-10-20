import type { OwnershipAuthority, OwnershipBoundary, OwnershipOperation, OwnershipState, OwnershipFailure } from '../owned-resources';

export type D14AnomalyId = 'ultimate-hero' | 'into-the-unknown';
/** Authenticated choice facts supplied independently of a candidate save, at a settled boundary. */
export interface D14Selection {
  readonly choiceId: string;
  readonly seatId: string;
  readonly unitId: string;
  readonly anomalyId: D14AnomalyId;
  readonly atOrdinal: number;
}
export interface D14Authority {
  readonly ownership: OwnershipAuthority;
  readonly selections: readonly D14Selection[];
}
export type D14Boundary = OwnershipBoundary;
export type D14ResourceOperation = Exclude<OwnershipOperation,
  { readonly kind: 'settle' | 'hold-unit' | 'hold-item' | 'hold-duplicator' }>;
export type D14Command = { readonly id: string } & (
  | { readonly kind: 'select'; readonly selection: D14Selection }
  | { readonly kind: 'settle'; readonly roundId: string }
  | { readonly kind: 'resources'; readonly operations: readonly D14ResourceOperation[] }
);
export interface D14Record {
  readonly selection: D14Selection;
  /** Current bound identity after a normal upgrade, never a newly allocated replacement. */
  readonly unitId: string;
  readonly dueOrdinal: number;
  readonly phase: 'waiting' | 'promoted' | 'absent' | 'returned' | 'retired';
}
export interface D14State {
  readonly activation: 'unwired-d14';
  readonly ownership: OwnershipState;
  readonly records: readonly D14Record[];
  readonly commands: readonly D14Command[];
}
export interface D14Event {
  readonly type: 'd14Selected' | 'd14Promoted' | 'd14Returned' | 'd14Retired' | 'ownershipCommitted';
  readonly receiptId: string;
  readonly unitId: string | null;
}
export type D14Failure = OwnershipFailure | 'unauthorized-choice' | 'unsupported-operation';
export type D14Result = { readonly ok: true; readonly state: D14State; readonly events: readonly D14Event[] }
  | { readonly ok: false; readonly state: D14State; readonly reason: D14Failure };
