import {describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import {restoreMatch} from '../src/simulation/serialization';
import {accepted,readyMatch} from './match-helpers';
import type {MatchState} from '../src/simulation/match-types';

// Explicit unit-level boundary fixtures, not ordinary acquisition evidence.
// Full ordinary acquisition is covered independently by the three route tests.
describe('permanent Tristana growth is a conserved Match resource',()=>{
 it('sums all merged lineages exactly once and destroys growth on sale',()=>{
  const initial=readyMatch();
  const state:MatchState={...initial,gold:20,nextUnitSerial:6,
   shop:{...initial.shop,slots:[{status:'available',definitionId:'tristana'},...initial.shop.slots.slice(1)]},
   preparation:{...initial.preparation,units:[...initial.preparation.units,
    {id:'unit-4',definitionId:'tristana',starLevel:1,team:'player',location:{kind:'bench',slot:0}},
    {id:'unit-5',definitionId:'tristana',starLevel:1,team:'player',location:{kind:'bench',slot:1}}]},
   persistentGrowth:[{unitId:'unit-4',attackDamageBps:250},{unitId:'unit-5',attackDamageBps:375}]};
  const merged=api.buyUnit(state,0,state.shop.generation);expect(merged.ok).toBe(true);if(!merged.ok)throw Error(merged.reason);
  expect(merged.state.persistentGrowth).toEqual([{unitId:'unit-4',attackDamageBps:625}]);
  expect(merged.state.preparation.units.find(u=>u.id==='unit-4')?.starLevel).toBe(2);
  expect(merged.state.gold).toBe(18);expect(merged.state.nextUnitSerial).toBe(7);
  expect(merged.events.filter(e=>e.type==='unitUpgraded')).toHaveLength(1);
  const repeat=api.buyUnit(merged.state,0,state.shop.generation);expect(repeat.ok).toBe(false);expect(repeat.state).toBe(merged.state);
  const sold=accepted(api.sellUnit(merged.state,'unit-4'));
  expect(sold.persistentGrowth).toEqual([]);expect(sold.gold).toBe(23); // two-star two-cost sale=5.
  expect(state.persistentGrowth).toEqual([{unitId:'unit-4',attackDamageBps:250},{unitId:'unit-5',attackDamageBps:375}]);
 });
 it('commits actual battle growth once and never regrants it on restore, duplicate step or Continue',()=>{
  const initial=readyMatch();
  const state:MatchState={...initial,preparation:{...initial.preparation,units:initial.preparation.units.map(u=>u.id==='unit-3'?{...u,definitionId:'tristana',starLevel:3}:u)}};
  let live=accepted(api.startMatchCombat(state)),growthEvents=0;
  while(live.phase==='combat'){
   const result=api.stepMatch(live);
   for(const event of result.events)if(event.type==='growth'){
    expect(event.unitId).toBe('unit-3');expect(event.amountBps).toBe(125);growthEvents++;
   }
   live=result.state;
  }
  expect(growthEvents).toBeGreaterThan(0);
  expect(live.persistentGrowth).toEqual([{unitId:'unit-3',attackDamageBps:125*growthEvents}]);
  expect(live.roundResults).toHaveLength(1);
  const restored=restoreMatch(JSON.stringify(live));expect(restored).toEqual(live);
  const duplicate=api.stepMatch(restored);expect(duplicate.state).toBe(restored);expect(duplicate.events).toEqual([]);
  const next=accepted(api.nextRound(restored,1));expect(next.persistentGrowth).toEqual(live.persistentGrowth);
  const stale=api.nextRound(next,1);expect(stale.ok).toBe(false);expect(stale.state).toBe(next);
 });
});
