import { drawSubscriptionSlots } from './augment-pool-batch5-h12-subscription';
export { enterShopAugmentRound, subscriptionAcquired, subscriptionStageStart, drawSubscriptionSlots } from './augment-pool-batch5-h12-subscription';
import { starryUpgrade } from './augment-pool-batch5-r5';
export { starryChanceBps, starryUpgrade } from './augment-pool-batch5-r5';
import { recordShopDraw, recordShopFiresale } from './shop-history';
import type { ShopDrawCause } from './shop-history-types';
import { generateShop } from './shop';
import type { SixCostShopContext } from './six-cost-shop';
import type { MatchEvent, MatchState, ShopSlot } from './match-types';
import type { OwnedAugment } from './strategy-types';
import type { UnitLootPolicy } from './loot-runtime';
import type { CostTier } from './unit-types';
import { AUGMENT_SHOP, shopAugmentValue, type ShopAugmentRule } from './content/augment-pool-shop';
import { readSeatMechanic, writeSeatMechanic } from './seat-mechanics/state';
import { grantMechanicUnit } from './seat-mechanics/grants';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { isCombatRosterLocked } from './operation-policy';
import { SHOP_CATALOG, SHOP_CATALOG_BY_COST } from './match-rules';
import { nextRandom } from './rng';
import { UNIT_DEFINITIONS } from './units';

/** Owner-visible shop-augment ledger. `credits` is the free shop rerolls earned by Ticket;
 * restore re-derives them from the seed and reroll count. */
export const SHOP_AUGMENT_KEY='shop-augments';
export const SHOP_AUGMENT_SOURCE='augment-pool-shop';
interface ShopAugmentRecord {
 readonly credits:number;
 /** Prismatic Ticket: shop rerolls made while owned. */
 readonly rolls?:number;
 /** Rigged Shop+: generation of the first shop drawn after acquisition. */
 readonly rigAnchor?:number;
 /** ReinFOURcement: provenance sequence of the 4-cost purchase that was upgraded. */
 readonly reinforced?:number;
}
const RECORD_KEYS=['credits','rolls','rigAnchor','reinforced'];
/** Literal counts from the 14.24 descriptions that have no source field. */
const REINFORCED_COST=4;

const owned=(state:Pick<MatchState,'augments'>,rule:ShopAugmentRule)=>state.augments.filter(a=>AUGMENT_SHOP[a.definitionId]?.rule===rule);
const record=(state:Pick<MatchState,'seatMechanics'>)=>readSeatMechanic(state,SHOP_AUGMENT_KEY) as unknown as ShopAugmentRecord|undefined;
function write(state:MatchState,patch:Partial<ShopAugmentRecord>):MatchState {
 const next={credits:0,...record(state),...patch};
 return writeSeatMechanic(state,SHOP_AUGMENT_KEY,JSON.parse(JSON.stringify(next)));
}
const receiptId=(rule:ShopAugmentRule,a:OwnedAugment,n:number)=>JSON.stringify([SHOP_AUGMENT_SOURCE,rule,a.choiceId,n]);
/** Seat/choice-bound draw; never advances live RNG, so retries and restore see the same word. */
function word(state:Pick<MatchState,'seed'|'multiplayer'>,parts:readonly (string|number)[]):number {
 const namespace=JSON.stringify([SHOP_AUGMENT_SOURCE,state.multiplayer?.seatId??'solo',...parts]);
 let hash=0x811c9dc5;for(let i=0;i<namespace.length;i++)hash=Math.imul(hash^namespace.charCodeAt(i),0x01000193)>>>0;
 return nextRandom((state.seed^hash)>>>0).word;
}
const isStageStart=(round:number)=>getMultiplayerRoundByOrdinal(round).subround===1;

/* ---------------- free reroll credits ---------------- */

const ticketHit=(state:Pick<MatchState,'seed'|'multiplayer'>,a:OwnedAugment,roll:number)=>
 Math.floor(word(state,['ticket',a.choiceId,roll])*10000/4294967296)<shopAugmentValue(a.definitionId,'RerollPercent')*100;
