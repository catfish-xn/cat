import { expect } from 'vitest';
import { createMatch, createSharedPool, initializeSharedSeat, assertSharedPoolConservation,
  generateSharedShop, buySharedUnit, rerollSharedShop, runSharedMatchCommand,
  type SharedPoolState, type MatchState, type SharedPoolResult, type SharedPoolBatchResult } from '../src/server-entry';
export const accept=(r:SharedPoolResult)=>{if(!r.ok)throw new Error(r.reason);return r;};
export const batch=(r:SharedPoolBatchResult)=>{if(!r.ok)throw new Error(r.reason);return r;};
export function room(capacities?:Record<string,number>,count=2,seed=42) {
  let pool=createSharedPool('test-pool',seed,{seatCount:count,...(capacities?{capacities}: {})});const states:MatchState[]=[];
  for(let i=0;i<count;i++) {
    const r=accept(initializeSharedSeat(pool,createMatch(5),`seat-${i}`,i));pool=r.pool;states.push(r.state);
  }
  assertSharedPoolConservation(pool,states);return {pool,states};
}
// Independent ledger oracle: sum one copy per reservation/source without production selectors.
export function conserved(pool:SharedPoolState,states?:readonly MatchState[]) {
  for(const [id,initial] of Object.entries(pool.initial)) {
    const available=pool.available[id],shop=pool.shops.filter(r=>r.definitionId===id).length;
    const held=pool.holdings.filter(h=>h.definitionId===id).reduce((n,h)=>n+h.sources.length,0);
    const pending=pool.pending.filter(r=>r.definitionId===id).length;
    expect(available).toBeGreaterThanOrEqual(0);expect(available+shop+held+pending).toBe(initial);
  }
  assertSharedPoolConservation(pool,states);
}
export function rejected(result:SharedPoolResult,pool:SharedPoolState,state:MatchState,reason:string) {
  expect(result).toEqual({ok:false,pool,state,reason});expect(result.pool).toBe(pool);expect(result.state).toBe(state);
}
export function fight(pool:SharedPoolState,state:MatchState) {
  let r=accept(runSharedMatchCommand(pool,state,{type:'startCombat'})),budget=1201;
  while(r.state.phase==='combat'&&budget-->0) r=accept(runSharedMatchCommand(r.pool,r.state,{type:'step'}));
  expect(budget).toBeGreaterThanOrEqual(0);conserved(r.pool,[r.state]);return r;
}
export function fullBench() {
  let {pool,states}=room(undefined,1);let state:MatchState={...states[0],gold:1000,level:9,xp:0};
  let r=accept(generateSharedShop(pool,state,0));pool=r.pool;state=r.state;
  for(let budget=0;state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length<9;budget++) {
    if(budget>60)throw new Error('fill bench budget');
    const slot=state.shop.slots.findIndex(s=>s.status==='available'&&s.definitionId!=='maddie'
      &&state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===s.definitionId&&u.starLevel===1).length<2);
    r=accept(slot<0?rerollSharedShop(pool,state,state.shop.generation):buySharedUnit(pool,state,slot,state.shop.generation));pool=r.pool;state=r.state;
  }
  conserved(pool,[state]);return {pool,state};
}
