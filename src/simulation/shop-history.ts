import { augmentLevelCap, grantMatchXp } from './augment-pool-batch5-h12-progression';
import { getRoundSchedule, FINAL_ROUND } from './round-schedule';
import { foldResourceProvenance } from './resource-provenance';
import { readG23Progress } from './g2-3-state';
import { g23RadiantRound } from './g2-3-settlement';
import type { MatchState } from './match-types';
import { SHOP_HISTORY_VERSION, type ShopCredit, type ShopDrawCause, type ShopHistoryEntry, type ShopHistoryPoint } from './shop-history-types';
import { AUGMENT_SHOP } from './content/augment-pool-shop';
import { canonicalContent } from './content';
import { freeRerollGrants, freeRerollsUsed } from './free-rerolls';
import { drawSoloAugmentShop, recordShopReroll, shopOfferCost, starryUpgrade, planFiresale, SHOP_AUGMENT_KEY } from './shop-augments';
import { replaySharedShop } from './shared-pool';
import { sixCostShopContext } from './six-cost-shop';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { grantXp } from './progression';
import { xpPurchaseAmount, xpPurchaseCost, batch3EntryXp } from './augment-xp';
import { readAugmentIncome } from './augment-income';
import { choiceAcquisitionXp } from './choice-acquisition';
import { outcomeAcquisitionXp } from './augment-pool-batch3-progress';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { readSeatMechanic, writeSeatMechanic } from './seat-mechanics/state';
import { SHOP_CATALOG, MATCH_RULES } from './match-rules';

