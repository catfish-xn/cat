import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { appendAugmentFact, historyCheck } from './augment-history';
import { appendResourceProvenance } from './resource-provenance';
import type { AugmentItemTransform } from './augment-history-types';
import type { MatchState } from './match-types';
import type { ItemInstance } from './strategy-types';
import { canonicalContent } from './content';

/** Called only inside a traced domain transaction. History owns the evidence; the resource row preserves order. */
export function transformH13Item(s: MatchState, choiceId: string, input: ItemInstance, definitions: readonly string[]): MatchState {
  historyCheck(s.augments.some(a=>a.choiceId===choiceId&&['salvage-bin-plus','artifactory','pandoras-items-iii'].includes(a.definitionId)),'transform owner');
  historyCheck(definitions.length>0&&definitions.length<=2,'transform output count');
  const receiptId=JSON.stringify(['batch5-h13',choiceId,s.round,input.id]);
  const previous=s.augmentHistory?.facts.find(f=>f.kind==='augment-item-transform'&&f.receiptId===receiptId);
  if(previous?.kind==='augment-item-transform'){
    historyCheck(canonicalContent(previous.input)===canonicalContent(input)&&canonicalContent(previous.outputs.map(i=>i.definitionId))===canonicalContent(definitions),'transform receipt conflict');
    return s;
  }
  const outputs=definitions.map((definitionId,i):ItemInstance=>({id:`item-${s.nextItemSerial+i}`,definitionId,location:{kind:'inventory'}}));
  const fact:AugmentItemTransform={kind:'augment-item-transform',choiceId,receiptId,input,outputs};
  const plan=replayH13Transform(s.items,s.nextItemSerial,fact);
  const recorded=appendAugmentFact(s,fact);
  return {...recorded,...plan,resourceProvenance:appendResourceProvenance(s.resourceProvenance,getMultiplayerRoundByOrdinal(s.round).roundId,fact)};
}
export function replayH13Transform(items:readonly ItemInstance[],nextItemSerial:number,fact:AugmentItemTransform):{items:readonly ItemInstance[];nextItemSerial:number} {
  historyCheck(items.some(i=>canonicalContent(i)===canonicalContent(fact.input)),'transform input ownership/location');
  for(const [i,output] of fact.outputs.entries())historyCheck(output.id===`item-${nextItemSerial+i}`&&output.location.kind==='inventory','transform serial/location');
  return {items:[...items.filter(i=>i.id!==fact.input.id),...fact.outputs],nextItemSerial:nextItemSerial+fact.outputs.length};
}
