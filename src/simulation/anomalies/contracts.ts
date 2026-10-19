import type { ChoiceDefinition } from '../strategy-types';
import type { AbilityContext } from '../combat-s13-abilities';
import type { CombatOrigin } from '../combat-types';
import type { S13Unit } from '../combat-s13-state';

/** Optional, serializable receipts; exact trusted-input replay authenticates them. */
export interface AnomalyRuntime {
  attackStream?: { state: number; draws: number };
  pendingAttacks?: { targetId: string; executeAtTick: number; rootActionSeq: number; raw: number }[];
  absentUntilTick?: number;
  enteredAtTick?: number;
  firstCastTick?: number;
  takedowns?: string[];
  invisibleUntilTick?: number;
  critReady?: boolean;
  revivedAtTick?: number;
  decayRemainder?: number;
  consumed?: { unitId: string; health: number; attackDamage: number };
  orbit?: { radiusMilli: number; hits: Record<string, number>; center: import('../board').HexCell; tick: number };
}
export interface AnomalySummon {
  readonly kind: 'crab' | 'wolf' | 'mini';
  readonly ownerId: string;
  readonly ordinal: number;
  readonly bornAtTick: number;
  readonly source: CombatOrigin;
}
export interface AnomalyModule {
  readonly definition: ChoiceDefinition;
  start?(ctx: AbilityContext, unit: S13Unit, source: CombatOrigin): void;
  tick?(ctx: AbilityContext, unit: S13Unit, source: CombatOrigin, nextSeq: () => number): void;
  cast?(ctx: AbilityContext, unit: S13Unit, target: S13Unit, source: CombatOrigin): void;
  takedown?(ctx: AbilityContext, unit: S13Unit, victimId: string, source: CombatOrigin): void;
  attack?(ctx: AbilityContext, unit: S13Unit, target: S13Unit, seq: number, source: CombatOrigin): void;
  death?(ctx: AbilityContext, unit: S13Unit, source: CombatOrigin): void;
}
