/** B2 design contracts only. No runtime imports, reducers, or production activation. */
import type { CombatEventData, CombatOrigin } from '../combat-types';
import type { HexCell } from '../board';

/** All numbers must be finite safe integers; Bps denominator=10000, Tick=50ms. */
export type Bps = number;
export type Tick = number;
export type Duration = { readonly kind: 'ticks'; readonly ticks: Tick } | { readonly kind: 'combat' };
export type Source = CombatOrigin & { readonly parentItemInstanceId: string | null };
export interface EffectIdentity {
  /** Canonical JSON tuple [combatId,sourceKind,instanceId,effectIndex,targetId]. */
  readonly key: string;
  readonly source: Source;
  readonly targetId: string;
}
export type StackPolicy =
  | { readonly kind: 'refresh-same-instance'; readonly magnitude: 'replace' | 'max'; readonly phase: 'preserve' }
  | { readonly kind: 'independent-instances' }
  | { readonly kind: 'strongest-category'; readonly category: StatusKind; readonly retainSuppressed: true }
  | { readonly kind: 'add-stacks'; readonly cap: number | null };
export interface EffectRuntime extends EffectIdentity {
  readonly startsAtTick: Tick;
  readonly expiresAtTick: Tick | null;
  readonly stacks: number;
  readonly triggerCount: number;
  readonly nextEligibleTick: Tick;
  readonly consumed: boolean;
  readonly stackPolicy: StackPolicy;
}
export type Stat = 'maxHp' | 'attackDamage' | 'abilityPower' | 'armor' | 'magicResist'
  | 'attackSpeed' | 'critChance' | 'critMultiplier' | 'damageAmp' | 'damageReduction' | 'omnivamp';
export type Condition =
  | { readonly kind: 'always' }
  | { readonly kind: 'hp-ratio'; readonly subject: 'holder' | 'target'; readonly op: 'gt' | 'lt' | 'lte'; readonly thresholdBps: Bps }
  | { readonly kind: 'target-max-hp'; readonly op: 'gt'; readonly hp: number }
  | { readonly kind: 'starting-rows'; readonly rows: 'front-two' | 'back-two' }
  | { readonly kind: 'enemy-targeting-holder' };
export interface StatModifier {
  readonly stat: Stat;
  readonly unit: 'flat' | 'bps';
  readonly amount: number;
  readonly condition: Condition;
}
export interface Amount {
  readonly flat: number;
  readonly attackDamageBps: Bps;
  readonly abilityPowerBps: Bps;
  readonly maxHpBps: Bps;
  readonly missingHpBps: Bps;
  /** Read the completed cast receipt, before any refund. */
  readonly actualManaSpentBps: Bps;
  /** Read qualifying absorbed+hpDamage from the triggering outcome, not raw damage. */
  readonly actualDamageBps: Bps;
  readonly hpBasis: 'holder' | 'target';
  readonly sample: 'application' | 'each-pulse' | 'packet';
  readonly cap: number | null;
}
export type DamageType = 'physical' | 'magic' | 'true';
/** Origin is provenance; delivery is proc eligibility. They are not interchangeable. */
export type DamageDelivery = 'basic-attack' | 'ability-direct' | 'ability-periodic'
  | 'attack-extra' | 'equipment-proc' | 'item-burn';
export type ProcPermission = 'apply-item-burn' | 'last-whisper' | 'defender-titan'
  | 'omnivamp' | 'gunblade-ally-heal' | 'guardbreaker' | 'incoming-basic-hit' | 'damage-mana';
