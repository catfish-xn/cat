import { g23RadiantDefinitionId } from './g2-3-rewards';
import { canonicalContent } from './content';
import { masterworkCandidates, planConsumable, previewUseConsumable } from './consumables';
import { appendResourceProvenance } from './resource-provenance';
import { openMechanicChoice, resolveMechanicChoice } from './seat-mechanics/choices';
import type { MatchState, MatchCommandResult } from './match-types';
import type { ConsumableTarget } from './consumable-types';

/** Selecting a unit opens its armory without spending the tool. A direct item target cannot bypass that step. */
export function openMasterworkChoice(state: MatchState, consumableId: string, target: ConsumableTarget): MatchCommandResult {
  const refused = (reason: 'invalid-consumable-target'): MatchCommandResult => ({ok:false,state,reason});
  if (target?.kind !== 'unit' || target.itemId !== undefined) return refused('invalid-consumable-target');
  const preview = previewUseConsumable(state, consumableId, target);
  if (!preview.ok) return {ok:false,state,reason:preview.reason};
  if (preview.effect !== 'masterwork-upgrade') return refused('invalid-consumable-target');
  const offers = preview.affectedItemIds;
  return openMechanicChoice(state, {choiceId: JSON.stringify(['masterwork', consumableId]), offers, returnPhase:'preparation',
    payload:{kind:'armory',source:'masterwork-upgrade',masterwork:{consumableId,unitId:target.unitId},
      prices:Object.fromEntries(offers.map(id=>[id,0])),timeoutOption:offers[0]}});
}
/** Resolving the chosen instance, consuming the tool, transforming and unequipping commit together. */
export function completeMasterworkChoice(state: MatchState, optionId: string, timedOut: boolean): MatchCommandResult {
  if (state.pendingChoice?.payload?.source !== 'masterwork-upgrade') return {ok:false,state,reason:'invalid-choice'};
  try { validateMasterworkChoice(state); } catch { return {ok:false,state,reason:'invalid-choice'}; }
  const payload = state.pendingChoice!.payload!;
  if (payload.kind !== 'armory' || !payload.masterwork) return {ok:false,state,reason:'invalid-choice'};
  const resolved = resolveMechanicChoice(state, optionId, timedOut);
  if (!resolved.ok) return resolved;
  const plan = planConsumable({...resolved.state,phase:'preparation',combat:null}, payload.masterwork.consumableId,
    {kind:'unit',unitId:payload.masterwork.unitId,itemId:optionId});
  if (!plan.ok) return {ok:false,state,reason:plan.reason};
  return {ok:true,state:{...plan.state,resourceProvenance:appendResourceProvenance(plan.state.resourceProvenance,
    state.roundDefinitionId,{kind:'consumable-used',record:plan.record})},events:[...resolved.events,...plan.events]};
}
export function validateMasterworkChoice(state: MatchState): void {
  const choice = state.pendingChoice;
  if (choice?.payload?.source !== 'masterwork-upgrade' && !choice?.choiceId.startsWith('["masterwork",')) return;
  const fail = (): never => {throw new RangeError('Invalid masterwork choice');};
  const payload = choice?.payload;
  if (!choice || payload?.kind !== 'armory' || !payload.masterwork || state.phase !== 'choice') return fail();
  const expected = openMasterworkChoice({...state,phase:'preparation',combat:null,pendingChoice:null},payload.masterwork.consumableId,
    {kind:'unit',unitId:payload.masterwork.unitId});
  if (!expected.ok || canonicalContent(expected.state.pendingChoice) !== canonicalContent(choice)) fail();
}
/** Owner-only UI mapping. Offers are instance IDs, and the item definition is not the option ID. */
export function readMasterworkOptions(state: MatchState, unitId: string) {
  return masterworkCandidates(state,unitId).map(item=>({itemId:item.id,definitionId:item.definitionId,radiantDefinitionId:g23RadiantDefinitionId(item.definitionId)!}));
}
