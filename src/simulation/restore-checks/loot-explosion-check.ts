// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { historyCheck } from '../augment-history';
import { LOOT_EXPLOSION_SOURCE, lootExplosionRewardPlan } from '../augment-pool-batch5-g7';
import { canonicalContent } from '../content/index';
import type { MatchState } from '../match-types';
import { getMultiplayerRoundByOrdinal } from '../multiplayer-round';

export function validateLootExplosionRewards(state:MatchState):void {
  const expected=lootExplosionRewardPlan(state),actual=(state.seatMechanics?.receipts??[]).filter(r=>r.source===LOOT_EXPLOSION_SOURCE || r.receiptId.startsWith(`["${LOOT_EXPLOSION_SOURCE}",`));
  historyCheck(actual.length===expected.length && new Set(actual.map(r=>r.receiptId)).size===actual.length,'loot explosion reward count');
  for(const receipt of actual) {
    const p=expected.find(p=>p.receiptId===receipt.receiptId);
    historyCheck(p && receipt.source===p.source && receipt.round===p.round && receipt.roundId===getMultiplayerRoundByOrdinal(p.round).roundId,'loot explosion reward identity');
    historyCheck(receipt.kind===p.reward.kind && (receipt.kind==='gold' ? p.reward.kind==='gold'&&receipt.amount===p.reward.amount : receipt.kind==='item'&&p.reward.kind==='item'&&receipt.definitionId===p.reward.definitionId),'loot explosion reward value');
    if(receipt.kind==='item')historyCheck(state.resourceProvenance.entries.some(e=>e.kind==='item-acquired' && e.itemId===receipt.itemId && canonicalContent(e.source)===canonicalContent({kind:'mechanic',receiptId:receipt.receiptId})),'loot explosion item provenance');
  }
}