function ticketCredits(state:Pick<MatchState,'seed'|'multiplayer'|'augments'>,rolls:number):number {
 const a=owned(state,'ticket')[0];if(!a)return 0;
 let n=0;for(let i=0;i<rolls;i++)if(ticketHit(state,a,i))n++;return n;
}
/** Every free shop reroll credit from this table: Rigged Shop+'s Rerolls on acquisition plus the recorded credits. */
export function shopAugmentFreeRerolls(state:Pick<MatchState,'augments'|'seatMechanics'>):number {
 return owned(state,'rigged').reduce((n,a)=>n+shopAugmentValue(a.definitionId,'Rerolls'),0)+(owned(state,'ticket').length?(record(state)?.credits??0):0);
}
/** Prismatic Ticket: every shop reroll while owned rolls RerollPercent for one more free reroll. */
export function recordShopReroll(state:MatchState):MatchState {
 const a=owned(state,'ticket')[0];if(!a)return state;
 const rolls=record(state)?.rolls??0,credits=record(state)?.credits??0;
 return write(state,{rolls:rolls+1,credits:credits+(ticketHit(state,a,rolls)?1:0)});
}

/* ---------------- round entry ---------------- */

/* ---------------- shop generation ---------------- */

/** Price of a shop offer: a 2-star offer is three copies. */
export function shopOfferCost(offer:{readonly definitionId:string;readonly starLevel?:2}):number {
 return UNIT_DEFINITIONS[offer.definitionId].cost*(offer.starLevel===2?3:1);
}
/** Rigged Shop+: the first shop drawn after acquisition and every Numrolls-th one after it hold only 3-cost champions.
 * The anchor is fixed by that first draw. Returns the tier to force, if any. */
export function planRiggedShop(state:MatchState,generation:number):{readonly state:MatchState;readonly tier?:CostTier} {
 const a=owned(state,'rigged')[0];if(!a)return {state};
 const anchor=record(state)?.rigAnchor??generation;
 const next=record(state)?.rigAnchor===undefined?write(state,{rigAnchor:anchor}):state;
 return (generation-anchor)%shopAugmentValue(a.definitionId,'Numrolls')===0?{state:next,tier:3}:{state:next};
}
/* ---------------- unit grants ---------------- */

/** Grant while the roster is editable; a full bench or a locked online roster retains the gift in an existing mechanic orb. */
function grantUnit(state:MatchState,request:{readonly receiptId:string;readonly definitionId:string;readonly starLevel?:2},policy?:UnitLootPolicy) {
 const base={...request,source:SHOP_AUGMENT_SOURCE};
 if(!isCombatRosterLocked(state)&&(policy||!state.multiplayer)){
  const now=grantMechanicUnit(state,{...base,immediate:true},policy);
  if(now.ok||now.reason!=='bench-full')return now;
 }
 return grantMechanicUnit(state,base,policy);
}
/** Firesale: at each round entry after acquisition, take one random champion from the freshly drawn shop for free.
 * `release` returns the slot's reserved copy to the pool before the grant reserves it again. */
export function planFiresale(state:MatchState,round:number):{readonly owner:OwnedAugment;readonly slot:number}|undefined {
 const owner=owned(state,'firesale').find(a=>a.acquiredRound<round);if(!owner)return undefined;
 const open=state.shop.slots.flatMap((s,i)=>s.status==='available'?[i]:[]);if(!open.length)return undefined;
 return {owner,slot:open[Math.floor(word(state,['firesale',owner.choiceId,round])*open.length/4294967296)]};
}
export function stealFiresaleUnit(state:MatchState,owner:OwnedAugment,slot:number,policy?:UnitLootPolicy):{readonly state:MatchState;readonly events:readonly MatchEvent[]} {
 const offer=state.shop.slots[slot];if(offer.status!=='available')throw new RangeError('Firesale slot');
 const emptied:MatchState={...state,shop:{...state.shop,slots:state.shop.slots.map((s,i)=>i===slot?{status:'purchased' as const}:s)}};
 const result=grantUnit(emptied,{receiptId:receiptId('firesale',owner,state.round),definitionId:offer.definitionId,...(offer.starLevel?{starLevel:offer.starLevel}:{})},policy);
 if(!result.ok)throw new RangeError(`Firesale grant: ${result.reason}`);
 return {state:recordShopFiresale(state,result.state,slot,receiptId('firesale',owner,state.round)),events:result.events};
}
/** ReinFOURcement: the first REINFORCED_COST-cost shop purchase after acquisition arrives at 2 stars. The upgrade is two
 * more copies of the same champion from the pool, so the purchase combines exactly like buying three. */