const shopOwner=(id:string)=>Boolean(AUGMENT_SHOP[id])||id==='dual-purpose';
const point=(s:MatchState):ShopHistoryPoint=>({round:s.round,level:s.level,xp:s.xp,resourcePrefix:s.resourceProvenance.entries.length,owners:s.augments.map(a=>a.choiceId),gold:s.gold,mechanicPrefix:s.seatMechanics?.receipts.length??0,lootPrefix:s.m8.loot.receipts.length,schedulePrefix:s.scheduleReceipts.length,economyPrefix:s.roundResults.length});
const append=(s:MatchState,e:ShopHistoryEntry):MatchState=>s.shopHistory?{...s,shopHistory:{...s.shopHistory,entries:[...s.shopHistory.entries,e]}}:s;
export function recordShopAcquisition(before:MatchState,after:MatchState):MatchState {
 if(!after.shopHistory&&!after.augments.some(a=>shopOwner(a.definitionId)))return after;
 const started:MatchState=after.shopHistory?after:{...after,shopHistory:{version:SHOP_HISTORY_VERSION,initial:{...point(before),shop:before.shop,rngState:before.rngState},entries:[]}};
 return append(started,{kind:'acquire',point:point(after),choiceId:after.augments.at(-1)!.choiceId});
}
export function recordShopRound(state:MatchState):MatchState {return append(state,{kind:'round',point:point(state)});}
export function recordShopXp(before:MatchState,after:MatchState):MatchState {
 return append(after,{kind:'xp',point:point(before),goldCost:xpPurchaseCost(before.augments,before.round)});
}
export function recordShopRelease(before:MatchState,after:MatchState):MatchState {
 return append(after,{kind:'release',point:point(before)});
}
export function recordShopAnomalyReroll(before:MatchState,after:MatchState):MatchState {
 return append(after,{kind:'anomaly-reroll',point:point(before),choiceId:before.pendingChoice!.choiceId});
}
export function recordShopLock(before:MatchState,after:MatchState):MatchState {
 return append(after,{kind:'lock',point:point(before),locked:Boolean(after.shop.locked)});
}
export function recordShopBuy(before:MatchState,after:MatchState,slot:number):MatchState {
 const offer=before.shop.slots[slot];if(offer.status!=='available')throw new RangeError('Shop history purchase');
 return append(after,{kind:'buy',point:point(before),slot,starLevel:offer.starLevel??1,goldCost:shopOfferCost(offer)});
}
export function recordShopFiresale(before:MatchState,after:MatchState,slot:number,receiptId:string):MatchState {
 return append(after,{kind:'firesale',point:point(before),slot,receiptId});
}
function baselineSpends(state:MatchState):Map<string,number> {
 const h=state.shopHistory!,initial=h.initial,owners=state.augments.filter(a=>initial.owners.includes(a.choiceId));
 const view={...state,augments:owners,round:initial.round,level:initial.level,xp:initial.xp,
  resourceProvenance:{...state.resourceProvenance,entries:state.resourceProvenance.entries.slice(0,initial.resourcePrefix)}};
 let left=state.resourceProvenance.entries.slice(0,initial.resourcePrefix).filter(e=>e.kind==='free-reroll').length;
 const used=new Map<string,number>();
 for(const g of freeRerollGrants(view)){const n=Math.min(left,g.count);used.set(g.choiceId,n);left-=n;}
 check(left===0,'initial free credits');return used;
}
function nextCredit(state:MatchState,used:ReadonlyMap<string,number>):ShopCredit|null {
 const g=freeRerollGrants(state).find(g=>g.count>(used.get(g.choiceId)??0));
 return g?{choiceId:g.choiceId,ordinal:used.get(g.choiceId)??0}:null;
}
export function recordShopDraw(before:MatchState,after:MatchState,cause:ShopDrawCause,stock?:Readonly<Record<string,number>>):MatchState {
 if(!after.shopHistory)return after;
 // Online advancement proposes an infinite shop before the shared transaction draws the real one.
 if(!stock&&before.m8.loot.layoutBinding.mode==='shared')return after;
 const used=baselineSpends(before);
 for(const e of before.shopHistory!.entries)if(e.kind==='draw'&&e.credit)used.set(e.credit.choiceId,(used.get(e.credit.choiceId)??0)+1);
 const credit=cause==='reroll'?nextCredit(before,used):null;
 const shop=cause==='reroll'?{...after.shop,locked:Boolean(before.shop.locked)}:after.shop;
 return append(after,{kind:'draw',point:point(before),cause,shop,rngState:after.rngState,credit,
  goldCost:cause==='reroll'&&!credit?MATCH_RULES.rerollCost:0,
  starry:after.shop.slots.map((s,i)=>s.status==='available'&&starryUpgrade(before,after.shop.generation,i,s.definitionId)),
  ...(stock?{stock}:{})});
}
function check(value:unknown,why:string):asserts value {if(!value)throw new RangeError(`Invalid shop history: ${why}`);}
const same=(a:unknown,b:unknown)=>canonicalContent(a)===canonicalContent(b);
const int=(n:unknown,min=0):n is number=>Number.isSafeInteger(n)&&(n as number)>=min;
function keys(o:object,names:readonly string[]):void {check(o&&typeof o==='object'&&!Array.isArray(o)&&same(Object.keys(o).sort(),[...names].sort()),'fields');}
const POINT_KEYS=['round','level','xp','resourcePrefix','owners','gold','mechanicPrefix','lootPrefix','schedulePrefix','economyPrefix'];
function checkPoint(p:ShopHistoryPoint,state:MatchState):void {
 keys(p,POINT_KEYS);
 check(int(p.gold)&&int(p.mechanicPrefix)&&p.mechanicPrefix<=(state.seatMechanics?.receipts.length??0)&&int(p.lootPrefix)&&p.lootPrefix<=state.m8.loot.receipts.length&&int(p.schedulePrefix)&&p.schedulePrefix<=state.scheduleReceipts.length&&int(p.economyPrefix)&&p.economyPrefix<=state.roundResults.length,'gold evidence prefixes');
 check(int(p.round,1)&&p.round<=state.round&&int(p.level,1)&&p.level<=10&&int(p.xp)&&int(p.resourcePrefix)&&p.resourcePrefix<=state.resourceProvenance.entries.length&&Array.isArray(p.owners),'point');
 grantXp(p.level,p.xp,0);
 check(p.owners.every(id=>typeof id==='string'&&state.augments.some(a=>a.choiceId===id))&&new Set(p.owners).size===p.owners.length,'owners');
 const entries=state.resourceProvenance.entries;
 check(entries.slice(0,p.resourcePrefix).every(e=>getMultiplayerRoundById(e.roundId).ordinal<=p.round)
  &&entries.slice(p.resourcePrefix).every(e=>getMultiplayerRoundById(e.roundId).ordinal>=p.round),'resource round boundary');
 check(p.economyPrefix===p.round-1||p.economyPrefix===p.round,'economy round boundary');
 const receipts=state.seatMechanics?.receipts??[];
 check(receipts.slice(0,p.mechanicPrefix).every(r=>r.round<=p.round)&&receipts.slice(p.mechanicPrefix).every(r=>r.round>=p.round),'mechanic round boundary');
 check(state.scheduleReceipts.slice(0,p.schedulePrefix).every(r=>r.round<=p.round)&&state.scheduleReceipts.slice(p.schedulePrefix).every(r=>r.round>=p.round),'schedule round boundary');
}
/** Replays the shop subdomain. Summaries and purchase provenance are outputs, never sources of Ticket or star decisions.
 * Like the existing unsigned resource/battle logs, this proves rule consistency, not authorship of a file. */
