import { AUGMENT_BATCH5_H6 } from './content/augment-pool-batch5-h6';
import { validateAugmentHistory, preflightAugmentHistory } from './augment-history-restore';
import type { AugmentHistoryAuthority } from './augment-history';
import { recordShopDraw, recordShopRelease, validateShopHistory } from './shop-history';
import type { ShopDrawCause } from './shop-history-types';
import { AUGMENT_BATCH5 } from './content/augment-pool-batch5';
import { buyXpWithShopRefresh } from './match';
import { AUGMENT_BATCH4 } from './content/augment-pool-batch4';
import { validateBatch1Gifts } from './augment-pool-grants';
import { validateAugmentOfferHistory } from './augment-offers';
import { spendFreeReroll } from './free-rerolls';
import { planRiggedShop, drawSubscriptionSlots, subscriptionAcquired, subscriptionStageStart, planFiresale, stealFiresaleUnit,
  recordShopReroll, starryUpgrade, validateShopAugments } from './shop-augments';
import { createOpeningEncounter, bindSharedOpeningEncounter, applyOpeningEffects, planOpeningRound } from './opening-encounter';
import { planSixCostShop, sixCostShopContext } from './six-cost-shop';
import { validateEpicForges } from './epic-forges';
import { validateConsumableState } from './consumables';
import { selectOpeningUnit } from './opening-unit';
import { shareGeneratedJson } from './immutable-json';
import { createOrbLayout, freezeOrbLayoutThroughRound } from './orb-layout';
import { FINAL_ROUND } from './round-schedule';
import { prepareMatchLoot } from './loot-runtime';
import { claimOrb } from './match';
import { forfeitUnclaimedOrbs } from './orb-claim';
import { validateMultiplayerOrbLedger } from './orb-restore';
import { createMatch, createCarouselMatch, useConsumable,claimG23Reward } from './match';
import { canOperateMatch } from './operation-policy';
import { canonicalContent, CONTENT_DIGEST } from './content';
import { M8_VERSION } from './m8/version';
import { MATCH_RULES, SHOP_CATALOG, SHOP_CATALOG_BY_COST } from './match-rules';
import { openAnvil, buyUnit, sellUnit, setShopLock, advanceMultiplayerRound, startMatchCombat, stepMatch, settleMatchCombatStream, selectChoice,
  forfeitPendingChoice, claimOrDiscardLoot, rerollAugment } from './match';
import { externalAugmentBlocks } from './augment-offers';
import { enableMultiplayerSettlement, applyRoundSettlement } from './round-settlement';
import type { MultiplayerCommandResult } from './round-settlement';
import type { MatchEvent, MatchState, ShopSlot } from './match-types';
import type { UnitLootPolicy } from './loot-runtime';
import { nextRandom, validateSeed } from './rng';
import { getShopOdds } from './progression';
import { UNIT_DEFINITIONS } from './units';
import type { CostTier } from './unit-types';
import { SHARED_POOL_VERSION, POOL_CAPACITY_BY_COST, type SharedPoolState, type SharedPoolResult,
  type SharedPoolBatchResult, type SharedPoolEvent, type SharedPoolFailure, type SharedMatchCommand } from './shared-pool-types';
import { PoolError, requirePool, safe, sourceKey, draftPool, releaseShop, returnHolding,
  assertSharedPoolConservation, reconcileHoldings, rewardPolicy, type PoolDraft } from './shared-pool-ledger';
export { SHARED_POOL_VERSION, POOL_CAPACITY_BY_COST, assertSharedPoolConservation };
export type * from './shared-pool-types';

