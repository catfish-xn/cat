import type { HexCell, Team } from './board';
export type CostTier = 1 | 2 | 3 | 4 | 5;
export type StarLevel = 1 | 2 | 3;
export interface UnitDefinition {
  /** G2-3 summon/structure (e.g. Jayce's forge, Sion): sell refused 'unit-not-sellable' unless sellable; board slot free unless countsTowardPopulation. */
  readonly summon?: { readonly sellable: boolean; readonly countsTowardPopulation: boolean };
  /** G2-3 form swapper: current form comes from its deployment row (seat-mechanics/forms.ts), frozen at combat start. */
  readonly formSwap?: true;
  readonly unitKind?: 'champion' | 'neutral';
  readonly monsterFamily?: string;
  readonly baseCritChanceBps?: number;
  readonly baseCritMultiplierBps?: number;
  readonly id: string; readonly name: string; readonly symbol: string; readonly color: number;
  readonly cost: CostTier;
  readonly baseStats: { readonly health: number; readonly attack: number; readonly armor: number; readonly magicResist: number };
  readonly attackRange: number; readonly attackIntervalTicks: number;
  readonly baseAttackSpeedBps?: number;
  readonly initialMana: number; readonly maxMana: number; readonly abilityId: string;
  readonly traits: readonly string[];
}
export type UnitLocation = { readonly kind: 'bench'; readonly slot: number } | { readonly kind: 'board'; readonly cell: HexCell };
export interface Unit { readonly encounterId?: string; readonly id: string; readonly definitionId: string; readonly team: Team; readonly location: UnitLocation; readonly starLevel: StarLevel }
export interface ResolvedUnitStats {
  readonly unitKind?: 'champion' | 'neutral';
  readonly monsterFamily?: string;
  readonly baseCritChanceBps?: number;
  readonly baseCritMultiplierBps?: number;
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
