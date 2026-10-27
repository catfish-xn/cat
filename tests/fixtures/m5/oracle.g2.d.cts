import type { MatchState, RoundResult, MatchEvent } from '../../../src/simulation/match';
import type { CombatState } from '../../../src/simulation/combat';
import type { FrozenDirectDrop, FrozenLootRound, LootChoiceDescriptor } from '../../../src/simulation/loot-types';
import type { RngStream, LootReceipt } from '../../../src/simulation/m8/contracts';

export const COST: Record<string, number>;
export function luckyGlovesPair(seed:number,start:number,role:string,radiant?:boolean): {children:string[];state:number;draws:number};
export function validateLuckyGlovesEquipment(state:MatchState): void;
export const SELL: Record<number, number[]>;
export const COMPONENTS: readonly string[];
export type OracleCommand = Readonly<{ type: string; [key: string]: unknown }>;
export type OracleAugmentTier = 'silver' | 'gold' | 'prismatic';
export function openingEncounter(seed: number): string;
export function augmentTier(seed: number, node: string): OracleAugmentTier;
export function augmentPool(tier: OracleAugmentTier, owned: readonly { readonly definitionId: string }[], excluded?: readonly string[], node?: string | null, traits?: readonly string[], sharedCarousel?: boolean): string[];
export function augmentDraw(rng: number, tier: OracleAugmentTier, owned: readonly { readonly definitionId: string }[], excluded?: readonly string[], node?: string | null, traits?: readonly string[], sharedCarousel?: boolean): { offers: string[]; rng: number };
export function validateAugmentReroll(before: MatchState, result: unknown, command: OracleCommand): void;
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
export function shop(rng: number, generation: number, level: number, locked?: boolean, round?: number, context?: { seed: number; viktor: boolean } | null): { rngState: number; shop: MatchState['shop'] };
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
  apply(before: MatchState, after: MatchState, command?: OracleCommand | null, events?: readonly MatchEvent[]): void;
  check(state: MatchState): void;
}

/** Detached observations, initialized before H3 growth; no production growth is an expectation. */
export interface H3Ledger { readonly kind: 'h3-oracle-v1' }
export function createH3Ledger(initial: MatchState): H3Ledger;
export function checkH3Growth(memory: H3Ledger, before: MatchState, after: MatchState, command?: OracleCommand | null): H3Ledger;
export function h3GrowthForUnit(memory: H3Ledger, unitId: string): import('../../../src/simulation/augment-history-types').AugmentGrowth;

export function blackMarket(tier: number, rng: number): { offers: string[]; rng: number; draws: number };
export function validateChemTransition(before: MatchState, after: MatchState): void;
export const ANVIL_IDS: ReadonlySet<string>;

export function augmentGold(id: string, roundId: string): number;
export function entryXp(state: {
  readonly round: number;
  readonly augments: readonly { readonly definitionId: string; readonly acquiredRound: number }[];
  readonly roundResults: readonly { readonly round: number; readonly roundKind: string; readonly result: string }[];
}): number;
export function freeRerollCredits(state: {
  readonly round: number;
  readonly level: number;
  readonly seed?: number;
  readonly multiplayer?: { readonly seatId: string };
  readonly augments: readonly { readonly definitionId: string; readonly choiceId: string; readonly acquiredRound: number }[];
  readonly seatMechanics?: { readonly seat?: Readonly<Record<string, unknown>>; readonly receipts?: readonly unknown[] };
  readonly resourceProvenance?: { readonly entries: readonly unknown[] };
  readonly roundResults?: readonly unknown[];
}): number;

export const CATALOG: readonly (readonly string[])[];
export const ROUNDS: readonly { roundId: string; ordinal: number; stage: number; sub: number; kind: string }[];

export function benchXp(state: unknown): number;

export function shopWord(state: Pick<MatchState, 'seed' | 'multiplayer'>, parts: readonly (string | number)[]): bigint;
export function shopForState(state: MatchState, round?: number, subscription?: boolean): { rngState: number; shop: MatchState['shop'] };
export function shopTransition(state: MatchState, command: unknown): { rngState: number; shop: MatchState['shop']; stolen?: {definitionId: string; starLevel?:2; slot: number} };
export function validateScoreboardCombat(state: MatchState, input: unknown, provenancePrefixLength?: number): void;

export function shopGlitchCount(state: MatchState, previousMs: number, elapsedMs: number, acquiredAt?: number): number;
export function shopGlitchSolo(state: MatchState, previousMs: number, elapsedMs: number, acquiredAt?: number): {shop: MatchState['shop']; rngState: number};
export function shopGlitchShared(pool: import('../../../src/simulation/shared-pool-types').SharedPoolState, state: MatchState, previousMs: number, elapsedMs: number, acquiredAt?: number): {
  shop: MatchState['shop']; rngState: number; available: Record<string, number>;
  shops: import('../../../src/simulation/shared-pool-types').SharedPoolState['shops'];
};
export function tombRaiderPlan(state: MatchState): readonly { readonly choiceId: string; readonly seatId: string; readonly round: number; readonly offers: readonly string[] }[];
export function validateTombRaiderTransition(before: MatchState, after: MatchState, command: unknown, events: readonly unknown[]): void;

export function madChemistExpected(star: number, abilityPower: number, attackSpeedBps: number, ticks?: number): { total: number; pulses: number[]; mana: number };

export function starryChanceBps(level: number): number;
export function starrySharedShop(state: MatchState, stock: Readonly<Record<string, number>>): {
  rngState: number; shop: MatchState['shop']; available: Record<string, number>;
};

export function batch5TransformPlan(before: MatchState, augmentId: string, stock: Readonly<Record<string,number>>): ReturnType<typeof import('./augment-rewards-oracle.cjs').batch5Transforms>;
