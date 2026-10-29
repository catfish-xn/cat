// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { contestedAmount, SOURCE } from '../augment-pool-batch5-h6';
import type { MatchState } from '../match-types';

export function validateContestedGold(state:MatchState):void {
 const owner=state.augments.find(a=>a.definitionId==='contested');
 const expected=owner?state.roundResults.filter(r=>r.roundKind==='pvp'&&r.round>=owner.acquiredRound).map(r=>({round:r.round,amount:contestedAmount(state,r.round),receiptId:JSON.stringify([SOURCE,owner.choiceId,r.round])})).filter(p=>p.amount>0):[];
 const actual=(state.seatMechanics?.receipts??[]).filter(r=>r.source===SOURCE||r.receiptId.startsWith(`["${SOURCE}",`));
 if(actual.length!==expected.length || actual.some(r=>!expected.some(p=>p.receiptId===r.receiptId&&p.round===r.round&&r.kind==='gold'&&r.amount===p.amount&&r.source===SOURCE)))throw new RangeError('Invalid contested gold authority');
}
