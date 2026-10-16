import { syntheticSharedRound } from './tp-helpers';
import { describe, expect, it } from 'vitest';
import { createMatch, createSharedPool, initializeSharedSeat, generateSharedShop, refreshSharedShops,
  buySharedUnit, rerollSharedShop, sellSharedUnit, setSharedShopLock, releaseSeatOnElimination,
  POOL_CAPACITY_BY_COST, type MatchState, type SharedPoolState } from '../src/server-entry';
import { freeze } from './combat-helpers';
import { accept,batch,room,conserved,rejected,fullBench } from './tp-helpers';

describe('TP finite shop transactions',()=>{
  it('uses exactly the admitted 48 heroes and Riot 30/25/18/10/9; all opening gifts precede shops',()=>{
    expect(POOL_CAPACITY_BY_COST).toEqual({1:30,2:25,3:18,4:10,5:9});
    const {pool,states}=room(undefined,8);
    expect(Object.keys(pool.initial)).toHaveLength(48);expect(Object.values(pool.initial).reduce((a,b)=>a+b)).toBe(990);
    expect(pool.initial.irelia).toBe(30);expect(pool.available.irelia).toBe(30-pool.holdings.filter(h=>h.definitionId==='irelia').length);expect(pool.holdings).toHaveLength(8);
    expect(pool.shops).toEqual([]);expect(states.every(s=>s.shop.slots.every(o=>o.status==='purchased'&&o.empty))).toBe(true);
    const shops=batch(refreshSharedShops(freeze(pool),freeze(states),1));
    expect(shops.pool.shops).toHaveLength(40);expect(Object.values(shops.pool.available).reduce((a,b)=>a+b)).toBe(942);
    conserved(shops.pool,shops.states);
  });
  it('two seats competing for the last copy cannot both display it; purchase moves the reservation',()=>{
    const {pool,states}=room({irelia:2,maddie:1});
    const a=accept(generateSharedShop(freeze(pool),freeze(states[0]),0));
    const b=accept(generateSharedShop(a.pool,states[1],0));
    expect(a.state.shop.slots[0]).toEqual({status:'available',definitionId:'maddie'});
    expect(b.state.shop.slots.every(s=>s.status==='purchased'&&s.empty)).toBe(true);
    expect(b.pool.available.maddie).toBe(0);expect(b.pool.shops).toHaveLength(1);
    const buyer={...a.state,gold:1},purchased=accept(buySharedUnit(b.pool,buyer,0,1));
    expect(purchased.state.gold).toBe(0);expect(purchased.pool.available.maddie).toBe(0);expect(purchased.pool.shops).toHaveLength(0);
    expect(purchased.pool.holdings.filter(h=>h.definitionId==='maddie')).toHaveLength(1);
    rejected(buySharedUnit(purchased.pool,purchased.state,0,1),purchased.pool,purchased.state,'purchased-slot');
    rejected(buySharedUnit(purchased.pool,b.state,0,1),purchased.pool,b.state,'empty-slot');
    rejected(buySharedUnit(purchased.pool,buyer,0,1),purchased.pool,buyer,'stale-seat');conserved(purchased.pool,[purchased.state,b.state]);
  });
  it('uses remaining-copy weights, consumes exactly two words per nonempty slot, and never retries empties',()=>{
    const {pool,states}=room({irelia:2,darius:1,maddie:3});
    const state={...states[0],rngState:0},r=accept(generateSharedShop(pool,state,0));
    // Seed0: second LCG word 1196435762. floor(word*4/2^32)=1 -> Maddie.
    // Uniform-by-hero would choose Darius (floor(word*2/2^32)=0), a different answer.
    expect(r.state.shop.slots[0]).toEqual({status:'available',definitionId:'maddie'});
    expect(r.state.shop.slots.filter(s=>s.status==='available')).toHaveLength(4);
    expect(r.state.shop.slots[4]).toEqual({status:'purchased',empty:true});
    expect(r.poolEvents).toContainEqual({type:'sharedShopGenerated',seatId:'seat-0',generation:1,rngDraws:8});
    expect(r.state.rngState).toBe(2748932008);conserved(r.pool,[r.state,states[1]]);
  });
  it('renormalizes only positive-probability tiers and cannot draw an unavailable tier at level 1',()=>{
    const {pool,states}=room({irelia:2,leona:2,caitlyn:1});
    const low=accept(generateSharedShop(pool,states[0],0));
    expect(low.state.rngState).toBe(states[0].rngState);expect(low.pool.shops).toEqual([]);
    const high=accept(generateSharedShop(low.pool,{...states[1],level:3,xp:0},0));
    expect(high.state.shop.slots.filter(s=>s.status==='available')).toEqual([{status:'available',definitionId:'leona'},{status:'available',definitionId:'leona'}]);
    expect(high.pool.available.caitlyn).toBe(1);conserved(high.pool,[low.state,high.state]);
  });
  it('reroll refunds unused offers first; generation protects duplicate reroll and empty rerolls fail for free',()=>{
    const {pool,states}=room({irelia:2,maddie:1});let a=accept(generateSharedShop(pool,{...states[0],gold:10},0));
    const b=accept(generateSharedShop(a.pool,{...states[1],gold:10},0));
    rejected(rerollSharedShop(b.pool,b.state,1),b.pool,b.state,'pool-empty');
    a=accept(rerollSharedShop(b.pool,a.state,1));expect(a.state.gold).toBe(8);expect(a.pool.shops).toHaveLength(1);
    rejected(rerollSharedShop(a.pool,a.state,1),a.pool,a.state,'stale-shop');conserved(a.pool,[a.state,b.state]);
  });
  it('insufficient gold, full bench, bad slot and stale generation preserve pool, state and RNG',()=>{
    const {pool,states}=room({irelia:2,maddie:1}),r=accept(generateSharedShop(pool,states[0],0));
    rejected(buySharedUnit(freeze(r.pool),freeze(r.state),0,1),r.pool,r.state,'insufficient-gold');
    rejected(rerollSharedShop(r.pool,r.state,1),r.pool,r.state,'insufficient-gold');
    rejected(buySharedUnit(r.pool,r.state,0,0),r.pool,r.state,'stale-shop');
    rejected(buySharedUnit(r.pool,r.state,5,1),r.pool,r.state,'invalid-slot');
    const filled=fullBench();let offered=accept(rerollSharedShop(filled.pool,filled.state,filled.state.shop.generation));
    for(let i=0;i<30&&!offered.state.shop.slots.some(s=>s.status==='available'&&offered.state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===s.definitionId&&u.starLevel===1).length<2);i++)offered=accept(rerollSharedShop(offered.pool,offered.state,offered.state.shop.generation));
    const slot=offered.state.shop.slots.findIndex(s=>s.status==='available'&&offered.state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===s.definitionId&&u.starLevel===1).length<2);
    rejected(buySharedUnit(freeze(offered.pool),freeze(offered.state),slot,offered.state.shop.generation),offered.pool,offered.state,'bench-full');
  });
  it.each([3,9])('merges %i base sources through real upgrades and returns them once on sale',copies=>{
    const {pool,states}=room({irelia:2,maddie:copies});let r=accept(generateSharedShop(pool,{...states[0],gold:100},0));
    for(let i=0;i<copies;i++) {
      let slot=r.state.shop.slots.findIndex(s=>s.status==='available');
      if(slot<0) {r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));slot=r.state.shop.slots.findIndex(s=>s.status==='available');}
      r=accept(buySharedUnit(r.pool,r.state,slot,r.state.shop.generation));conserved(r.pool,[r.state,states[1]]);
    }
    const unit=r.state.preparation.units.find(u=>u.definitionId==='maddie'&&u.team==='player')!;
    expect(unit.starLevel).toBe(copies===3?2:3);expect(r.pool.holdings.find(h=>h.unitId===unit.id&&h.seatId==='seat-0')!.sources).toHaveLength(copies);
    const sold=accept(sellSharedUnit(r.pool,r.state,unit.id));expect(sold.pool.available.maddie).toBe(copies);expect(sold.state.gold-r.state.gold).toBe(copies);
    rejected(sellSharedUnit(sold.pool,sold.state,unit.id),sold.pool,sold.state,'unknown-unit');conserved(sold.pool,[sold.state,states[1]]);
  });
  it('releases all shops and real holdings once after elimination; archived army is not sellable',()=>{
    const {pool,states}=room({irelia:2,maddie:2});const r=accept(generateSharedShop(pool,{...states[0],gold:10},0));
    const bought=accept(buySharedUnit(r.pool,r.state,0,1));
    rejected(releaseSeatOnElimination(bought.pool,bought.state),bought.pool,bought.state,'not-eliminated');
    const eliminated:MatchState={...bought.state,playerHp:0,multiplayer:{...bought.state.multiplayer!,status:'eliminated'}};
    const out=accept(releaseSeatOnElimination(freeze(bought.pool),freeze(eliminated)));
    expect(out.pool.available.maddie).toBe(2);expect(out.pool.available.irelia).toBe(1);expect(out.state.gold).toBe(eliminated.gold);
    rejected(releaseSeatOnElimination(out.pool,out.state),out.pool,out.state,'duplicate-release');
    rejected(sellSharedUnit(out.pool,out.state,'unit-1'),out.pool,out.state,'seat-eliminated');conserved(out.pool,[out.state,states[1]]);
  });
  it('rejects copied unowned units, foreign pool bindings, and malformed capacity configurations',()=>{
    const {pool,states}=room({irelia:2,maddie:2}),s=states[0];
    const forged={...s,preparation:{...s.preparation,units:[...s.preparation.units,{...s.preparation.units[0],id:'mirror'}]}};
    rejected(generateSharedShop(pool,forged,0),pool,forged,'invalid-seat-state');
    const foreign={...s,sharedPool:{...s.sharedPool!,poolId:'foreign'}};
    rejected(generateSharedShop(pool,foreign,0),pool,foreign,'invalid-seat-state');
    expect(()=>createSharedPool('x',0,{capacities:{unknown:1}})).toThrow();expect(()=>createSharedPool('x',0,{capacities:{caitlyn:10}})).toThrow();
    const small=createSharedPool('small',3371,{seatCount:2,capacities:{irelia:1}}),first=accept(initializeSharedSeat(small,createMatch(5, {mode:'shared-deferred'}),'fixture-7',0));
    const second=createMatch(5, {mode:'shared-deferred'});rejected(initializeSharedSeat(first.pool,second,'fixture-37',1),first.pool,second,'pool-empty');
  });
});

