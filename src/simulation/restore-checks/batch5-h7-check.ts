// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { BATCH5_H7_SOURCE, batch5H7GoldPlan } from '../augment-pool-batch5-h7';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundByOrdinal } from '../multiplayer-round';

export function validateBatch5H7Gold(state: MatchState): void {
  const expected = batch5H7GoldPlan(state);
  const actual = (state.seatMechanics?.receipts ?? []).filter(r => r.source === BATCH5_H7_SOURCE || r.receiptId.startsWith(`["${BATCH5_H7_SOURCE}",`));
  if (actual.length !== expected.length || new Set(actual.map(r => r.receiptId)).size !== expected.length || actual.some(r => {
    const p = expected.find(p => p.receiptId === r.receiptId);
    return !p || r.source !== p.source || r.kind !== 'gold' || r.amount !== p.amount || r.round !== p.round ||
      r.roundId !== getMultiplayerRoundByOrdinal(p.round).roundId;
  })) throw new RangeError('Invalid batch5 h7 gold authority');
}
