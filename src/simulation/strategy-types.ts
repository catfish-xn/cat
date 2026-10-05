import type { Team } from './board';
import type { ResolvedUnitStats } from './unit-types';
import type { ResolvedAbility } from './ability-types';

export type Stat = 'maxHp' | 'attackDamage' | 'armor' | 'magicResist' | 'initialMana' | 'abilityAmount' | 'abilityPower';
export type PercentStat = Exclude<Stat, 'initialMana'>;
export type Hook = 'combatStart' | 'onAttack' | 'onCast' | 'onHpLoss';
export type EffectAction =
  | { readonly kind: 'grantShield'; readonly amount: number; readonly durationTicks: number }
  | { readonly kind: 'gainMana'; readonly amount: number }
  | { readonly kind: 'dealDamage'; readonly amount: number; readonly damageType: 'physical' | 'magic' };
export type Effect =
  | { readonly kind: 'mechanic'; readonly mechanic: string; readonly values: Readonly<Record<string, number>> }
  | { readonly kind: 'statFlat'; readonly stat: Stat; readonly amount: number }
  | { readonly kind: 'statPercentBps'; readonly stat: PercentStat; readonly bps: number }
  | { readonly kind: 'attackSpeedBps'; readonly bps: number }
  | { readonly kind: 'trigger'; readonly hook: Hook; readonly everyN: number; readonly action: EffectAction };
export interface TraitTier { readonly threshold: number; readonly effects: readonly Effect[]; readonly memberEffects?: readonly Effect[] }
export interface TraitDefinition { readonly id: string; readonly name: string; readonly target: 'members' | 'team'; readonly tiers: readonly TraitTier[] }
export interface ItemDefinition { readonly id: string; readonly name: string; readonly kind: 'component' | 'completed'; readonly effects: readonly Effect[]; readonly recipe?: readonly [string, string] }
export interface ChoiceDefinition { readonly id: string; readonly name: string; readonly description: string; readonly effects: readonly Effect[] }
export interface ItemInstance { readonly id: string; readonly definitionId: string; readonly location: { readonly kind: 'inventory' } | { readonly kind: 'unit'; readonly unitId: string; readonly slot: number } }
export interface OwnedAugment { readonly definitionId: string; readonly choiceId: string; readonly acquiredRound: number }
export interface AnomalyBinding { readonly definitionId: string; readonly unitId: string; readonly choiceId: string; readonly boundRound: number }
export interface PendingChoice {
  readonly kind: 'augment' | 'anomaly' | 'component'; readonly step: 'target' | 'offer'; readonly choiceId: string;
  readonly returnPhase?: 'preparation' | 'settlement';
  readonly generation: number; readonly offers: readonly string[]; readonly targetId: string | null;
  readonly rerollCount: number; readonly eventId: string;
}
export interface ScheduleReceipt { readonly eventId: string; readonly round: number; readonly kind: 'reward' | 'augment' | 'anomaly' | 'component'; readonly itemIds: readonly string[]; readonly gold: number; readonly unitId: string | null; readonly definitionId: string | null }
export type ScheduleEvent = { readonly timing?: 'before' | 'after' } & (
  | { readonly id: string; readonly priority: number; readonly kind: 'reward'; readonly components: readonly string[]; readonly randomComponents: number; readonly gold: number; readonly recruitIfEmpty: boolean }
  | { readonly id: string; readonly priority: number; readonly kind: 'augment' | 'anomaly' | 'component' });
export type SourceKind = 'attack' | 'ability' | 'trait' | 'item' | 'augment' | 'anomaly' | 'enemyGrowth';
export interface EffectSource { readonly sourceKind: SourceKind; readonly sourceDefinitionId: string; readonly sourceInstanceId: string; readonly ownerId: string; readonly effectIndex: number }
export interface SourcedEffect { readonly key: string; readonly source: EffectSource; readonly effect: Effect }
export interface ResolvedTrigger { readonly key: string; readonly source: EffectSource; readonly hook: Hook; readonly everyN: number; readonly action: EffectAction }
export interface TraitSnapshot { readonly team: Team; readonly traitId: string; readonly count: number; readonly tier: number; readonly memberDefinitionIds: readonly string[]; readonly targetUnitIds: readonly string[] }
export interface StrategyUnitSnapshot { readonly unitId: string; readonly stats: ResolvedUnitStats; readonly ability: ResolvedAbility; readonly sources: readonly SourcedEffect[]; readonly triggers: readonly ResolvedTrigger[]; readonly attackDamageBase?: number; readonly attackDamagePercentBps?: number; readonly abilityPower?: number; readonly mechanics?: import('./combat-types').CombatMechanics }
export interface StrategySnapshot { readonly traits: readonly TraitSnapshot[]; readonly units: readonly StrategyUnitSnapshot[] }
export interface EffectRuntime { readonly key: string; readonly count: number }
export interface EffectInvocation { readonly trigger: ResolvedTrigger; readonly targetId: string; readonly action: EffectAction }
export type StrategyEvent =
 | { readonly type: 'itemCombined'; readonly consumedIds: readonly string[]; readonly itemId: string; readonly definitionId: string }
 | { readonly type: 'itemEquipped'; readonly itemId: string; readonly unitId: string; readonly slot: number }
 | { readonly type: 'itemsReturned'; readonly itemIds: readonly string[]; readonly unitId: string }
 | { readonly type: 'anomalyTransferred'; readonly fromId: string; readonly toId: string }
 | { readonly type: 'anomalyRemoved'; readonly unitId: string }
 | { readonly type: 'rewardGranted'; readonly receipt: ScheduleReceipt }
 | { readonly type: 'choiceOpened'; readonly choice: PendingChoice }
 | { readonly type: 'choiceSelected'; readonly choiceId: string; readonly definitionId: string; readonly unitId: string | null }
 | { readonly type: 'anomalyTargetSelected'; readonly choiceId: string; readonly unitId: string }
 | { readonly type: 'anomalyRerolled'; readonly choiceId: string; readonly generation: number; readonly cost: number };
