
import type { MatchState } from './match-types';
import { SHOP_HISTORY_VERSION, type ShopCredit, type ShopDrawCause, type ShopHistoryEntry, type ShopHistoryPoint } from './shop-history-types';
import { AUGMENT_SHOP } from './content/augment-pool-shop';
import { freeRerollGrants } from './free-rerolls';
import { shopOfferCost, starryUpgrade } from './shop-augments';
import { xpPurchaseCost } from './augment-xp';
import { MATCH_RULES } from './match-rules';

export const shopOwner=(id:string)=>Boolean(AUGMENT_SHOP[id])||id==='dual-purpose'||id==='shop-glitch'||id==='reroll-transfer'||id==='at-what-cost';
export const point=(s:MatchState):ShopHistoryPoint=>({round:s.round,level:s.level,xp:s.xp,resourcePrefix:s.resourceProvenance.entries.length,owners:s.augments.map(a=>a.choiceId),gold:s.gold,mechanicPrefix:s.seatMechanics?.receipts.length??0,lootPrefix:s.m8.loot.receipts.length,schedulePrefix:s.scheduleReceipts.length,economyPrefix:s.roundResults.length});
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
export function baselineSpends(state:MatchState):Map<string,number> {
 const h=state.shopHistory!,initial=h.initial,owners=state.augments.filter(a=>initial.owners.includes(a.choiceId));
 const view={...state,augments:owners,round:initial.round,level:initial.level,xp:initial.xp,
  resourceProvenance:{...state.resourceProvenance,entries:state.resourceProvenance.entries.slice(0,initial.resourcePrefix)}};
 let left=state.resourceProvenance.entries.slice(0,initial.resourcePrefix).filter(e=>e.kind==='free-reroll').length;
 const used=new Map<string,number>();
 for(const g of freeRerollGrants(view)){const n=Math.min(left,g.count);used.set(g.choiceId,n);left-=n;}
 check(left===0,'initial free credits');return used;
}
export function nextCredit(state:MatchState,used:ReadonlyMap<string,number>):ShopCredit|null {
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
export function check(value:unknown,why:string):asserts value {if(!value)throw new RangeError(`Invalid shop history: ${why}`);}