export type CritEligibility = 'basic' | 'requires-spell-authorization' | 'never';
export interface DamageContext {
  readonly source: Source;
  readonly targetId: string;
  readonly damageType: DamageType;
  readonly delivery: DamageDelivery;
  readonly actionSeq: number;
  readonly rootActionSeq: number;
  readonly parentPacketId: string | null;
  readonly triggeringCastActionSeq: number | null;
  readonly packetId: string;
  readonly packetOrdinal: number;
  readonly equipmentDepth: 0 | 1;
  readonly redirected: boolean;
  readonly area: boolean;
  readonly critEligibility: CritEligibility;
  /** Derived by the rules matrix, validated on restore; not arbitrary caller grants. */
  readonly permissions: readonly ProcPermission[];
}
export interface DamageRequest { readonly context: DamageContext; readonly amount: Amount }
export interface DamageOutcome {
  readonly context: DamageContext;
  readonly hit: boolean;
  readonly raw: number;
  readonly prevented: number;
  readonly mitigated: number;
  readonly absorbed: number;
  readonly hpDamage: number;
  readonly overkill: number;
  readonly critical: boolean;
  readonly killingPacket: boolean;
}
export interface SpellCritAuthorization {
  readonly nonItemSources: readonly Source[];
  readonly itemSources: readonly Source[];
  readonly enabled: boolean;
  /** 1000 * redundant item authorizations; independent of equipment slot order. */
  readonly redundantItemBonusBps: Bps;
  readonly chanceBps: Bps;
  readonly multiplierBps: Bps;
}
export type StatusKind = 'burn' | 'wound' | 'sunder' | 'shred' | 'stun' | 'control-immunity'
  | 'untargetable' | 'damage-prevention' | 'stat-buff' | 'stat-debuff' | 'damage-reduction';
export interface StatusApplication {
  readonly kind: StatusKind;
  readonly magnitudeBps: Bps;
  readonly duration: Duration;
  readonly stackPolicy: StackPolicy;
  readonly removable: boolean;
  readonly polarity: 'beneficial' | 'harmful';
  /** Required for stat-buff/stat-debuff; forbidden for other kinds by validation. */
  readonly modifier?: StatModifier;
}
export interface StatusContribution extends EffectIdentity {
  readonly application: StatusApplication;
  readonly appliedAtTick: Tick;
  readonly expiresAtTick: Tick | null;
}
export interface StatusGroup {
  readonly targetId: string;
  readonly kind: StatusKind;
  readonly contributions: readonly StatusContribution[];
  readonly effectiveSourceKey: string | null;
  readonly effectiveMagnitudeBps: Bps;
  /** Burn category clock survives refresh/stronger source takeover. */
  readonly nextPulseAtTick: Tick | null;
}
export interface PeriodicTask extends EffectIdentity {
  readonly nextPulseAtTick: Tick;
  readonly periodTicks: Tick;
  readonly endsAtTick: Tick | null;
  readonly pulseOrdinal: number;
  readonly pulseLimit: number | null;
  readonly remainderNumerator: number;
  readonly remainderDenominator: number;
  readonly finalPulse: 'before-expiry' | 'none';
  readonly onSourceDeath: 'cancel' | 'persist-attached';
  readonly onTargetDeath: 'cancel';
  readonly effect: Effect;
}
export interface HealRequest {
  readonly source: Source;
  readonly targetId: string;
  readonly requested: number;
  readonly kind: 'direct' | 'omnivamp' | 'ally-vamp';
  readonly fromPacketId: string | null;
}
export interface HealOutcome extends HealRequest {
  readonly afterWound: number;
  readonly actual: number;
  readonly overheal: number;
  readonly preventedByWound: number;
}
export type ShieldEndReason = 'depleted' | 'expired' | 'death-cleanup' | 'replaced' | 'combat-end';
export interface ShieldState extends EffectIdentity {
  readonly granted: number;
  readonly remaining: number;
  readonly absorbed: number;
  readonly startsAtTick: Tick;
  readonly expiresAtTick: Tick;
  readonly endRewardConsumed: boolean;
}
export interface SurvivalSample {
  readonly unitId: string;
  readonly tick: Tick;
  readonly hpBeforeDamage: number;
  readonly hpAfterDamage: number;
  readonly maxHpBeforeThresholdEffects: number;
  readonly survivedDamageBatch: boolean;
  readonly receivedPositiveDamage: boolean;
}
export interface ManaState {
  readonly unitId: string;
  readonly current: number;
  readonly maximum: number;
  readonly lockedUntilTick: Tick;
}
export interface ManaRequest {
  readonly source: Source;
  readonly targetId: string;
  readonly amount: number;
  readonly reason: 'attack' | 'damage' | 'incoming-basic-hit' | 'periodic' | 'cast-refund' | 'kill';
  readonly bypassLock: 'none' | 'this-cast-refund';
  readonly castActionSeq: number | null;
}
export interface ManaOutcome extends ManaRequest {
  readonly before: number;
  readonly blocked: number;
  readonly applied: number;
  readonly overflow: number;
  readonly after: number;
}
export interface CastReceipt {
  readonly source: Source;
  readonly actionSeq: number;
  readonly completed: boolean;
  readonly actualManaSpent: number;
  readonly refundedMana: number;
  readonly completionCell: HexCell;
}
export type Trigger = 'combat-start' | 'attack-completed' | 'incoming-basic-hit' | 'cast-completed'
  | 'damage-dealt' | 'damage-taken' | 'shield-hit' | 'post-damage-survival' | 'shield-ended'
  | 'target-changed' | 'kill-or-assist' | 'periodic';
