import type { DropIdentity, DropState, EncounterPlan, RngStream } from './m8/contracts';

/** Immutable descriptor, separate from concrete LootPayload. No permanent item identity. */
export interface LootChoiceDescriptor extends DropIdentity {
  readonly sourceUnitId: string;
  readonly slotOrdinal: number;
  readonly kind: 'component-choice';
  readonly poolVersion: 'm8b-components-v1';
  readonly terminalFallbackDefinitionId: string;
  readonly revealCondition: 'source-killed';
  readonly quantity: 1;
}
export type FrozenDirectDrop = Extract<DropState, { readonly status:'planned' }> & {
  readonly sourceUnitId: string; readonly slotOrdinal: number; readonly revealCondition:'source-killed';
};
export interface FrozenLootRound {
  readonly encounterPlan: EncounterPlan & { readonly drops: readonly FrozenDirectDrop[] };
  readonly choices: readonly LootChoiceDescriptor[];
}
/** Checkpoint① persistence format, not a Match save or an enabled award ledger.
 * One authoritative frozen plan per entered PvE. Never copy these into a second writable plan.
 */
export interface FrozenLootLedger {
  readonly version: 'm8-b8-loot-freeze-v1';
  readonly seed: number;
  readonly replayDigest: string;
  readonly throughRoundOrdinal: number;
  readonly rng: RngStream;
  readonly rounds: readonly FrozenLootRound[];
}
/** Runtime status and resolution belong to the independent ledger introduced in checkpoint②.
 * Component identity is read from receipt.payload, never duplicated here.
 */
export interface LootChoiceEligibility { readonly dropId:string; readonly status:'planned'|'revealed'|'forfeited' }
export interface LootChoiceResolution { readonly dropId:string; readonly receiptId:string; readonly method:'player-choice'|'terminal-fallback' }

/** Runtime progress references the sole immutable plan; payloads are never copied here. */
export type DirectLootProgress = { readonly dropId: string } & (
  | { readonly status: 'planned' | 'revealed' | 'pending-capacity' | 'retained-terminal' | 'forfeited'; readonly receiptId: null }
  | { readonly status: 'granted'; readonly receiptId: string }
);
export interface LootEarnedEvidence {
  readonly dropId: string;
  readonly death: { readonly combatId: string; readonly tick: number; readonly eventSeq: number };
}
export interface MatchLootState {
  readonly frozen: FrozenLootLedger;
  readonly direct: readonly DirectLootProgress[];
  readonly choiceEligibility: readonly LootChoiceEligibility[];
  readonly choiceResolutions: readonly LootChoiceResolution[];
  readonly earnedEvidence: readonly LootEarnedEvidence[];
  readonly receipts: readonly import('./m8/contracts').LootReceipt[];
  readonly guaranteeCounters: Readonly<Record<string, number>>;
}
export type LootMatchEvent =
  | { readonly type: 'lootRevealed'; readonly dropId: string; readonly death: LootEarnedEvidence['death'] }
  | { readonly type: 'lootForfeited'; readonly dropId: string }
  | { readonly type: 'lootGranted'; readonly receipt: import('./m8/contracts').LootReceipt }
  | { readonly type: 'lootChoiceResolved'; readonly dropId: string; readonly receiptId: string; readonly method: LootChoiceResolution['method'] };
