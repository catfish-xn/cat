/**
 * C18-B: the room's dispatch of `useConsumable` (contract §18.1/§18.3/§18.6). The room only hands the command to the
 * rules' shared-pool transaction; it never checks the tool, the target, the phase or a reforge result itself. On
 * success the pool, the latest seat state and the events are published together; on failure the input references come
 * back unchanged with the rules' reason (§18.5: no event, no revision, no RNG, the tool is not consumed).
 */
import { runSharedMatchCommand, type SharedPoolResult } from '../../server-entry';
import type { MatchState } from '../../simulation/match-types';
import type { ConsumableCommand } from '../protocol';
import type { SharedPoolState } from './types';

export function useSeatConsumable(pool: SharedPoolState, state: MatchState, command: ConsumableCommand): SharedPoolResult {
  return runSharedMatchCommand(pool, state, { type: 'useConsumable', consumableId: command.consumableId, target: command.target });
}