export interface TargetSelector {
  readonly relation: 'self' | 'ally' | 'enemy';
  readonly anchor: 'holder' | 'primary-target' | 'previous-target';
  readonly radius: number | null;
  readonly maxTargets: number;
  readonly excludeSelf: boolean;
  readonly excludePrimary: boolean;
  readonly distinct: boolean;
  readonly order: 'distance-id' | 'hp-ratio-id' | 'not-burned-by-this-instance-distance-id';
  readonly sample: 'combat-start' | 'action-completion' | 'each-tick' | 'each-pulse';
}
/** Finite declarative payloads; executors are B3–B5 work. */
export type Effect =
  | { readonly kind: 'modify-stat'; readonly modifier: StatModifier; readonly duration: Duration }
  | { readonly kind: 'damage'; readonly damageType: DamageType; readonly delivery: DamageDelivery; readonly amount: Amount; readonly critEligibility: CritEligibility }
  | { readonly kind: 'apply-status'; readonly status: StatusApplication }
  | { readonly kind: 'heal'; readonly amount: Amount }
  | { readonly kind: 'grant-shield'; readonly amount: Amount; readonly durationTicks: Tick; readonly onEnd: readonly ShieldEndReason[]; readonly endEffects: readonly Effect[] }
  | { readonly kind: 'grant-mana'; readonly amount: number; readonly reason: ManaRequest['reason']; readonly bypassLock: ManaRequest['bypassLock'] }
  | { readonly kind: 'change-max-hp'; readonly bonusBps: Bps; readonly currentHp: 'add-max-delta'; readonly countsAsHeal: false }
  | { readonly kind: 'authorize-spell-crit'; readonly duplicateBonusBps: 1000 }
  | { readonly kind: 'cleanse'; readonly remove: 'removable-hostile-control-dot-debuff'; readonly retarget: true }
  | { readonly kind: 'temporary-equipment'; readonly policyId: 'TG-01'; readonly lifetime: 'round' };
export interface TriggerDefinition {
  readonly source: Source;
  readonly event: Trigger;
  readonly condition: Condition;
  readonly selector: TargetSelector;
  readonly internalCooldownTicks: Tick;
  readonly maxPerAction: number;
  readonly maxPerCombat: number | null;
  readonly stackPolicy: StackPolicy;
  readonly effects: readonly Effect[];
}
export interface EquipmentRoundRoll {
  /** Identity = canonical JSON [parentItemInstanceId,roundId], never holder ID. */
  readonly parentItemInstanceId: string;
  readonly roundId: string;
  readonly playerLevelSnapshot: number;
  readonly poolVersion: 'tg-01-v1';
  readonly children: readonly [string, string];
  readonly rngDrawStart: number;
  readonly rngDrawEnd: number;
}
export interface TemporaryEquipment {
  readonly temporaryId: string;
  readonly parentItemInstanceId: string;
  readonly roundId: string;
  readonly holderId: string;
  readonly definitionId: string;
  readonly slot: 1 | 2;
  readonly expiresAfterRoundId: string;
}
export interface RngStream { readonly state: number; readonly draws: number }
export interface M8RandomStreams {
  readonly equipment: RngStream;
  readonly encounter: RngStream;
  readonly loot: RngStream;
}
export interface RoundDefinition {
  readonly roundId: string;
  readonly ordinal: number;
  readonly stage: number;
  readonly subround: number;
  readonly kind: 'pvp' | 'pve' | 'supply';
  readonly isFinal: boolean;
  readonly encounterId: string | null;
  readonly displayName: string;
}
export type LootPayload =
  | { readonly kind: 'gold'; readonly quantity: number }
  | { readonly kind: 'item' | 'unit'; readonly definitionId: string; readonly quantity: number };
