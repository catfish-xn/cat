// 存档恢复专用校验；单人和联机恢复共用，实时对局命令不引用这里。
import { validateAugmentAuthority, type AugmentHistoryAuthority } from '../augment-history';
import { augmentNeedsHistory } from '../augment-history-owners';
import type { SharedPoolState } from '../shared-pool-types';
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
import { validateRestartMission } from './restart-mission-check';

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
 validateBatch1GiftReceipts(state);
}

/** Gift identity/contents alone: also required while a seat is in the carousel,
 * before normal preparation/economy restoration can run. Inspect receipts even
 * without an owner so deleting the augment cannot bypass this admission. */
export function validateBatch1GiftReceipts(state:MatchState):void {
 validateRestartMission(state);
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

/** Read the gift owner from a trusted pool reservation/receipt, not the candidate seat's owners or receipts. */
function rewardNeedsAugmentHistory(dropId:string):boolean {
  try {
    const drop:unknown=JSON.parse(dropId);
    if(!Array.isArray(drop))return false;
    let receiptId:unknown;
    if(drop[0]==='mechanic')receiptId=drop[1];
    else {
      const orb:unknown=typeof drop[0]==='string'?JSON.parse(drop[0]):null;
      if(!Array.isArray(orb)||orb[0]!=='orb'||orb[2]!=='mechanic')return false;
      receiptId=orb[3];
    }
    const gift:unknown=typeof receiptId==='string'?JSON.parse(receiptId):null;
    return Array.isArray(gift)&&gift[0]===AUGMENT_GIFT_SOURCE&&typeof gift[2]==='string'&&augmentNeedsHistory(gift[2]);
  } catch { return false; }
}

/** Trusted pool evidence requires authority even if the candidate erases its gift claims. */
export function trustedPoolGiftRequiresAuthority(pool:SharedPoolState,state:MatchState):boolean {
 return [...pool.pending,...pool.rewards].some(r=>r.seatId===state.sharedPool!.seatId&&rewardNeedsAugmentHistory(r.dropId));
}

/** Carousel restore authenticates history before inspecting initial-gift receipts. */
export function validateOnlineBatch1GiftAuthority(pool:SharedPoolState,state:MatchState,authority?:AugmentHistoryAuthority):void {
 validateAugmentAuthority(state,authority,trustedPoolGiftRequiresAuthority(pool,state));
 validateBatch1GiftReceipts(state);
}
