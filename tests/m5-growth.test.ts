import {beforeAll,describe,expect,it} from 'vitest';
import * as api from '../src/simulation/match';
import {restoreMatch} from '../src/simulation/serialization';
import {accepted,readyMatch} from './match-helpers';
import {finishPublicEquipmentBattle,publicEquipmentPreparation,resolvePublicEquipmentChoices} from './fixtures/b8-public-equipment';
import type {MatchState} from '../src/simulation/match-types';
import {shop as independentShop} from './fixtures/m5/oracle.g2.cjs';

// Warm the same public acquisition route used below, once, outside the test body.
beforeAll(() => {
 const shared=publicEquipmentPreparation(['sword','rod','sword','sword'],{seed:22});
 expect(shared.seed).toBe(22);
},30_000);

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
  // Nine paid Tristana cards from the public v17 seed22 acquisition route create the same
  // three-star kill/growth control without relabelling the opening Irelia.
  let state=publicEquipmentPreparation(['sword','rod','sword','sword'],{seed:22});
  // Keep the naturally acquired army alive while earning purchase income. The
  // same two recipe items return with their IDs when their original holder sells.
  const equipment:string[]=[];
  const fundingCarry=state.preparation.units.filter(u=>u.team==='player').sort((a,b)=>b.starLevel-a.starLevel||Number(b.definitionId==='maddie')-Number(a.definitionId==='maddie'))[0];
  expect(fundingCarry).toBeDefined();
  for(const [slot,pair] of [['sword','rod'],['sword','sword']].entries()){
   const a=state.items.find(item=>item.definitionId===pair[0])!;
   const b=state.items.find(item=>item.definitionId===pair[1]&&item.id!==a.id)!;
   const id=`item-${state.nextItemSerial}`;
   state=accepted(api.combineItems(state,a.id,b.id));state=accepted(api.equipItem(state,id,fundingCarry.id,slot));equipment.push(id);
  }
  // The independent shop oracle prices all nine purchases, including paid
  // rerolls. Earn ordinary income with the real army until that route is funded.
  let requiredCost=0;
  for(let rounds=0;;rounds++){
   expect(rounds).toBeLessThan(16);
   if(state.phase==='preparation'){
    let funded:MatchState=state;
    for(const unit of funded.preparation.units.filter(u=>u.team==='player'))funded=accepted(api.sellUnit(funded,unit.id));
    let shop=funded.shop,rng=funded.rngState,cost=0,copies=0;
    for(let rolls=0;rolls<100&&copies<9;rolls++){
     for(const offer of shop.slots)if(offer.status==='available'&&offer.definitionId==='tristana'&&copies<9){copies++;cost+=2;}
     if(copies<9){const next=independentShop(rng,shop.generation+1,funded.level);shop=next.shop;rng=next.rngState;cost+=2;}
    }
    if(copies===9&&cost<=funded.gold){state=funded;requiredCost=cost;break;}
   }
   if(state.phase==='preparation'){
    // Acquisition returns the real roster to the bench. Field it while earning
    // ordinary income; four empty-board losses can now kill this v17 route.
    for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').sort((a,b)=>Number(b.id===fundingCarry.id)-Number(a.id===fundingCarry.id)||b.starLevel-a.starLevel)){
     const board=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');
     if(board.length>=state.level)break;
     const row=['irelia','vander','rell','darius'].includes(unit.definitionId)?4:7;
     const col=[3,2,4,1,5,0,6].find(col=>!board.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===row))!;
     state=accepted(api.deployMatchUnit(state,unit.id,{kind:'board',cell:{col,row}}));
    }
    state=finishPublicEquipmentBattle(state);
   }
   else expect(state.m8.round.kind).toBe('supply');
   while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){
    const reserve=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'&&u.id!==fundingCarry.id).sort((a,b)=>a.starLevel-b.starLevel)[0];
    expect(reserve).toBeDefined();state=accepted(api.sellUnit(state,reserve.id));
   }
   state=resolvePublicEquipmentChoices(accepted(api.nextRound(state,state.round)));
  }
  // The random-loot acquisition route can leave a full reserve. Free it through
  // real sales before buying nine new Tristana cards; their lineage stays separate.
  const purchaseGold=state.gold;
  const unitId=`unit-${state.nextUnitSerial}`;
  for(let bought=0,rolls=0;bought<9;) {
   const slot=state.shop.slots.findIndex(offer=>offer.status==='available'&&offer.definitionId==='tristana');
   if(slot<0){expect(rolls++).toBeLessThan(100);state=accepted(api.rerollShop(state));continue;}
   state=accepted(api.buyUnit(state,slot,state.shop.generation));
   if(bought++===0)state=accepted(api.deployMatchUnit(state,unitId,{kind:'board',cell:{col:4,row:4}}));
  }
  expect(state.gold).toBe(purchaseGold-requiredCost);
  for(const [slot,id] of equipment.entries())state=accepted(api.equipItem(state,id,unitId,slot));
  expect(state.preparation.units.find(unit=>unit.id===unitId)).toMatchObject({definitionId:'tristana',starLevel:3});
  expect(restoreMatch(JSON.stringify(state))).toEqual(state);
  // v15's new offers alter the paid route's combat modifiers. Back-row placement
  // preserves a real lethal bounce without changing any stats or growth assertions.
  state=accepted(api.deployMatchUnit(state,unitId,{kind:'board',cell:{col:0,row:7}}));
  // The new income/equipment prefix ends later. Use the next real PvE encounter
  // for the lethal-growth control; preserve ordinary HP, income and anomaly acquisition.
  for(let budget=0;state.roundDefinitionId!=='4-7';budget++){
   expect(budget).toBeLessThan(16);
   if(state.phase==='choice'){
    const c=state.pendingChoice!;
    state=c.step==='target'?accepted(api.selectAnomalyTarget(state,c.choiceId,c.generation,unitId))
     :accepted(api.selectChoice(state,c.choiceId,c.generation,c.offers[0]));
   }else if(state.phase==='preparation')state=finishPublicEquipmentBattle(state);
   else state=accepted(api.nextRound(state,state.round));
  }
  const initial=state;
  const priorGrowth=initial.persistentGrowth.find(g=>g.unitId===unitId)?.attackDamageBps??0;
  let live=accepted(api.startMatchCombat(state)),growthEvents=0;
  while(live.phase==='combat'){
   const result=api.stepMatch(live);
   for(const event of result.events)if(event.type==='growth'){
    expect(event.unitId).toBe(unitId);expect(event.amountBps).toBe(125);growthEvents++;
   }
   live=result.state;
  }
  expect(growthEvents).toBeGreaterThan(0);
  expect(live.persistentGrowth).toEqual([{unitId,attackDamageBps:priorGrowth+125*growthEvents}]);
  expect(live.roundResults).toHaveLength(initial.roundResults.length+1);
  const restored=restoreMatch(JSON.stringify(live));expect(restored).toEqual(live);
  const forged=JSON.parse(JSON.stringify(live));forged.persistentGrowth[0].attackDamageBps+=125;
  expect(()=>restoreMatch(forged)).toThrow(/current resource fold/);
  const duplicate=api.stepMatch(restored);expect(duplicate.state).toBe(restored);expect(duplicate.events).toEqual([]);
  const next=accepted(api.nextRound(restored,restored.round));expect(next.persistentGrowth).toEqual(live.persistentGrowth);
  const stale=api.nextRound(next,restored.round);expect(stale.ok).toBe(false);expect(stale.state).toBe(next);
 },20_000);
});
