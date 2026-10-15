import type { MatchState, RoundResult, MatchEvent } from '../../../src/simulation/match';
import type { CombatState } from '../../../src/simulation/combat';
import type { FrozenDirectDrop, FrozenLootRound, LootChoiceDescriptor } from '../../../src/simulation/loot-types';
import type { RngStream, LootReceipt } from '../../../src/simulation/m8/contracts';

export const COST: Record<string, number>;
export const SELL: Record<number, number[]>;
export const COMPONENTS: readonly string[];
export type OracleCommand = Readonly<{ type: string; [key: string]: unknown }>;
export type EconomyInput = Pick<MatchState, 'round' | 'gold' | 'level' | 'xp' | 'playerHp' | 'streak'> & Partial<Pick<MatchState, 'seed' | 'm8'>>;
export type EconomyCombat = Pick<CombatState, 'result' | 'tick' | 'nextEventSeq'> & {
  readonly units: readonly (Pick<CombatState['units'][number], 'team' | 'alive'> & Partial<Pick<CombatState['units'][number], 'id'>>)[];
  readonly neutralReceipts?: CombatState['neutralReceipts'];
};
export function settlement(before: EconomyInput, combat: EconomyCombat | null, goldBefore?: number): RoundResult;
export function investment(before: {
  readonly augmentProgress: MatchState['augmentProgress'];
  readonly augments: readonly { readonly definitionId: string }[];
}, record: Pick<RoundResult, 'incomeBreakdown'>): MatchState['augmentProgress'];
export function shop(rng: number, generation: number, level: number, locked?: boolean): { rngState: number; shop: MatchState['shop'] };
export function xp(level: number, value: number, amount: number): { level: number; xp: number; xpApplied: number };
export function lootIndex(rng: RngStream, n: number): { index: number; rng: RngStream };
export function lootPlan(seed: number, ordinal: number): { readonly rng: RngStream; readonly rounds: readonly FrozenLootRound[] };
export function validateLoot(state: MatchState): Map<string, FrozenDirectDrop | LootChoiceDescriptor>;
export function validateLootTransition(before: MatchState, after: MatchState, command: OracleCommand | undefined, events: readonly MatchEvent[]): readonly LootReceipt[];
export class Ledger {
  constructor(initial: MatchState);
  gold: number;
  cards: number;
  combinations: number;
  costs: Record<string, number>;
  rows: RoundResult[];
  receipts: Set<string>;
  apply(before: MatchState, after: MatchState, command?: OracleCommand, events?: readonly MatchEvent[]): void;
  check(state: MatchState): void;
}
