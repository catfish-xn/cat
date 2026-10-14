/**
 * C18-B: the room's dispatch of `useConsumable` (contract §18.1/§18.3 draft). The room only hands the command to the
 * rules; it never checks the tool, the target, the phase or a reforge result itself.
 *
 * TODO(T13-B, contract §18.1): replace the body with
 *   runSharedMatchCommand(pool, state, { type: 'useConsumable', consumableId: command.consumableId, target: command.target })
 * once src/server-entry exports it. Until then no seat can hold a tool instance (MatchState has no consumable
 * inventory before T13-B), so every use is refused as the rules would: `unknown-consumable`, with the input pool and
 * state references unchanged (no event, no revision, no RNG), exactly the §18.5 failure atomicity.
 */
import type { MatchState } from '../../simulation/match-types';
import type { ConsumableCommand, ConsumableFailure } from '../protocol';
import type { SharedPoolState } from './types';

export type UseConsumableOutcome = { readonly ok: false; readonly pool: SharedPoolState; readonly state: MatchState; readonly reason: ConsumableFailure };

export function useSeatConsumable(pool: SharedPoolState, state: MatchState, _command: ConsumableCommand): UseConsumableOutcome {
  return { ok: false, pool, state, reason: 'unknown-consumable' };
}
