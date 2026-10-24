import type { MatchEvent, MatchState, ShopSlot } from './match-types';
import type { OwnedAugment } from './strategy-types';
import type { UnitLootPolicy } from './loot-runtime';
import type { CostTier } from './unit-types';
import { AUGMENT_SHOP, shopAugmentValue, type ShopAugmentRule } from './content/augment-pool-shop';
import { readSeatMechanic, writeSeatMechanic } from './seat-mechanics/state';
import { grantMechanicGold, grantMechanicUnit } from './seat-mechanics/grants';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { isCombatRosterLocked } from './operation-policy';
import { MATCH_RULES, SHOP_CATALOG, SHOP_CATALOG_BY_COST } from './match-rules';
import { nextRandom } from './rng';
import { UNIT_DEFINITIONS } from './units';

/** Owner-visible shop-augment ledger. `credits` is the free shop rerolls earned so far by round-entry and reroll rules;
 * restore re-derives it from provenance, the recorded round-start gold and the seed. */
export const SHOP_AUGMENT_KEY='shop-augments';
export const SHOP_AUGMENT_SOURCE='augment-pool-shop';
interface ShopAugmentRecord {
 readonly credits:number;
 /** Invested: [round, gold] at every round entry after acquisition. */
 readonly rounds?:readonly (readonly [number,number])[];
 /** Prismatic Ticket: shop rerolls made while owned. */
 readonly rolls?:number;
 /** Rigged Shop+: generation of the first shop drawn after acquisition. */
 readonly rigAnchor?:number;
 /** ReinFOURcement: provenance sequence of the 4-cost purchase that was upgraded. */
 readonly reinforced?:number;
}
const RECORD_KEYS=['credits','rounds','rolls','rigAnchor','reinforced'];
/** Literal counts from the 14.24 descriptions that have no source field. */
const REINFORCED_COST=4, SUBSCRIPTION_SIZE=4;

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

/** Patience is a Virtue: FreeRerolls at every round entry after acquisition whose previous round had no shop purchase. */
function patienceCredits(state:Pick<MatchState,'augments'|'round'|'resourceProvenance'>):number {
 const bought=new Set(state.resourceProvenance.entries.flatMap(e=>e.kind==='unit-acquired'&&e.source.kind==='shop'?[getMultiplayerRoundById(e.roundId).ordinal]:[]));
 return owned(state,'patience').reduce((sum,a)=>{
  let n=0;for(let round=a.acquiredRound+1;round<=state.round;round++)if(!bought.has(round-1))n+=shopAugmentValue(a.definitionId,'FreeRerolls');
  return sum+n;
 },0);
}
/** Invested: one reroll per GoldPerReroll held above GoldThreshold, counting at most MaxGold. */
function investedCredits(state:Pick<MatchState,'augments'>,rounds:readonly (readonly [number,number])[]):number {
 const a=owned(state,'invested')[0];if(!a)return 0;
 const v=(k:string)=>shopAugmentValue(a.definitionId,k);
 return rounds.reduce((sum,[,gold])=>sum+Math.max(0,Math.floor((Math.min(gold,v('MaxGold'))-v('GoldThreshold'))/v('GoldPerReroll'))),0);
}
const ticketHit=(state:Pick<MatchState,'seed'|'multiplayer'>,a:OwnedAugment,roll:number)=>
 Math.floor(word(state,['ticket',a.choiceId,roll])*100/4294967296)<shopAugmentValue(a.definitionId,'RerollPercent');
function ticketCredits(state:Pick<MatchState,'seed'|'multiplayer'|'augments'>,rolls:number):number {
 const a=owned(state,'ticket')[0];if(!a)return 0;
 let n=0;for(let i=0;i<rolls;i++)if(ticketHit(state,a,i))n++;return n;
}
/** Every free shop reroll credit from this table: Rigged Shop+'s Rerolls on acquisition plus the recorded credits. */
export function shopAugmentFreeRerolls(state:Pick<MatchState,'augments'|'seatMechanics'>):number {
 return owned(state,'rigged').reduce((n,a)=>n+shopAugmentValue(a.definitionId,'Rerolls'),0)+(record(state)?.credits??0);
}
/** Prismatic Ticket: every shop reroll while owned rolls RerollPercent for one more free reroll. */
export function recordShopReroll(state:MatchState):MatchState {
 const a=owned(state,'ticket')[0];if(!a)return state;
 const rolls=record(state)?.rolls??0,credits=record(state)?.credits??0;
 return write(state,{rolls:rolls+1,credits:credits+(ticketHit(state,a,rolls)?1:0)});
}

