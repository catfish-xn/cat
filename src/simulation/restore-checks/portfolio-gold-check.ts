// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { portfolioGoldPlan, SOURCE } from '../augment-pool-batch5-h4';
import type { MatchState } from '../match-types';

export function validatePortfolioGold(state:MatchState):void {
  const plan=portfolioGoldPlan(state),actual=(state.seatMechanics?.receipts??[]).filter(r=>r.source===SOURCE||r.receiptId.startsWith(`["${SOURCE}",`));
  if(actual.length!==plan.length||new Set(actual.map(r=>r.receiptId)).size!==actual.length) throw new RangeError('Invalid portfolio gold authority');
  for(const r of actual){const p=plan.find(p=>p.receiptId===r.receiptId);if(!p||r.kind!=='gold'||r.source!==p.source||r.round!==p.round||r.amount!==p.amount)throw new RangeError('Invalid portfolio gold authority');}
}
