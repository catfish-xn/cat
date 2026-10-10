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