describe('TP whole-room natural refresh',()=>{
  it('all eight release before any draw, deterministic seeded order rotates, locks retain generation/reservations',()=>{
    let {pool,states}=room(undefined,8);const first=batch(refreshSharedShops(pool,states,1));
    expect(refreshSharedShops(JSON.parse(JSON.stringify(pool)),JSON.parse(JSON.stringify(states)),1)).toEqual(first);
    const locked=accept(setSharedShopLock(first.pool,first.states[0],true,1));pool=locked.pool;states=[locked.state,...first.states.slice(1)];
    const held=pool.shops.filter(r=>r.seatId==='seat-0'),firstOrder=first.poolEvents.find(e=>e.type==='sharedRefreshOrder')!;
    const leaders:string[]=[];
    for(let round=2;round<=9;round++) {
      // Isolated shop-scheduler vectors; catalog/history advance is tested separately through public commands.
      const prepared=syntheticSharedRound(pool,states,round);const r=batch(refreshSharedShops(freeze(prepared.pool),freeze(prepared.states),round));
      const order=r.poolEvents.find(e=>e.type==='sharedRefreshOrder');if(order?.type!=='sharedRefreshOrder')throw new Error('order');leaders.push(order.seatIds[0]);
      expect(r.pool.shops.filter(s=>s.seatId==='seat-0')).toEqual(held);expect(r.states[0].shop.generation).toBe(1);
      expect(r.states[0].rngState).toBe(locked.state.rngState);conserved(r.pool,r.states);pool=r.pool;states=[...r.states];
    }
    expect(new Set(leaders).size).toBe(8);expect(firstOrder.type).toBe('sharedRefreshOrder');
    const retried=refreshSharedShops(pool,states,9);expect(retried).toEqual({ok:false,pool,states,reason:'stale-refresh'});
  });
  it('the first seat in a new round can draw the old last seat reservation (release barrier)',()=>{
    let {pool,states}=room({irelia:2,maddie:1});let r=batch(refreshSharedShops(pool,states,1));
    const owner=r.pool.shops[0].seatId,prepared=syntheticSharedRound(r.pool,r.states,2);r=batch(refreshSharedShops(prepared.pool,prepared.states,2));
    expect(r.pool.shops[0].seatId).not.toBe(owner);expect(r.pool.available.maddie).toBe(0);conserved(r.pool,r.states);
  });
  it('missing seats and a late wrong-phase state reject the entire batch unchanged',()=>{
    const {pool,states}=room({irelia:2,maddie:1});
    const missing=states.slice(0,1);expect(refreshSharedShops(pool,missing,1)).toEqual({ok:false,pool,states:missing,reason:'incomplete-seats'});
    const invalid:MatchState[]=[states[0],{...states[1],phase:'settlement',combat:null}];
    expect(refreshSharedShops(pool,invalid,1)).toEqual({ok:false,pool,states:invalid,reason:'wrong-phase'});
  });
  it('mixed eight-seat command history is reproducible and conserves after every success and rejection',()=>{
    function sequence() {
      const initial=room(undefined,8),first=batch(refreshSharedShops(initial.pool,initial.states,1));
      let pool:SharedPoolState=first.pool,states:MatchState[]=first.states.map(s=>({...s,gold:100,level:9,xp:0}));
      for(let i=0;i<160;i++) {
        const index=i%8,s=states[index];let r;
        if(i%5===0) r=rerollSharedShop(pool,s,s.shop.generation);
        else if(i%7===0) {const unit=s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench');r=sellSharedUnit(pool,s,unit?.id??'absent');}
        else r=buySharedUnit(pool,s,i%5,s.shop.generation);
        if(r.ok) {pool=r.pool;states[index]=r.state;}else {expect(r.pool).toBe(pool);expect(r.state).toBe(s);}
        conserved(pool,states);
      }
      return {pool,states};
    }
    expect(sequence()).toEqual(sequence());
  });
});