/** Restore only against the matching authoritative pool snapshot; offline restoreMatch remains offline-only. */
export function restoreSharedOrbSnapshot(pool:SharedPoolState,input:unknown,authority?:AugmentHistoryAuthority):MatchState {
  const state=(typeof input==='string'?JSON.parse(input):structuredClone(input)) as MatchState;
  requirePool(state.rulesVersion===M8_VERSION.rulesVersion&&state.contentVersion===M8_VERSION.contentVersion
    &&state.contentDigest===CONTENT_DIGEST&&state.schemaVersion===M8_VERSION.schemaVersion,'invalid-seat-state');
  preflightAugmentHistory(state);
  canonicalContent(state); assertSharedPoolConservation(pool,[state]);validateMultiplayerOrbLedger(state);validateConsumableState(state);validateEpicForges(state);validateAugmentOfferHistory(state);
  validateShopAugments(state);validateShopHistory(state);validateAugmentHistory(state,authority);
  // New level rewards use the same acquisition/gift/gold authority as offline restore. Also inspect receipt namespaces
  // so deleting the owner cannot turn a forged Batch4 receipt into an unvalidated generic mechanic receipt.
  if(state.augments.some(a=>AUGMENT_BATCH4[a.definitionId]||AUGMENT_BATCH5[a.definitionId]||Object.hasOwn(AUGMENT_BATCH5_H6,a.definitionId))||state.resourceProvenance.entries.some(e=>e.kind==='dual-purpose-selected'||e.kind==='dual-purpose-xp-purchased')||(state.seatMechanics?.receipts??[]).some(r=>
    r.source==='augment-pool-batch5-h6'||r.receiptId.startsWith('["augment-pool-batch5-h6",')||r.source==='augment-pool-batch5'||Object.keys(AUGMENT_BATCH5).some(id=>r.receiptId.includes(id))||r.source==='augment-pool-batch4'||Object.keys(AUGMENT_BATCH4).some(id=>r.receiptId.includes(id))))validateBatch1Gifts(state);
  return state;
}

/** Omitted capacities use Riot sizes. Explicit partial capacities are isolated test/config fixtures;
 * unspecified heroes have zero copies, and no definition outside the 19-hero slice is allowed. */
export function createSharedPool(poolId:string,seed:number,options:{readonly seatCount?:number;readonly capacities?:Readonly<Record<string,number>>}={}):SharedPoolState {
  validateSeed(seed);
  requirePool(typeof poolId==='string'&&poolId.length>0);
  if(options.capacities) requirePool(Object.keys(options.capacities).every(id=>SHOP_CATALOG.includes(id)));
  const initial=Object.fromEntries(SHOP_CATALOG.map(id=>[id,options.capacities ? options.capacities[id]??0 : POOL_CAPACITY_BY_COST[UNIT_DEFINITIONS[id].cost]]));
  const pool:SharedPoolState={openingEncounter:createOpeningEncounter(seed),carouselParticipants:[],carouselReservations:[],carouselReceipts:[],carouselRounds:[],orbLayout:createOrbLayout(seed),version:SHARED_POOL_VERSION,poolId,seed,seatCount:options.seatCount??8,revision:0,
    initial,available:{...initial},seats:[],shops:[],holdings:[],pending:[],rewards:[],naturalRound:0,order:[]};
  assertSharedPoolConservation(pool);return pool;
}
const failure=(pool:SharedPoolState,state:MatchState,reason:SharedPoolFailure):SharedPoolResult=>({ok:false,pool,state,reason});
const reasonOf=(error:unknown):SharedPoolFailure=>error instanceof PoolError?error.reason:'invalid-pool';
const stamp=(state:MatchState):{state:MatchState;events:readonly MatchEvent[]}=>({state,events:[]});
function finish(pool:PoolDraft,state:MatchState,bumpPool=true):MatchState {
  const seatId=state.sharedPool!.seatId,seat=pool.seats.find(s=>s.seatId===seatId)!;
  const shop=shareGeneratedJson(state.shop);
  const revision=seat.revision+1;requirePool(safe(revision)&&safe(pool.revision+1));
  pool.seats=pool.seats.map(s=>s===seat?{...seat,revision,shop}:s);if(bumpPool) pool.revision++;
  return {...state,shop,sharedPool:{poolId:pool.poolId,seatId,revision}};
}
function active(pool:SharedPoolState,state:MatchState):void {
  requirePool(pool.carouselReservations.length===0,'wrong-phase');
  assertSharedPoolConservation(pool,[state]);
  requirePool(!pool.seats.find(s=>s.seatId===state.sharedPool!.seatId)!.released&&state.multiplayer?.status==='active','seat-eliminated');
}
function transact(pool:SharedPoolState,state:MatchState,
  command:(draft:PoolDraft,policy:UnitLootPolicy,events:SharedPoolEvent[])=>MultiplayerCommandResult,preSold?:string):SharedPoolResult {
  try {
    active(pool,state);
    const draft=draftPool(pool),poolEvents:SharedPoolEvent[]=[];
    const result=command(draft,rewardPolicy(draft,state,poolEvents),poolEvents);
    if(!result.ok) return failure(pool,state,result.reason);
    requirePool(safe(result.state.gold)&&safe(result.state.nextMatchEventSeq),'invalid-seat-state');
    reconcileHoldings(draft,state,result.state,poolEvents,preSold);
    if(result.state===state&&canonicalContent(draft)===canonicalContent(pool)) return {ok:true,pool,state,events:result.events,poolEvents};
    const next=finish(draft,result.state);assertSharedPoolConservation(draft,[next]);
    return {ok:true,pool:draft,state:next,events:result.events,poolEvents};
  } catch(error) {return failure(pool,state,reasonOf(error));}
}

