import { validateTombRaider } from './augment-pool-batch5-r1';
import { AUGMENT_BATCH5_H1 } from './content/augment-pool-batch5-h1';
import { AUGMENT_BATCH5_H3 } from './content/augment-pool-batch5-h3';
import { validateSurvivorGold } from './augment-pool-batch5-h4-survivor';
import { validatePortfolioGold } from './augment-pool-batch5-h4';
import { validateContestedGold } from './augment-pool-batch5-h6';
import { validateShopAugments } from './shop-augments';
import { AUGMENT_BATCH5 } from './content/augment-pool-batch5';
import { batch5RewardPlan, validateBatch5Gold } from './augment-pool-batch5-progress';
import { batch4RewardPlan, drainBatch4Gold, validateBatch4Gold } from './augment-pool-batch4-progress';
import { AUGMENT_BATCH4_B4XP } from './content/augment-pool-batch4-b4xp';
import { AUGMENT_BATCH4_B4COMBAT } from './content/augment-pool-batch4-b4combat';
import { formSwapperGiftPlan, validateFormSwapperSelection } from './augment-pool-formswapper';
import { batch2RewardPlan, drainBatch2Gold, validateBatch2Gold } from './augment-pool-batch2-progress';
import { AUGMENT_BATCH2_ENABLED } from './content/augment-pool-batch2';
import type { MatchState } from './match-types';
import type { UnitLootPolicy } from './loot-runtime';
import { AUGMENT_BATCH1 } from './content/augment-pool-batch1';
import { AUGMENT_BATCH3 } from './content/augment-pool-batch3';
import { batch3RewardPlan, drainBatch3Gold, validateBatch3Gold, drainBatch3Dummies, validateBatch3Dummies, drainBatch3Forming } from './augment-pool-batch3-progress';
import { validateFreeRerolls } from './free-rerolls';
import { validateAcquisitionLevels } from './augment-xp';
import { drainSettlementGold, validateSettlementGold } from './augment-settlement-gold';
import { planAugmentGifts, augmentAnvilOffers, AUGMENT_GIFT_SOURCE } from './augment-gift-plan';
import { grantMechanicItem, grantMechanicUnit, grantMechanicConsumable } from './seat-mechanics/grants';
import { isAnvil } from './content/anvils';
import { UNIT_DEFINITIONS } from './units';

/** Derive pending grants from authenticated owned augments, never from a client-supplied reward or receipt. */
export function batch1GiftPlan(state:MatchState) {
 return state.augments.flatMap(a=>planAugmentGifts(state,a,(AUGMENT_BATCH5_H1[a.definitionId as keyof typeof AUGMENT_BATCH5_H1]??(AUGMENT_BATCH5_H3 as Readonly<Record<string,{gifts:readonly import('./augment-gift-plan').AugmentGiftSpec[]}>>)[a.definitionId]??AUGMENT_BATCH5[a.definitionId]??AUGMENT_BATCH1[a.definitionId]??AUGMENT_BATCH2_ENABLED[a.definitionId]??AUGMENT_BATCH3[a.definitionId]??AUGMENT_BATCH4_B4XP[a.definitionId]??AUGMENT_BATCH4_B4COMBAT[a.definitionId])?.gifts??[])).concat(batch2RewardPlan(state),batch3RewardPlan(state),formSwapperGiftPlan(state),batch4RewardPlan(state),batch5RewardPlan(state));
}
/** Offline heroes/anvils retain capacity escrow; online heroes use the existing shared-pool reward orbs.
 * Anvils are summons and stay outside the pool. Revisit blocked gifts after triples free a slot. */
export function drainBatch1Gifts(initial:MatchState,policy?:UnitLootPolicy):MatchState {
 // Dummify/Golemify first: their removal frees the bench for the dummy or golem they grant.
 let state=drainBatch3Forming(initial),progressed:boolean;
 do {
  progressed=false;
  for(const gift of batch1GiftPlan(state)){
   if(state.seatMechanics?.receipts.some(r=>r.receiptId===gift.receiptId))continue;
   const request={...gift,source:AUGMENT_GIFT_SOURCE};
   const result=gift.kind==='unit'?grantMechanicUnit(state,request,policy)
    :gift.kind==='item'?grantMechanicItem(state,request):grantMechanicConsumable(state,request);
   if(result.ok){state=result.state;progressed=true;}
   else if(result.reason!=='bench-full')throw new RangeError(`Augment batch1 grant: ${result.reason} (${gift.definitionId})`);
  }
 }while(progressed);
 return drainBatch3Dummies(drainBatch4Gold(drainSettlementGold(drainBatch3Gold(drainBatch2Gold(state)))));
}
/** Anvil options belong to the acquisition receipt; open order and current round do not affect them. */
export function batch1AnvilSpecification(state:MatchState,receiptId:string) {
 const gift=batch1GiftPlan(state).find(g=>g.receiptId===receiptId);
 return gift?.kind==='unit'&&isAnvil(gift.definitionId)
  ?{definitionId:gift.definitionId,offers:augmentAnvilOffers(state.seed,receiptId,gift.definitionId)}:undefined;
}
export function validateBatch1Gifts(state:MatchState):void {
 validateTombRaider(state);
 validateSurvivorGold(state);
 validatePortfolioGold(state);
 validateContestedGold(state);
 validateBatch5Gold(state);
 validateBatch4Gold(state);
 validateBatch2Gold(state);
 validateFormSwapperSelection(state);
 validateBatch3Gold(state);
 validateAcquisitionLevels(state);
 validateSettlementGold(state);
 validateShopAugments(state);
 validateFreeRerolls(state);
 validateBatch3Dummies(state);
 const gifts=batch1GiftPlan(state),receipts=state.seatMechanics?.receipts??[];
 const fail=()=>{throw new RangeError('Invalid augment batch1 gift authority');};
 for(const r of receipts)if(r.source===AUGMENT_GIFT_SOURCE||r.receiptId.startsWith('["augment-pool-batch1",')){
  const gift=gifts.find(g=>g.receiptId===r.receiptId);
  if(!gift||r.source!==AUGMENT_GIFT_SOURCE||r.kind!==gift.kind||!('definitionId' in r)||r.definitionId!==gift.definitionId||r.round<gift.acquiredRound||r.round>state.round||gift.kind!=='unit'&&r.round!==gift.acquiredRound)fail();
  if(r.kind==='unit'&&gift){
   if((r.starLevel??1)!==(gift.starLevel??1))fail();
   if(isAnvil(r.definitionId)){if(r.resolution!=='held'||r.gold!==0)fail();}
   else if(r.resolution==='gold'?r.gold!==UNIT_DEFINITIONS[r.definitionId].cost:r.gold!==0)fail();
  }
 }
 for(const gift of gifts)if(gift.kind!=='unit'&&!receipts.some(r=>r.receiptId===gift.receiptId))fail();
}
