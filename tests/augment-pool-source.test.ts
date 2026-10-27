import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { BATCH1_SOURCE, BATCH2_SOURCE, BATCH1_BLOCKED_SOURCE, RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH1, AUGMENT_BATCH1_BLOCKED } from '../src/simulation/content/augment-pool-batch1';
import { AUGMENT_BATCH2 } from '../src/simulation/content/augment-pool-batch2';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { createMatch } from '../src/simulation/match';
import { batch1GiftPlan } from '../src/simulation/augment-pool-grants';
import type { AugmentGiftSpec } from '../src/simulation/augment-gift-plan';

const ONE_COSTS=['amumu','darius','draven','irelia','lux','maddie','morgana','powder','singed','steb','trundle','vex','violet','zyra'];
function token(s:AugmentGiftSpec):string {
 if(s.kind==='random-item')return `ri:${s.pool}:${s.count}${s.identical?':identical':''}`;
 if(s.kind==='random-unit')return `ru:${s.cost}:${s.count}:${s.starLevel??1}`;
 if(s.kind==='all-units')return `all:${s.cost}`;
 if(s.kind==='random-unit-pool')throw new Error('unexpected acquisition pool');
 return `${{item:'i',unit:'u',consumable:'c'}[s.kind]}:${s.definitionId}${s.kind==='consumable'?`:${s.count??1}`:s.kind==='unit'&&s.starLevel&&s.starLevel!==1?`:${s.starLevel}`:''}`;
}
it('covers both tables completely with independent indexed expectations',()=>{
 expect(RESEARCH_FILE).toMatch(/augments-14\.24\.json$/);
 expect(BATCH1_SOURCE).toHaveLength(67);expect(BATCH2_SOURCE).toHaveLength(26);
 expect(BATCH1_SOURCE.map(x=>x.id).sort()).toEqual(Object.keys(AUGMENT_BATCH1).sort());
 expect(BATCH2_SOURCE.map(x=>x.id).sort()).toEqual(Object.keys(AUGMENT_BATCH2).sort());
 expect(new Set([...BATCH1_SOURCE,...BATCH2_SOURCE].map(x=>x.recordIndex)).size).toBe(93);
});
it.each([...BATCH1_SOURCE,...BATCH2_SOURCE])('$id matches research record [$recordIndex]: identity, raw constants and reward plan',e=>{
 const row=AUGMENT_BATCH1[e.id]??AUGMENT_BATCH2[e.id];
 expect(row.apiName).toBe(e.apiName);expect(row.tier).toBe(e.tier);expect(row.source.values).toEqual(e.values);
 // This inventory row remains in batch 2; executable content moved to B5-58.
 if(e.id==='forbidden-magic'){
  expect(AUGMENT_BATCH2[e.id].enabled).toBe(false);expect(row.gifts).toEqual([]);
  expect(AUGMENT_DEFINITIONS[e.id].id).toBe(e.id);expect(AUGMENT_POOL_API_NAMES[e.id]).toBe(e.apiName);
  expect(batch1GiftPlan({...createMatch(42),augments:[{definitionId:e.id,choiceId:'oracle',acquiredRound:1}]})).toHaveLength(3);
  return;
 }
 if(!e.enabled){
  expect(AUGMENT_BATCH2[e.id].enabled).toBe(false);expect(row.gifts).toEqual([]);
  expect(AUGMENT_DEFINITIONS[e.id]).toBeUndefined();expect(AUGMENT_POOL_API_NAMES[e.id]).toBeUndefined();
  expect(batch1GiftPlan({...createMatch(42),augments:[{definitionId:e.id,choiceId:'oracle',acquiredRound:1}]})).toEqual([]);
  return;
 }
 expect(AUGMENT_TIERS[e.id]).toBe(e.tier);expect(AUGMENT_POOL_API_NAMES[e.id]).toBe(e.apiName);
 expect(row.gifts.map(token).sort()).toEqual([...e.rewards].sort());
 const effects=AUGMENT_DEFINITIONS[e.id].effects;
 const mechanic=(name:string,key:string)=>effects.reduce((sum,x)=>sum+(x.kind==='mechanic'&&x.mechanic===name?(x.values as Record<string,number>)[key]??0:0),0);
 expect(mechanic('acquisitionGold','amount')).toBe(e.gold);
 expect(mechanic('acquisitionXp','amount')).toBe(e.xp);
 expect(mechanic('incomePolicy','roundGold')).toBe(e.roundGold);
 // Exercise actual expanded grants, independently of implementation spec expansion.
 for(const seed of [0,42,999]){
  const gifts=batch1GiftPlan({...createMatch(seed),augments:[{definitionId:e.id,choiceId:'oracle',acquiredRound:1}]}),remaining=[...gifts];
  for(const reward of e.rewards){
   const [kind,id,countOrStar,identical]=reward.split(':');
   const count=kind==='all'?ONE_COSTS.length:kind==='ri'||kind==='ru'||kind==='c'?Number(countOrStar):1;
   const matched=remaining.filter(g=>kind==='all'||kind==='ru'?g.kind==='unit'&&UNIT_DEFINITIONS[g.definitionId]?.cost===Number(id)&&(g.starLevel??1)===(kind==='ru'?Number(identical):1):kind==='ri'?g.kind==='item':g.kind===({i:'item',u:'unit',c:'consumable'} as const)[kind as 'i']&&g.definitionId===id);
   expect(matched.length).toBeGreaterThanOrEqual(count);
   const taken=matched.slice(0,count);if(kind==='all')expect(taken.map(g=>g.definitionId).sort()).toEqual(ONE_COSTS);if(identical==='identical')expect(new Set(taken.map(g=>g.definitionId)).size).toBe(1);
   for(const g of taken)remaining.splice(remaining.indexOf(g),1);
  }
  expect(remaining).toEqual([]);
 }
});

