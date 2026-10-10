import {describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import {restoreMatch} from '../src/simulation/serialization';
import {accepted,readyMatch} from './match-helpers';
import {publicEquipmentPreparation} from './fixtures/m8-b4-match';
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
  // Real public income reaches 3-5. Nine paid Tristana cards create the same
  // three-star kill/growth control without relabelling the opening Irelia.
  let state=publicEquipmentPreparation(['sword','rod','sword','sword']);
  state=accepted(api.deployMatchUnit(state,'unit-1',{kind:'board',cell:{col:1,row:4}}));
  const unitId=`unit-${state.nextUnitSerial}`;
  for(let bought=0,rolls=0;bought<9;) {
   const slot=state.shop.slots.findIndex(offer=>offer.status==='available'&&offer.definitionId==='tristana');
   if(slot<0){expect(rolls++).toBeLessThan(100);state=accepted(api.rerollShop(state));continue;}
   state=accepted(api.buyUnit(state,slot,state.shop.generation));
   if(bought++===0)state=accepted(api.deployMatchUnit(state,unitId,{kind:'board',cell:{col:3,row:7}}));
  }
  for(const [slot,pair] of [['sword','rod'],['sword','sword']].entries()) {
   const a=state.items.find(item=>item.definitionId===pair[0])!;
   const b=state.items.find(item=>item.definitionId===pair[1]&&item.id!==a.id)!;
   const id=`item-${state.nextItemSerial}`;
   state=accepted(api.combineItems(state,a.id,b.id));state=accepted(api.equipItem(state,id,unitId,slot));
  }
  expect(state.preparation.units.find(unit=>unit.id===unitId)).toMatchObject({definitionId:'tristana',starLevel:3});
  expect(restoreMatch(JSON.stringify(state))).toEqual(state);
  const initial=state;
  let live=accepted(api.startMatchCombat(state)),growthEvents=0;
  while(live.phase==='combat'){
   const result=api.stepMatch(live);
   for(const event of result.events)if(event.type==='growth'){
    expect(event.unitId).toBe(unitId);expect(event.amountBps).toBe(125);growthEvents++;
   }
   live=result.state;
  }
  expect(growthEvents).toBeGreaterThan(0);
  expect(live.persistentGrowth).toEqual([{unitId,attackDamageBps:125*growthEvents}]);
  expect(live.roundResults).toHaveLength(initial.roundResults.length+1);
  const restored=restoreMatch(JSON.stringify(live));expect(restored).toEqual(live);
  const forged=JSON.parse(JSON.stringify(live));forged.persistentGrowth[0].attackDamageBps+=125;
  expect(()=>restoreMatch(forged)).toThrow(/current resource fold/);
  const duplicate=api.stepMatch(restored);expect(duplicate.state).toBe(restored);expect(duplicate.events).toEqual([]);
  const next=accepted(api.nextRound(restored,restored.round));expect(next.persistentGrowth).toEqual(live.persistentGrowth);
  const stale=api.nextRound(next,restored.round);expect(stale.ok).toBe(false);expect(stale.state).toBe(next);
 });
});
