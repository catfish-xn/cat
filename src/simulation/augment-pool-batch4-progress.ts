import type { MatchState } from './match-types';
import type { OwnedAugment } from './strategy-types';
import { AUGMENT_BATCH4 } from './content/augment-pool-batch4';
import { acquisitionLevels } from './augment-xp';
import { planAugmentGifts, type AugmentGiftSpec } from './augment-gift-plan';
import { grantMechanicGold } from './seat-mechanics/grants';

export const AUGMENT_BATCH4_SOURCE='augment-pool-batch4';
/** First authoritative round in which this level was reached. Round results retain both preparation and settlement
 * levels; the current preparation is the only suffix not yet in that history. Never trust a separate reward counter. */
export function batch4LevelRound(state:MatchState,a:OwnedAugment,level:number):number {
 if(level<=acquisitionLevels(state)[a.choiceId])return a.acquiredRound;
 return state.roundResults.find(r=>r.round>=a.acquiredRound&&(r.levelBefore>=level||r.levelAfter>=level))?.round??state.round;
}
const rewardOwner=(a:OwnedAugment,level:number,round:number):OwnedAugment=>({...a,choiceId:JSON.stringify([a.choiceId,'batch4-level',level]),acquiredRound:round});
/** Acquisition hero plus one deterministic reward per reached level. Threshold rows also pay thresholds already reached
 * on selection (P-B4); repeat rows count strictly later level-ups. Full benches keep the existing pending-gift plan. */
export function batch4RewardPlan(state:MatchState) {
 return state.augments.flatMap(a=>{
  const row=AUGMENT_BATCH4[a.definitionId];if(!row)return [];
  const from=acquisitionLevels(state)[a.choiceId];if(from===undefined)return [];
  const gifts=planAugmentGifts(state,a,row.gifts);
  for(let level=1;level<=state.level;level++){
   const round=batch4LevelRound(state,a,level),owner=rewardOwner(a,level,round);
   let specs:readonly AugmentGiftSpec[]=row.thresholds?.find(t=>row.source.values[t.level]===level)?.gifts??[];
   if(row.perLevel&&level>from){
    specs='copyOf' in row.perLevel?[{kind:'unit',definitionId:gifts[row.perLevel.copyOf].definitionId}]
     :[{kind:'random-unit',cost:Math.max(row.perLevel.minCost,level-row.perLevel.costOffset) as 1|2|3|4|5|6,count:1,starLevel:row.perLevel.starLevel}];
   }
   gifts.push(...planAugmentGifts(state,owner,specs));
  }
  return gifts;
 });
}
export function goldPlan(state:MatchState) {
 return state.augments.flatMap(a=>{
  const row=AUGMENT_BATCH4[a.definitionId],threshold=row?.goldThreshold;if(!threshold||state.level<row.source.values[threshold.level]!)return [];
  return [{receiptId:JSON.stringify([AUGMENT_BATCH4_SOURCE,a.choiceId,'level',row.source.values[threshold.level]]),source:AUGMENT_BATCH4_SOURCE,
   amount:row.source.values[threshold.amount]!,round:batch4LevelRound(state,a,row.source.values[threshold.level]!)}];
 });
}
export function drainBatch4Gold(initial:MatchState):MatchState {
 let state=initial;
 for(const p of goldPlan(state)){
  if(state.seatMechanics?.receipts.some(r=>r.receiptId===p.receiptId))continue;
  const result=grantMechanicGold(state,p);if(!result.ok)throw new RangeError('Batch4 gold '+result.reason);state=result.state;
 }
 return state;
}

