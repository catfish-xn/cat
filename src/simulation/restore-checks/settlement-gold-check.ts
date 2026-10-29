// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { KINGSLAYER_SOURCE, plan, RISKY_MOVES_SOURCE } from '../augment-settlement-gold';
import type { MatchState } from '../match-types';

export function validateSettlementGold(state:MatchState):void {
 const expected=plan(state),receipts=state.seatMechanics?.receipts??[];
 const ours=(r:{source:string;receiptId:string})=>[KINGSLAYER_SOURCE,RISKY_MOVES_SOURCE].some(s=>r.source===s||r.receiptId.startsWith(`["${s}",`));
 for(const r of receipts.filter(ours)){
  const p=expected.find(p=>p.receiptId===r.receiptId);
  if(!p||r.kind!=='gold'||r.source!==p.source||r.amount!==p.amount||r.round!==p.round)throw new RangeError('Invalid batch3 settlement gold authority');
 }
 for(const p of expected)if(!receipts.some(r=>r.receiptId===p.receiptId))throw new RangeError('Missing batch3 settlement gold receipt');
}
