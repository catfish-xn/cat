import type { Amount, Condition, EffectRuntime, PeriodicTask, Source, StatModifier, StatusGroup, TriggerDefinition, CombatActivity } from './contracts';
/** Development input/compiler projections. The frozen G04–G07 records themselves are unchanged. */
export interface VampDefinition { readonly source: Source; readonly modifier: StatModifier; readonly allyBps: number; readonly allyCondition: Condition }
export interface MechanismDefinitions {
  readonly eventTriggers?: readonly TriggerDefinition[];
  readonly periodicTasks: readonly PeriodicTask[];
  readonly survivalTriggers: readonly TriggerDefinition[];
  readonly vamp: readonly VampDefinition[];
  readonly positiveDamageHeals?: readonly { readonly source: Source; readonly amount: Amount }[];
}
export interface MechanismState {
  readonly initialized: boolean;
  readonly combatId: string;
  readonly sampledAtTick: number;
  readonly statuses: readonly StatusGroup[];
  readonly periodicTasks: readonly PeriodicTask[];
  readonly runtimes: readonly EffectRuntime[];
  readonly activities: readonly CombatActivity[];
}
export const EMPTY_MECHANISMS: MechanismState = { initialized: false, combatId: 'standalone', sampledAtTick: 0, statuses: [], periodicTasks: [], runtimes: [], activities: [] };
