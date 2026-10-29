import { ITEM_DEFINITIONS } from './content/items';
import type { MatchState } from './match-types';
import { appendAugmentFact, historyCheck, requireAugmentFacts } from './augment-history';
import { transformH13Item } from './augment-pool-batch5-h13-transforms';
import { planAugmentGifts } from './augment-gift-plan';
import { AUGMENT_BATCH5_H13 } from './content/augment-pool-batch5-h13';

/** P-B5-20: only recipes from the ordinary item catalogue can be salvaged.
 * Returns a detached recipe; special items with a completed kind are not admitted. */
export function salvageRecipe(definitionId: string): readonly [string, string] | null {
  const item = ITEM_DEFINITIONS[definitionId];
  if (!item || item.kind !== 'completed' || !item.recipe) return null;
  const [a, b] = item.recipe;
  if (ITEM_DEFINITIONS[a]?.kind !== 'component' || ITEM_DEFINITIONS[b]?.kind !== 'component') return null;
  return [a, b];
}

/** Record completed PvP/PvE at the existing settlement drain, before planning rewards. No second counter. */
export function recordH13Settlements(s:MatchState):MatchState {
  const a=s.augments.find(a=>a.definitionId==='salvage-bin-plus');
  const r=s.roundResults.find(r=>r.round===s.round);
  if(!a||!r||r.round<a.acquiredRound||r.roundKind==='supply'||s.augmentHistory?.facts.some(f=>f.kind==='settled-combat'&&f.settlementId===r.settlementId))return s;
  return appendAugmentFact(s,{kind:'settled-combat',settlementId:r.settlementId,roundKind:r.roundKind});
}
export function salvageRewardPlan(s:MatchState) {
  return s.augments.filter(a=>a.definitionId==='salvage-bin-plus').flatMap(a=>{
    const completed=s.roundResults.filter(r=>r.round>=a.acquiredRound&&r.roundKind!=='supply').map(r=>{
      const facts=requireAugmentFacts(s,'settled-combat',r.round);
      historyCheck(facts.length===1&&facts[0].settlementId===r.settlementId&&facts[0].roundKind===r.roundKind,'settled combat receipt');
      return facts[0];
    });
    const due=completed.filter(f=>f.roundKind==='pvp')[AUGMENT_BATCH5_H13[a.definitionId].source.values.NumRounds-1];
    return due?planAugmentGifts(s,{...a,choiceId:JSON.stringify([a.choiceId,'h13-four-pvp']),acquiredRound:due.round},[{kind:'random-item',pool:'component',count:1}]):[];
  });
}
/** Sale already returned permanent items. Temporary equipment is a separate projection and never enters this list. */
export function salvageSoldItems(before:MatchState,after:MatchState,unitId:string):MatchState {
  const a=before.augments.find(a=>a.definitionId==='salvage-bin-plus');if(!a)return after;
  let s=after;
  for(const original of before.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===unitId).sort((a,b)=>(a.location.kind==='unit'?a.location.slot:0)-(b.location.kind==='unit'?b.location.slot:0))){
    const recipe=salvageRecipe(original.definitionId);if(!recipe)continue;
    s=transformH13Item(s,a.choiceId,{...original,location:{kind:'inventory'}},recipe);
  }
  return s;
}
