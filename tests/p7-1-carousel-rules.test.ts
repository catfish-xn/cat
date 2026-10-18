import {freezeCombatInput} from '../src/simulation/combat-input';
import {expect,it} from 'vitest';
import {atSupply,must,supplySeats} from './p7-carousel-helper';
import {createCarousel,prepareCarouselParticipants,advanceCarousel,pickCarouselForSeat,completeCarouselForSeat,resolvePendingCarouselUnits,sellPendingCarouselUnit,restoreCarouselSeat,grantCarouselPick,releaseCarouselParticipant} from '../src/simulation/carousel';
import {buySharedUnit,rerollSharedShop,nextSharedRound,sellSharedUnit,assertSharedPoolConservation,releaseSeatOnElimination} from '../src/simulation/shared-pool';
import {buyXp,deployMatchUnit,stepMatch} from '../src/simulation/match';
import {toPrivateSeatView} from '../src/simulation/private-seat-view';
import {UNIT_DEFINITIONS} from '../src/simulation/units';
import type {MatchState} from '../src/simulation/match-types';
import type {SharedPoolState} from '../src/simulation/shared-pool-types';
import {resolveCarouselPreparation,validateCarouselMetadata} from '../src/simulation/carousel-units';
import {getMultiplayerRoundByOrdinal} from '../src/simulation/multiplayer-round';

