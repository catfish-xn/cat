import { describe, expect, it } from 'vitest';
import { createMatch, deployMatchUnit, validateMatchDeployment, startMatchCombat, stepMatch, type MatchState } from './fixtures/recorded-match';
import { deployUnit, getPlayerDeploymentCount, validateDeployment } from '../src/simulation/game';
import { restoreMatch, serializeMatch } from './fixtures/history-evidence';
import { DEPLOYMENT_RULES_VERSION } from '../src/simulation/match-rules';
import { CONTENT_DIGEST } from '../src/simulation/content';
import type { UnitLocation } from '../src/simulation/units';
import { accepted, freeze, purchasedThreeHeroMatch } from './match-helpers';
import { fullBench, conserved } from './tp-helpers';

const board = (col: number): UnitLocation => ({kind:'board',cell:{col,row:4}});
const bench = (slot: number): UnitLocation => ({kind:'bench',slot});
function fixture(): MatchState {
  const state=createMatch(),source=state.preparation.units.find(u=>u.team==='player')!;
  return {...state,level:2,preparation:{...state.preparation,units:[
    ...[board(1),board(2),bench(0),bench(1)].map((location,i)=>({...source,id:`unit-${i+1}`,location})),
    ...state.preparation.units.filter(u=>u.team==='enemy'),
  ]}};
}
const location = (state: MatchState, id: string) => state.preparation.units.find(u=>u.id===id)!.location;
function rejected(state: MatchState, unitId: string, target: UnitLocation, reason: string) {
  const before=structuredClone(state),result=deployMatchUnit(freeze(state),unitId,target);
  expect(validateMatchDeployment(state,unitId,target)).toBe(reason);
  expect(result).toEqual({ok:false,state,reason});expect(result.state).toBe(state);
  expect(Object.hasOwn(result,'events')).toBe(false);expect(state).toEqual(before);
}

