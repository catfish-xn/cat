import { expect, it } from 'vitest';
import { room, accept, conserved, rejected } from './tp-helpers';
import { generateSharedShop, runSharedMatchCommand, setSharedShopLock } from '../src/simulation/shared-pool';
import { buyXp } from '../src/simulation/match';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';

it('Dual Purpose shared XP atomically returns reservations, draws weighted finite shops and preserves lock/credits',()=>{
 const fixture=room(undefined,1);let r=accept(generateSharedShop(fixture.pool,{...fixture.states[0],gold:30,augments:[{definitionId:'dual-purpose',choiceId:'xp-transaction-vector',acquiredRound:1}]},0));
 r=accept(setSharedShopLock(r.pool,r.state,true,r.state.shop.generation));
 const direct=buyXp(r.state);expect(direct).toEqual({ok:false,state:r.state,reason:'invalid-mechanic-state'});
 const before=r;r=accept(runSharedMatchCommand(r.pool,r.state,{type:'buyXp'}));
 expect(r.state.gold).toBe(before.state.gold-2);expect(r.state.shop.generation).toBe(before.state.shop.generation+1);expect(r.state.shop.locked).toBe(true);
 expect(r.pool.shops.every(s=>s.generation===r.state.shop.generation)).toBe(true);expect(r.poolEvents).toContainEqual(expect.objectContaining({type:'sharedShopGenerated',generation:r.state.shop.generation}));
 expect(freeRerollsAvailable(r.state)).toBe(freeRerollsAvailable(before.state));conserved(r.pool,[r.state]);
 const second=r;r=accept(runSharedMatchCommand(r.pool,r.state,{type:'buyXp'}));expect(r.state.gold).toBe(second.state.gold-4);expect(r.state.seatMechanics!.receipts.filter(x=>x.source==='augment-pool-batch5')).toHaveLength(1);conserved(r.pool,[r.state]);
 const poor={...r.state,gold:0};rejected(runSharedMatchCommand(r.pool,poor,{type:'buyXp'}),r.pool,poor,'insufficient-gold');
 const capped={...r.state,level:10 as const,xp:0};rejected(runSharedMatchCommand(r.pool,capped,{type:'buyXp'}),r.pool,capped,'max-level');
});
