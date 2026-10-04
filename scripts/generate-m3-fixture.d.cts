import type { MatchState, MatchEvent } from '../src/simulation/match';
import type { CombatEvent } from '../src/simulation/combat';
import type { LedgerCommand } from '../tests/fixtures/m3/oracle.cjs';
export interface FixtureCommand { command: LedgerCommand; annotation?: string; before: MatchState; after: MatchState; events: readonly MatchEvent[] }
export interface FixtureRound { round: number; preparationActions: FixtureCommand[]; before: MatchState; started: MatchState;
  atTick: Map<number, MatchState>; events: CombatEvent[]; settled: MatchState; continued: MatchState }
export interface FixtureRun { name: string; initial: MatchState; commands: FixtureCommand[]; rounds: FixtureRound[]; final: MatchState; events: CombatEvent[] }
export default function createFixtures(): Promise<{ growth: FixtureRun; terminal: FixtureRun }>;
