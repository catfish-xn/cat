// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { plan, SOURCE } from '../augment-pool-batch5-h8-deaths';
import type { MatchState } from '../match-types';

export function validateBatch5H8Deaths(state:MatchState):void {
 const expected=plan(state),actual=(state.seatMechanics?.receipts??[]).filter(r=>r.source===SOURCE||r.receiptId.startsWith(`["${SOURCE}",`));
 if(actual.length!==expected.length||expected.some(p=>!actual.some(r=>r.receiptId===p.receiptId&&r.source===p.source&&r.kind==='gold'&&r.round===p.round&&r.amount===p.amount)))throw new RangeError('Invalid monetization gold');
}
