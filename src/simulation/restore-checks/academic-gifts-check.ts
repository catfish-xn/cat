// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { academicGiftPlan } from '../augment-pool-batch5-s3b';
import type { MatchState } from '../match-types';
import { isCombatRosterLocked } from '../operation-policy';
import { getCatalogRoundById } from '../round-selectors';

export function validateAcademicGifts(state:MatchState):void {
  const mayDefer=state.phase==='combat'||isCombatRosterLocked(state)
    ||state.preparation.units.filter(u=>u.location.kind==='bench').length>=state.preparation.benchSize;
  for(const gift of academicGiftPlan(state)){
    const receipt=state.seatMechanics?.receipts.find(r=>r.receiptId===gift.receiptId);
    if(!receipt){if(!mayDefer)throw new RangeError('Invalid academic research missing anvil');continue;}
    const craft=state.resourceProvenance.entries[JSON.parse(gift.receiptId)[4]];
    const birth=state.resourceProvenance.entries.find(e=>e.kind==='unit-acquired'&&e.source.kind==='mechanic'&&e.source.receiptId===gift.receiptId);
    if(receipt.kind!=='unit'||!birth||birth.sequence<=craft.sequence||receipt.round<getCatalogRoundById(craft.roundId).ordinal)
      throw new RangeError('Invalid academic research anvil before craft');
  }
}
