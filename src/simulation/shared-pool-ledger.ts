import { encodePrimitiveTuple } from './primitive-tuple';
import { validateOpeningEncounterContext, validateOpeningEncounterState } from './opening-encounter';
import { d14OwnedUnits } from './d14-runtime';
import {findMechanicReceipt} from './seat-mechanics/state';
import { validateCarouselMetadata } from './carousel-units';
import { isImmutableJson } from './immutable-json';
import { restoreOrbLayout } from './orb-layout';
import { matchesFrozenLootLedger } from './loot-freeze';
import { canonicalContent } from './content';
import { MATCH_RULES, SHOP_CATALOG } from './match-rules';
import type { MatchState } from './match-types';
import { lootReceiptId } from './loot-identity';
import type { UnitLootPolicy } from './loot-runtime';
import { validateSeed } from './rng';
import { UNIT_DEFINITIONS } from './units';
import { getUnitSellPrice } from './unit-stats';
import { mechanicDropId } from './seat-mechanics/grants';
import { SHARED_POOL_VERSION, POOL_CAPACITY_BY_COST, type PoolHolding, type PoolSeat, type ShopReservation, type RewardReservation,
  type PoolRewardReceipt, type SharedPoolState, type SharedPoolFailure, type SharedPoolEvent } from './shared-pool-types';

export class PoolError extends Error { constructor(readonly reason:SharedPoolFailure) { super(reason); } }
export function requirePool(condition:unknown, reason:SharedPoolFailure='invalid-pool'):asserts condition {
  if (!condition) throw new PoolError(reason);
}
export const safe = (n:number,min=0) => Number.isSafeInteger(n) && n>=min;
export const sourceKey=(...parts:(string|number)[])=>encodePrimitiveTuple(parts);
export const shopSource=(r:ShopReservation)=>sourceKey('shop',r.seatId,r.generation,r.slot);
/** One key per reserved copy; a 2-star offer holds three. */
export const shopSources=(r:ShopReservation)=>r.starLevel===2?[0,1,2].map(i=>i?sourceKey('shop',r.seatId,r.generation,r.slot,i):shopSource(r)):[shopSource(r)];
export const rewardSource=(r:RewardReservation)=>sourceKey('loot',r.seatId,r.receiptId);
const rewardSources=(r:RewardReservation)=>Array.from({length:3**((r.starLevel??1)-1)},(_,i)=>r.starLevel?sourceKey('loot',r.seatId,r.receiptId,i):rewardSource(r));
const rewardSalePrice=(definitionId:string,starLevel:1|2|3)=>getUnitSellPrice({id:'orb',team:'player',location:{kind:'bench',slot:0},definitionId,starLevel});
export type PoolDraft = {-readonly [K in keyof SharedPoolState]:SharedPoolState[K]} & {
  available:Record<string,number>; seats:PoolSeat[]; shops:ShopReservation[];
  holdings:PoolHolding[]; pending:RewardReservation[]; rewards:PoolRewardReceipt[];
};
export function draftPool(pool:SharedPoolState):PoolDraft {
  return {...pool,available:{...pool.available},seats:[...pool.seats],shops:[...pool.shops],holdings:[...pool.holdings],
    pending:[...pool.pending],rewards:[...pool.rewards]};
}
export function returnHolding(pool:PoolDraft, seatId:string, unitId:string):void {
  const held=pool.holdings.find(h=>h.seatId===seatId&&h.unitId===unitId);
  requirePool(held,'invalid-seat-state');
  pool.available[held.definitionId]+=held.sources.length;
  pool.holdings=pool.holdings.filter(h=>h!==held);
}
export function releaseShop(pool:PoolDraft,seatId:string):void {
  for (const slot of pool.shops.filter(r=>r.seatId===seatId)) pool.available[slot.definitionId]+=shopSources(slot).length;
  pool.shops=pool.shops.filter(r=>r.seatId!==seatId);
}

