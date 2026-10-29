// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { goldPlan } from '../augment-pool-batch2-progress';
import type { MatchState } from '../match-types';

export function validateBatch2Gold(state:MatchState):void {
 const plan=goldPlan(state),receipts=state.seatMechanics?.receipts??[];
 for(const r of receipts.filter(r=>r.source==='augment-pool-batch2'||r.receiptId.startsWith('["augment-pool-batch2",'))){
  const p=plan.find(p=>p.receiptId===r.receiptId);
  if(!p||r.kind!=='gold'||r.source!==p.source||r.amount!==p.amount||r.round!==p.round)throw new RangeError('Invalid batch2 gold authority');
 }
 for(const p of plan)if(!receipts.some(r=>r.receiptId===p.receiptId))throw new RangeError('Missing batch2 gold receipt');
}
