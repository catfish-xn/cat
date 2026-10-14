/**
 * C18-B: the room's dispatch of `useConsumable` (contract §18.1/§18.3/§18.6). The room only hands the command to the
 * rules' shared-pool transaction and keeps its atomic result; it never checks the tool, the target, the phase or a
 * reforge result itself. A refusal returns the input pool and state references (no event, revision, RNG or ID moved,
 * §18.5); a success is committed by the caller together with the latest live seat, never on a frozen battle copy.
 */
import { runSharedMatchCommand } from '../../server-entry';
import type { MatchState } from '../../simulation/match-types';
import type { ConsumableCommand } from '../protocol';
import type { SharedPoolState } from './types';

export function useSeatConsumable(pool: SharedPoolState, state: MatchState, command: ConsumableCommand) {
  return runSharedMatchCommand(pool, state, { type: 'useConsumable', consumableId: command.consumableId, target: command.target });
}
