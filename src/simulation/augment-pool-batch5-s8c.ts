import { planAugmentGifts } from './augment-gift-plan';
import { EMBLEM_ITEMS } from './content/emblems';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { UNIT_DEFINITIONS } from './units';
import type { MatchState } from './match-types';
import type { CostTier } from './unit-types';

/** Draw once from the existing 22-emblem pool; all subsequent rewards use that same trait. */
export function hardCommitRewardPlan(state:MatchState) {
 return state.augments.flatMap(a=>{
  if(a.definitionId!=='hard-commit')return [];
  const emblem=planAugmentGifts(state,a,[{kind:'random-item',pool:'emblem',count:1}]);
  const trait=EMBLEM_ITEMS[emblem[0].definitionId].emblemTrait!;
  const gifts=[...emblem];
  for(let round=a.acquiredRound;round<=state.round;round++){
   const info=getMultiplayerRoundByOrdinal(round);
   if(round!==a.acquiredRound&&info.subround!==1)continue;
   const target=Math.min(info.stage,5);
   const costs=[...Array.from({length:target},(_,i)=>target-i),...Array.from({length:5-target},(_,i)=>target+i+1)];
   const definitions=costs.map(cost=>SHOP_CATALOG_BY_COST[cost as CostTier].filter(id=>UNIT_DEFINITIONS[id].traits.includes(trait))).find(ids=>ids.length>0);
   if(!definitions)continue;
   const owner={...a,choiceId:JSON.stringify([a.choiceId,'hard-commit',round]),acquiredRound:round};
   gifts.push(...planAugmentGifts(state,owner,[{kind:'random-unit-pool',definitions,count:1}]));
  }
  return gifts;
 });
}
