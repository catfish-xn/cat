// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { portableGrantId, r2AnomalyAllowed } from '../augment-pool-batch5-r2-anomaly';
import { traceBoundUnitIdentity } from '../bound-unit-identity';
import { PORTABLE_ANOMALY_PREFIX, portableAnomalyId } from '../content/augment-pool-batch5-r2';
import type { MatchState } from '../match-types';

/** Receipt/definition/round all follow the selected schedule, not the candidate item or a surviving original hero. */
export function validatePortableAnomaly(state:MatchState):void {
  const fail=()=>{throw new RangeError('Invalid portable anomaly');};
  const owner=state.augments.find(a=>a.definitionId==='another-anomaly');
  const selected=state.scheduleReceipts.find(r=>r.kind==='anomaly');
  const expected=owner&&selected?portableGrantId(owner.choiceId,selected.eventId):null;
  const receipts=(state.seatMechanics?.receipts??[]).filter(r=>r.source==='augment-pool-batch5-r2'||r.receiptId.startsWith('["augment-pool-batch5-r2",'));
  if(receipts.length!==(expected?1:0))fail();
  if(expected&&selected){
    const receipt=receipts[0];
    if(!r2AnomalyAllowed(state.augments,selected.definitionId!)||receipt.kind!=='item'||receipt.receiptId!==expected
      ||receipt.source!=='augment-pool-batch5-r2'||receipt.round!==selected.round||receipt.roundId!=='4-6'
      ||receipt.definitionId!==PORTABLE_ANOMALY_PREFIX+selected.definitionId)fail();
  }
  if(owner&&state.pendingChoice?.kind==='anomaly'&&state.pendingChoice.offers.some(id=>!r2AnomalyAllowed(state.augments,id)))fail();
  const original=selected?.unitId?traceBoundUnitIdentity(selected.unitId,state.resourceProvenance.entries):null;
  for(const item of state.items)if(portableAnomalyId(item.definitionId)!==null){
    if(!owner||!selected||item.definitionId!==PORTABLE_ANOMALY_PREFIX+selected.definitionId
      ||item.location.kind==='unit'&&item.location.unitId===original)fail();
  }
}