/** Import only the untouched public opening, before any shared shop is generated. */
export function initializeSharedSeat(pool:SharedPoolState,state:MatchState,seatId:string,seatIndex:number):SharedPoolResult {
  try {
    assertSharedPoolConservation(pool);
    requirePool(pool.order.length===0&&pool.naturalRound===0&&pool.seats.every(s=>s.shop.generation===0),'already-generated');
    requirePool(typeof seatId==='string'&&seatId.length>0&&safe(seatIndex)&&seatIndex<pool.seatCount
      &&!pool.seats.some(s=>s.seatId===seatId||s.seatIndex===seatIndex),'invalid-seat');
    const roster=state.preparation.units.filter(u=>u.team==='player');
    const carouselOpening=!!state.carousel;
    requirePool(canonicalContent(state)===canonicalContent(carouselOpening?createCarouselMatch(state.seed):createMatch(state.seed,{mode:'shared-deferred'})),'invalid-seat-state');
    const enabled=enableMultiplayerSettlement(state,seatId);if(!enabled.ok)return failure(pool,state,enabled.reason);
    const draft=draftPool(pool),hero={...roster[0],definitionId:selectOpeningUnit(pool.seed,seatId)};
    const frozenLayout=freezeOrbLayoutThroughRound(draft.orbLayout,1);
    if(!frozenLayout.ok)throw new PoolError(frozenLayout.reason);draft.orbLayout=frozenLayout.layout;
    const boundLoot=prepareMatchLoot(state.seed,1,{...state.m8.loot,layoutBinding:{mode:'shared',poolId:pool.poolId,
      version:'s13-orb-layout-v2',throughRoundOrdinal:0}},draft.orbLayout);
    if(hero) {
      requirePool(draft.available[hero.definitionId]>0,'pool-empty');draft.available[hero.definitionId]--;
      draft.holdings.push({seatId,unitId:hero.id,definitionId:hero.definitionId,sources:[sourceKey('opening',seatId)]});
    }
    // createMatch's private infinite shop was never published. Its draws are discarded too.
    let next:MatchState={...enabled.state,openingEncounter:bindSharedOpeningEncounter(pool.openingEncounter,pool.poolId,seatId),augmentTierSeed:pool.seed,preparation:{...enabled.state.preparation,units:enabled.state.preparation.units.map(u=>u.id===hero.id?hero:u)},resourceProvenance:{...enabled.state.resourceProvenance,entries:enabled.state.resourceProvenance.entries.map((entry,index)=>index===0&&entry.kind==='unit-acquired'?{...entry,source:{kind:'opening' as const,seed:pool.seed,seatId}}:entry)},m8:{...enabled.state.m8,loot:boundLoot},rngState:state.seed,shop:{generation:0,locked:false,slots:Array.from({length:MATCH_RULES.shopSize},()=>({status:'purchased' as const,empty:true as const}))},
      sharedPool:{poolId:pool.poolId,seatId,revision:0}};
    const applied=applyOpeningEffects(next,planOpeningRound(pool.openingEncounter,'1-2').facts,pool.openingEncounter);
    if(!applied.ok) return failure(pool,state,applied.reason);
    next=applied.state;
    draft.seats.push({seatId,seatIndex,revision:0,released:false,shop:next.shop});draft.revision++;
    assertSharedPoolConservation(draft,[next]);return {ok:true,pool:draft,state:next,events:applied.events,poolEvents:[]};
  } catch(error) {return failure(pool,state,reasonOf(error));}
}

