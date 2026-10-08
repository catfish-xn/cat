import { describe,it,expect } from 'vitest';
import frozen from '../src/simulation/content/source/s13-14.24b/normalized/items.json';
import { ITEM_DEFINITIONS,COMPONENT_IDS } from '../src/simulation/content/items';
import { validateContent } from '../src/simulation/validate-content';
import { validateComponentPool,validateComponentCandidates,COMPONENT_POOL } from '../src/simulation/component-pool';
import { createMatch,selectChoice,stepMatch } from '../src/simulation/match';
import { itemMatch } from './fixtures/m8-b4-match';
import { serializeMatch,restoreMatch } from '../src/simulation/serialization';
import { stepCombat } from '../src/simulation/combat';
import { wearing,run,enemy } from './fixtures/m8-b4-items';
describe('B4 catalogue and IF-POOL',()=>{
 it('44 B1 identities/compositions/unique map one-to-one;every unordered recipe exists',()=>{
  validateContent();expect(Object.values(ITEM_DEFINITIONS)).toHaveLength(44);
  for(const x of frozen.items){const i=Object.values(ITEM_DEFINITIONS).find(i=>i.apiName===x.apiName)!;expect(i).toBeDefined();expect(i.kind).toBe(x.kind);expect(i.unique).toBe(x.sourceUnique);expect((i.recipe??[]).map(id=>ITEM_DEFINITIONS[id].apiName).sort()).toEqual([...x.composition].sort());}
  const recipes=Object.values(ITEM_DEFINITIONS).filter(i=>i.recipe).map(i=>[...i.recipe!].sort().join('|'));expect(new Set(recipes).size).toBe(36);
  for(const a of COMPONENT_IDS)for(const b of COMPONENT_IDS)expect(recipes.filter(r=>r===[a,b].sort().join('|'))).toHaveLength(1);
 });
 it('all44 base coefficients match frozen B1 normalized units,including CritChance and maxHP percentages',()=>{
  for(const x of frozen.items){
   const item=Object.values(ITEM_DEFINITIONS).find(i=>i.apiName===x.apiName)!,fields=x.normalizedEffects as Partial<Record<string,{value:number}>>;
   const flat=(stat:string)=>item.effects.reduce((n,e)=>n+(e.kind==='statFlat'&&e.stat===stat?e.amount:0),0);
   const percent=(stat:string)=>item.effects.reduce((n,e)=>n+(e.kind==='statPercentBps'&&e.stat===stat?e.bps:0),0);
   expect({ad:percent('attackDamage'),ap:flat('abilityPower'),as:item.effects.reduce((n,e)=>n+(e.kind==='attackSpeedBps'?e.bps:0),0),hp:flat('maxHp'),hpBps:percent('maxHp'),armor:flat('armor'),mr:flat('magicResist'),mana:flat('initialMana'),crit:item.combatProgram?.modifiers?.filter(m=>m.stat==='critChance').reduce((n,m)=>n+(m.value.kind==='constant'?m.value.amount:0),0)??0},x.apiName)
    .toEqual({ad:fields.AD?.value??0,ap:fields.AP?.value??0,as:fields.AS?.value??0,hp:fields.Health?.value??0,hpBps:fields.PercentMaxHP?.value??fields.BonusPercentHP?.value??0,armor:fields.Armor?.value??0,mr:fields.MagicResist?.value??0,mana:fields.Mana?.value??0,crit:fields.CritChance?.value??0});
  }
 });
 it('eight API sorted candidates;old selection emits exactly one ScheduleReceipt,zero RNG',()=>{
  const before=createMatch(42);expect(before.pendingChoice?.offers).toEqual(COMPONENT_POOL.map(x=>x.definitionId));validateComponentCandidates(before.pendingChoice!.offers);
  expect(restoreMatch(serializeMatch(before))).toEqual(before);
  const r=selectChoice(before,before.pendingChoice!.choiceId,0,'gloves');if(!r.ok)throw new Error(r.reason);
  expect(r.state.scheduleReceipts).toHaveLength(before.scheduleReceipts.length+1);expect(r.state.items.filter(i=>i.definitionId==='gloves')).toHaveLength(1);expect(r.state.choiceRngState).toBe(before.choiceRngState);
 });
 it('pool rejects missing,duplicate,wrong-kind/identity and candidates',()=>{
  for(const offers of [COMPONENT_IDS.slice(1),[...COMPONENT_IDS.slice(0,7),COMPONENT_IDS[0]],[...COMPONENT_IDS.slice(0,7),'deathblade'],[...COMPONENT_IDS].reverse()])expect(()=>validateComponentCandidates(offers)).toThrow();
  const bad={...ITEM_DEFINITIONS};delete bad.gloves;expect(()=>validateComponentPool(bad)).toThrow();
  expect(()=>validateComponentPool({...ITEM_DEFINITIONS,gloves:{...ITEM_DEFINITIONS.gloves,kind:'completed'}})).toThrow();
  expect(()=>validateContent({items:{...ITEM_DEFINITIONS,'copy':{...ITEM_DEFINITIONS['infinity-edge'],id:'copy'}}})).toThrow();
  const missing={...ITEM_DEFINITIONS};delete missing['infinity-edge'];expect(()=>validateContent({items:missing})).toThrow();
  const swapped={...ITEM_DEFINITIONS,'infinity-edge':{...ITEM_DEFINITIONS['infinity-edge'],recipe:ITEM_DEFINITIONS['last-whisper'].recipe},'last-whisper':{...ITEM_DEFINITIONS['last-whisper'],recipe:ITEM_DEFINITIONS['infinity-edge'].recipe}};expect(()=>validateContent({items:swapped})).toThrow();
 });
 it.each(Object.values(ITEM_DEFINITIONS).map(i=>i.id))('%s actual Match start and restore preserve catalogue program sources and RNG',id=>{
  let s=itemMatch(id);expect(restoreMatch(serializeMatch(s))).toEqual(s);
  for(let i=0;i<361&&s.phase==='combat';i++){s=stepMatch(s).state;if([0,19,39,59,79,99,159,199,359].includes(i)){const restored=restoreMatch(serializeMatch(s));expect(restored).toEqual(s);expect(stepMatch(restored)).toEqual(stepMatch(s));}}
 });
 it.each(Object.values(ITEM_DEFINITIONS).filter(i=>i.kind==='completed').map(i=>i.id))('%s JSON combat continuation and RNG equal after a real trigger',id=>{
  const r=run(wearing(id),110,[enemy()]);expect(stepCombat(JSON.parse(JSON.stringify(r.state)))).toEqual(stepCombat(r.state));
 });
});
