/** B2 v3 audit revision, pending re-review; query signatures, not available runtime exports until B3–B9. */
import type { HexCell } from '../board';
import type { MonsterFamily } from '../content/neutrals';
import type { CombatActivity, DamageType, DropIdentity, LootPayload, M8Version, RoundDefinition, Source, StatusGroup, TemporaryEquipment } from './contracts';
export type EquipmentFailure = 'wrong-phase' | 'unknown-item' | 'unknown-unit' | 'same-item'
  | 'item-not-inventory' | 'invalid-recipe' | 'invalid-slot' | 'item-slot-occupied'
  | 'unique-conflict' | 'exclusive-slots' | 'temporary-item';
export interface ItemCatalogEntry {
  readonly id: string;
  readonly apiName: string;
  readonly name: string;
  readonly localizationStatus: 'temporary-unverified' | 'verified';
  readonly kind: 'component' | 'completed';
  readonly recipe: readonly [string, string] | null;
  readonly effectDescriptions: readonly string[];
  readonly unique: boolean;
  readonly slotCost: 1 | 3;
  readonly referencePatch: '14.24b';
  readonly contentVersion: M8Version['contentVersion'];
  readonly evidenceStatus: 'source-reviewed' | 'approved-provisional';
  readonly conventionIds: readonly string[];
}
export type CombinePreview =
  | { readonly allowed: true; readonly reason: null; readonly resultDefinitionId: string; readonly consumedItemIds: readonly [string, string] }
  | { readonly allowed: false; readonly reason: EquipmentFailure };
export type EquipPreview =
  | { readonly allowed: true; readonly reason: null; readonly occupiedSlots: readonly (0 | 1 | 2)[]; readonly conflictingItemIds: readonly [] }
  | { readonly allowed: false; readonly reason: EquipmentFailure; readonly conflictingItemIds: readonly string[] };
export interface UnitEquipmentView {
  readonly unitId: string;
  readonly slots: readonly { readonly slot: 0 | 1 | 2; readonly itemInstanceId: string | null; readonly reservedByItemInstanceId: string | null }[];
  readonly temporaryItems: readonly TemporaryEquipment[];
}
export interface EncounterPreview {
  readonly encounterId: string;
  readonly units: readonly { readonly unitId: string; readonly definitionId: string; readonly name: string; readonly starLevel: 1 | 2 | 3; readonly cell: HexCell; readonly unitKind: 'champion' | 'neutral'; readonly monsterFamily: MonsterFamily | null; readonly stats: Readonly<Record<'maxHp' | 'attackDamage' | 'armor' | 'magicResist' | 'attackRange' | 'attackIntervalTicks' | 'critChanceBps' | 'critMultiplierBps' | 'abilityPower' | 'mana' | 'maxMana', number>>; readonly abilityDescription: string }[];
  readonly rulesNote: string;
}
export type RevealedDropView = DropIdentity & { readonly payload: LootPayload } & (
  | { readonly status: 'granted'; readonly receiptId: string; readonly allowedActions: readonly [] }
  | { readonly status: 'revealed' | 'pending-capacity'; readonly receiptId: null; readonly allowedActions: readonly []; readonly reason: 'auto-grant-in-domain' | 'bench-full' }
  | { readonly status: 'retained-terminal'; readonly receiptId: null; readonly allowedActions: readonly []; readonly reason: 'terminal-bench-full' }
);
export interface LootView {
  readonly roundId: string;
  readonly revealedDrops: readonly RevealedDropView[];
  readonly pendingClaims: readonly string[];
  readonly canContinue: boolean;
  /** 'pending-choice' (approved addendum 2026-10-10): an earned, unresolved loot pick blocks Continue. */
  readonly reason: 'pending-capacity' | 'pending-choice' | 'unsettled-round' | 'game-over' | null;
  /** Approved addendum 2026-10-10: identity of the loot pick that is the current PendingChoice, else null.
   * Identity only; candidates stay in PendingChoice.offers and the fallback is never exposed. */
  readonly pendingChoice: (DropIdentity & { readonly choiceId: string; readonly generation: number }) | null;
}
export type CompatibilityView =
  | { readonly status: 'current'; readonly currentRulesVersion: M8Version['rulesVersion']; readonly fileRulesVersion: M8Version['rulesVersion']; readonly canResume: true; readonly canReplay: true; readonly canExportOriginal: true; readonly reason: null }
  | { readonly status: 'legacy-preserved'; readonly currentRulesVersion: M8Version['rulesVersion']; readonly fileRulesVersion: 'm5-14.24b-v1'; readonly canResume: false; readonly canReplay: false; readonly canExportOriginal: true; readonly reason: 'new-match-required' }
  | { readonly status: 'rejected'; readonly currentRulesVersion: M8Version['rulesVersion']; readonly fileRulesVersion: string | null; readonly canResume: false; readonly canReplay: false; readonly canExportOriginal: boolean; readonly reason: 'unsupported-version' | 'digest-mismatch' | 'invalid-data' | 'capacity-exceeded' };