export function applyReinfourcement(before:MatchState,after:MatchState,policy?:UnitLootPolicy):{readonly state:MatchState;readonly events:readonly MatchEvent[]} {
 const a=owned(after,'reinfourcement')[0];
 const fact=after.resourceProvenance.entries.slice(before.resourceProvenance.entries.length).find(e=>e.kind==='unit-acquired'&&e.source.kind==='shop');
 if(!a||record(after)?.reinforced!==undefined||fact?.kind!=='unit-acquired'||fact.source.kind!=='shop'||UNIT_DEFINITIONS[fact.source.definitionId].cost!==REINFORCED_COST)return {state:after,events:[]};
 let state=write(after,{reinforced:fact.sequence});const events:MatchEvent[]=[];
 for(const copy of [0,1]){
  const result=grantUnit(state,{receiptId:receiptId('reinfourcement',a,copy),definitionId:fact.source.definitionId},policy);
  if(!result.ok)return {state:after,events:[]};
  state=result.state;events.push(...result.events);
 }
 return {state,events};
}
/* ---------------- restore ---------------- */

export function validateShopAugments(state:MatchState):void {
 const fail=(why:string)=>{throw new RangeError(`Invalid shop augment authority: ${why}`);};
 const raw=state.seatMechanics?.seat[SHOP_AUGMENT_KEY] as Record<string,unknown>|undefined;
 const int=(n:unknown,min=0):n is number=>Number.isSafeInteger(n)&&(n as number)>=min;
 if(raw!==undefined){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!RECORD_KEYS.includes(k))||!int(raw.credits))fail('record');
 }
 const r=(raw??{credits:0}) as unknown as ShopAugmentRecord;
 const ticket=owned(state,'ticket')[0],rigged=owned(state,'rigged')[0],reinforce=owned(state,'reinfourcement')[0];
 if(owned(state,'ticket').length>1)fail('duplicate');
 if(r.rolls!==undefined&&(!ticket||!int(r.rolls,1)||r.rolls>state.shop.generation))fail('rolls');
 if(r.rigAnchor!==undefined&&(!rigged||!int(r.rigAnchor,1)||r.rigAnchor>state.shop.generation))fail('rig anchor');
 if(r.credits!==ticketCredits(state,r.rolls??0))fail('credits');
 // ReinFOURcement: the marked purchase is the first such purchase after acquisition; its two copies are receipted.
 let reinforced:string|undefined;
 if(r.reinforced!==undefined){
  const fact=state.resourceProvenance.entries[r.reinforced as number];
  if(!reinforce||!int(r.reinforced)||fact?.kind!=='unit-acquired'||fact.source.kind!=='shop'||UNIT_DEFINITIONS[fact.source.definitionId]?.cost!==REINFORCED_COST
   ||getMultiplayerRoundById(fact.roundId).ordinal<reinforce.acquiredRound)fail('reinforced');
  reinforced=(fact as {source:{definitionId:string}}).source.definitionId;
 }else if(reinforce&&state.multiplayer&&state.resourceProvenance.entries.some(e=>e.kind==='unit-acquired'&&e.source.kind==='shop'&&UNIT_DEFINITIONS[e.source.definitionId]?.cost===REINFORCED_COST&&getMultiplayerRoundById(e.roundId).ordinal>reinforce.acquiredRound))fail('missing reinforced');
 const receipts=state.seatMechanics?.receipts??[];
 for(const receipt of receipts){
  if(receipt.source!==SHOP_AUGMENT_SOURCE&&!receipt.receiptId.startsWith(`["${SHOP_AUGMENT_SOURCE}",`))continue;
  let parts:unknown;try{parts=JSON.parse(receipt.receiptId);}catch{fail('receipt id');}
  const [source,rule,choiceId,n]=parts as [string,ShopAugmentRule,string,number];
  const a=state.augments.find(a=>a.choiceId===choiceId&&AUGMENT_SHOP[a.definitionId]?.rule===rule);
  if(receipt.source!==SHOP_AUGMENT_SOURCE||source!==SHOP_AUGMENT_SOURCE||!Array.isArray(parts)||parts.length!==4||!a||!int(n))fail('receipt');
  const own=a!;
  if(rule==='subscription'){if(receipt.kind!=='gold'||receipt.amount!==shopAugmentValue(own.definitionId,'GoldPerStage')||receipt.round!==n||n<=own.acquiredRound||n>state.round||!isStageStart(n))fail('subscription gold');}
  else if(rule==='firesale'){if(receipt.kind!=='unit'||![1,2].includes(receipt.starLevel??1)||receipt.starLevel===2&&UNIT_DEFINITIONS[receipt.definitionId]?.cost>2||!SHOP_CATALOG.includes(receipt.definitionId)||receipt.round!==n||n<=own.acquiredRound||n>state.round)fail('firesale');}
  else if(rule==='reinfourcement'){if(receipt.kind!=='unit'||(receipt.starLevel??1)!==1||n>1||receipt.definitionId!==reinforced)fail('reinfourcement');}
  else fail('receipt rule');
 }
 for(const a of owned(state,'subscription'))for(let round=a.acquiredRound+1;round<=state.round;round++)
  if(isStageStart(round)&&!receipts.some(x=>x.receiptId===receiptId('subscription',a,round)))fail('missing subscription gold');
 if(reinforce&&reinforced!==undefined&&[0,1].some(c=>!receipts.some(x=>x.receiptId===receiptId('reinfourcement',reinforce,c))))fail('missing reinfourcement copy');
}

