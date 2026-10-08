import { describe,expect,it } from 'vitest';
import { freezeCompanions, registerDeaths, advanceReactions, validateCompanionState, type CompanionDefinition } from '../src/simulation/m8/companions';
import { source, amount, modifier } from './fixtures/m8-contract-cases';
const members=[{id:'a',team:'enemy' as const,unitKind:'neutral' as const,encounterId:'enc',monsterFamily:'family'}, {id:'b',team:'enemy' as const,unitKind:'neutral' as const,encounterId:'enc',monsterFamily:'family'},{id:'c',team:'enemy' as const,unitKind:'neutral' as const,encounterId:'enc',monsterFamily:'family'}];
const def:CompanionDefinition={source:{...source('reaction','a','a'),sourceKind:'ability'},effects:[{kind:'heal',amount:amount(0,{missingHpBps:10000})}]};
const deaths=[{combatId:'battle',tick:10,deadUnitId:'c',team:'enemy' as const,encounterId:'enc',monsterFamily:'family',eventId:'death-c'},{combatId:'battle',tick:10,deadUnitId:'b',team:'enemy' as const,encounterId:'enc',monsterFamily:'family',eventId:'death-b'}];
describe('IF-DEATH finite opening membership, post-cleanup survivors, original-tick reactions',()=>{
 it('two deaths register once each in ID order; corpse re-read/JSON restore zero duplicate',()=>{
  const start=freezeCompanions('battle',members,[def]);const result=registerDeaths(start,deaths,['a']);
  expect(result.reactions.map(r=>[r.deadUnitId,r.executeAtTick,r.status])).toEqual([['b',11,'pending'],['c',11,'pending']]);
  expect(registerDeaths(JSON.parse(JSON.stringify(result)),deaths,['a'])).toEqual(result);
  expect(registerDeaths(start,deaths,[]).reactions).toEqual([]);
  const next=advanceReactions(result,11,['a'],false);expect(next.ready).toHaveLength(2);
  expect(advanceReactions(next.state,11,['a'],false).ready).toHaveLength(0);
  validateCompanionState(JSON.parse(JSON.stringify(next.state)),'battle',[def],members);
 });
 it('future same-family arrivals are not opening companions; source death/end cancels',()=>{
  const start=freezeCompanions('battle',members,[def]);
  expect(registerDeaths(start,[{...deaths[0],deadUnitId:'new'}],['a']).reactions).toEqual([]);
  const pending=registerDeaths(start,deaths,['a']);
  expect(advanceReactions(pending,11,[],false).state.reactions.map(r=>r.status)).toEqual(['cancelled','cancelled']);
  expect(advanceReactions(pending,10,['a'],true).ready).toEqual([]);
 });
 it('AS reaction carries next-tick activation from death10; ready at11 not12',()=>{
  const speed:CompanionDefinition={...def,effects:[{kind:'modify-stat',modifier:modifier('attackSpeed',1200,{unit:'bps'}),activation:'next-tick',duration:{kind:'combat'},stackPolicy:{kind:'add-stacks',cap:null}}]};
  const registered=registerDeaths(freezeCompanions('battle',members,[speed]),[deaths[0]],['a']);
  expect(advanceReactions(registered,10,['a'],false).ready).toEqual([]);
  expect(advanceReactions(registered,11,['a'],false).ready[0]).toMatchObject({executeAtTick:11,status:'executed'});
 });
});
