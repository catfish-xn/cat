import { canonicalContent } from './content';
import { COMPONENT_POOL, validateComponentCandidates } from './component-pool';
import { compareLootChoices, lootChoiceId } from './loot-identity';
import type { LootChoiceDescriptor, LootChoiceEligibility, LootChoiceResolution } from './loot-types';
import type { PendingChoice } from './strategy-types';
import { freezeContent } from './content/freeze';

/** Pure domain order primitive. No exposure of fallback, award, phase or live Match mutation. */
export function orderedUnresolvedLootChoices(descriptors:readonly LootChoiceDescriptor[], eligibility:readonly LootChoiceEligibility[], resolutions:readonly LootChoiceResolution[]):readonly LootChoiceDescriptor[] {
  return descriptors.filter(d=>eligibility.some(e=>e.dropId===d.dropId && e.status==='revealed') && !resolutions.some(r=>r.dropId===d.dropId)).sort(compareLootChoices);
}
export function makeLootPendingChoice(descriptor:LootChoiceDescriptor):PendingChoice {
  validateComponentCandidates(COMPONENT_POOL.map(p=>p.definitionId),descriptor.poolVersion);
  const choiceId=lootChoiceId(descriptor.dropId);
  return freezeContent({kind:'component',step:'offer',choiceId,eventId:choiceId,generation:0,returnPhase:'settlement',
    offers:COMPONENT_POOL.map(p=>p.definitionId),targetId:null,rerollCount:0});
}
/** Restore and domain entry must call this before any projection. Never normalize corrupt values. */
export function validateLootPendingChoice(value:unknown, descriptor:LootChoiceDescriptor):void {
  if(canonicalContent(value)!==canonicalContent(makeLootPendingChoice(descriptor))) throw new RangeError('Invalid loot pending choice');
}