export function validateShopHistory(state:MatchState):void {
 const held=state.augments.some(a=>shopOwner(a.definitionId)),h=state.shopHistory;
 const shopPurchases=state.resourceProvenance.entries.filter(e=>e.kind==='unit-acquired'&&e.source.kind==='shop');
 if(!h){
  check(!held,'missing shop-history-v1; legacy shop augment saves cannot be authenticated');
  check(!state.shop.slots.some(s=>s.status==='available'&&s.starLevel===2)&&!shopPurchases.some(e=>e.kind==='unit-acquired'&&e.source.kind==='shop'&&e.source.starLevel===2),'two-star without history');
  return;
 }
 check(held,'history without owner');keys(h,['version','initial','entries']);check(h.version===SHOP_HISTORY_VERSION&&Array.isArray(h.entries),'version');
 keys(h.initial,[...POINT_KEYS,'shop','rngState']);
 const {shop:initialShop,rngState:initialRng,...initialPoint}=h.initial;checkPoint(initialPoint,state);
 check(!state.augments.some(a=>initialPoint.owners.includes(a.choiceId)&&shopOwner(a.definitionId)),'initial owner');
 check(int(initialRng)&&initialRng<=0xffffffff&&int(initialShop.generation,state.sharedPool?0:1)&&initialShop.generation<=state.shop.generation
  &&Array.isArray(initialShop.slots)&&initialShop.slots.length===MATCH_RULES.shopSize&&!initialShop.slots.some(s=>s.status==='available'&&s.starLevel===2),'initial shop');
 check(h.entries[0]?.kind==='acquire'&&h.entries[0].point.round===initialPoint.round,'acquisition boundary');
 const firstChoice=h.entries[0].choiceId;check(shopOwner(state.augments.find(a=>a.choiceId===firstChoice)!.definitionId),'first shop acquisition');
 check(initialPoint.economyPrefix===initialPoint.round-1,'initial economy boundary');
 keys(initialShop,['generation','slots',...(Object.hasOwn(initialShop,'locked')?['locked']:[])]);
 check(initialShop.locked===undefined||typeof initialShop.locked==='boolean','initial lock');
 for(const slot of initialShop.slots){
  if(slot.status==='available'){keys(slot,['status','definitionId']);check(SHOP_CATALOG.includes(slot.definitionId),'initial offer');}
  else {keys(slot,['status',...(Object.hasOwn(slot,'empty')?['empty']:[])]);check(slot.status==='purchased'&&(slot.empty===undefined||slot.empty===true),'initial empty slot');}
 }

 check(!state.resourceProvenance.entries.slice(0,initialPoint.resourcePrefix).some(e=>e.kind==='unit-acquired'&&e.source.kind==='shop'&&(e.source.starLevel===2||e.source.generation>initialShop.generation)),'pre-acquisition purchase');
 let cursor:MatchState={...state,round:initialPoint.round,level:initialPoint.level,xp:initialPoint.xp,shop:initialShop,rngState:initialRng,gold:initialPoint.gold,
  augments:state.augments.filter(a=>initialPoint.owners.includes(a.choiceId))};
 if(!state.multiplayer){
  // Solo selection precedes all trading at this node. Anchor its bank/XP to the preceding
  // independently checked settlement, rather than allowing a candidate to fund invented rerolls.
  const previous=state.roundResults.find(r=>r.round===initialPoint.round-1);check(previous,'initial settlement');
  const xp=grantXp(previous.levelAfter,previous.xpAfter,readAugmentIncome(cursor.augments).roundXp+batch3EntryXp(cursor.augments,state.roundResults,initialPoint.round),augmentLevelCap(cursor.augments));
  check(xp.level===cursor.level&&xp.xp===cursor.xp,'initial XP');
  const receipts=(state.seatMechanics?.receipts??[]).slice(previous.mechanicReceiptPrefixLength,initialPoint.mechanicPrefix);
  const receiptGold=receipts.reduce((n,r)=>n+(r.kind==='gold'?r.amount:r.kind==='unit'?r.gold:r.kind==='choice'?-r.price:0),0);
  const sales=state.resourceProvenance.entries.slice(0,initialPoint.resourcePrefix).reduce((n,e)=>n+(e.kind==='unit-sold'&&e.roundId===previous.roundId&&e.context==='settlement-capacity'?e.goldGranted:0),0);
  check(cursor.gold===previous.goldAfter+receiptGold+sales,'initial bank');
 }
 cursor=writeSeatMechanic(cursor,SHOP_AUGMENT_KEY,undefined);
 const used=baselineSpends(state),buys=new Set<number>(),spends=new Set<number>();
 let prefix=initialPoint.resourcePrefix,needNatural=false,needDual=false,needSubscription=false;
 let lastWasXp=false,lastPoint=initialPoint;
 const sync=(p:ShopHistoryPoint)=>{
  check(['mechanicPrefix','lootPrefix','schedulePrefix','economyPrefix'].every(k=>(p[k as keyof ShopHistoryPoint] as number)>=(lastPoint[k as keyof ShopHistoryPoint] as number)),'evidence prefix order');
  for(const result of state.roundResults.slice(lastPoint.economyPrefix,p.economyPrefix)){
   check(result.round===cursor.round&&result.levelBefore===cursor.level&&result.xpBefore===cursor.xp,'settlement XP boundary');
   cursor={...cursor,level:result.levelAfter,xp:result.xpAfter};
  }
  cursor={...cursor,gold:cursor.gold+evidenceGold(state,p)-evidenceGold(state,lastPoint)};
  check(cursor.gold===p.gold,'gold balance');lastPoint=p;
 };
 for(const e of h.entries){
  check(e&&typeof e==='object','entry');checkPoint(e.point,state);check(e.point.resourcePrefix>=prefix,'resource order');prefix=e.point.resourcePrefix;
  // Crafted Crafting credits exist only after their real combination, including within the same round.
  cursor={...cursor,resourceProvenance:{...state.resourceProvenance,entries:state.resourceProvenance.entries.slice(0,prefix)}};
  sync(e.point);
  const expectedOwners=e.kind==='acquire'?[...cursor.augments.map(a=>a.choiceId),e.choiceId]:cursor.augments.map(a=>a.choiceId);
  check(same(e.point.owners,expectedOwners),'ownership chronology');
  if(e.kind!=='round')check(e.point.round===cursor.round,'round chronology');
  if(e.kind!=='round'&&e.kind!=='acquire')check(e.point.level===cursor.level&&e.point.xp===cursor.xp,'generation level/XP');
  check(!needDual||e.kind==='draw'&&e.cause==='dual-purpose','missing XP refresh');
  check(!needSubscription||e.kind==='draw'&&e.cause==='subscription','missing subscription');
  if(e.kind==='acquire'){
   keys(e,['kind','point','choiceId']);const a=state.augments.find(a=>a.choiceId===e.choiceId)!;
   check(a&&a.acquiredRound===cursor.round&&!cursor.augments.some(x=>x.choiceId===a.choiceId),'acquisition');
   let xp=grantMatchXp(cursor,choiceAcquisitionXp(AUGMENT_DEFINITIONS[a.definitionId])+outcomeAcquisitionXp(cursor,a));
   if(a.definitionId==='max-cap'&&xp.level===7)xp={...xp,xp:0};
   check(xp.level===e.point.level&&xp.xp===e.point.xp,'acquisition XP');
   cursor={...cursor,...xp,augments:[...cursor.augments,a]};needSubscription=AUGMENT_SHOP[a.definitionId]?.rule==='subscription';
  }else if(e.kind==='round'){
   keys(e,['kind','point']);check(!needNatural&&e.point.round===cursor.round+1,'round entry');
   const previous=state.roundResults.find(r=>r.round===cursor.round);check(previous,'round settlement');
   const xp=grantMatchXp(cursor,readAugmentIncome(cursor.augments).roundXp+batch3EntryXp(cursor.augments,state.roundResults,e.point.round));
   check(xp.level===e.point.level&&xp.xp===e.point.xp,'round XP');
   cursor={...cursor,round:e.point.round,...xp};needSubscription=cursor.augments.some(a=>AUGMENT_SHOP[a.definitionId]?.rule==='subscription')&&getMultiplayerRoundByOrdinal(cursor.round).subround===1;
   needNatural=!needSubscription&&(!cursor.shop.locked||anomalyRecovery(state,cursor,e.point));
  }else if(e.kind==='xp'){
   keys(e,['kind','point','goldCost']);check(cursor.level<augmentLevelCap(cursor.augments)&&e.goldCost===xpPurchaseCost(cursor.augments,cursor.round),'XP cost');
   check(cursor.gold>=e.goldCost,'XP bank');cursor={...cursor,gold:cursor.gold-e.goldCost,...grantMatchXp(cursor,xpPurchaseAmount(cursor.augments,cursor.round))};
   needDual=cursor.augments.some(a=>a.definitionId==='dual-purpose');
  }else if(e.kind==='release'){
   keys(e,['kind','point']);check(state.multiplayer?.status==='eliminated'&&state.playerHp===0&&e===h.entries.at(-1),'seat release');needNatural=false;
   cursor={...cursor,shop:{...cursor.shop,locked:false,slots:cursor.shop.slots.map(()=>({status:'purchased',empty:true}))}};
  }else if(e.kind==='anomaly-reroll'){
   keys(e,['kind','point','choiceId']);check(cursor.gold>=1&&(state.anomalyBinding?.choiceId===e.choiceId||state.pendingChoice?.kind==='anomaly'&&state.pendingChoice.choiceId===e.choiceId),'anomaly fee');cursor={...cursor,gold:cursor.gold-1};
  }else if(e.kind==='lock'){
   keys(e,['kind','point','locked']);check(typeof e.locked==='boolean'&&e.locked!==Boolean(cursor.shop.locked),'lock');cursor={...cursor,shop:{...cursor.shop,locked:e.locked}};
  }else if(e.kind==='draw'){
   keys(e,['kind','point','cause','shop','rngState','credit','goldCost','starry',...(e.stock?['stock']:[])]);
   check(['natural','subscription','reroll','dual-purpose'].includes(e.cause),'draw cause');
   if(e.cause==='natural'){check(needNatural||cursor.shop.generation===0,'natural refresh');needNatural=false;}
   else if(e.cause==='subscription'){check(needSubscription,'subscription refresh');needSubscription=false;}
   else {check(!needNatural,'missing natural refresh');if(e.cause==='dual-purpose')check(needDual&&lastWasXp,'XP refresh');}
   const credit=e.cause==='reroll'?nextCredit(cursor,used):null;
   check(same(e.credit,credit)&&e.goldCost===(e.cause==='reroll'&&!credit?MATCH_RULES.rerollCost:0),'reroll payment/source');
   check(cursor.gold>=e.goldCost,'reroll bank');cursor={...cursor,gold:cursor.gold-e.goldCost};
   if(credit){used.set(credit.choiceId,credit.ordinal+1);const fact=state.resourceProvenance.entries[prefix];
    check(fact?.kind==='free-reroll'&&fact.generation===cursor.shop.generation&&getMultiplayerRoundById(fact.roundId).ordinal===cursor.round,'free spend');spends.add(prefix);}
   if(e.cause==='reroll'||e.cause==='dual-purpose')cursor=recordShopReroll(cursor);
   needDual=false;
   check(Boolean(e.stock)===Boolean(state.sharedPool),'pool context');
   if(e.stock){keys(e.stock,SHOP_CATALOG);check(Object.values(e.stock).every(n=>int(n)&&n<=100),'pool stock');}
   let drawn=e.stock?replaySharedShop(cursor,e.stock,e.cause==='subscription')
    :drawSoloAugmentShop(cursor,sixCostShopContext(cursor),e.cause==='subscription',e.cause,cursor,false);
   if(!e.stock&&e.cause==='reroll')drawn={...drawn,shop:{...drawn.shop,locked:Boolean(cursor.shop.locked)}};
   check(same(e.shop,drawn.shop)&&e.rngState===drawn.rngState,'generated shop/RNG');
   check(same(e.starry,drawn.shop.slots.map((s,i)=>s.status==='available'&&starryUpgrade(cursor,drawn.shop.generation,i,s.definitionId))),'Starry Night outcome');
   cursor=drawn;
  }else if(e.kind==='buy'||e.kind==='firesale'){
   check(!needNatural,'purchase before natural refresh');check(int(e.slot)&&e.slot<MATCH_RULES.shopSize,'slot');
   const offer=cursor.shop.slots[e.slot];check(offer.status==='available','purchased offer');
   if(e.kind==='buy'){
    keys(e,['kind','point','slot','starLevel','goldCost']);check(e.starLevel===(offer.starLevel??1)&&e.goldCost===shopOfferCost(offer),'purchase star/price');
    check(cursor.gold>=e.goldCost,'purchase bank');cursor={...cursor,gold:cursor.gold-e.goldCost};
    const fact=state.resourceProvenance.entries[prefix];check(fact?.kind==='unit-acquired'&&fact.source.kind==='shop'&&same(fact.source,{kind:'shop',generation:cursor.shop.generation,slotIndex:e.slot,definitionId:offer.definitionId,...(offer.starLevel?{starLevel:offer.starLevel}:{})})&&getMultiplayerRoundById(fact.roundId).ordinal===cursor.round,'purchase provenance');buys.add(prefix);
   }else{
    keys(e,['kind','point','slot','receiptId']);const plan=planFiresale(cursor,cursor.round),r=state.seatMechanics?.receipts.find(r=>r.receiptId===e.receiptId);
    check(plan?.slot===e.slot&&r?.kind==='unit'&&r.round===cursor.round&&r.definitionId===offer.definitionId&&(r.starLevel??1)===(offer.starLevel??1),'Firesale offer');
   }
   cursor={...cursor,shop:{...cursor.shop,slots:cursor.shop.slots.map((s,i)=>i===e.slot?{status:'purchased'}:s)}};
  }else check(false,'entry kind');
  lastWasXp=e.kind==='xp';
 }
 check(!needDual&&!needNatural&&!needSubscription,'incomplete history');
 check(same(cursor.augments,state.augments)&&cursor.round===state.round,'final owners/round');
 check(same(cursor.shop,state.shop)&&cursor.rngState===state.rngState,'final shop/RNG');
 sync(point(state));
 check(cursor.level===state.level&&cursor.xp===state.xp,'final XP');
 const actual=readSeatMechanic(state,SHOP_AUGMENT_KEY) as {rolls?:number;credits?:number;rigAnchor?:number}|undefined;
 const replayed=readSeatMechanic(cursor,SHOP_AUGMENT_KEY) as typeof actual;
 check((actual?.rolls??0)===(replayed?.rolls??0)&&(actual?.credits??0)===(replayed?.credits??0)&&actual?.rigAnchor===replayed?.rigAnchor,'Ticket rolls/credits or rig anchor');
 for(let i=initialPoint.resourcePrefix;i<state.resourceProvenance.entries.length;i++){
  const e=state.resourceProvenance.entries[i];
  if(e.kind==='unit-acquired'&&e.source.kind==='shop')check(buys.has(i),'missing purchase');
  if(e.kind==='free-reroll')check(spends.has(i),'missing free spend');
 }
 check(freeRerollsUsed(state)===state.resourceProvenance.entries.filter(e=>e.kind==='free-reroll').length,'spend total');
}

