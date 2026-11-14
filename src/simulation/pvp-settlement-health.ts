import type { MatchState } from './match-types';
import type { G23BattleFacts } from './g2-3-economy';
import { melCanSave } from './mel-save';

/** Damage-only boundary, before any settlement healing. Shared by the commit and
 * the room's opposite-side receipt; never predicts from frozen starting HP. */
export function pvpSettlementHpLost(state:MatchState, proposal:{readonly damage:number;readonly g23Facts?:G23BattleFacts}):number {
  if (!Number.isSafeInteger(proposal.damage) || proposal.damage < 0) throw new RangeError('Invalid PvP damage');
  const raw = Math.max(0,state.playerHp-proposal.damage);
  // Nonlethal damage cannot trigger Mel; do not reconstruct her full G23 progress for it.
  return state.playerHp-(raw === 0 && melCanSave(state,proposal.g23Facts,raw)?1:raw);
}
