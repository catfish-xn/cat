import {describe,it,expect} from 'vitest';
import {samplePlanBindings,planEffectApplications} from '../src/simulation/m8/planning';
import {DEFAULT_BOARD} from '../src/simulation/board';
import {source,cast,amount} from './fixtures/m8-contract-cases';
import type {AbilityPlan,Effect} from '../src/simulation/m8/contracts';
const u=(id:string,col:number)=>({id,cell:{col,row:4},hp:1000,maxHp:1000,team:id==='h'?'player' as const:'enemy' as const,alive:true});
const effect:Effect={kind:'damage',damageType:'physical',delivery:'ability-direct',critEligibility:'requires-spell-authorization',amount:amount(85)};
describe('M9 seam: random binding and deterministic finite skill planning',()=>{
 it('Caitlyn-like operation consumes1word during binding, then outputsA/B/A with unchanged center order',()=>{
  const plan:AbilityPlan={source:source('ability','h','h'),cast:cast({targetIds:['B']}),snapshots:{},triggers:[],operations:[{kind:'center-and-area',center:{kind:'random-enemy-center',areaOrder:'id',radius:1,rng:'combat',mapping:'word-modulo-id-sorted-count',draws:1},areaEffects:[effect],centerEffects:[effect]}]};
  const env={board:DEFAULT_BOARD,holderId:'h',tick:1,units:[u('h',3),u('B',4),u('A',5)]};let words=0;
  const bindings=samplePlanBindings(plan,env,()=>{words++;return 0;});expect(bindings).toEqual({centers:{0:'A'}});expect(words).toBe(1);
  const result=planEffectApplications(plan,env,bindings);expect(result.effects.map(e=>e.targetId)).toEqual(['A','B','A']);expect(words).toBe(1);
  expect(planEffectApplications(JSON.parse(JSON.stringify(plan)),env,JSON.parse(JSON.stringify(bindings)))).toEqual(result);
 });
});
