import {describe,it,expect} from 'vitest';
import {createMatch,startMatchCombat,stepMatch,nextRound,deployMatchUnit,useConsumable,equipItem} from './fixtures/recorded-match';
import {serializeMatch,restoreMatch} from './fixtures/history-evidence';
import {freezeLootThroughRound} from '../src/simulation/loot-freeze';
import {createOrbLayout,freezeOrbLayoutThroughRound} from '../src/simulation/orb-layout';
import {createSharedPool,initializeSharedSeat,runSharedMatchCommand} from '../src/simulation/shared-pool';
import {previewUseConsumable} from '../src/simulation/consumables';
import {readLootView,readComponentEquivalent} from '../src/simulation/loot-view';
import {toPrivateSeatView} from '../src/simulation/private-seat-view';
import type {MatchState,MatchCommandResult} from '../src/simulation/match-types';
const accepted=(r:MatchCommandResult)=>{if(!r.ok)throw new Error(r.reason);return r.state;};
function finish(state:MatchState) {
  for(const u of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench')) {
    const deployed=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');if(deployed.length>=state.level)break;
    const col=[3,2,4,1,5,0,6].find(col=>!deployed.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===7))!;
    state=accepted(deployMatchUnit(state,u.id,{kind:'board',cell:{col,row:7}}));
  }
  state=accepted(startMatchCombat(state));
  for(let i=0;state.phase==='combat'&&i<1201;i++)state=stepMatch(state).state;
  expect(state.phase).toBe('settlement');return state;
}
function opening(seed=42) {
  let state=createMatch(seed);
  for(let n=0;n<3;n++){state=finish(state);if(n<2)state=accepted(nextRound(state,state.round));}
  return state;
}
describe('R3/R4 catalog and live entry accounting',()=>{
  it('all eight PvE rounds have the signed orb counts and no PvE choice/fallback',()=>{
    const plan=freezeLootThroughRound(42,38);
    expect(plan.rounds.map(r=>[r.encounterPlan.roundId,r.orbs.length,r.choices.length])).toEqual([
      ['1-2',1,0],['1-3',2,0],['1-4',3,0],['2-7',2,0],['3-7',2,0],['4-7',2,0],['5-7',2,0],['6-7',1,0],
    ]);
    expect(plan.rounds.flatMap(r=>r.orbs)).toHaveLength(15);
    for(const round of plan.rounds)for(const orb of round.orbs)for(const [i,entry] of orb.entries.entries()) {
      expect(entry.dropId).toBe(JSON.stringify([orb.orbId,i]));expect(entry.entryOrdinal).toBe(i);
    }
  });
  it('eight different seat seeds use exactly the same layout, preserving private content streams',()=>{
    const layout=freezeOrbLayoutThroughRound(createOrbLayout(42),38);if(!layout.ok)throw Error(layout.reason);
    const plans=Array.from({length:8},(_,i)=>freezeLootThroughRound(i+1,38,layout.layout));
    const shapes=plans.map(p=>p.rounds.flatMap(r=>r.orbs.map(o=>[o.orbId,o.tier,o.templateId])));
    shapes.forEach(s=>expect(s).toEqual(shapes[0]));
    expect(new Set(plans.map(p=>JSON.stringify(p.rounds.flatMap(r=>r.encounterPlan.drops.map(d=>d.payload))))).size).toBe(8);
  });
  it('layout retry, stale/invalid failure preserve identity and draws',()=>{
    const initial=createOrbLayout(1),r=freezeOrbLayoutThroughRound(initial,3);if(!r.ok)throw Error(r.reason);
    expect(r.layout.rng.draws).toBe(1);
    expect(freezeOrbLayoutThroughRound(r.layout,3)).toEqual({ok:true,layout:r.layout});
    expect(freezeOrbLayoutThroughRound(r.layout,2)).toEqual({ok:false,layout:r.layout,reason:'stale-orb-layout'});
    expect(freezeOrbLayoutThroughRound(r.layout,39)).toEqual({ok:false,layout:r.layout,reason:'invalid-orb-round'});
    const corrupt={...r.layout,rng:{...r.layout.rng,draws:2}};
    expect(freezeOrbLayoutThroughRound(corrupt,4)).toEqual({ok:false,layout:corrupt,reason:'invalid-orb-layout'});
  });
  it('shared initialization accepts only pristine deferred state and freezes layout once',()=>{
    let pool=createSharedPool('orbs',42);
    const solo=createMatch(1);
    expect(initializeSharedSeat(pool,solo,'A',0)).toMatchObject({ok:false,reason:'invalid-seat-state'});
    for(let i=0;i<8;i++){
      const state=createMatch(i,{mode:'shared-deferred'});
      expect(state.m8.loot.frozen).toMatchObject({throughRoundOrdinal:0,rng:{draws:0},rounds:[]});
      expect(startMatchCombat(state)).toEqual({ok:false,state,reason:'wrong-phase'});
      expect(()=>serializeMatch(state)).toThrow();
      const r=initializeSharedSeat(pool,state,String(i),i);if(!r.ok)throw Error(r.reason);
      pool=r.pool;expect(pool.revision).toBe(i+1);expect(pool.orbLayout.throughRoundOrdinal).toBe(1);
      expect(r.state.m8.loot.layoutBinding).toEqual({mode:'shared',poolId:'orbs',version:'s13-orb-layout-v1',throughRoundOrdinal:1});
      const bad=runSharedMatchCommand(pool,r.state,{type:'useConsumable',consumableId:'missing',target:{kind:'unit',unitId:'unit-1'}});
      expect(bad).toEqual({ok:false,pool,state:r.state,reason:'unknown-consumable'});
    }
  });
  it('real opening grants 2–3 value, three tools, unique receipts and round-trips every stage',()=>{
    let state=createMatch(42);
    for(let n=0;n<3;n++){
      expect(restoreMatch(serializeMatch(state))).toEqual(state);
      state=finish(state);expect(restoreMatch(serializeMatch(state))).toEqual(state);
      expect(stepMatch(state)).toEqual({state,events:[]});
      const view=readLootView(state),privateView=toPrivateSeatView(state);
      expect(privateView.revealedLoot?.revealedDrops).toEqual(view.revealedDrops);
      expect(privateView.revealedLoot?.revealedOrbs).toEqual(view.revealedOrbs);
      expect(view.revealedOrbs.every(o=>o.status==='claimed')).toBe(true);
      if(n<2)state=accepted(nextRound(state,state.round));
    }
    expect([2,3]).toContain(readComponentEquivalent(state));expect(state.consumables).toHaveLength(3);
    expect(new Set(state.m8.loot.receipts.map(r=>r.receiptId)).size).toBe(state.m8.loot.receipts.length);
  });
  it('earned remover returns original IDs, consumes once, and restores without another grant',()=>{
    let state=opening();const tool=state.consumables[0],item=state.items[0];
    state=accepted(equipItem(state,item.id,'unit-1',2));
    const preview=previewUseConsumable(state,tool.consumableId,{kind:'unit',unitId:'unit-1'});
    expect(preview).toEqual({ok:true,effect:'remove-all',affectedItemIds:[item.id],destination:'inventory',affectsCurrentBattle:false});
    const next=accepted(useConsumable(state,tool.consumableId,{kind:'unit',unitId:'unit-1'}));
    expect(next.items.find(i=>i.id===item.id)?.location).toEqual({kind:'inventory'});
    expect(next.nextItemSerial).toBe(state.nextItemSerial);expect(next.reforgeState).toBe(state.reforgeState);
    expect(restoreMatch(serializeMatch(next))).toEqual(next);
    expect(useConsumable(next,tool.consumableId,{kind:'unit',unitId:'unit-1'})).toEqual({ok:false,state:next,reason:'unknown-consumable'});
  });
});