/** Infinite-pool shop uses the same cadence and independent upgrade stream as shared seats. */
export function drawSoloAugmentShop(initial:MatchState,context:SixCostShopContext,subscription=false,cause:ShopDrawCause=subscription?'subscription':'natural',before=initial,audit=true):MatchState {
 const generation=initial.shop.generation+1,rigged=planRiggedShop(initial,generation),state=rigged.state;
 if(subscription){
  const available=Object.fromEntries(SHOP_CATALOG.map(id=>[id,1]));
  const draw=drawSubscriptionSlots(state,available,()=>{});
  const next={...state,rngState:draw.rngState,shop:{generation,slots:draw.slots,locked:Boolean(state.shop.locked)}};
  return audit?recordShopDraw(before,next,cause):next;
 }
 const drawn=generateShop(state.rngState,generation,state.level,state.round,context);
 let rng=state.rngState;
 const slots=drawn.shop.slots.map((offer,slot):ShopSlot=>{
  if(rigged.tier!==undefined){const draw=nextRandom(nextRandom(rng).state);rng=draw.state;const catalog=SHOP_CATALOG_BY_COST[rigged.tier];offer={status:'available',definitionId:catalog[Math.floor(draw.word*catalog.length/4294967296)]};}
  return offer.status==='available'&&starryUpgrade(state,generation,slot,offer.definitionId)?{...offer,starLevel:2}:offer;
 });
 const next={...state,...drawn,shop:{...drawn.shop,slots,...(cause==='dual-purpose'?{locked:Boolean(state.shop.locked)}:{})}};
 return audit?recordShopDraw(before,next,cause):next;
}
