// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { AUGMENT_SHOP } from '../content/augment-pool-shop';
import type { MatchState } from '../match-types';

/** A shared snapshot must not authenticate acquisition gold using its own receipt.
 * Shop history checks subsequent cash flow; bind this initial receipt to content. */
export function validateBatch5R5ShopAcquisition(state: MatchState): void {
  const owners = state.augments.filter(a => AUGMENT_SHOP[a.definitionId]?.rule === 'starry');
  const receipts = state.scheduleReceipts.filter(r => r.definitionId && AUGMENT_SHOP[r.definitionId]?.rule === 'starry');
  const fail = () => { throw new RangeError('Invalid Starry Night acquisition'); };
  if (owners.length > 1 || receipts.length !== owners.length) fail();
  for (const a of owners) {
    const r = receipts.find(r => r.eventId === a.choiceId);
    if (!r || r.kind !== 'augment' || r.definitionId !== a.definitionId || r.round !== a.acquiredRound
      || r.gold !== AUGMENT_SHOP[a.definitionId].source.values.Gold || r.itemIds.length || r.unitId !== null) fail();
  }
}
