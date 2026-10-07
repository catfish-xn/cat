/** B2 audit revision v3: pending re-review, not implementation-ready signoff. No runtime imports, reducers, or production activation. */
import type { CombatEventData, CombatOrigin } from '../combat-types';
import type { HexCell } from '../board';

/** All numbers must be finite safe integers; Bps denominator=10000, Tick=50ms. */
export type Bps = number;
export type Tick = number;
export type Duration = { readonly kind: 'ticks'; readonly ticks: Tick } | { readonly kind: 'combat' };
export type Source = CombatOrigin & { readonly parentItemInstanceId: string | null };
/** A01: namespace is external; applicationId distinguishes independent casts (e.g. Rell). */
export type EffectKeyTuple = readonly [combatId: string, ownerId: string, sourceKind: Source['sourceKind'],
  definitionId: string, instanceId: string, effectIndex: number, parentItemInstanceId: string | null,
  targetId: string, applicationId: string];
export interface EffectIdentity {
  /** JSON.stringify(EffectKeyTuple), with complete provenance, never a display name. */
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
  readonly counters: Readonly<Record<string, number>>;
  readonly consumedRewards: readonly string[];
  readonly nextEligibleTick: Tick;
  readonly consumed: boolean;
  readonly stackPolicy: StackPolicy;
}
export type Stat = 'maxHp' | 'attackDamage' | 'abilityPower' | 'armor' | 'magicResist'
  | 'attackSpeed' | 'range' | 'critChance' | 'critMultiplier' | 'damageAmp' | 'damageReduction' | 'omnivamp';
export type Condition =
  | { readonly kind: 'always' }
  | { readonly kind: 'positive-hp-damage' }
  | { readonly kind: 'hp-ratio'; readonly subject: 'holder' | 'target'; readonly op: 'gt' | 'lt' | 'lte'; readonly thresholdBps: Bps }
  | { readonly kind: 'target-max-hp'; readonly op: 'gt'; readonly hp: number }
  | { readonly kind: 'starting-rows'; readonly rows: 'front-two' | 'back-two' }
  | { readonly kind: 'enemy-targeting-holder' };
/** A08: evaluate applicable contributions before selecting strongest reduction. */
export interface DamageFilter {
  readonly deliveries: readonly DamageDelivery[] | 'all';
  readonly damageTypes: readonly DamageType[] | 'all';
  readonly redirected: 'include' | 'exclude' | 'only';
}
/** A09: current count is recomputed, never accumulated as event stacks. */
export type ModifierValue = { readonly kind: 'constant'; readonly amount: number }
  | { readonly kind: 'counter'; readonly counterId: string; readonly perCount: number }
  | { readonly kind: 'unit-count'; readonly perUnit: number; readonly population: 'alive-enemies-targeting-holder'; readonly sample: 'current'; readonly distinctBy: 'unitId' };