export interface DropIdentity {
  readonly dropId: string;
  readonly encounterId: string;
  readonly sourceUnitId: string | null;
  readonly roundId: string;
}
export type DropState = DropIdentity & { readonly payload: LootPayload } & (
  | { readonly status: 'planned'; readonly revealCondition: 'source-killed' | 'approved-guarantee'; readonly receiptId: null }
  | { readonly status: 'revealed' | 'pending-capacity' | 'retained-terminal'; readonly receiptId: null }
  | { readonly status: 'granted'; readonly receiptId: string }
  | { readonly status: 'forfeited'; readonly receiptId: null }
);
export interface LootReceipt {
  readonly receiptId: string;
  readonly dropId: string;
  readonly payload: LootPayload;
  readonly grantedItemIds: readonly string[];
  readonly grantedUnitIds: readonly string[];
}
export interface EncounterPlan {
  readonly roundId: string;
  readonly encounterId: string;
  readonly policyVersion: string;
  readonly drops: readonly DropState[];
}
export interface M8MatchExtension {
  readonly rng: M8RandomStreams;
  readonly equipmentRoundRolls: readonly EquipmentRoundRoll[];
  readonly temporaryEquipment: readonly TemporaryEquipment[];
  readonly round: RoundDefinition;
  readonly encounterPlan: EncounterPlan | null;
  readonly lootReceipts: readonly LootReceipt[];
  readonly guaranteeCounters: Readonly<Record<string, number>>;
}
export interface M8CombatExtension {
  readonly effects: readonly EffectRuntime[];
  readonly statuses: readonly StatusGroup[];
  readonly periodicTasks: readonly PeriodicTask[];
  readonly shields: readonly ShieldState[];
  readonly spellCrit: Readonly<Record<string, SpellCritAuthorization>>;
  readonly castReceipts: readonly CastReceipt[];
  readonly mana: readonly ManaState[];
  readonly damageContributors: Readonly<Record<string, readonly string[]>>;
}
/** Frozen target identifiers. Current M7 constants deliberately remain unchanged. */
export interface M8Version {
  readonly contractVersion: 'm8-b2-v1';
  readonly schemaVersion: 6;
  readonly rulesVersion: 'm8-14.24b-v1';
  readonly contentVersion: 's13-14.24b-m8-v1';
  readonly contentDigest: string;
  readonly saveFormatVersion: 2;
  readonly replayFormatVersion: 2;
  readonly commandProtocolVersion: 2;
  readonly rngAlgorithm: 'lcg32-v1';
  readonly tickMs: 50;
}
export type UnchangedCombatEvent = Extract<CombatEventData, { readonly type: 'targetChanged' | 'kill' | 'growth' | 'effectTriggered' | 'movement' | 'attack' | 'death' | 'combatFinished' }>;
export type M8CombatEvent = { readonly domain: 'combat'; readonly combatId: string; readonly tick: Tick; readonly eventSeq: number } & (
  | UnchangedCombatEvent
  | { readonly type: 'cast'; readonly receipt: CastReceipt }
  | { readonly type: 'packetDamage'; readonly outcome: DamageOutcome }
  | { readonly type: 'heal'; readonly outcome: HealOutcome }
  | { readonly type: 'manaChanged'; readonly outcome: ManaOutcome }
  | { readonly type: 'statusChanged'; readonly group: StatusGroup; readonly reason: 'applied' | 'refreshed' | 'expired' | 'cleansed' | 'source-lost' }
  | { readonly type: 'shieldLayerChanged'; readonly layer: ShieldState; readonly reason: 'granted' | 'absorbed' | ShieldEndReason }
  | { readonly type: 'statChanged'; readonly unitId: string; readonly source: Source; readonly stat: Stat; readonly before: number; readonly after: number }
  | { readonly type: 'maxHpChanged'; readonly unitId: string; readonly source: Source; readonly beforeMax: number; readonly afterMax: number; readonly beforeHp: number; readonly afterHp: number; readonly countsAsHeal: false }
);
