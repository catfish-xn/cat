import type { MatchState, MatchCommandResult } from '../../../src/simulation/match';
import type { Unit } from '../../../src/simulation/units';
import type { LedgerCommand } from '../m4/oracle.cjs';
export type { LedgerCommand } from '../m4/oracle.cjs';
export function expectedCommand(before: MatchState, command: LedgerCommand): MatchCommandResult;
export function cardValue(units: readonly Unit[]): number;
