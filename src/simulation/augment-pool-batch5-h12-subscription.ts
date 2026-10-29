import type { MatchState, ShopSlot } from './match-types';
import type { OwnedAugment } from './strategy-types';
import type { CostTier } from './unit-types';
import { AUGMENT_BATCH5_H12 } from './content/augment-pool-batch5-h12';
import { requireAugmentFacts } from './augment-history';
import { grantMechanicGold } from './seat-mechanics/grants';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { MATCH_RULES, SHOP_CATALOG_BY_COST } from './match-rules';
import { nextRandom } from './rng';

const ID='subscription-service', SUBSCRIPTION_SIZE=4, SHOP_AUGMENT_SOURCE='augment-pool-shop';
const owned=(state:Pick<MatchState,'augments'>)=>state.augments.filter(a=>a.definitionId===ID);
const sourceValue=(key:string)=>AUGMENT_BATCH5_H12[ID].source.values[key]!;
const receiptId=(a:OwnedAugment,n:number)=>JSON.stringify([SHOP_AUGMENT_SOURCE,'subscription',a.choiceId,n]);
function acquisition(state:MatchState,a:OwnedAugment) {
 const fact=requireAugmentFacts(state,'acquire',a.acquiredRound).find(f=>f.choiceId===a.choiceId&&f.definitionId===ID);
 if(!fact)throw new RangeError('Invalid augment history: missing Subscription Service acquisition');
 return fact;
}
/** A stage is due only after the authenticated acquisition and a real natural-round entry. */
function stageDue(state:MatchState,a:OwnedAugment,round:number):boolean {
 if(round<=acquisition(state,a).round||getMultiplayerRoundByOrdinal(round).subround!==1)return false;
 requireAugmentFacts(state,'round-entry',round);
 return true;
}

/** Round entry, after income and scheduled gifts: Subscription Service gold. */
export function enterShopAugmentRound(initial:MatchState):MatchState {
 let state=initial;const round=state.round;
 for(const a of owned(state))if(stageDue(state,a,round)){
  const id=receiptId(a,round),amount=sourceValue('GoldPerStage');
  const previous=state.seatMechanics?.receipts.find(r=>r.receiptId===id);
  if(previous){
   if(previous.kind!=='gold'||previous.source!==SHOP_AUGMENT_SOURCE||previous.round!==round||previous.amount!==amount)
    throw new RangeError('Shop augment stage gold: conflicting subscription receipt');
   continue;
  }
  const result=grantMechanicGold(state,{receiptId:id,source:SHOP_AUGMENT_SOURCE,amount});
  if(!result.ok)throw new RangeError(`Shop augment stage gold: ${result.reason}`);state=result.state;
 }
 return state;
}

/** Subscription Service opens on acquisition and at every stage start after it. */
export function subscriptionAcquired(before:MatchState,after:MatchState):boolean {
 return owned(after).some(a=>!before.augments.some(b=>b.choiceId===a.choiceId)&&acquisition(after,a).round===after.round);
}
export function subscriptionStageStart(state:MatchState,round:number):boolean {
 return owned(state).some(a=>stageDue(state,a,round));
}
/** Subscription Service shop: SUBSCRIPTION_SIZE distinct ChampionTier champions weighted by available copies, the rest empty.
 * `take` reserves one copy; the caller owns the pool ledger. Draws use the seat's shop RNG like a normal refresh. */
export function drawSubscriptionSlots(state:MatchState,available:Readonly<Record<string,number>>,take:(definitionId:string,slot:number)=>void):{readonly slots:ShopSlot[];readonly rngState:number;readonly rngDraws:number} {
 const tier=sourceValue('ChampionTier') as CostTier;
 const slots:ShopSlot[]=[],picked=new Set<string>();let rngState=state.rngState,rngDraws=0;
 for(let slot=0;slot<MATCH_RULES.shopSize;slot++){
  const catalog=SHOP_CATALOG_BY_COST[tier].filter(id=>!picked.has(id)&&available[id]>0),total=catalog.reduce((n,id)=>n+available[id],0);
  if(slot>=SUBSCRIPTION_SIZE||!total){slots.push({status:'purchased',empty:true});continue;}
  const draw=nextRandom(rngState);rngState=draw.state;rngDraws++;
  let copy=Math.floor(draw.word*total/4294967296);
  const definitionId=catalog.find(id=>{if(copy<available[id])return true;copy-=available[id];return false;})!;
  picked.add(definitionId);take(definitionId,slot);slots.push({status:'available',definitionId});
 }
 return {slots,rngState,rngDraws};
}

