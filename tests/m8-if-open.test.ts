import {describe,it,expect} from 'vitest';
import {planOpening,commitOpening,validateOpeningState,advanceOpeningTasks} from '../src/simulation/m8/opening';
import {DEFAULT_BOARD} from '../src/simulation/board';
import {source,amount} from './fixtures/m8-contract-cases';
const u=(id:string,col:number,row:number,team:'player'|'enemy'='enemy')=>({id,cell:{col,row},team,hp:1000,maxHp:1000,alive:true,untargetable:false,controlled:false});
const s=(id:string)=>({...source('opening',id,id),sourceKind:'ability' as const});
describe('IF-OPEN shared opening occupancy and independent delayed-task state',()=>{
 it('charge(3,1)→(4,2)→(3,3)→(3,4)→(2,5) freezes victim and tick1 task',()=>{
  const units=[u('h',3,1),u('p',3,4,'player')];
  const defs=[{kind:'path-charge' as const,source:s('h'),effects:[{kind:'damage' as const,damageType:'magic' as const,delivery:'ability-direct' as const,critEligibility:'never' as const,amount:amount(0,{maxHpBps:1500,hpBasis:'target',cap:300,sample:'packet'})}]}];
  const state=planOpening('c',DEFAULT_BOARD,units,defs);
  expect(state.plans[0]).toMatchObject({from:{col:3,row:1},to:{col:2,row:5},path:[{col:4,row:2},{col:3,row:3},{col:3,row:4},{col:2,row:5}],targetIds:['p'],consumed:true,task:{executeAtTick:1,status:'pending'}});
  const applied=commitOpening(state,units);expect(applied.movements).toHaveLength(1);expect(applied.units.find(u=>u.id==='h')?.cell).toEqual({col:2,row:5});
  expect(commitOpening(JSON.parse(JSON.stringify(applied.state)),applied.units).movements).toEqual([]);
  validateOpeningState(applied.state,'c',DEFAULT_BOARD,defs);
  const cancelled=advanceOpeningTasks(applied.state,1,applied.units.map(u=>u.id==='h'?{...u,controlled:true}:u));
  expect(cancelled.ready).toEqual([]);expect(cancelled.state.plans[0].task?.status).toBe('cancelled');expect(cancelled.state.plans[0].to).toEqual({col:2,row:5});
 });
 it('fully occupied charge consumes without position/damage; jumps reserve inID order and input permutation invariant',()=>{
  const units=[u('h',3,1),u('a',4,2),u('b',3,3),u('p',3,4,'player'),u('q',2,5,'player')];
  const blocked=planOpening('c',DEFAULT_BOARD,units,[{kind:'path-charge',source:s('h'),effects:[]}]);
  expect(blocked.plans[0]).toMatchObject({to:{col:3,row:1},targetIds:[],task:null,consumed:true});
  const jumpers=[u('b',4,2),u('a',2,2),u('p',3,7,'player')];
  const defs=[{kind:'backline-jump' as const,source:s('b')},{kind:'backline-jump' as const,source:s('a')}];
  const planned=planOpening('c',DEFAULT_BOARD,jumpers,defs);
  expect(planOpening('c',DEFAULT_BOARD,[...jumpers].reverse(),[...defs].reverse())).toEqual(planned);
  const cells=planned.plans.map(p=>JSON.stringify(p.to));expect(new Set(cells).size).toBe(2);
 });
});