function buyUntil(pool:SharedPoolState,state:MatchState,done:(s:MatchState)=>boolean,want:(id:string)=>boolean=()=>true){
  for(let guard=0;!done(state);guard++){
    if(guard>1000)throw Error('shop fixture guard');
    const slot=state.shop.slots.findIndex(s=>s.status==='available'&&want(s.definitionId)&&state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===s.definitionId&&u.starLevel===1).length<2);
    const r=must(slot<0?rerollSharedShop(pool,state,state.shop.generation):buySharedUnit(pool,state,slot,state.shop.generation));pool=r.pool;state=r.state;
  }
  return {pool,state};
}
function capacity(fullBoard:boolean){
  let {pool,state}=atSupply();state={...state,gold:10000};
  if(fullBoard){
    while(state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length<state.level){
      ({pool,state}=buyUntil(pool,state,s=>s.preparation.units.some(u=>u.location.kind==='bench')));
      const u=state.preparation.units.find(u=>u.location.kind==='bench')!;
      const col=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length;
      state=must(deployMatchUnit(state,u.id,{kind:'board',cell:{col,row:7}})).state;
    }
  }
  return buyUntil(pool,state,s=>s.preparation.units.filter(u=>u.location.kind==='bench').length===9);
}
function pick(pool:SharedPoolState,state:MatchState,slot=0){
  pool=must(prepareCarouselParticipants(pool,[{seatId:'s0',state}])).pool;
  const carousel=must(advanceCarousel(must(createCarousel(pool,'2-4',{algorithm:'lcg32-v1',state:123})).state,6000)).state;
  return must(pickCarouselForSeat(carousel.pool,carousel,state,'s0',slot));
}
function nextPreparation(picked:ReturnType<typeof pick>){
  const closed=must(advanceCarousel(picked.carousel,12000)).state;
  const complete=must(completeCarouselForSeat(closed,picked.state,'s0'));
  const advanced=must(nextSharedRound(complete.state.pool,[complete.match],complete.match.round));
  return {pool:advanced.pool,state:advanced.states[0],events:advanced.events.flatMap(e=>e.events),carousel:{...complete.state,pool:advanced.pool}};
}
it('an overdue carousel preparation receipt validates in overtime and still rejects invalid boundaries',()=>{
  const a=atSupply(),picked=pick(a.pool,a.state),round=getMultiplayerRoundByOrdinal(39);
  // Isolate an overdue receipt's consumption boundary; the natural route is covered separately.
  const state:MatchState={...picked.state,phase:'preparation',round:39,roundDefinitionId:round.roundId,
    pendingChoice:null,combat:null,m8:{...picked.state.m8,round}};
  const resolved=resolveCarouselPreparation(state);
  expect(resolved.state.resourceProvenance.entries.at(-1)).toMatchObject({kind:'carousel-preparation-settled',roundId:'overtime-1'});
  expect(()=>validateCarouselMetadata(resolved.state)).not.toThrow();
  expect(resolveCarouselPreparation(resolved.state)).toEqual({state:resolved.state,events:[]});
  const bad=structuredClone(resolved.state);
  Object.assign(bad.resourceProvenance.entries.at(-1)!,{roundId:'2-4'});
  expect(()=>validateCarouselMetadata(bad)).toThrow();
  Object.assign(bad.resourceProvenance.entries.at(-1)!,{roundId:'overtime-0'});
  expect(()=>validateCarouselMetadata(bad)).toThrow();
});
it('bench takes priority; a full bench falls back to board and that pick enters the next combat roster',()=>{
  const a=atSupply(),bench=pick(a.pool,a.state),id=bench.state.carousel!.receipts.at(-1)!.unitId!;
  expect(bench.state.preparation.units.find(u=>u.id===id)?.location.kind).toBe('bench');
  const b=capacity(false),board=pick(b.pool,b.state),boardId=board.state.carousel!.receipts.at(-1)!.unitId!;
  expect(board.state.preparation.units.find(u=>u.id===boardId)?.location.kind).toBe('board');
  const next=nextPreparation(board),combat=freezeCombatInput(next.state,1,next.state.resourceProvenance.entries.length);
  expect(combat.inputs.preparation.units.some(u=>u.id===boardId)).toBe(true);
  assertSharedPoolConservation(next.pool,[next.state]);
});
it('both full holds a pool-owned unit outside the combat roster; sell is atomic and returns its copy once',()=>{
  const a=capacity(true),picked=pick(a.pool,a.state),held=picked.state.carousel!.heldCarouselUnits[0];
  expect(held).toBeDefined();expect(picked.state.preparation.units.some(u=>u.id===held.unitId)).toBe(false);
  expect(toPrivateSeatView(picked.state).heldCarouselUnits).toEqual([held]);
  const next=nextPreparation(picked),combat=freezeCombatInput(next.state,1,next.state.resourceProvenance.entries.length);
  expect(combat.inputs.preparation.units.some(u=>u.id===held.unitId)).toBe(false);
  const failed=sellPendingCarouselUnit(next.pool,{...next.state,phase:'combat'} as MatchState,held.unitId);
  expect(failed.ok).toBe(false);expect(failed.pool).toBe(next.pool);
  const sold=must(sellPendingCarouselUnit(next.pool,next.state,held.unitId));
  expect(sold.state.gold).toBe(next.state.gold+UNIT_DEFINITIONS[held.definitionId].cost);
  expect(sold.pool.available[held.definitionId]).toBe(next.pool.available[held.definitionId]+1);
  expect(sold.state.carousel!.heldCarouselUnits).toEqual([]);
  const repeat=sellPendingCarouselUnit(sold.pool,sold.state,held.unitId);
  expect(repeat).toMatchObject({ok:false,reason:'unknown-unit',pool:sold.pool,state:sold.state});
  assertSharedPoolConservation(sold.pool,[sold.state]);
});
it.each(['bench','board','level'] as const)('held units move after a %s vacancy, once, without another birth or RNG draw',kind=>{
  const a=capacity(true),picked=pick(a.pool,a.state),next=nextPreparation(picked),held=next.state.carousel!.heldCarouselUnits[0];
  let {pool,state}=next;
  if(kind==='level'){const oldLevel=state.level;while(state.level===oldLevel)state=must(buyXp(state)).state;}
  else {
    const unit=state.preparation.units.find(u=>u.team==='player'&&u.location.kind===kind)!;
    const sold=must(sellSharedUnit(pool,state,unit.id));pool=sold.pool;state=sold.state;
  }
  const serial=state.nextUnitSerial,rng=state.rngState,items=state.items;
  const moved=must(resolvePendingCarouselUnits(pool,state));
  expect(moved.state.carousel!.heldCarouselUnits).toEqual([]);
  expect(moved.state.nextUnitSerial).toBe(serial);expect(moved.state.rngState).toBe(rng);expect(moved.state.items).toEqual(items);
  const claimed=moved.events.filter(e=>e.type==='carouselPendingClaimed');expect(claimed).toHaveLength(1);
  // A triple can consume the card after it moves; the claim and ownership ledger remain authoritative.
  expect(moved.state.preparation.units.some(u=>u.id===held.unitId)||moved.events.some(e=>e.type==='unitUpgraded'&&e.consumedIds.includes(held.unitId))).toBe(true);
  const again=must(resolvePendingCarouselUnits(moved.pool,moved.state));expect(again.state).toBe(moved.state);expect(again.events).toEqual([]);
  expect(()=>restoreCarouselSeat({...next.carousel,pool:moved.pool},moved.state)).not.toThrow();
  assertSharedPoolConservation(moved.pool,[moved.state]);
});
it('defers a real upgrade until next preparation; repeated steps, grants and restored resolution issue no second receipt',()=>{
  let {pool,state}=atSupply();state={...state,gold:10000};
  const preview=must(createCarousel(pool,'2-4',{algorithm:'lcg32-v1',state:123})).state;
  const target=preview.slots.find(s=>!state.preparation.units.some(u=>u.definitionId===s.definitionId))!;
  ({pool,state}=buyUntil(pool,state,s=>s.preparation.units.filter(u=>u.definitionId===target.definitionId&&u.starLevel===1).length===2,id=>id===target.definitionId));
  const picked=pick(pool,state,target.slot),id=picked.state.carousel!.receipts.at(-1)!.unitId!;
  expect(picked.state.preparation.units.filter(u=>u.definitionId===target.definitionId&&u.starLevel===1)).toHaveLength(3);
  expect(picked.events.some(e=>e.type==='unitUpgraded')).toBe(false);
  expect(must(resolvePendingCarouselUnits(picked.pool,picked.state)).state).toBe(picked.state);
  expect(stepMatch(picked.state)).toEqual({state:picked.state,events:[]});
  const restored=restoreCarouselSeat(picked.carousel,JSON.stringify(picked.state));
  expect(must(grantCarouselPick(picked.carousel,restored,'s0')).events).toEqual([]);
  const next=nextPreparation({...picked,state:restored});
  expect(next.events.filter(e=>e.type==='unitUpgraded')).toHaveLength(1);
  expect(next.state.carousel!.preparationReceipts).toEqual([picked.state.carousel!.receipts.at(-1)!.id]);
  expect(next.state.resourceProvenance.entries.filter(e=>e.kind==='carousel-preparation-settled')).toHaveLength(1);
  expect(next.state.preparation.units.filter(u=>u.definitionId===target.definitionId)).toHaveLength(1);
  expect(next.state.preparation.units.find(u=>u.definitionId===target.definitionId)?.starLevel).toBe(2);
  expect(next.events.some(e=>e.type==='unitUpgraded'&&[e.survivorId,...e.consumedIds].includes(id))).toBe(true);
  const recovered=restoreCarouselSeat(next.carousel,JSON.stringify(next.state));
  expect(must(resolvePendingCarouselUnits(next.pool,recovered)).events).toEqual([]);
  for(const mutate of [(s:MatchState)=>(s.carousel!.preparationReceipts as string[]).push(s.carousel!.preparationReceipts[0]),(s:MatchState)=>(s.carousel!.preparationReceipts as string[]).pop()]){
    const bad=structuredClone(recovered);mutate(bad);expect(()=>restoreCarouselSeat(next.carousel,bad)).toThrow();
  }
  assertSharedPoolConservation(next.pool,[recovered]);
});
// UI_REQUESTS G1-P7: after a carousel closes every receipt is granted and the units are ordinary pool holdings, so an
// elimination in a later round goes through releaseSeatOnElimination alone. The closed carousel's frozen pool is stale
// by then and releaseCarouselParticipant refuses it; the granted receipt stays as the historical birth record.
it('a seat eliminated after the 2-4 carousel closed is released by releaseSeatOnElimination alone; the pool stays conserved',()=>{
  const {pool,states}=supplySeats(2);
  let carousel=must(advanceCarousel(must(createCarousel(pool,'2-4',{algorithm:'lcg32-v1',state:77})).state,6000)).state;
  const seats=[...states];
  for(const [i,seatId] of ['s0','s1'].entries()){
    const picked=must(pickCarouselForSeat(carousel.pool,carousel,seats[i],seatId,i));carousel=picked.carousel;seats[i]=picked.state;
  }
  carousel=must(advanceCarousel(carousel,carousel.deadlineMs)).state;
  expect(carousel.status).toBe('closed');
  expect(carousel.receipts.map(r=>r.status)).toEqual(['granted','granted']);
  expect(carousel.pool.carouselReservations).toEqual([]);
  for(const [i,seatId] of ['s0','s1'].entries()){
    const done=must(completeCarouselForSeat(carousel,seats[i],seatId));carousel=done.state;seats[i]=done.match;
  }
  const closed=carousel,advanced=must(nextSharedRound(closed.pool,seats,seats[0].round));
  const receipt=closed.receipts.find(r=>r.seatId==='s0')!;
  const eliminated:MatchState={...advanced.states[0],playerHp:0,multiplayer:{...advanced.states[0].multiplayer!,status:'eliminated'}};
  expect(advanced.pool.holdings.some(h=>h.seatId==='s0'&&h.unitId===receipt.unitId)).toBe(true);
  expect(releaseCarouselParticipant(closed,eliminated,'s0')).toMatchObject({ok:false,reason:'invalid-match',state:closed,match:eliminated,events:[],poolEvents:[]});
  const released=must(releaseSeatOnElimination(advanced.pool,eliminated));
  assertSharedPoolConservation(released.pool,[released.state,advanced.states[1]]);
  expect(released.poolEvents.some(e=>e.type==='sharedSeatReleased'&&e.seatId==='s0')).toBe(true);
  expect(released.pool.seats.find(s=>s.seatId==='s0')?.released).toBe(true);
  expect(released.pool.holdings.some(h=>h.seatId==='s0')).toBe(false);
  expect(released.pool.carouselReceipts.find(r=>r.id===receipt.id)).toEqual(receipt);
  expect(releaseSeatOnElimination(released.pool,released.state)).toMatchObject({ok:false,reason:'duplicate-release',pool:released.pool});
});