/** R3: domain-resolved current effects; UI never evaluates AbilityPlan. */
export interface CombatStatusesView {
  readonly statuses: readonly StatusGroup[];
  readonly activities: readonly Extract<CombatActivity, { lifecycle: 'active' }>[];
}
export interface CombatStatsView {
  readonly nextEventSeq: number;
  readonly units: readonly { readonly unitId: string; readonly hpDamage: Readonly<Record<DamageType, number>>; readonly shieldAbsorbed: number; readonly healing: number; readonly overheal: number; readonly bySource: readonly { readonly source: Source; readonly hpDamage: number; readonly healing: number; readonly requestedHealing: number; readonly preventedByWound: number; readonly overheal: number }[] }[];
}
/** State is the validated future M8 Match/Combat, never a UI-owned reconstructed state. */
export interface M8Queries<Match, Combat, File> {
  readItemCatalog(): readonly ItemCatalogEntry[];
  previewCombine(state: Readonly<Match>, aId: string, bId: string): CombinePreview;
  previewEquip(state: Readonly<Match>, itemId: string, unitId: string, slot: number): EquipPreview;
  readUnitEquipment(state: Readonly<Match>, unitId: string): UnitEquipmentView | null;
  readRoundInfo(state: Readonly<Match>): RoundDefinition;
  readEncounterPreview(state: Readonly<Match>): EncounterPreview | null;
  readLootView(state: Readonly<Match>): LootView;
  readCompatibility(file: Readonly<File>): CompatibilityView;
  readCombatStats(state: Readonly<Combat>): CombatStatsView;
  readCombatStatuses(state: Readonly<Combat>): CombatStatusesView;
}


/** A13: this boundary belongs to B9 storage, never to Match or a UI DB reader. */
export interface LegacyRecordRef {
  readonly namespace: 'hex-autobattler-m6';
  readonly runId: string;
  readonly fingerprint: string;
}
export interface LegacyRecord {
  readonly recordRef: LegacyRecordRef;
  readonly location: 'active' | 'history';
  /** Informational only: old historical records did not retain the active-slot token. */
  readonly activeSlotRevision: number | null;
  readonly createdAt: string;
  readonly rulesVersion: 'm5-14.24b-v1';
  readonly schemaVersion: 5;
  readonly saveFormatVersion: 1;
  readonly replayFormatVersion: 1;
  readonly canExportOriginal: boolean;
  readonly reason: 'invalid-record' | 'missing-history' | null;
}
export type LegacyListResult =
  | { readonly ok: true; readonly records: readonly LegacyRecord[] }
  | { readonly ok: false; readonly namespace: 'hex-autobattler-m6'; readonly reason: 'unavailable' | 'read-failed' };
export interface LegacyExportRequest { readonly requestId: string; readonly recordRef: LegacyRecordRef }
export type LegacyExportResult = LegacyExportRequest & (
  | { readonly ok: true; readonly fileName: string; readonly mediaType: 'application/json'; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly reason: 'not-found' | 'stale-reference' | 'invalid-record' | 'missing-history' | 'unavailable' | 'read-failed' }
);
export interface LegacyRecordAccess {
  listLegacyRecords(): Promise<LegacyListResult>;
  exportLegacy(request: LegacyExportRequest): Promise<LegacyExportResult>;
}
export interface M8SaveControlsCallbacks {
  onExportCurrent(): Promise<void>;
  onExportLegacy(request: LegacyExportRequest): Promise<LegacyExportResult>;
}