/* ---------------- round entry ---------------- */

/** Round entry, after income and this round's scheduled gifts: Patience and Invested credits, Subscription Service gold. */
export function enterShopAugmentRound(initial:MatchState):MatchState {
 let state=initial;const round=state.round;
 for(const a of owned(state,'patience'))if(a.acquiredRound<round&&!state.resourceProvenance.entries.some(e=>e.kind==='unit-acquired'&&e.source.kind==='shop'&&getMultiplayerRoundById(e.roundId).ordinal===round-1))
  state=write(state,{credits:(record(state)?.credits??0)+shopAugmentValue(a.definitionId,'FreeRerolls')});
 const invested=owned(state,'invested')[0];
 if(invested&&invested.acquiredRound<round){
  const rounds=[...(record(state)?.rounds??[]),[round,state.gold] as const];
  state=write(state,{rounds,credits:(record(state)?.credits??0)+investedCredits(state,rounds)-investedCredits(state,rounds.slice(0,-1))});
 }
 for(const a of owned(state,'subscription'))if(a.acquiredRound<round&&isStageStart(round)){
  const result=grantMechanicGold(state,{receiptId:receiptId('subscription',a,round),source:SHOP_AUGMENT_SOURCE,amount:shopAugmentValue(a.definitionId,'GoldPerStage')});
  if(!result.ok)throw new RangeError(`Shop augment stage gold: ${result.reason}`);state=result.state;
 }
 return state;
}

/* ---------------- shop generation ---------------- */

/** Price of a shop offer: a 2-star offer is three copies. */
export function shopOfferCost(offer:{readonly definitionId:string;readonly starLevel?:2}):number {
 return UNIT_DEFINITIONS[offer.definitionId].cost*(offer.starLevel===2?3:1);
}
/** Starry Night: 14.24 chance by player level, under the archive's hashed field names (triage 2026-10-24). Levels 1-2
 * use the level-3 chance and 1- and 2-cost share one chance (P). MaxTier ({0d14760d}) bounds the cost. */
const STARRY_CHANCE_KEYS:Readonly<Record<number,string>>={3:'{4abd7204}',4:'{49c43705}',5:'{99dcb7a2}',6:'{020fb2eb}',7:'{7083c200}',8:'{ca771d21}',9:'{019b80fe}',10:'{4885b8ce}'};
export function starryChanceBps(state:Pick<MatchState,'augments'|'level'>):number {
 const a=owned(state,'starry')[0];if(!a)return 0;
 const v=AUGMENT_SHOP[a.definitionId].source.values[STARRY_CHANCE_KEYS[Math.min(10,Math.max(3,state.level))]];
 return Math.round(v!*10000);
}
/** Whether this freshly drawn 1-star offer becomes 2-star. Seat/generation/slot-bound, so the shop RNG stream is unchanged;
 * the caller reserves the two extra copies and keeps a 1-star offer when the pool lacks them. */
export function starryUpgrade(state:MatchState,generation:number,slot:number,definitionId:string):boolean {
 const a=owned(state,'starry')[0];if(!a||UNIT_DEFINITIONS[definitionId].cost>shopAugmentValue(a.definitionId,'{0d14760d}'))return false;
 return Math.floor(word(state,['starry',a.choiceId,generation,slot])*10000/4294967296)<starryChanceBps(state);
}

/** Rigged Shop+: the first shop drawn after acquisition and every Numrolls-th one after it hold only 3-cost champions.
 * The anchor is fixed by that first draw. Returns the tier to force, if any. */
export function planRiggedShop(state:MatchState,generation:number):{readonly state:MatchState;readonly tier?:CostTier} {
 const a=owned(state,'rigged')[0];if(!a)return {state};
 const anchor=record(state)?.rigAnchor??generation;
 const next=record(state)?.rigAnchor===undefined?write(state,{rigAnchor:anchor}):state;
 return (generation-anchor)%shopAugmentValue(a.definitionId,'Numrolls')===0?{state:next,tier:3}:{state:next};
}
/** Subscription Service opens on acquisition and at every stage start after it. */
export function subscriptionAcquired(before:MatchState,after:MatchState):boolean {
 return owned(after,'subscription').some(a=>!before.augments.some(b=>b.choiceId===a.choiceId));
}
export function subscriptionStageStart(state:MatchState,round:number):boolean {
 return owned(state,'subscription').some(a=>a.acquiredRound<round)&&isStageStart(round);
}
/** Subscription Service shop: SUBSCRIPTION_SIZE distinct ChampionTier champions weighted by available copies, the rest empty.
 * `take` reserves one copy; the caller owns the pool ledger. Draws use the seat's shop RNG like a normal refresh. */
