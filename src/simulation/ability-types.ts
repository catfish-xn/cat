import type { EffectSource, SourceKind } from './strategy-types';
export type DamageType = 'physical' | 'magic';
type AbilityBase = { readonly id: string; readonly amountByStar: readonly [number, number, number] };
export type AbilityDefinition = AbilityBase & (
  | { readonly kind: 'damage'; readonly damageType: DamageType; readonly radius: 0 | 1 }
  | { readonly kind: 'selfShield'; readonly durationTicks: number }
);
export type ResolvedAbility = { readonly id: string; readonly amount: number } & (
  | { readonly kind: 'damage'; readonly damageType: DamageType; readonly radius: 0 | 1 }
  | { readonly kind: 'selfShield'; readonly durationTicks: number }
);
export interface DamagePacket {
  readonly sourceId: string; readonly targetId: string; readonly damageType: DamageType; readonly rawAmount: number;
  readonly sourceKind: 'attack' | 'ability' | SourceKind; readonly source?: EffectSource; readonly sourceInstanceId?: string; readonly packetOrdinal?: number; readonly triggerEligible?: boolean; readonly abilityId?: string; readonly effectIndex: number;
}