/** Read-only invariant check. Optional states must match their registered shops/holdings. */
export function assertSharedPoolConservation(pool:SharedPoolState,states:readonly MatchState[]=[]):void {
  requirePool(pool.version===SHARED_POOL_VERSION && typeof pool.poolId==='string' && pool.poolId.length>0);
  validateSeed(pool.seed);
  try { validateOpeningEncounterContext(pool.openingEncounter,pool.seed); } catch { requirePool(false,'invalid-pool'); }
  requirePool(restoreOrbLayout(pool.orbLayout).seed===pool.seed);
  requirePool(safe(pool.revision)&&safe(pool.naturalRound)&&safe(pool.seatCount,1)&&pool.seatCount<=8);
  requirePool(Object.keys(pool.initial).length===SHOP_CATALOG.length && Object.keys(pool.available).length===SHOP_CATALOG.length);
  const totals:Record<string,number>={};
  for(const id of SHOP_CATALOG) {
    requirePool(Object.hasOwn(pool.initial,id)&&Object.hasOwn(pool.available,id)&&safe(pool.initial[id])&&pool.initial[id]<=POOL_CAPACITY_BY_COST[UNIT_DEFINITIONS[id].cost]&&safe(pool.available[id]));
    totals[id]=pool.available[id];
  }
  // Index once per validation; never cache mutable caller-owned pool/state data.
  const reservations = new Map<string, Map<number, ShopReservation[]>>();
  for (const reservation of pool.shops) {
    let slots = reservations.get(reservation.seatId);
    if (!slots) { slots = new Map(); reservations.set(reservation.seatId, slots); }
    const group = slots.get(reservation.slot);
    if (group) group.push(reservation); else slots.set(reservation.slot, [reservation]);
  }
  const seats = new Map(pool.seats.map(seat => [seat.seatId, seat]));
  const pendingRewards = new Set(pool.pending.map(rewardSource));
  const seatIds=new Set<string>(),indices=new Set<number>();
  requirePool(pool.seats.length<=pool.seatCount);
  for(const seat of pool.seats) {
    requirePool(typeof seat.seatId==='string'&&seat.seatId.length>0&&!seatIds.has(seat.seatId)&&!indices.has(seat.seatIndex)
      &&safe(seat.seatIndex)&&seat.seatIndex<pool.seatCount&&safe(seat.revision)&&safe(seat.shop.generation));
    seatIds.add(seat.seatId);indices.add(seat.seatIndex);
    requirePool(seat.shop.slots.length===MATCH_RULES.shopSize);
    for(const [slot,offer] of seat.shop.slots.entries()) {
      requirePool(['available','purchased'].includes(offer.status));
      const reserved=(reservations.get(seat.seatId)?.get(slot) ?? []);
      requirePool(offer.status==='available'?reserved.length===1&&reserved[0].generation===seat.shop.generation&&reserved[0].definitionId===offer.definitionId&&reserved[0].starLevel===offer.starLevel:reserved.length===0);
    }
    if(seat.released) requirePool(!pool.holdings.some(h=>h.seatId===seat.seatId)&&!pool.pending.some(p=>p.seatId===seat.seatId)&&!pool.shops.some(r=>r.seatId===seat.seatId));
  }
  requirePool(pool.order.length===0 || pool.order.length===pool.seatCount&&new Set(pool.order).size===pool.seatCount&&pool.order.every(s=>seatIds.has(s)));
  const sources=new Set<string>(),units=new Set<string>(),rewards=new Set<string>();
  const count=(seatId:string,definitionId:string,keys:readonly string[])=>{
    requirePool(seatIds.has(seatId)&&Object.hasOwn(totals,definitionId)&&keys.length>0);
    for(const key of keys) {requirePool(typeof key==='string'&&!sources.has(key));sources.add(key);}
    totals[definitionId]+=keys.length;
  };
  for(const r of pool.shops) {
    const seat=seats.get(r.seatId);
    requirePool(seat && !seat.released && r.generation===seat.shop.generation&&safe(r.slot)&&r.slot<MATCH_RULES.shopSize);
    requirePool(r.starLevel===undefined||r.starLevel===2&&UNIT_DEFINITIONS[r.definitionId].cost<=2);
    count(r.seatId,r.definitionId,shopSources(r));
  }
  for(const h of pool.holdings) {
    const key=sourceKey(h.seatId,h.unitId);requirePool(!units.has(key)&&[1,3,9].includes(h.sources.length));units.add(key);
    count(h.seatId,h.definitionId,h.sources);
  }
  for(const p of pool.pending) {
    requirePool([1,2,3].includes(p.starLevel??1)&&p.receiptId===lootReceiptId(p.dropId));count(p.seatId,p.definitionId,rewardSources(p));
  }
  for(const r of pool.rewards) {
    const key=rewardSource(r);requirePool(!rewards.has(key)&&seatIds.has(r.seatId)&&Object.hasOwn(totals,r.definitionId)
      &&[1,2,3].includes(r.starLevel??1)&&r.receiptId===lootReceiptId(r.dropId)&&['held','gold','capacity-sold','forfeited'].includes(r.resolution)
      &&r.gold===(r.resolution==='gold'?UNIT_DEFINITIONS[r.definitionId].cost:r.resolution==='capacity-sold'?rewardSalePrice(r.definitionId,r.starLevel??1):0)
      &&!pendingRewards.has(key));rewards.add(key);
  }
  const carouselKeys=new Set<string>();
  requirePool(Array.isArray(pool.carouselParticipants)&&Array.isArray(pool.carouselRounds)&&new Set(pool.carouselRounds).size===pool.carouselRounds.length);
  for(const r of pool.carouselReservations) {
    requirePool(typeof r.carouselId==='string'&&r.reservationId===`${r.carouselId}:slot:${r.slot}`&&safe(r.slot)&&r.slot<9&&!carouselKeys.has(r.reservationId)&&Object.hasOwn(totals,r.definitionId));
    requirePool(r.seatId===null||seatIds.has(r.seatId));carouselKeys.add(r.reservationId);totals[r.definitionId]++;
  }
  const receiptKeys=new Set<string>();
  for(const r of pool.carouselReceipts) {
    requirePool((r.id===`${r.carouselId}:${r.seatId}`||Array.from({length:8},(_,i)=>`${r.carouselId}:${r.seatId}:extra:${i+1}`).includes(r.id))&&r.holdingSource===r.id&&!receiptKeys.has(r.id)&&seatIds.has(r.seatId)&&Object.hasOwn(totals,r.definitionId)&&['reserved','granted','released'].includes(r.status));receiptKeys.add(r.id);
    const reservation=pool.carouselReservations.find(p=>p.carouselId===r.carouselId&&p.slot===r.slot);
    requirePool(r.status==='reserved'?!!reservation&&reservation.seatId===r.seatId&&reservation.definitionId===r.definitionId:!reservation);
    requirePool(r.status==='granted'?typeof r.unitId==='string'&&typeof r.itemInstanceId==='string':r.unitId===null&&r.itemInstanceId===null);
  }
  for(const id of SHOP_CATALOG) requirePool(totals[id]===pool.initial[id]);
  const provided=new Set<string>();
  for(const state of states) {
    try { validateOpeningEncounterState(state,pool.openingEncounter); } catch { requirePool(false,'invalid-seat-state'); }
    validateCarouselMetadata(state);
    const layoutBinding=state.m8.loot.layoutBinding;
    requirePool(layoutBinding.mode==='shared'&&layoutBinding.poolId===pool.poolId&&layoutBinding.version===pool.orbLayout.version,'invalid-seat-state');
    requirePool(layoutBinding.throughRoundOrdinal === state.m8.loot.frozen.throughRoundOrdinal
      && state.m8.loot.frozen.throughRoundOrdinal === Math.min(state.round,38)
      && state.m8.loot.frozen.throughRoundOrdinal<=pool.orbLayout.throughRoundOrdinal,'invalid-seat-state');
    requirePool(matchesFrozenLootLedger(state.m8.loot.frozen,state.seed,state.m8.loot.frozen.throughRoundOrdinal,pool.orbLayout),'invalid-seat-state');
    const binding=state.sharedPool;requirePool(binding&&binding.poolId===pool.poolId,'invalid-seat-state');
    const opening=state.resourceProvenance.entries[0];
    requirePool(opening?.kind==='unit-acquired'&&opening.source.kind==='opening'&&opening.source.seed===pool.seed&&opening.source.seatId===binding.seatId,'invalid-seat-state');
    requirePool(!provided.has(binding.seatId),'invalid-seat-state');provided.add(binding.seatId);
    const seat=seats.get(binding.seatId);requirePool(seat,'invalid-seat-state');
    requirePool(binding.revision===seat.revision,'stale-seat');
    requirePool(state.multiplayer?.seatId===seat.seatId&&((state.shop===seat.shop&&isImmutableJson(state.shop))||canonicalContent(state.shop)===canonicalContent(seat.shop)),'invalid-seat-state');
    const roster=d14OwnedUnits(state).filter(u=>u.team==='player'&&!UNIT_DEFINITIONS[u.definitionId]?.summon),held=pool.holdings.filter(h=>h.seatId===seat.seatId);
    if(seat.released) {requirePool(state.multiplayer?.status==='eliminated'&&state.playerHp===0,'invalid-seat-state');continue;}
    requirePool(roster.length+(state.carousel?.pendingUnits.length??0)===held.length,'invalid-seat-state');
    for(const u of roster) requirePool(held.some(h=>h.unitId===u.id&&h.definitionId===u.definitionId&&h.sources.length===3**(u.starLevel-1)),'invalid-seat-state');
    for(const pending of state.carousel?.pendingUnits??[]) requirePool(held.some(h=>h.unitId===pending.unitId&&h.definitionId===pending.definitionId&&h.sources.length===1),'invalid-seat-state');
    for(const p of pool.pending.filter(p=>p.seatId===seat.seatId)) {
      const progress=state.m8.loot.direct.find(d=>d.dropId===p.dropId);
      requirePool(progress&&['revealed','pending-capacity','retained-terminal'].includes(progress.status),'invalid-seat-state');
    }
  }
}

