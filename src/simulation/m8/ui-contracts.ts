/** Frozen B2 query signatures, not available runtime exports until B3–B9. */
import type { HexCell } from '../board';
import type { DamageType, DropIdentity, LootPayload, M8Version, RoundDefinition, Source, StatusGroup, TemporaryEquipment } from './contracts';
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
  readonly units: readonly { readonly unitId: string; readonly definitionId: string; readonly name: string; readonly starLevel: 1 | 2 | 3; readonly cell: HexCell; readonly stats: Readonly<Record<'maxHp' | 'attackDamage' | 'armor' | 'magicResist', number>>; readonly abilityDescription: string }[];
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
  readonly reason: 'pending-capacity' | 'unsettled-round' | 'game-over' | null;
}
export type CompatibilityView =
  | { readonly status: 'current'; readonly currentRulesVersion: M8Version['rulesVersion']; readonly fileRulesVersion: M8Version['rulesVersion']; readonly canResume: true; readonly canReplay: true; readonly canExportOriginal: true; readonly reason: null }
  | { readonly status: 'legacy-preserved'; readonly currentRulesVersion: M8Version['rulesVersion']; readonly fileRulesVersion: 'm5-14.24b-v1'; readonly canResume: false; readonly canReplay: false; readonly canExportOriginal: true; readonly reason: 'new-match-required' }
  | { readonly status: 'rejected'; readonly currentRulesVersion: M8Version['rulesVersion']; readonly fileRulesVersion: string | null; readonly canResume: false; readonly canReplay: false; readonly canExportOriginal: boolean; readonly reason: 'unsupported-version' | 'digest-mismatch' | 'invalid-data' | 'capacity-exceeded' };
export interface CombatStatsView {
  readonly nextEventSeq: number;
  readonly units: readonly { readonly unitId: string; readonly hpDamage: Readonly<Record<DamageType, number>>; readonly shieldAbsorbed: number; readonly healing: number; readonly overheal: number; readonly bySource: readonly { readonly source: Source; readonly hpDamage: number; readonly healing: number }[] }[];
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
  readCombatStatuses(state: Readonly<Combat>): readonly StatusGroup[];
}
