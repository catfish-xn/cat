import { historyCheck } from './augment-history';
import type { AugmentHistoryFact } from './augment-history-types';
import type { MatchState } from './match-types';

/** Bounded structural preflight only. Command replay / independent room authority authenticate the facts. */
export function preflightH13Fact(state: MatchState, fact: AugmentHistoryFact): void {
  if (fact.kind === 'augment-item-transform' || fact.kind === 'inventory-transform-entry') {
    const owner = state.augments.find(a => a.choiceId === fact.choiceId);
    historyCheck(owner && ['salvage-bin-plus', 'artifactory', 'pandoras-items-iii'].includes(owner.definitionId)
      && owner.acquiredRound <= fact.round, 'item history owner');
    if (fact.kind === 'inventory-transform-entry') {
      historyCheck(owner.definitionId !== 'salvage-bin-plus' && owner.acquiredRound < fact.round
        && Array.isArray(fact.itemIds) && fact.itemIds.length <= 1024
        && fact.itemIds.every(id => typeof id === 'string' && /^item-[1-9][0-9]*$/.test(id))
        && new Set(fact.itemIds).size === fact.itemIds.length, 'inventory entry bounds');
    } else {
      historyCheck(fact.input && typeof fact.input.id === 'string'
        && fact.input.location?.kind === 'inventory' && Array.isArray(fact.outputs)
        && fact.outputs.length === (owner.definitionId === 'salvage-bin-plus' ? 2 : 1)
        && fact.outputs.every(i => i && typeof i.id === 'string' && typeof i.definitionId === 'string' && i.location?.kind === 'inventory'), 'item transform bounds');
      historyCheck(fact.receiptId === JSON.stringify(['batch5-h13', fact.choiceId, fact.round, fact.input.id]), 'item transform receipt');
    }
  } else if (fact.kind === 'settled-combat') {
    const owner = state.augments.find(a => a.definitionId === 'salvage-bin-plus');
    const result = state.roundResults.find(r => r.round === fact.round);
    historyCheck(owner && owner.acquiredRound <= fact.round && result
      && result.settlementId === fact.settlementId && result.roundKind === fact.roundKind
      && (fact.roundKind === 'pvp' || fact.roundKind === 'pve'), 'settled combat boundary');
  }
}