/** Two words per nonempty slot. Empty slots consume no words; positive-odds stocked tiers renormalize. */
function drawShop(pool:PoolDraft,state:MatchState,poolEvents:SharedPoolEvent[],cause:ShopDrawCause='natural',before=state,audit=true):MatchState {
  const stock={...pool.available};
  requirePool(safe(state.shop.generation+1,1));
  const seatId=state.sharedPool!.seatId,generation=state.shop.generation+1,odds=getShopOdds(state.level);
  // Rigged Shop+ forces a single tier; with that tier out of stock the slot falls back to the level odds.
  const rigged=planRiggedShop(state,generation);state=rigged.state;
  const slots:ShopSlot[]=[];let rngState=state.rngState,rngDraws=0;
  for(let slot=0;slot<MATCH_RULES.shopSize;slot++) {
    const forced=rigged.tier!==undefined&&SHOP_CATALOG_BY_COST[rigged.tier].some(id=>pool.available[id]>0);
    const weights=forced?odds.map((_,i)=>i+1===rigged.tier?1:0):odds;
    const stocked=([1,2,3,4,5] as CostTier[]).filter(t=>weights[t-1]>0&&SHOP_CATALOG_BY_COST[t].some(id=>pool.available[id]>0));
    if(!stocked.length) {slots.push({status:'purchased',empty:true});continue;}
    const tierWord=nextRandom(rngState),weight=stocked.reduce((sum,t)=>sum+weights[t-1],0);
    let roll=Math.floor(tierWord.word*weight/4294967296),tier=stocked[0];
    for(const candidate of stocked) {tier=candidate;if(roll<weights[tier-1])break;roll-=weights[tier-1];}
    const memberWord=nextRandom(tierWord.state),catalog=SHOP_CATALOG_BY_COST[tier];
    let copy=Math.floor(memberWord.word*catalog.reduce((sum,id)=>sum+pool.available[id],0)/4294967296);
    const definitionId=catalog.find(id=>{if(copy<pool.available[id])return true;copy-=pool.available[id];return false;})!;
    pool.available[definitionId]--;
    // Starry Night: a 2-star offer reserves two more copies; without them it stays 1-star.
    const star=pool.available[definitionId]>=2&&starryUpgrade(state,generation,slot,definitionId);if(star)pool.available[definitionId]-=2;
    pool.shops.push({seatId,generation,slot,definitionId,...(star?{starLevel:2 as const}:{})});
    slots.push({status:'available',definitionId,...(star?{starLevel:2 as const}:{})});rngState=memberWord.state;rngDraws+=2;
  }
  const six=planSixCostShop(state.round,state.level,generation,sixCostShopContext(state));
  const catalog=SHOP_CATALOG_BY_COST[6], total=catalog.reduce((n,id)=>n+pool.available[id],0);
  if(six.slot!==null&&total>0&&rigged.tier===undefined){
    const old=slots[six.slot];
    if(old.status==='available'){
      pool.available[old.definitionId]+=old.starLevel===2?3:1;
      pool.shops=pool.shops.filter(r=>!(r.seatId===seatId&&r.generation===generation&&r.slot===six.slot));
    }
    let copy=Math.floor(six.memberWord*total/4294967296);
    const definitionId=catalog.find(id=>{if(copy<pool.available[id])return true;copy-=pool.available[id];return false;})!;
    pool.available[definitionId]--;pool.shops.push({seatId,generation,slot:six.slot,definitionId});
    slots[six.slot]={status:'available',definitionId};
  }
  poolEvents.push({type:'sharedShopGenerated',seatId,generation,rngDraws});
  const next={...state,rngState,shop:{generation,slots,locked:Boolean(state.shop.locked)}};
  return audit?recordShopDraw(before,next,cause,stock):next;
}
/** Subscription Service: replaces the seat's shop (locked or not) with its 4-cost shop; the caller released the old one. */
function drawSubscriptionShop(pool:PoolDraft,state:MatchState,poolEvents:SharedPoolEvent[],audit=true):MatchState {
  const stock={...pool.available};
  requirePool(safe(state.shop.generation+1,1));
  const seatId=state.sharedPool!.seatId,generation=state.shop.generation+1;
  const drawn=drawSubscriptionSlots(state,pool.available,(definitionId,slot)=>{pool.available[definitionId]--;pool.shops.push({seatId,generation,slot,definitionId});});
  poolEvents.push({type:'sharedShopGenerated',seatId,generation,rngDraws:drawn.rngDraws});
  const next={...state,rngState:drawn.rngState,shop:{generation,slots:drawn.slots,locked:Boolean(state.shop.locked)}};
  return audit?recordShopDraw(state,next,'subscription',stock):next;
}
/** Firesale: return the stolen slot's reserved copy, then grant it through the transaction's reward policy. */
function applyFiresale(pool:PoolDraft,state:MatchState,round:number,poolEvents:SharedPoolEvent[]):{state:MatchState;events:readonly MatchEvent[]} {
  const plan=planFiresale(state,round);if(!plan)return {state,events:[]};
  const seatId=state.sharedPool!.seatId,r=pool.shops.find(r=>r.seatId===seatId&&r.generation===state.shop.generation&&r.slot===plan.slot);
  requirePool(r,'invalid-seat-state');pool.shops=pool.shops.filter(s=>s!==r);pool.available[r.definitionId]+=r.starLevel===2?3:1;
  const stolen=stealFiresaleUnit(state,plan.owner,plan.slot,rewardPolicy(pool,state,poolEvents));
  reconcileHoldings(pool,state,stolen.state,poolEvents);
  let sequence=stolen.state.nextMatchEventSeq;
  const events=stolen.events.map(event=>'tick' in event?event:{...event,domain:'match' as const,eventSeq:sequence++});
  return {state:{...stolen.state,nextMatchEventSeq:sequence},events};
}
export function generateSharedShop(pool:SharedPoolState,state:MatchState,expectedGeneration:number):SharedPoolResult {
  return transact(pool,state,(draft,_policy,events)=>{
    requirePool(pool.seats.length===pool.seatCount,'incomplete-seats');
    requirePool(state.shop.generation===expectedGeneration,'stale-shop');
    requirePool(state.shop.generation===0&&pool.naturalRound===0,'already-generated');
    requirePool(state.round===1&&(state.phase==='preparation'||state.phase==='choice'),'wrong-phase');
    const next=drawShop(draft,state,events);
    if(draft.seats.every(s=>s.seatId===state.sharedPool!.seatId||s.shop.generation>0)) draft.naturalRound=1;
    return {ok:true,...stamp(next)};
  });
}
export function buySharedUnit(pool:SharedPoolState,state:MatchState,slot:number,expectedGeneration:number):SharedPoolResult {
  return transact(pool,state,(_draft,policy)=>{
    requirePool(canOperateMatch(state),'wrong-phase');
    requirePool(state.shop.generation===expectedGeneration,'stale-shop');
    requirePool(Number.isInteger(slot)&&slot>=0&&slot<MATCH_RULES.shopSize,'invalid-slot');
    requirePool(!('empty' in state.shop.slots[slot] && state.shop.slots[slot].empty),'empty-slot');
    return buyUnit(state,slot,expectedGeneration,policy);
  });
}
export function rerollSharedShop(pool:SharedPoolState,state:MatchState,expectedGeneration:number):SharedPoolResult {
  return transact(pool,state,(draft,_policy,events)=>{
    requirePool(canOperateMatch(state),'wrong-phase');
    requirePool(state.shop.generation===expectedGeneration,'stale-shop');
    const spent=spendFreeReroll(state),cost=spent.free?0:MATCH_RULES.rerollCost;
    requirePool(state.gold>=cost,'insufficient-gold');
    releaseShop(draft,state.sharedPool!.seatId);
    const next=drawShop(draft,recordShopReroll(spent.state),events,'reroll',state);
    requirePool(next.shop.slots.some(s=>s.status==='available'),'pool-empty');
    return {ok:true,...stamp({...next,gold:state.gold-cost})};
  });
}
/** Compatibility entry: every XP purchase uses the same shared transaction. */
export function buySharedXp(pool:SharedPoolState,state:MatchState):SharedPoolResult {
  return runSharedMatchCommand(pool,state,{type:'buyXp'});
}
export function setSharedShopLock(pool:SharedPoolState,state:MatchState,locked:boolean,expectedGeneration:number):SharedPoolResult {
  return transact(pool,state,()=>setShopLock(state,locked,expectedGeneration));
}
export function sellSharedUnit(pool:SharedPoolState,state:MatchState,unitId:string):SharedPoolResult {
  return transact(pool,state,(draft,policy)=>{
    const unit=state.preparation.units.find(u=>u.id===unitId);
    requirePool(unit,'unknown-unit');requirePool(unit.team==='player','enemy-unit');
    // Return sold copies before same-transaction mechanism hooks; orbs require an explicit later claim.
    // G2-3 summons never hold a pool copy.
    if(!UNIT_DEFINITIONS[unit.definitionId]?.summon) returnHolding(draft,state.sharedPool!.seatId,unitId);
    return sellUnit(state,unitId,policy);
  },unitId);
}