const isSummon=(state:MatchState,unitId:string)=>!!UNIT_DEFINITIONS[state.preparation.units.find(u=>u.id===unitId)?.definitionId??'']?.summon;
/** Fold committed acquisition/upgrade/sale facts, never infer returned copies from display counts. */
export function reconcileHoldings(pool:PoolDraft,before:MatchState,after:MatchState,events:SharedPoolEvent[],preSold?:string):void {
  const seatId=before.sharedPool!.seatId;
  requirePool(after.resourceProvenance.entries.length>=before.resourceProvenance.entries.length,'invalid-seat-state');
  for(const fact of after.resourceProvenance.entries.slice(before.resourceProvenance.entries.length)) {
    if(fact.kind==='unit-acquired') {
      let definitionId:string,source:string, sources:readonly string[]|undefined;
      if(fact.source.kind==='shop') {
        const origin=fact.source,r=pool.shops.find(r=>r.seatId===seatId&&r.generation===origin.generation&&r.slot===origin.slotIndex);
        requirePool(r&&r.definitionId===origin.definitionId,'invalid-seat-state');
        requirePool((origin.starLevel??1)===(r.starLevel??1),'invalid-seat-state');
        definitionId=r.definitionId;source=shopSource(r);sources=shopSources(r);pool.shops=pool.shops.filter(s=>s!==r);
      } else if(fact.source.kind==='mechanic') {
        // G2-3 mechanic grant: summons never enter the pool; heroes consume the same-transaction reservation.
        const mechanicReceipt=findMechanicReceipt(after,fact.source.receiptId);
        if(mechanicReceipt?.kind==='unit'&&UNIT_DEFINITIONS[mechanicReceipt.definitionId]?.summon)continue;
        const dropId=mechanicDropId(fact.source.receiptId),p=pool.pending.find(p=>p.seatId===seatId&&p.dropId===dropId);
        requirePool(p,'invalid-seat-state');definitionId=p.definitionId;source=rewardSource(p);sources=rewardSources(p);
        pool.pending=pool.pending.filter(r=>r!==p);
        const receipt:PoolRewardReceipt={...p,resolution:'held',gold:0};pool.rewards.push(receipt);events.push({type:'sharedRewardResolved',receipt});
      } else {
        requirePool(fact.source.kind==='loot','invalid-seat-state');
        const receiptId=fact.source.receiptId;
        if(after.m8.loot.receipts.some(r=>r.receiptId===receiptId&&r.payload.kind==='forge'&&r.grantedUnitIds.includes(fact.unitId)))continue;
        const p=pool.pending.find(p=>p.seatId===seatId&&p.receiptId===receiptId);
        requirePool(p,'invalid-seat-state');definitionId=p.definitionId;source=rewardSource(p);sources=rewardSources(p);
        pool.pending=pool.pending.filter(r=>r!==p);
        const receipt:PoolRewardReceipt={...p,resolution:'held',gold:0};pool.rewards.push(receipt);events.push({type:'sharedRewardResolved',receipt});
      }
      pool.holdings.push({seatId,unitId:fact.unitId,definitionId,sources:sources??[source]});
    } else if(fact.kind==='unit-upgraded'||fact.kind==='unit-upgraded-after-combat') {
      const e=fact.event;if(UNIT_DEFINITIONS[e.definitionId]?.summon)continue;const ids=[e.survivorId,...e.consumedIds];
      const parts=ids.map(id=>pool.holdings.find(h=>h.seatId===seatId&&h.unitId===id));
      requirePool(parts.every(h=>h&&h.definitionId===e.definitionId&&h.sources.length===3**(e.fromStar-1)),'invalid-seat-state');
      pool.holdings=pool.holdings.filter(h=>h.seatId!==seatId||!ids.includes(h.unitId));
      pool.holdings.push({seatId,unitId:e.survivorId,definitionId:e.definitionId,sources:parts.flatMap(h=>h!.sources)});
    } else if(fact.kind==='carousel-preparation-settled'||fact.kind==='carousel-unit-claimed') {
      for(const e of fact.upgrades){const ids=[e.survivorId,...e.consumedIds],parts=ids.map(id=>pool.holdings.find(h=>h.seatId===seatId&&h.unitId===id));requirePool(parts.every(h=>h&&h.definitionId===e.definitionId&&h.sources.length===3**(e.fromStar-1)),'invalid-seat-state');pool.holdings=pool.holdings.filter(h=>h.seatId!==seatId||!ids.includes(h.unitId));pool.holdings.push({seatId,unitId:e.survivorId,definitionId:e.definitionId,sources:parts.flatMap(h=>h!.sources)});}
    } else if(fact.kind==='unit-sold' && fact.unitId!==preSold && !isSummon(before,fact.unitId)) returnHolding(pool,seatId,fact.unitId);
    // Batch-3 Dummify/Golemify: a removed champion returns every copy it holds, exactly like a sale (the fact is the receipt).
    else if(fact.kind==='unit-removed' && !isSummon(before,fact.unitId)) returnHolding(pool,seatId,fact.unitId);
  }
  for(const p of pool.pending.filter(p=>p.seatId===seatId)) {
    if(after.m8.loot.direct.find(d=>d.dropId===p.dropId)?.status!=='forfeited') continue;
    pool.available[p.definitionId]+=rewardSources(p).length;pool.pending=pool.pending.filter(r=>r!==p);
    const receipt:PoolRewardReceipt={...p,resolution:'forfeited',gold:0};pool.rewards.push(receipt);events.push({type:'sharedRewardResolved',receipt});
  }
}
export function rewardPolicy(pool:PoolDraft,state:MatchState,events:SharedPoolEvent[]):UnitLootPolicy {
  return (drop,capacitySold)=>{
    requirePool(drop.payload.kind==='unit'&&drop.payload.quantity===1,'invalid-loot');
    const seatId=state.sharedPool!.seatId,definitionId=drop.payload.definitionId;
    const starLevel=drop.payload.starLevel??1,copies=3**(starLevel-1);
    const p:RewardReservation={seatId,definitionId,dropId:drop.dropId,receiptId:lootReceiptId(drop.dropId),...(starLevel>1?{starLevel}:{})};
    requirePool(Object.hasOwn(pool.available,definitionId)&&!pool.rewards.some(r=>rewardSource(r)===rewardSource(p)),'invalid-loot');
    if(pool.pending.some(r=>rewardSource(r)===rewardSource(p))) return drop.payload;
    if(pool.available[definitionId]>=copies) {
      if(capacitySold) {
        const gold=rewardSalePrice(definitionId,starLevel),receipt:PoolRewardReceipt={...p,resolution:'capacity-sold',gold};
        pool.rewards.push(receipt);events.push({type:'sharedRewardResolved',receipt});
        return {kind:'gold',quantity:gold,resolution:'capacity-sold'};
      }
      pool.available[definitionId]-=copies;pool.pending.push(p);events.push({type:'sharedRewardReserved',seatId,dropId:drop.dropId});
      return drop.payload;
    }
    const gold=UNIT_DEFINITIONS[definitionId].cost,receipt:PoolRewardReceipt={...p,resolution:'gold',gold};
    pool.rewards.push(receipt);events.push({type:'sharedRewardResolved',receipt});
    return {kind:'gold',quantity:gold,resolution:'gold'};
  };
}
