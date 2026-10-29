// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { AUGMENT_BATCH4_SOURCE, goldPlan } from '../augment-pool-batch4-progress';
import type { MatchState } from '../match-types';

/** Reject forged amount, source, trigger round, missing/duplicate and orphan receipts. Gift receipts use Batch1 validation. */
export function validateBatch4Gold(state:MatchState):void {
 const plan=goldPlan(state),receipts=state.seatMechanics?.receipts??[];
 const actual=receipts.filter(r=>r.source===AUGMENT_BATCH4_SOURCE||r.receiptId.startsWith(`["${AUGMENT_BATCH4_SOURCE}",`));
 const fail=()=>{throw new RangeError('Invalid batch4 gold authority');};
 if(actual.length!==plan.length||new Set(actual.map(r=>r.receiptId)).size!==actual.length)fail();
 for(const r of actual){const p=plan.find(p=>p.receiptId===r.receiptId);
  if(!p||r.kind!=='gold'||r.source!==p.source||r.amount!==p.amount||r.round!==p.round)fail();
 }
}