/** All original Match paths that may award a unit use this transaction-local pool policy. */
export function runSharedMatchCommand(pool:SharedPoolState,state:MatchState,command:SharedMatchCommand):SharedPoolResult {
  return transact(pool,state,(_draft,policy,poolEvents)=>{
    const result=matchCommand(_draft,policy,poolEvents);
    // Subscription Service opens its shop the moment it is acquired (a pick or a timed-out pick).
    if(!result.ok||!subscriptionAcquired(state,result.state))return result;
    releaseShop(_draft,state.sharedPool!.seatId);
    return {...result,state:drawSubscriptionShop(_draft,result.state,poolEvents)};
  });
  function matchCommand(_draft:PoolDraft,policy:UnitLootPolicy,poolEvents:SharedPoolEvent[]):MultiplayerCommandResult {
    switch(command.type) {
      case 'buyXp': return buyXpWithShopRefresh(state,policy,leveled=>{releaseShop(_draft,state.sharedPool!.seatId);return drawShop(_draft,leveled,poolEvents,'dual-purpose');});
      case 'openAnvil': return openAnvil(state,command.unitId);
      case 'rerollAugment': return rerollAugment(state,command.choiceId,command.generation,command.optionIndex,command.augmentBlocked);
      case 'useConsumable': {
        const tool=state.consumables.find(c=>c.consumableId===command.consumableId),target=command.target,u=target.kind==='unit'?state.preparation.units.find(u=>u.id===target.unitId):undefined;
        if(tool?.definitionId==='TFT_Consumable_NeekosHelp'&&u&&UNIT_DEFINITIONS[u.definitionId]?.cost===6)requirePool(_draft.available[u.definitionId]>0,'pool-empty');
        return useConsumable(state,command.consumableId,command.target);
      }
      case 'settleRound': return applyRoundSettlement(state,command.receipt,policy);
      case 'startCombat': return startMatchCombat(state,policy);
      case 'settleCombatStream': return settleMatchCombatStream(state,command.terminal,policy);
      case 'step': {const next=stepMatch(state,policy);return {ok:true,...next};}
      case 'choose': return selectChoice(state,command.choiceId,command.generation,command.definitionId,policy);
      case 'timeoutChoice': return forfeitPendingChoice(state,command.round,command.choiceId,command.generation,policy);
      case 'claimLoot': return claimOrDiscardLoot(state,command.round,policy);
      case 'claimOrb': return claimOrb(state,command.orbId,command.round,policy);
      default: throw new PoolError('invalid-command');
    }
  }
}
export function releaseSeatOnElimination(pool:SharedPoolState,state:MatchState):SharedPoolResult {
  try {
    assertSharedPoolConservation(pool,[state]);
    const seatId=state.sharedPool!.seatId,seat=pool.seats.find(s=>s.seatId===seatId)!;
    requirePool(!seat.released,'duplicate-release');
    requirePool(!pool.carouselReservations.length||!pool.carouselParticipants.some(p=>p.seatId===seatId)||pool.carouselReceipts.some(r=>r.seatId===seatId&&r.status==='released'&&r.carouselId.endsWith(`:carousel:${pool.carouselRounds.at(-1)}`)),'wrong-phase');
    requirePool(state.multiplayer?.status==='eliminated'&&state.playerHp===0,'not-eliminated');
    const draft=draftPool(pool),poolEvents:SharedPoolEvent[]=[];
    releaseShop(draft,seatId);
    for(const h of pool.holdings.filter(h=>h.seatId===seatId)) returnHolding(draft,seatId,h.unitId);
    const pendingIds=new Set(pool.pending.filter(p=>p.seatId===seatId).map(p=>p.dropId));
    const events:MatchEvent[]=[...pendingIds].map((dropId,i)=>({type:'lootForfeited',dropId,domain:'match',eventSeq:state.nextMatchEventSeq+i}));
    requirePool(safe(state.nextMatchEventSeq+events.length),'invalid-seat-state');
    const forfeited=forfeitUnclaimedOrbs(state);
    events.push(...forfeited.events.map((event,i)=>'tick' in event?event:({...event,domain:'match' as const,eventSeq:state.nextMatchEventSeq+events.length+i})));
    requirePool(safe(state.nextMatchEventSeq+events.length),'invalid-seat-state');
    let next:MatchState={...forfeited.state,nextMatchEventSeq:state.nextMatchEventSeq+events.length,shop:{...state.shop,locked:false,slots:state.shop.slots.map(()=>({status:'purchased' as const,empty:true as const}))},
      m8:{...forfeited.state.m8,loot:{...forfeited.state.m8.loot,direct:forfeited.state.m8.loot.direct.map(d=>pendingIds.has(d.dropId)?{dropId:d.dropId,status:'forfeited' as const,receiptId:null}:d)}}};
    next=recordShopRelease(forfeited.state,next);
    reconcileHoldings(draft,state,next,poolEvents);
    // Keep the terminal army only as an archived display snapshot, never as owned pool stock.
    draft.seats=draft.seats.map(s=>s.seatId===seatId?{...s,released:true}:s);
    next=finish(draft,next);poolEvents.push({type:'sharedSeatReleased',seatId});
    assertSharedPoolConservation(draft,[next]);return {ok:true,pool:draft,state:next,events,poolEvents};
  } catch(error) {return failure(pool,state,reasonOf(error));}
}