export interface StatModifier {
  readonly stat: Stat;
  readonly unit: 'flat' | 'bps' | 'hexes';
  readonly value: ModifierValue;
  readonly condition: Condition;
  readonly damageFilter: DamageFilter | null;
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
  readonly shieldAbsorbedBps: Bps;
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
/** A02: inherited values skip coefficient/crit/resistance/amp/reduction, not shields. */
export type DamageInput =
  | { readonly stage: 'raw'; readonly amount: Amount }
  | { readonly stage: 'after-mitigation'; readonly amount: number;
      readonly inherited: { readonly parentPacketId: string; readonly resolvedAtTick: Tick;
        readonly portion: 'overkill' | 'redirect-share'; readonly critical: boolean } };
export interface DamageRequest { readonly context: DamageContext; readonly input: DamageInput }
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
export type StatusEndReason = 'expired' | 'cleansed' | 'source-lost' | 'death-cleanup' | 'replaced' | 'combat-end';
/** A06: attached to exactly one contribution; a companion status must not pay twice. */
export interface StatusEndEffects {
  readonly reasons: readonly StatusEndReason[];
  readonly timing: 'expiry-before-actions';
  readonly effects: readonly Effect[];
}
export interface StatusApplication {
  readonly activation: 'immediate' | 'next-tick';
  readonly kind: StatusKind;
  readonly magnitudeBps: Bps;
  readonly duration: Duration;
  readonly stackPolicy: StackPolicy;
  readonly removable: boolean;
  readonly polarity: 'beneficial' | 'harmful';
  /** Required for stat-buff/stat-debuff; forbidden for other kinds by validation. */
  readonly modifier?: StatModifier;
  readonly damageFilter: DamageFilter | null;
  readonly onEnd: StatusEndEffects | null;
}
export interface StatusContribution extends EffectIdentity {
  readonly application: StatusApplication;
  /** Effective start tick; the request tick remains in its originating event. */
  readonly appliedAtTick: Tick;
  readonly expiresAtTick: Tick | null;
  readonly endRewardConsumed: boolean;
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
/** A07: task embeds a frozen program; each pulse selects once, then runs all effects. */
export interface PeriodicProgram {
  readonly definitionId: string;
  readonly selector: TargetSelector;
  readonly targetSnapshot: 'once-per-pulse';
  readonly effects: readonly Effect[];
}
/** R1: outer task key owns these accounts; effectIndex is the frozen program ordinal. */
export interface PeriodicRemainder {
  readonly effectIndex: number;
  readonly targetId: string;
  readonly numerator: number;
  readonly denominator: number;
}
export interface PeriodicTask extends EffectIdentity {
  readonly nextPulseAtTick: Tick;
  readonly periodTicks: Tick;
  readonly endsAtTick: Tick | null;
  readonly pulseOrdinal: number;
  readonly pulseLimit: number | null;
  readonly remainders: readonly PeriodicRemainder[];
  readonly finalPulse: 'before-expiry' | 'none';
  readonly onSourceDeath: 'cancel' | 'persist-attached';
  readonly onTargetDeath: 'cancel';
  readonly program: PeriodicProgram;
}
/** A10: one HP mutation per healId; contribution amounts use exact rational weights. */
export interface HealContribution {
  readonly source: Source;
  readonly numerator: number;
  readonly denominator: number;
}
export interface HealShare {
  readonly source: Source;
  readonly requested: number;
  readonly afterWound: number;
  readonly actual: number;
  readonly overheal: number;
  readonly preventedByWound: number;
}
export interface HealRequest {
  readonly healId: string;
  readonly contributions: readonly HealContribution[];
  readonly targetId: string;
  readonly requested: number;
  readonly kind: 'direct' | 'omnivamp' | 'ally-vamp';
  readonly fromPacketId: string | null;
}
export interface HealOutcome extends HealRequest {
  readonly shares: readonly HealShare[];
  readonly afterWound: number;
  readonly actual: number;
  readonly overheal: number;
  readonly preventedByWound: number;
}
export type ShieldEndReason = 'depleted' | 'expired' | 'death-cleanup' | 'replaced' | 'combat-end';
/** A03: decay is a loss of remaining shield, never damage absorption. */
export type ShieldDecayPolicy = { readonly kind: 'none' } | { readonly kind: 'linear-initial-grant' };
export type ShieldDecayState = { readonly kind: 'none' }
  | { readonly kind: 'linear-initial-grant'; readonly basisGranted: number; readonly grantedAtTick: Tick;
      readonly durationTicks: Tick; readonly lastDecayAtTick: Tick };
export interface ShieldState extends EffectIdentity {
  readonly granted: number;
  readonly remaining: number;
  readonly absorbed: number;
  readonly decayed: number;
  readonly expiredDiscarded: number;
  readonly decay: ShieldDecayState;
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
  /** A11: exact authoritative list returned by cast planning, duplicates/order retained. */
  readonly targetIds: readonly string[];
  readonly targetsSampledAtTick: Tick;
  readonly actualManaSpent: number;
  readonly refundedMana: number;
  readonly completionCell: HexCell;
}
export type Trigger = 'combat-start' | 'attack-completed' | 'incoming-basic-hit' | 'cast-completed'
  | 'damage-dealt' | 'damage-taken' | 'shield-hit' | 'post-damage-survival' | 'shield-ended'
  | 'target-changed' | 'kill-or-assist' | 'periodic' | 'counter-updated';
/** A05: event actor/target are not the holder or the current ordinary-attack target. */
export type TriggerContext = { readonly eventSeq: number; readonly tick: Tick; readonly actionSeq: number;
  readonly actorId: string; readonly targetId: string | null } & (
  | { readonly event: 'cast-completed'; readonly cast: CastReceipt }
  | { readonly event: Exclude<Trigger, 'cast-completed'>; readonly cast: null }
);
export interface TriggerListener {
  readonly subject: 'actor' | 'target';
  readonly relationToHolder: 'self' | 'ally' | 'enemy' | 'any';
  readonly withinHexes: number | null;
}
export type TriggerGate = { readonly kind: 'always' }
  | { readonly kind: 'every-n'; readonly counterId: string; readonly everyN: number; readonly firstAt: number }
  | { readonly kind: 'stack-threshold-once'; readonly counterId: string; readonly at: number; readonly rewardId: string };
export interface CounterDefinition {
  readonly id: string;
  readonly events: readonly { readonly event: Trigger; readonly listener: TriggerListener; readonly qualifies: 'completed-event' | 'positive-actual-damage' }[];
  readonly scope: 'source-instance';
  readonly reset: 'combat-start';
  readonly cap: number | null;
}
export interface TargetSelector {
  readonly primary: 'normal' | 'first-required';
  readonly candidates: 'board' | 'event-actor' | 'event-target' | 'bound-target';
  readonly relation: 'self' | 'ally' | 'enemy';
  readonly anchor: 'holder' | 'primary-target' | 'previous-target' | 'event-actor';
  readonly radius: number | null;
  readonly maxTargets: number;
  readonly excludeSelf: boolean;
  readonly excludePrimary: boolean;
  readonly distinct: boolean;
  readonly order: 'distance-id' | 'farthest-id' | 'hp-ratio-id' | 'hp-absolute-distance-id' | 'id' | 'not-burned-by-this-instance-distance-id';
  readonly sample: 'combat-start' | 'action-completion' | 'each-tick' | 'each-pulse';
}
/** Finite declarative payloads; executors are B3–B5 work. */
export type Effect =
  | { readonly kind: 'modify-stat'; readonly stackPolicy: StackPolicy; readonly activation: 'immediate' | 'next-tick'; readonly modifier: StatModifier; readonly duration: Duration }
  | { readonly kind: 'damage'; readonly damageType: DamageType; readonly delivery: DamageDelivery; readonly amount: Amount; readonly critEligibility: CritEligibility }
  | { readonly kind: 'apply-status'; readonly status: StatusApplication }
  | { readonly kind: 'heal'; readonly amount: Amount }
  | { readonly kind: 'transfer-stat'; readonly activation: 'next-tick'; readonly stats: readonly Stat[]; readonly amount: number; readonly duration: Duration; readonly applicationIdentity: 'action-target'; readonly persistAfterTargetDeath: true }
  | { readonly kind: 'grant-shield'; readonly amount: Amount; readonly durationTicks: Tick; readonly decay: ShieldDecayPolicy; readonly onEnd: readonly ShieldEndReason[]; readonly endTiming: 'post-damage' | 'next-action-planning'; readonly endTargeting: AbilityTargeting; readonly endEffects: readonly Effect[] }
  | { readonly kind: 'grant-mana'; readonly amount: number; readonly reason: ManaRequest['reason']; readonly bypassLock: ManaRequest['bypassLock'] }
  | { readonly kind: 'change-max-hp'; readonly bonusBps: Bps; readonly currentHp: 'add-max-delta'; readonly countsAsHeal: false }
  | { readonly kind: 'authorize-spell-crit'; readonly duplicateBonusBps: 1000 }
  | { readonly kind: 'cleanse'; readonly remove: 'removable-hostile-control-dot-debuff'; readonly retarget: true }
  | { readonly kind: 'temporary-equipment'; readonly policyId: 'TG-01'; readonly lifetime: 'round' };
export interface TriggerDefinition {
  readonly id: string;
  readonly source: Source;
  readonly listener: TriggerListener;
  readonly aggregation: 'event' | 'action-damage-total';
  readonly counters: readonly CounterDefinition[];
  readonly gate: TriggerGate;
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
  readonly activities: readonly CombatActivity[];
  readonly abilityPlans: readonly AbilityPlan[];
  readonly actionTasks: readonly ActionTask[];
  readonly armedAttacks: readonly ArmedAttack[];
  readonly shields: readonly ShieldState[];
  readonly spellCrit: Readonly<Record<string, SpellCritAuthorization>>;
  readonly castReceipts: readonly CastReceipt[];
  readonly mana: readonly ManaState[];
  readonly damageContributors: Readonly<Record<string, readonly string[]>>;
}
/** Frozen target identifiers. Current M7 constants deliberately remain unchanged. */
export interface M8Version {
  readonly contractVersion: 'm8-b2-v3-review';
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
  | { readonly type: 'activityChanged'; readonly activity: CombatActivity; readonly reason: 'applied' | 'refreshed' | ActivityEndReason }
  | { readonly type: 'cast'; readonly receipt: CastReceipt }
  | { readonly type: 'packetDamage'; readonly outcome: DamageOutcome }
  | { readonly type: 'heal'; readonly outcome: HealOutcome }
  | { readonly type: 'manaChanged'; readonly outcome: ManaOutcome }
  | { readonly type: 'statusChanged'; readonly group: StatusGroup; readonly reason: 'applied' | 'refreshed' | StatusEndReason }
  | { readonly type: 'shieldLayerChanged'; readonly layer: ShieldState; readonly reason: 'granted' | 'absorbed' | 'decayed' | ShieldEndReason }
  | { readonly type: 'statChanged'; readonly unitId: string; readonly source: Source; readonly stat: Stat; readonly before: number; readonly after: number }
  | { readonly type: 'maxHpChanged'; readonly unitId: string; readonly source: Source; readonly beforeMax: number; readonly afterMax: number; readonly beforeHp: number; readonly afterHp: number; readonly countsAsHeal: false }
);


/** Existing nineteen abilities: finite plan vocabulary; no new champion executor. */
export type AbilityTargeting =
  | { readonly kind: 'bound-selection' }
  | { readonly kind: 'fixed'; readonly targetIds: readonly string[]; readonly ifMissing: 'skip' }
  | { readonly kind: 'select'; readonly selector: TargetSelector }
  | { readonly kind: 'area-around-selected'; readonly center: TargetSelector; readonly radius: number; readonly relation: 'enemy' | 'ally'; readonly order: 'id' }
  | { readonly kind: 'path'; readonly pathOrder: 'E-SE-SW-W-NW-NE'; readonly hitOrder: 'path-position' | 'id'; readonly aimId: string; readonly intercept: 'first-enemy' | 'all-enemies'; readonly fallback: 'farthest-enemy' | 'none' }
  | { readonly kind: 'chain'; readonly primaryId: string; readonly radius: number; readonly additionalTargets: number;
      readonly tieBreak: 'id'; readonly order: 'nearest-previous' | 'farthest-from-primary-return-primary'; readonly distinctSecondary: true }
  | { readonly kind: 'round-robin'; readonly primaryId: string; readonly radius: number; readonly ordinal: number; readonly fallback: 'nearest-enemy' }
  | { readonly kind: 'random-enemy-center'; readonly areaOrder: 'id'; readonly radius: number; readonly rng: 'combat'; readonly mapping: 'word-modulo-id-sorted-count'; readonly draws: 1 };
export interface ArmedAttack extends EffectIdentity {
  readonly mode: 'replace-basic' | 'append-ability-packet';
  readonly amount: Amount;
  readonly damageType: DamageType;
  readonly usesBasicCrit: boolean;
  readonly consume: 'next-completed-attack';
  readonly blocksRecast: boolean;
}
/** R3: persisted authoritative activity, independent of plans and UI time inference. */
export type ActivityEndReason = 'expired' | 'control-cancelled' | 'replaced' | 'death-cleanup' | 'combat-end';
export type CombatActivity = EffectIdentity & {
  readonly actionSeq: number;
  readonly startsAtTick: Tick;
  readonly expiresAtTick: Tick;
} & (
  | { readonly kind: 'channel'; readonly blocks: readonly ['move', 'attack', 'cast']; readonly cancelOnControl: true }
  | { readonly kind: 'redirect'; readonly allyRadius: number; readonly shareBps: Bps; readonly choose: 'lowest-id'; readonly repeatMitigation: false; readonly recursive: false }
) & (
  | { readonly lifecycle: 'active'; readonly endedAtTick: null; readonly endReason: null }
  | { readonly lifecycle: 'ended'; readonly endedAtTick: Tick; readonly endReason: ActivityEndReason }
);
export type AbilityOperation =
  | { readonly kind: 'primary-and-area'; readonly targeting: AbilityTargeting; readonly primaryId: string; readonly primaryEffects: readonly Effect[]; readonly otherEffects: readonly Effect[] }
  | { readonly kind: 'effects'; readonly targeting: AbilityTargeting; readonly effects: readonly Effect[] }
  | { readonly kind: 'center-and-area'; readonly center: Extract<AbilityTargeting, { readonly kind: 'random-enemy-center' | 'bound-selection' }>; readonly areaEffects: readonly Effect[]; readonly centerEffects: readonly Effect[] }
  | { readonly kind: 'arm-attack'; readonly armed: ArmedAttack }
  | { readonly kind: 'channel'; readonly startsAtTick: Tick; readonly endsAtTick: Tick; readonly blocks: readonly ['move', 'attack', 'cast']; readonly cancelOnControl: true }
  | { readonly kind: 'redirect'; readonly durationTicks: Tick; readonly allyRadius: number; readonly shareBps: Bps; readonly choose: 'lowest-id'; readonly repeatMitigation: false; readonly recursive: false }
  | { readonly kind: 'overkill-next-tick'; readonly selector: TargetSelector; readonly oncePerAction: true;
      readonly freezeTargetOnCommit: true; readonly inherit: 'after-mitigation'; readonly recursive: false;
      readonly growthOnCommitBps: Bps }
  | { readonly kind: 'schedule'; readonly tasks: readonly ActionTask[] };
export interface ActionTask {
  readonly key: string;
  readonly source: Source;
  readonly actionSeq: number;
  readonly ordinal: number;
  readonly committedAtTick: Tick;
  readonly replaceGroup: string | null;
  readonly executeAtTick: Tick;
  readonly consumed: boolean;
  readonly onSourceDeath: 'cancel' | 'persist';
  readonly onControl: 'cancel' | 'continue';
  readonly targeting: AbilityTargeting;
  readonly payload: { readonly kind: 'damage-request'; readonly request: DamageRequest; readonly mayCreateOverkill: false }
    | { readonly kind: 'operations'; readonly operations: readonly Exclude<AbilityOperation, { readonly kind: 'schedule' }>[] };
}
export interface AbilityPlan {
  readonly source: Source;
  readonly cast: CastReceipt;
  readonly operations: readonly AbilityOperation[];
  readonly triggers: readonly TriggerDefinition[];
  /** Actual snapshots (e.g. low-cost ally count), not recomputed from later Match data. */
  readonly snapshots: Readonly<Record<string, number>>;
}
