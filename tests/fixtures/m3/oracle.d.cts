import type { CombatState } from '../../../src/simulation/combat';
import type { GameState } from '../../../src/simulation/game';
import type { MatchCommandResult, MatchState, RoundResult, Shop } from '../../../src/simulation/match';
import type { Unit, UnitLocation } from '../../../src/simulation/units';
export const CATALOG: readonly (readonly string[])[];
export const ODDS: readonly (readonly number[])[];
export const XP: readonly number[];
export const COST: Readonly<Record<string, number>>;
export type LedgerCommand = { type: 'reroll' | 'buyXp' } | { type: 'buy'; slot: number; generation: number }
  | { type: 'sell'; id: string } | { type: 'deploy'; id: string; target: UnitLocation };
export function expectedShop(rngState: number, generation: number, level: number): { shop: Shop; rngState: number };
export function progression(level: number, xp: number, amount: number): { level: number; xp: number; xpRequested: number; xpApplied: number; levelsGained: number };
export function expectedCommand(state: MatchState, command: LedgerCommand): MatchCommandResult;
export function expectedRound(state: MatchState, combat: CombatState): RoundResult;
export function purchased(state: GameState, definitionId: string, candidateId: string): unknown;
export function cardValue(units: readonly Unit[]): number;
export function validateReplayHeader(header: { schemaVersion: number; rulesVersion: string; contentVersion: string }): void;
