import {describe,it,expect} from 'vitest';
import {applySeatCommand} from '../src/server/room/room';
import {nextSharedRound,refreshSharedShops,runSharedMatchCommand,createSharedPool,initializeSharedSeat} from '../src/simulation/shared-pool';
import {createMatch,deployMatchUnit,equipItem} from '../src/simulation/match';
import {toPrivateSeatView} from '../src/simulation/private-seat-view';
import {readLootView} from '../src/simulation/loot-view';
import {room,fight,accept,batch,conserved,fullBench} from './tp-helpers';
import {accepted} from './fixtures/r3r4-public';
import type {MatchState} from '../src/simulation/match-types';
function claimAll(result:ReturnType<typeof fight>){for(const orb of readLootView(result.state).unclaimedOrbs!)result=accept(runSharedMatchCommand(result.pool,result.state,{type:'claimOrb',round:result.state.round,orbId:orb.orbId}));return result;}
function secondSettlement(){
 const initial=room(undefined,1),start=batch(refreshSharedShops(initial.pool,initial.states,1));
 const first=claimAll(fight(start.pool,start.states[0])),next=batch(nextSharedRound(first.pool,[first.state],1));
 let state=next.states[0];const unit=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!;
 state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col:3,row:7}}));
 return claimAll(fight(next.pool,state));
}
describe('D6 shared layout, transactions and D7 projections',()=>{
 it('rejects altered deferred openings before consuming stock or freezing the first layout',()=>{
  const pool=createSharedPool('p',0),initial=createMatch(0,{mode:'shared-deferred'});
  for(const state of [{...initial,gold:1},{...initial,nextConsumableSerial:2},{...initial,items:[{id:'item-1',definitionId:'sword',location:{kind:'inventory' as const}}]}]){
   const result=initializeSharedSeat(pool,state,'A',0);expect(result).toEqual({ok:false,pool,state,reason:'invalid-seat-state'});expect(result.pool).toBe(pool);expect(result.state).toBe(state);
  }
 });
 it.each(['preparation','combat','choice','settlement'] as const)('shared remover in %s bumps revisions once without changing stock or the frozen battle',phase=>{
  let {pool,state}=secondSettlement();
  if(phase!=='settlement'){const next=batch(nextSharedRound(pool,[state],2));pool=next.pool;state=next.states[0];}
  if(phase==='combat'){const next=accept(runSharedMatchCommand(pool,state,{type:'startCombat'}));pool=next.pool;state=next.state;}
  if(phase==='choice'){
   const end=fight(pool,state),next=batch(nextSharedRound(end.pool,[end.state],3));pool=next.pool;state=next.states[0];
  }
  expect(state.phase).toBe(phase);
  const holder=state.preparation.units.find(u=>u.team==='player')!,item=state.items[0],tool=state.consumables[0];
  state=accepted(equipItem(state,item.id,holder.id,2));
  const before=JSON.stringify({available:pool.available,holdings:pool.holdings,shops:pool.shops,pending:pool.pending,rewards:pool.rewards,layout:pool.orbLayout});
  const command={type:'useConsumable',consumableId:tool.consumableId,target:{kind:'unit',unitId:holder.id}} as const;
  const next=accept(runSharedMatchCommand(pool,state,command));
  expect(applySeatCommand(pool,state,command)).toEqual(next);
  expect(next.pool.revision).toBe(pool.revision+1);expect(next.state.sharedPool!.revision).toBe(state.sharedPool!.revision+1);
  expect(next.poolEvents).toEqual([]);expect(next.state.combat).toBe(state.combat);expect(next.state.combatInputBasis).toBe(state.combatInputBasis);
  expect(JSON.stringify({available:next.pool.available,holdings:next.pool.holdings,shops:next.pool.shops,pending:next.pool.pending,rewards:next.pool.rewards,layout:next.pool.orbLayout})).toBe(before);
  conserved(next.pool,[next.state]);
  expect(runSharedMatchCommand(next.pool,next.state,{type:'useConsumable',consumableId:tool.consumableId,target:{kind:'unit',unitId:holder.id}})).toEqual({ok:false,pool:next.pool,state:next.state,reason:'unknown-consumable'});
 });
 it('full bench keeps the complete orb through timeout and explicitly sells its hero with its tool',()=>{
  const initial=fullBench(),result=fight(initial.pool,initial.state);
  const view=readLootView(result.state);expect(view.revealedDrops.map(d=>d.status)).toEqual(['revealed','revealed']);
  expect(view.revealedOrbs[0].status).toBe('revealed');expect(result.state.consumables).toHaveLength(0);
  expect(result.pool.pending).toHaveLength(0);
  const next=accept(runSharedMatchCommand(result.pool,result.state,{type:'claimLoot',round:1}));
  expect(next.pool.pending).toHaveLength(0);expect(readLootView(next.state).revealedDrops[0]).toMatchObject({status:'revealed',reason:'awaiting-claim'});
  const paid=claimAll(next);expect(paid.state.consumables).toHaveLength(1);expect(readLootView(paid.state).claimReceipts![0]).toMatchObject({resolution:'capacity-sold',gold:1});conserved(paid.pool,[paid.state]);
  expect(toPrivateSeatView(next.state).revealedLoot).toEqual({roundId:'1-2',revealedDrops:readLootView(next.state).revealedDrops,revealedOrbs:readLootView(next.state).revealedOrbs});
  const retry=accept(runSharedMatchCommand(next.pool,next.state,{type:'claimLoot',round:1}));expect(retry.pool).toBe(next.pool);expect(retry.state).toBe(next.state);conserved(next.pool,[next.state]);
 });
 it('later-seat failure rolls back the layout and all earlier seat advances',()=>{
  const initial=room(undefined,2),start=batch(refreshSharedShops(initial.pool,initial.states,1));
  const first=fight(start.pool,start.states[0]);
  const states=[first.state,start.states[1]],pool=first.pool,before=JSON.stringify({pool,states});
  const result=nextSharedRound(pool,states,1);expect(result.ok).toBe(false);expect(result.pool).toBe(pool);expect(result.states).toBe(states);
  expect(JSON.stringify({pool,states})).toBe(before);
 });
 it('projections omit mismatched round metadata and do not leak nested tool fields',()=>{
  const {state}=secondSettlement(),extra={hidden:{seed:123}},raw={...state,consumables:state.consumables.map(c=>({...c,...extra}))};
  const view=toPrivateSeatView(raw);expect(view.consumables).toEqual(state.consumables);expect(Object.isFrozen(extra.hidden)).toBe(false);
  const mismatched={...state,round:state.round+1} as MatchState;
  expect(readLootView(mismatched).revealedDrops).toEqual([]);expect(toPrivateSeatView(mismatched)).not.toHaveProperty('revealedLoot');
 });
});