function refreshBatch(pool:SharedPoolState,states:readonly MatchState[],round:number,advance:boolean):SharedPoolBatchResult {
  const failed=(reason:SharedPoolFailure):SharedPoolBatchResult=>({ok:false,pool,states,reason});
  try {
    assertSharedPoolConservation(pool,states);
    const registered=pool.seats.filter(s=>!s.released);
    requirePool(pool.seats.length===pool.seatCount&&states.length===registered.length
      &&states.every(s=>registered.some(r=>r.seatId===s.sharedPool!.seatId)),'incomplete-seats');
    requirePool(states.length>0,'incomplete-seats');
    for(const state of states) {active(pool,state);requirePool(state.round===round,'stale-round');}
    const targetRound=advance?round+1:round;
    requirePool(targetRound===pool.naturalRound+1,'stale-refresh');
    if(!advance&&targetRound===1) requirePool(states.every(s=>s.shop.generation===0),'already-generated');
    const draft=draftPool(pool),poolEvents:SharedPoolEvent[]=[],events:{seatId:string;events:readonly MatchEvent[]}[]=[];
    const frozenLayout=freezeOrbLayoutThroughRound(draft.orbLayout,Math.min(targetRound,FINAL_ROUND));
    if(!frozenLayout.ok)throw new PoolError(frozenLayout.reason);draft.orbLayout=frozenLayout.layout;
    // v22: seats open their augment nodes in batch order; each sees the offers already opened before it (one-per-match).
    const opened:MatchState[]=[];
    let prepared=states.map((state,index):MatchState=>{
      if(!advance) {requirePool(state.phase==='preparation'||state.phase==='choice','wrong-phase');return state;}
      const {sharedPool, ...unbound}=state;
      const blocked=externalAugmentBlocks(state.sharedPool!.seatId,[...opened,...states.slice(index)]);
      const result=advanceMultiplayerRound(unbound,round,draft.orbLayout,blocked);if(!result.ok)throw new PoolError(result.reason);
      reconcileHoldings(draft,state,result.state,poolEvents);
      events.push({seatId:state.sharedPool!.seatId,events:result.events});
      // Discard only the unobserved infinite-shop proposal; keep schedule/equipment/loot progression.
      const next={...result.state,sharedPool,shop:state.shop,rngState:state.rngState};
      opened.push(next);return next;
    });
    let openingResolution: import('./shared-pool-types').OpeningRoundResolution | undefined;
    const openingPlan = planOpeningRound(draft.openingEncounter, prepared[0].roundDefinitionId);
    if (['gold-subscription','loot-subscription'].includes(draft.openingEncounter.selection.encounterId)) {
      prepared=prepared.map(state=>{
        const applied=applyOpeningEffects(state,openingPlan.facts,draft.openingEncounter);
        if(!applied.ok)throw new PoolError(applied.reason);
        const id=state.sharedPool!.seatId,row=events.find(e=>e.seatId===id);
        if(row)row.events=[...row.events,...applied.events];else events.push({seatId:id,events:applied.events});
        return applied.state;
      });
    }
    if (openingPlan.facts[0]?.nodeId === '3-5') {
      draft.openingEncounter = openingPlan.context;
      const before = new Map(prepared.map(s => [s.sharedPool!.seatId, s.playerHp]));
      prepared = prepared.map(state => {
        const applied = applyOpeningEffects(state, openingPlan.facts, draft.openingEncounter);
        if (!applied.ok) throw new PoolError(applied.reason);
        const id = state.sharedPool!.seatId, row = events.find(e => e.seatId === id);
        if (row) row.events = [...row.events, ...applied.events]; else events.push({seatId: id, events: applied.events});
        return applied.state;
      });
      const index = (s: MatchState) => draft.seats.find(r => r.seatId === s.sharedPool!.seatId)!.seatIndex;
      const hp = (s: MatchState) => before.get(s.sharedPool!.seatId)!;
      const dying = prepared.filter(s => s.playerHp === 0).sort((a,b) => hp(a)-hp(b) || index(b)-index(a));
      const survivors = prepared.filter(s => s.playerHp > 0);
      openingResolution = {nodeId: '3-5', outcome: openingPlan.facts[0].outcome!,
        eliminated: dying.map((s,i) => ({seatId:s.sharedPool!.seatId, rank:prepared.length-i, hpBefore:hp(s), hpAfterRaw:hp(s)-10})),
        ended: survivors.length <= 1, survivorRanks: survivors.length === 1 ? [{seatId:survivors[0].sharedPool!.seatId,rank:1}] : []};
      // Stage every death before returning stock or drawing any next shop; no partial state escapes on failure.
      for (const dyingState of dying) {
        const released = releaseSeatOnElimination(draft, dyingState);
        if (!released.ok) throw new PoolError(released.reason);
        Object.assign(draft, released.pool); poolEvents.push(...released.poolEvents);
        prepared = prepared.map(s => s === dyingState ? released.state : s);
        const row = events.find(e => e.seatId === dyingState.sharedPool!.seatId)!;
        row.events = [...row.events, ...released.events];
      }
    }
    if(!draft.order.length) {
      const order=[...draft.seats].sort((a,b)=>a.seatIndex-b.seatIndex).map(s=>s.seatId);let rng=pool.seed;
      for(let i=order.length-1;i>0;i--) {const draw=nextRandom(rng);rng=draw.state;const j=Math.floor(draw.word*(i+1)/4294967296);[order[i],order[j]]=[order[j],order[i]];}
      draft.order=order;
    }
    const activeOrder=draft.order.filter(id=>draft.seats.some(s=>s.seatId===id&&!s.released));
    const offset=activeOrder.length ? (targetRound-1)%activeOrder.length : 0;
    const order=[...activeOrder.slice(offset),...activeOrder.slice(0,offset)];
    poolEvents.push({type:'sharedRefreshOrder',round:targetRound,seatIds:order});
    const subscribed=(state:MatchState)=>advance&&state.multiplayer?.status!=='eliminated'&&subscriptionStageStart(state,targetRound);
    for(const state of prepared) if(state.multiplayer?.status !== 'eliminated' && (!state.shop.locked||subscribed(state))) releaseShop(draft,state.sharedPool!.seatId);
    const nextStates=new Map(prepared.map(s=>[s.sharedPool!.seatId,s]));
    for(const id of order) {
      const state=nextStates.get(id)!;
      if(subscribed(state)) nextStates.set(id,drawSubscriptionShop(draft,state,poolEvents));
      else if(!state.shop.locked) nextStates.set(id,drawShop(draft,state,poolEvents));
    }
    if(advance) for(const id of order) {
      const stolen=applyFiresale(draft,nextStates.get(id)!,targetRound,poolEvents);
      if(!stolen.events.length) continue;
      nextStates.set(id,stolen.state);
      const row=events.find(e=>e.seatId===id);
      if(row) row.events=[...row.events,...stolen.events]; else events.push({seatId:id,events:stolen.events});
    }
    draft.naturalRound=targetRound;
    const committed=states.map(s=>finish(draft,nextStates.get(s.sharedPool!.seatId)!,false));
    draft.revision++;
    assertSharedPoolConservation(draft,committed);
    return {ok:true,pool:draft,states:committed,events,poolEvents,...(openingResolution ? {openingResolution} : {})};
  } catch(error) {return failed(reasonOf(error));}
}
/** Initial shops or an externally prepared next round; all active seats required. */
export function refreshSharedShops(pool:SharedPoolState,states:readonly MatchState[],expectedRound:number):SharedPoolBatchResult {
  return refreshBatch(pool,states,expectedRound,false);
}
/** Atomic catalog/overtime advance + free refresh; neither an infinite shop nor its RNG is published. */
export function nextSharedRound(pool:SharedPoolState,states:readonly MatchState[],expectedRound:number):SharedPoolBatchResult {
  return refreshBatch(pool,states,expectedRound,true);
}

/** G23 gifts consume real pool copies; an empty pool resolves the gift to cost gold. */
export function sharedClaimG23Reward(pool:SharedPoolState,state:MatchState,atomId:string,definitionId:string):SharedPoolResult{
 return transact(pool,state,(_draft,policy)=>claimG23Reward(state,atomId,definitionId,policy));
}

/** Replay a single finite-pool draw from its recorded pre-reservation inventory. No live pool is mutated. */
export function replaySharedShop(state:MatchState,stock:Readonly<Record<string,number>>,subscription:boolean):MatchState {
 const pool={available:{...stock},shops:[]} as unknown as PoolDraft;
 return subscription?drawSubscriptionShop(pool,state,[],false):drawShop(pool,state,[],'natural',state,false);
}
