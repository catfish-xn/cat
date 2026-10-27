import { expect, it } from 'vitest';
import { room, accept, conserved } from './tp-helpers';
import { advanceSharedAugmentPreparationTime, generateSharedShop, setSharedShopLock } from '../src/simulation/shared-pool';
import { advanceAugmentPreparationTime } from '../src/simulation/augment-history';
import type { MatchState } from '../src/simulation/match';

it('uses the finite pool transaction for each logical clock refresh', () => {
  const fixture=room(undefined,1);
  let r=accept(generateSharedShop(fixture.pool,fixture.states[0],0));
  let state={...r.state,augments:[{definitionId:'shop-glitch',choiceId:'test',acquiredRound:1}],
    augmentHistory:{version:'augment-history-v1',seatId:r.state.sharedPool!.seatId,proof:{kind:'server'},facts:[
      {kind:'acquire',round:1,choiceId:'test',preparationElapsedMs:0},
    ]}} as unknown as MatchState;
  const generation=state.shop.generation, gold=state.gold;
  expect(()=>advanceAugmentPreparationTime(state,2500)).toThrow('pool transaction');
  r=accept(advanceSharedAugmentPreparationTime(r.pool,state,2500));state=r.state;
  expect(state.shop.generation).toBe(generation+1);expect(state.gold).toBe(gold);conserved(r.pool,[state]);
  expect(r.pool.shops.every(x=>x.generation===state.shop.generation)).toBe(true);
  r=accept(setSharedShopLock(r.pool,state,true,state.shop.generation));state=r.state;
  r=accept(advanceSharedAugmentPreparationTime(r.pool,state,5000));state=r.state;
  expect(state.shop.generation).toBe(generation+1);conserved(r.pool,[state]);
});
