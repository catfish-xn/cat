// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { BATCH5_S6C_SOURCE, goldPlan } from '../augment-pool-batch5-s6c';
import type { MatchState } from '../match-types';

export function validateBatch5S6cGold(state:MatchState):void {
 const expected=goldPlan(state),actual=(state.seatMechanics?.receipts??[]).filter(r=>r.source===BATCH5_S6C_SOURCE||r.receiptId.startsWith(`["${BATCH5_S6C_SOURCE}",`));
 if(actual.length!==expected.length||new Set(actual.map(r=>r.receiptId)).size!==actual.length)throw new RangeError('Invalid S6C gold authority');
 for(const r of actual){const p=expected.find(p=>p.receiptId===r.receiptId);if(!p||r.kind!=='gold'||r.source!==p.source||r.round!==p.round||r.roundId!==p.roundId||r.amount!==p.amount)throw new RangeError('Invalid S6C gold authority');}
}
