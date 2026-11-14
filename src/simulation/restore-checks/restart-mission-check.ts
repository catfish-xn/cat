import type { MatchState } from '../match-types';
import { restartMissionGiftPlan, restartMissionRemovalId } from '../restart-mission';
import { getMultiplayerRoundByOrdinal } from '../multiplayer-round';
import { lootOrbId } from '../loot-identity';

/** Resource folding proves removal ownership/completeness; the owner and gifts require the unique boundary. */
export function validateRestartMission(state: MatchState): void {
  const fail = () => { throw new RangeError('Invalid restart mission authority'); };
  const owners = state.augments.filter(a=>a.definitionId==='restart-mission');
  const markers = state.resourceProvenance.entries.filter(e=>e.kind==='restart-mission-completed');
  if (owners.length>1 || markers.length!==owners.length) fail();
  for (const owner of owners) {
    const marker = markers.find(e=>e.kind==='restart-mission-completed'&&e.choiceId===owner.choiceId);
    if (!marker || marker.roundId!==getMultiplayerRoundByOrdinal(owner.acquiredRound).roundId) fail();
    if (!state.augmentHistory?.facts.some(f=>f.kind==='acquire'&&f.choiceId===owner.choiceId&&f.definitionId===owner.definitionId&&f.round===owner.acquiredRound)) fail();
    const removals = state.resourceProvenance.entries.filter(e=>e.kind==='unit-removed'&&e.receiptId===restartMissionRemovalId(owner));
    if (removals.some(e=>e.sequence>=marker!.sequence||e.roundId!==marker!.roundId)) fail();
    for (const gift of restartMissionGiftPlan(state)) {
      const receipt=state.seatMechanics?.receipts.find(r=>r.receiptId===gift.receiptId);
      if (!receipt || receipt.kind!=='unit' || receipt.resolution!=='orb' || receipt.round!==owner.acquiredRound) fail();
      const orbId=lootOrbId(marker!.roundId,'mechanic',gift.receiptId,0);
      if (receipt?.kind!=='unit' || receipt.orbId!==orbId || !state.m8.loot.rewardOrbs?.some(o=>o.orbId===orbId)) fail();
    }
  }
}
