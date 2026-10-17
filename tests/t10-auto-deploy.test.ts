import { describe, expect, it } from 'vitest';
import { autoDeployToCap, createMatch, deployMatchUnit, getDeploymentCap, startMatchCombat, snapshotForBattle,
  type MatchState } from '../src/server-entry';
import { getPlayerDeploymentCount } from '../src/simulation/game';
import { freeze } from './combat-helpers';
import { accepted, bench, board, hero, prepared } from './t10-helpers';
import { catalogPreparation } from './t5r-helpers';

const own = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
describe('t10-auto-deploy at the online preparation deadline', () => {
  it('fills cap in bench-slot order, front first and center-left-right; keeps enemy and existing board units', () => {
    const base=prepared();
    const state: MatchState={...base,level:9,preparation:{...base.preparation,units:[
      ...base.preparation.units.filter(u=>u.team==='enemy'),hero('standing',board(3)),
      ...[8,3,6,1,5,0,7,2,4].map(slot=>hero(`bench-${slot}`,bench(slot),slot%2?'irelia':'maddie'))]}};
    const before=structuredClone(state), result=autoDeployToCap(freeze(state)), next=accepted(result);
    expect(state).toEqual(before);
    expect(getPlayerDeploymentCount(next.preparation)).toBe(getDeploymentCap(state));
    const positions=[[2,4],[4,4],[1,4],[5,4],[0,4],[6,4],[3,5],[2,5]];
    positions.forEach(([col,row],slot)=>expect(own(next).find(u=>u.id===`bench-${slot}`)?.location).toEqual(board(col,row)));
    expect(own(next).find(u=>u.id==='bench-8')?.location).toEqual(bench(8));
    expect(next.preparation.units.filter(u=>u.team==='enemy')).toEqual(state.preparation.units.filter(u=>u.team==='enemy'));
    expect(result.ok && result.events).toEqual(positions.map(([col,row],slot)=>({type:'unitDeployed',unitId:`bench-${slot}`,
      from:bench(slot),to:board(col,row),domain:'match',eventSeq:state.nextMatchEventSeq+slot})));
    const {preparation: _a,nextMatchEventSeq:_b,...rest}=next;
    expect(rest).toEqual((({preparation:_c,nextMatchEventSeq:_d,...original})=>original)(state));
    expect(autoDeployToCap(next)).toEqual({ok:true,state:next,events:[]});
    expect(autoDeployToCap(next).state).toBe(next);
  });
  it('uses precisely the normal online deploy event and stops with an empty bench', () => {
    const base=prepared(), state={...base,preparation:{...base.preparation,units:[hero('one',bench(8))]}};
    expect(autoDeployToCap(state)).toEqual(deployMatchUnit(state,'one',board(3)));
    const empty={...state,preparation:{...state.preparation,units:[]}};
    expect(autoDeployToCap(empty)).toEqual({ok:true,state:empty,events:[]});
    expect(autoDeployToCap(empty).state).toBe(empty);
  });
  it('fills the next free central cell without swapping any existing unit', () => {
    const base=prepared(), state={...base,level:3,preparation:{...base.preparation,
      units:[hero('center',board(3)),hero('left',board(2)),hero('new',bench(0))]}};
    const next=accepted(autoDeployToCap(state));
    expect(own(next).map(u=>u.location)).toEqual([board(3),board(2),board(4)]);
  });
  it('rejects offline, non-preparation, eliminated and over-cap states without any mutation', () => {
    const base=prepared();
    for (const state of [createMatch(5),{...base,phase:'settlement',combat:null},
      {...base,multiplayer:{...base.multiplayer!,status:'eliminated'}}] as MatchState[]) {
      expect(autoDeployToCap(freeze(state))).toEqual({ok:false,state,reason:'wrong-phase'});
      expect(autoDeployToCap(state).state).toBe(state);
    }
    // G2-4a crown: an over-cap board benches its newest units; only a full bench still refuses.
    const over={...base,level:1,preparation:{...base.preparation,units:[hero('unit-4',board(0)),hero('unit-5',board(1))]}};
    expect(own(accepted(autoDeployToCap(over))).map(u=>u.location)).toEqual([board(0),bench(0)]);
    const full={...over,preparation:{...over.preparation,units:[...over.preparation.units,...Array.from({length:9},(_,slot)=>hero(`unit-${10+slot}`,bench(slot)))]}};
    expect(autoDeployToCap(full)).toEqual({ok:false,state:full,reason:'population-cap'});
  });
  it('only enters frozen PvE/PvP inputs when the server explicitly calls the hook', () => {
    const state=prepared();
    expect(accepted(startMatchCombat(state)).combatInputBasis!.inputs.preparation.units.find(u=>u.id==='unit-2')?.location).toEqual(bench(0));
    const deployed=accepted(autoDeployToCap(state)), combat=accepted(startMatchCombat(deployed));
    expect(combat.combatInputBasis!.inputs.preparation).toEqual(deployed.preparation);
    const catalog=catalogPreparation('2-1');
    const pvp={...state,round:catalog.round,roundDefinitionId:catalog.roundDefinitionId,m8:catalog.m8};
    expect(snapshotForBattle(accepted(autoDeployToCap(pvp)),'A').units).toHaveLength(3);
    const {multiplayer:_online,...offline}=state;
    const started=accepted(startMatchCombat(offline));
    expect(started.combatInputBasis!.inputs.preparation.units.find(u=>u.id==='unit-2')?.location).toEqual(bench(0));
  });
});