it.each(BATCH1_BLOCKED_SOURCE)('$apiName record [$recordIndex] stays completely disabled',e=>{
 expect(AUGMENT_BATCH1_BLOCKED).toHaveProperty(e.apiName);
 expect(AUGMENT_DEFINITIONS[e.id]).toBeUndefined();expect(Object.values(AUGMENT_POOL_API_NAMES)).not.toContain(e.apiName);
 expect(batch1GiftPlan({...createMatch(42),augments:[{definitionId:e.id,choiceId:'oracle',acquiredRound:1}]})).toEqual([]);
});
// Optional provenance audit when the external archive is available. CI needs only
// the checked-in literals above; no download or production-derived oracle.
it.skipIf(!existsSync(RESEARCH_FILE))('all 95 citations point to the independently transcribed source identities, tiers and constants',()=>{
 const research=JSON.parse(readFileSync(RESEARCH_FILE,'utf8'));
 for(const e of [...BATCH1_SOURCE,...BATCH2_SOURCE,...BATCH1_BLOCKED_SOURCE]){
  const source=research[e.recordIndex];expect(source.apiName).toBe(e.apiName);
  expect(['silver','gold','prismatic'][source.tier-1]).toBe(e.tier);expect(source.effects).toEqual(e.values);
 }
});

// Independent reward milestones transcribed from records [162], [163], [191],
// [213], [196]. In particular, an implementation could keep raw constants right
// but award the wrong artifact/champion; these exercise the deferred plan too.
import { batch2RewardPlan } from '../src/simulation/augment-pool-batch2-progress';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { advanceG23Economy, type G23BattleFacts } from '../src/simulation/g2-3-economy';
it.each([
 ['rocket-collection',75,2,'item','TFT4_Item_OrnnTheCollector'],
 ['rocket-collection-plus',65,2,'item','TFT4_Item_OrnnTheCollector'],
 ['scrap-recycling',6,5,'item',null],
 ['welcome-to-the-playground',1,3,'unit',['vander','powder','violet']],
 ['betrayal',1,3,'unit','maddie'],
] as const)('%s pays the source reward identity, amount and lifetime cap', (id,threshold,limit,kind,definition)=>{
 function plan(counts:number[]){
  let s={...createMatch(42),augments:[{definitionId:id,choiceId:'source-reward',acquiredRound:1}]},p=readG23Progress(s)!;
  for(const [i,count] of counts.entries()){
   const facts:G23BattleFacts={battleId:`battle-${i+1}`,round:i+1,roundKind:'pvp',result:'win',conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0,batch2:[{definitionId:id,count}]};
   p=advanceG23Economy(p,facts).progress;
  }
  s=writeG23Progress({...s,round:counts.length},p);return batch2RewardPlan(s);
 }
 expect(plan([threshold-1])).toEqual([]);
 expect(plan([threshold-1,1])).toHaveLength(1);
 const gifts=plan(Array.from({length:3},()=>id==='betrayal'||id==='welcome-to-the-playground'?1:threshold*10));
 expect(gifts).toHaveLength(limit);
 for(const g of gifts){
  expect(g.kind).toBe(kind);
  if(Array.isArray(definition))expect(definition).toContain(g.definitionId);
  else if(definition)expect(g.definitionId).toBe(definition);
 }
});
