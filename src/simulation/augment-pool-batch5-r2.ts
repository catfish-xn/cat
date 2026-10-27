import { ANGER_RAGEBLADE, isAngerIssuesConvertibleItem } from './content/augment-pool-batch5-r2';
import { appendResourceProvenance } from './resource-provenance';
import type { MatchState } from './match-types';
import type { ItemDefinition, ItemInstance, OwnedAugment } from './strategy-types';
export { isAngerIssuesConvertibleItem } from './content/augment-pool-batch5-r2';

/** P-B5-21: only completed items from the ordinary recipe catalogue qualify.
 * Special items and emblems live in separate catalogues and must never be
 * inferred to be ordinary merely from their `kind: completed` property.
 * Compute the identity-preserving conversion; the caller must record and
 * authenticate this transition as part of the same resource transaction. */
export function convertAngerIssuesItems(
  items: readonly import('./strategy-types').ItemInstance[],
): readonly import('./strategy-types').ItemInstance[] {
  return items.map(item => isAngerIssuesConvertibleItem(item.definitionId) && item.definitionId !== 'rageblade'
    ? { ...item, definitionId: 'rageblade' } : item);
}

/** Same atomic transaction as the raw birth/combine/choice; receipts retain the original reward. */
export function applyAngerIssues(state:MatchState):MatchState {
  const owner=state.augments.find(a=>a.definitionId==='anger-issues');
  if(!owner)return state;
  const converted=state.items.filter(i=>i.definitionId!=='rageblade'&&isAngerIssuesConvertibleItem(i.definitionId));
  if(!converted.length)return state;
  return {...state,items:convertAngerIssuesItems(state.items),resourceProvenance:appendResourceProvenance(state.resourceProvenance,state.roundDefinitionId,
    converted.map(i=>({kind:'anger-item-converted' as const,itemId:i.id,from:i.definitionId,to:'rageblade',receiptId:owner.choiceId})))};
}

export function r2ItemDefinition(item:ItemDefinition,augments:readonly OwnedAugment[]):ItemDefinition {
  return isAngerIssuesConvertibleItem(item.id)&&augments.some(a=>a.definitionId==='anger-issues')?ANGER_RAGEBLADE:item;
}

export function replayAngerConversion(items:readonly ItemInstance[],fact:{itemId:string;from:string;to:string}):readonly ItemInstance[] {
  if(!items.some(i=>i.id===fact.itemId&&i.definitionId===fact.from)||!isAngerIssuesConvertibleItem(fact.from)||fact.from==='rageblade'||fact.to!=='rageblade')
    throw new RangeError('Invalid anger issues conversion');
  return items.map(i=>i.id===fact.itemId?{...i,definitionId:'rageblade'}:i);
}