export function drawSubscriptionSlots(state:MatchState,available:Readonly<Record<string,number>>,take:(definitionId:string,slot:number)=>void):{readonly slots:ShopSlot[];readonly rngState:number;readonly rngDraws:number} {
 const a=owned(state,'subscription')[0]!,tier=shopAugmentValue(a.definitionId,'ChampionTier') as CostTier;
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

/* ---------------- unit grants ---------------- */

/** Online heroes are granted at once while the roster is editable (the policy reserves the copy) and fall back to a
 * reward orb on a full bench or a locked roster, like every other online gift. */
function grantUnit(state:MatchState,request:{readonly receiptId:string;readonly definitionId:string;readonly starLevel?:2},policy?:UnitLootPolicy) {
 const base={...request,source:SHOP_AUGMENT_SOURCE};
 if(!isCombatRosterLocked(state)&&(policy||!state.multiplayer)){
  const now=grantMechanicUnit(state,{...base,immediate:true},policy);
  if(now.ok||now.reason!=='bench-full'||!state.multiplayer)return now;
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
 return {state:result.state,events:result.events};
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
/** Dual Purpose: the first XP purchase of each round while owned pays goldtogive; the caller rerolls the shop. */
export function dualPurposeOwner(state:MatchState):OwnedAugment|undefined { return owned(state,'dual-purpose')[0]; }
export function grantDualPurposeGold(state:MatchState):MatchState {
 const a=dualPurposeOwner(state);if(!a)return state;
 const id=receiptId('dual-purpose',a,state.round);
 if(state.seatMechanics?.receipts.some(r=>r.receiptId===id))return state;
 const result=grantMechanicGold(state,{receiptId:id,source:SHOP_AUGMENT_SOURCE,amount:shopAugmentValue(a.definitionId,'goldtogive')});
 if(!result.ok)throw new RangeError(`Dual Purpose gold: ${result.reason}`);return result.state;
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
 const invested=owned(state,'invested')[0],ticket=owned(state,'ticket')[0],rigged=owned(state,'rigged')[0],reinforce=owned(state,'reinfourcement')[0];
 if(owned(state,'invested').length>1||owned(state,'ticket').length>1)fail('duplicate');
 // Invested: exactly one [round, gold] per round entry after acquisition, in order.
 const rounds=r.rounds??[];
 if(r.rounds!==undefined&&(!invested||!Array.isArray(r.rounds)||!r.rounds.length))fail('rounds');
 if(invested){
  const expected=Array.from({length:Math.max(0,state.round-invested.acquiredRound)},(_,i)=>invested.acquiredRound+1+i);
  if(rounds.length!==expected.length||rounds.some((e,i)=>!Array.isArray(e)||e.length!==2||e[0]!==expected[i]||!int(e[1])))fail('rounds');
 }
 if(r.rolls!==undefined&&(!ticket||!int(r.rolls,1)||r.rolls>state.shop.generation))fail('rolls');
 if(r.rigAnchor!==undefined&&(!rigged||!int(r.rigAnchor,1)||r.rigAnchor>state.shop.generation))fail('rig anchor');
 if(r.credits!==patienceCredits(state)+investedCredits(state,rounds)+ticketCredits(state,r.rolls??0))fail('credits');
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
  else if(rule==='dual-purpose'){if(receipt.kind!=='gold'||receipt.amount!==shopAugmentValue(own.definitionId,'goldtogive')||receipt.round!==n||n<own.acquiredRound||n>state.round)fail('dual purpose gold');}
  else if(rule==='firesale'){if(receipt.kind!=='unit'||![1,2].includes(receipt.starLevel??1)||receipt.starLevel===2&&UNIT_DEFINITIONS[receipt.definitionId]?.cost>2||!SHOP_CATALOG.includes(receipt.definitionId)||receipt.round!==n||n<=own.acquiredRound||n>state.round)fail('firesale');}
  else if(rule==='reinfourcement'){if(receipt.kind!=='unit'||(receipt.starLevel??1)!==1||n>1||receipt.definitionId!==reinforced)fail('reinfourcement');}
  else fail('receipt rule');
 }
 for(const a of owned(state,'subscription'))for(let round=a.acquiredRound+1;round<=state.round;round++)
  if(isStageStart(round)&&!receipts.some(x=>x.receiptId===receiptId('subscription',a,round)))fail('missing subscription gold');
 if(reinforce&&reinforced!==undefined&&[0,1].some(c=>!receipts.some(x=>x.receiptId===receiptId('reinfourcement',reinforce,c))))fail('missing reinfourcement copy');
}
