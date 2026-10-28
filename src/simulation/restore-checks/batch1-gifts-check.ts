// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { AUGMENT_GIFT_SOURCE } from '../augment-gift-plan';
import { batch1GiftPlan } from '../augment-pool-grants';
import { isAnvil } from '../content/anvils';
import type { MatchState } from '../match-types';
import { UNIT_DEFINITIONS } from '../units';
import { validateAcademicGifts } from './academic-gifts-check';
import { validateAcquisitionLevels } from './acquisition-levels-check';
import { validateBatch2Gold } from './batch2-gold-check';
import { validateBatch3Dummies, validateBatch3Gold } from './batch3-progress-check';
import { validateBatch4Gold } from './batch4-gold-check';
import { validateBatch5G5Rewards } from './batch5-g5-check';
import { validateBatch5H7Gold } from './batch5-h7-check';
import { validateBatch5H8Gold } from './batch5-h8-check';
import { validateBatch5H8Deaths } from './batch5-h8-deaths-check';
import { validateBatch5Gold } from './batch5-progress-check';
import { validateBatch5S6cGold } from './batch5-s6c-check';
import { validateContestedGold } from './contested-gold-check';
import { validateFormSwapperSelection } from './form-swapper-check';
import { validateFreeRerolls } from './free-rerolls-check';
import { validateLootExplosionRewards } from './loot-explosion-check';
import { validatePortfolioGold } from './portfolio-gold-check';
import { validateSettlementGold } from './settlement-gold-check';
import { validateShopAugments } from './shop-augments-check';
import { validateSurvivorGold } from './survivor-gold-check';
import { validateTombRaider } from './tomb-raider-check';

export function validateBatch1Gifts(state:MatchState):void {
 validateTombRaider(state);
 validateBatch5G5Rewards(state);
 validateLootExplosionRewards(state);
 validateSurvivorGold(state);
 validatePortfolioGold(state);
 validateContestedGold(state);
 validateAcademicGifts(state);
 validateBatch5S6cGold(state);
 validateBatch5H7Gold(state);
 validateBatch5H8Gold(state);
 validateBatch5H8Deaths(state);
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