describe('SR-C7-01 atomic allied deployment swaps',()=>{
  it.each([
    ['bench to board','unit-3','unit-1'],
    ['board to bench','unit-1','unit-3'],
    ['bench to bench','unit-3','unit-4'],
    ['board to board','unit-1','unit-2'],
  ])('%s swaps at the population cap without changing either unit identity or any resources',(_label,a,b)=>{
    const state=freeze(fixture()),before=structuredClone(state),target=structuredClone(location(state,b));
    expect(validateDeployment(state.preparation,a,target)).toBeUndefined();
    expect(validateMatchDeployment(state,a,target)).toBeUndefined();
    const result=deployMatchUnit(state,a,target);expect(result.ok).toBe(true);
    if(!result.ok)throw new Error(result.reason);
    const next=result.state;
    expect(result.events).toEqual([]);expect(getPlayerDeploymentCount(next.preparation)).toBe(2);
    expect(next).toEqual({...state,preparation:{...state.preparation,units:state.preparation.units.map(u=>u.id===a
      ? {...u,location:location(state,b)} : u.id===b ? {...u,location:location(state,a)} : u)}});
    expect(state).toEqual(before);
    expect(location(next,a)).not.toBe(target);expect(location(next,b)).not.toBe(location(state,a));
    if(target.kind==='board') {Object.assign(target.cell,{col:6});expect(location(next,a)).toEqual(location(state,b));}
    // Re-sending the same destination must not reverse the exchange; no new events/RNG.
    expect(accepted(deployMatchUnit(next,a,location(next,a)))).toEqual(next);
  });
  it('rejects bench-to-empty-board at cap and cross-area swaps on an already over-cap board',()=>{
    rejected(fixture(),'unit-3',board(3),'population-cap');
    rejected({...fixture(),level:1},'unit-3',board(1),'population-cap');
    rejected({...fixture(),level:1},'unit-1',bench(0),'population-cap');
  });
  it('permits ordinary empty destinations and withdrawal that restores the cap',()=>{
    const state=fixture();
    expect(accepted(deployMatchUnit(state,'unit-3',bench(8))).preparation.units.find(u=>u.id==='unit-3')!.location).toEqual(bench(8));
    expect(getPlayerDeploymentCount(accepted(deployMatchUnit({...state,level:1},'unit-1',bench(8))).preparation)).toBe(1);
  });
  it.each(['combat','choice','settlement','gameOver'] as const)('rejects swaps during %s before geometry/population',phase=>{
    rejected({...fixture(),phase} as MatchState,'unit-3',board(1),'wrong-phase');
  });
  it('rejects invalid identities, coordinates and enemy occupants without partial movement',()=>{
    rejected(fixture(),'missing',bench(0),'unknown-unit');
    const state=fixture(),enemy=state.preparation.units.find(u=>u.team==='enemy')!;
    rejected(state,enemy.id,bench(0),'enemy-unit');
    rejected(state,'unit-3',{kind:'board',cell:{col:1,row:3}},'outside-deployment-zone');
    rejected(state,'unit-3',bench(9),'invalid-location');
    rejected(state,'unit-3',board(0.5),'invalid-location');
    rejected(state,'unit-3',null as unknown as UnitLocation,'invalid-location');
    for(const target of [board(1),bench(0)]) {
      const guarded={...state,preparation:{...state.preparation,units:state.preparation.units.map(u=>u.id==='unit-1'
        ? {...u,team:'enemy' as const,location:target} : u.id==='unit-3' ? {...u,location:bench(7)} : u)}};
      expect(validateDeployment(guarded.preparation,'unit-3',target)).toBe('occupied');
      expect(deployUnit(guarded.preparation,'unit-3',target).state).toBe(guarded.preparation);
      rejected(guarded,'unit-3',target,'occupied');
    }
  });
  it('validates the reverse destination and refuses ambiguous occupied targets',()=>{
    const state=fixture();
    for(const source of [bench(-1),{kind:'board',cell:{col:1,row:2}}] as UnitLocation[]) {
      const bad={...state,preparation:{...state.preparation,units:state.preparation.units.map(u=>u.id==='unit-3'?{...u,location:source}:u)}};
      rejected(bad,'unit-3',board(1),source.kind==='bench'?'invalid-location':'outside-deployment-zone');
    }
    const duplicate={...state,preparation:{...state.preparation,units:state.preparation.units.map(u=>u.id==='unit-2'?{...u,location:board(1)}:u)}};
    rejected(duplicate,'unit-3',board(1),'occupied');
  });
  it('supports a full shared-pool bench without changing pool assets or bindings',()=>{
    const {pool,state}=fullBench(),before=structuredClone(pool);
    const onBoard=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
    const reserve=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!;
    const next=accepted(deployMatchUnit(freeze(state),reserve.id,onBoard.location));
    expect(location(next,onBoard.id)).toEqual(reserve.location);
    expect(next.sharedPool).toBe(state.sharedPool);expect(pool).toEqual(before);conserved(pool,[next]);
  });
  it('replays all swap forms through saved preparation and resumes the resulting combat identically',()=>{
    let live=purchasedThreeHeroMatch(),restored=restoreMatch(serializeMatch(live));
    const commands: [string,UnitLocation][]=[['unit-2',bench(0)],['unit-3',bench(1)],
      ['unit-2',location(live,'unit-1')],['unit-1',bench(1)],['unit-3',board(3)],['unit-2',board(3)]];
    for(const [id,target] of commands) {
      const actual=deployMatchUnit(live,id,target),replayed=deployMatchUnit(restored,id,target);
      expect(replayed).toEqual(actual);live=accepted(actual);restored=restoreMatch(serializeMatch(accepted(replayed)));
      expect(restored).toEqual(live);
    }
    live=accepted(startMatchCombat(live));restored=restoreMatch(serializeMatch(accepted(startMatchCombat(restored))));
    for(let tick=0;tick<20&&live.phase==='combat';tick++) {
      const actual=stepMatch(live),replayed=stepMatch(restored);expect(replayed).toEqual(actual);
      live=actual.state;restored=restoreMatch(serializeMatch(replayed.state));expect(restored).toEqual(live);
    }
  });
  it('preserves ID-bound equipment/growth and restores a swapped legitimate save',()=>{
    const state=purchasedThreeHeroMatch(),a=state.preparation.units.find(u=>u.id==='unit-1')!,b=state.preparation.units.find(u=>u.id==='unit-2')!;
    const bound: MatchState={...state,items:[{id:'item-1',definitionId:'sword',location:{kind:'unit' as const,unitId:a.id,slot:0}}],
      nextItemSerial:2,persistentGrowth:[{unitId:a.id,attackDamageBps:125}]};
    const next=accepted(deployMatchUnit(freeze(bound),a.id,b.location));
    expect(next.items).toBe(bound.items);expect(next.persistentGrowth).toBe(bound.persistentGrowth);
    const swapped=accepted(deployMatchUnit(state,a.id,b.location));
    expect(restoreMatch(serializeMatch(swapped))).toEqual(swapped);
    expect(DEPLOYMENT_RULES_VERSION).toBe('preparation-swap-v1');
    expect(CONTENT_DIGEST).not.toBe('fnv1a32-utf16:c7ac9b0c');
    expect(()=>restoreMatch({...swapped,contentDigest:'fnv1a32-utf16:c7ac9b0c'})).toThrow('content-digest');
  });
});