/** Independent non-shop cash flow. Resource sales, receipts and settled income have their own validators.
 * Prefixes preserve the moment of a grant; deferred income enters only on the following round. */
function evidenceGold(state:MatchState,p:ShopHistoryPoint):number {
 const mechanics=(state.seatMechanics?.receipts??[]).slice(0,p.mechanicPrefix).reduce((n,r)=>n+(r.kind==='gold'?r.amount:r.kind==='unit'?r.gold:r.kind==='choice'?-r.price:0),0);
 const loot=state.m8.loot.receipts.slice(0,p.lootPrefix).reduce((n,r)=>n+(r.gold??(r.payload.kind==='gold'?r.payload.quantity:0)),0);
 const sales=state.resourceProvenance.entries.slice(0,p.resourcePrefix).reduce((n,e)=>n+(e.kind==='unit-sold'?e.goldGranted:0),0);
 const schedule=state.scheduleReceipts.slice(0,p.schedulePrefix).reduce((n,r)=>n+r.gold,0);
 const income=state.roundResults.slice(0,p.economyPrefix).reduce((n,r)=>n+(r.round<p.round?r.income:r.incomeBreakdown.win),0);
 return mechanics+loot+sales+schedule+income;
}

/** The existing solo anomaly recruitment rule may refresh an exhausted locked shop.
 * Shared entry discards that proposal and follows the shared lock policy instead. */
function anomalyRecovery(state:MatchState,cursor:MatchState,p:ShopHistoryPoint):boolean {
 if(state.sharedPool||cursor.round>FINAL_ROUND||!getRoundSchedule(cursor.round).some(e=>e.kind==='anomaly')
  ||cursor.shop.slots.some(s=>s.status==='available'&&shopOfferCost(s)<=cursor.gold))return false;
 const folded=foldResourceProvenance(state.resourceProvenance,{
  g23:readG23Progress(state),g23RadiantRound:g23RadiantRound(state),scheduleReceipts:state.scheduleReceipts,
  lootReceipts:state.m8.loot.receipts,mechanicReceipts:state.seatMechanics?.receipts,
  throughRoundOrdinal:state.round,prefixLength:p.resourcePrefix,
  combatSettlements:state.roundResults.filter(r=>r.roundKind!=='supply').map(r=>({roundId:r.roundId,combatId:`round-${r.round}`,settlementId:r.settlementId})),
 });
 return folded.units.length===0;
}
