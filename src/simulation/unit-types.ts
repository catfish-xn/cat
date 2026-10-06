import type { HexCell, Team } from './board';
export type CostTier = 1 | 2 | 3 | 4 | 5;
export type StarLevel = 1 | 2 | 3;
export interface UnitDefinition {
  readonly id: string; readonly name: string; readonly symbol: string; readonly color: number;
  readonly cost: CostTier;
  readonly baseStats: { readonly health: number; readonly attack: number; readonly armor: number; readonly magicResist: number };
  readonly attackRange: number; readonly attackIntervalTicks: number;
  readonly baseAttackSpeedBps?: number;
  readonly initialMana: number; readonly maxMana: number; readonly abilityId: string;
  readonly traits: readonly string[];
}
export type UnitLocation = { readonly kind: 'bench'; readonly slot: number } | { readonly kind: 'board'; readonly cell: HexCell };
export interface Unit { readonly id: string; readonly definitionId: string; readonly team: Team; readonly location: UnitLocation; readonly starLevel: StarLevel }
export interface ResolvedUnitStats {
  readonly health: number; readonly attack: number; readonly armor: number; readonly magicResist: number;
  readonly attackRange: number; readonly attackIntervalTicks: number;
  /** Original attacks/second ×10000; static modifiers stay additive. */
  readonly baseAttackSpeedBps?: number;
  readonly attackSpeedBonusBps?: number;
  readonly initialMana: number; readonly maxMana: number; readonly abilityId: string;
}
export interface UnitUpgradedEvent {
  readonly type: 'unitUpgraded'; readonly survivorId: string; readonly consumedIds: readonly string[];
  readonly definitionId: string; readonly fromStar: StarLevel; readonly toStar: StarLevel; readonly location: UnitLocation;
}
