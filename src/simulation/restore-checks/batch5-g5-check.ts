// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { BATCH5_G5_SOURCE, batch5G5GiftPlan, expectedUnexpectednessRolls } from '../augment-pool-batch5-g5';
import { pipelineGoldPlan } from '../augment-pool-batch5-g5-pipeline';
import { isAnvil } from '../content/anvils';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundByOrdinal } from '../multiplayer-round';
import { validatePipelineHistory } from './pipeline-history-check';

export function validateBatch5G5Rewards(state: MatchState): void {
  validatePipelineHistory(state);
  const plan = [...expectedUnexpectednessRolls(state), ...pipelineGoldPlan(state)].filter(r => r.reward.gold);
  const actual = (state.seatMechanics?.receipts ?? []).filter(r => r.source === BATCH5_G5_SOURCE || r.receiptId.startsWith(`["${BATCH5_G5_SOURCE}",`));
  if (actual.length !== plan.length || new Set(actual.map(r => r.receiptId)).size !== actual.length || actual.some(r => !plan.some(p => p.receiptId === r.receiptId && r.source === BATCH5_G5_SOURCE
    && r.kind === 'gold' && r.amount === p.reward.gold && r.round === p.round && r.roundId === getMultiplayerRoundByOrdinal(p.round).roundId)))
    throw new RangeError('Invalid batch5 g5 reward authority');
  // Online heroes always have an escrow receipt. Anvils retain the existing full-bench pending-gift policy.
  if (state.multiplayer && batch5G5GiftPlan(state).some(g => g.kind === 'unit' && !isAnvil(g.definitionId)
    && !state.seatMechanics?.receipts.some(r => r.receiptId === g.receiptId)))
    throw new RangeError('Invalid batch5 g5 missing gift');
}
