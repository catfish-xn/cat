import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_S8C } from '../src/simulation/content/augment-pool-batch5-s8c';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { hardCommitRewardPlan } from '../src/simulation/augment-pool-batch5-s8c';
import { selectChoice, startMatchCombat, nextRound, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, reachRound, resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import { CATALOG, COST, ROUNDS, xp, entryXp, benchXp, augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { createRequire } from 'node:module';
const rewardPools = createRequire(import.meta.url)('./augment-reward-pools-oracle-data.cjs');

it.skipIf(!existsSync(RESEARCH_FILE))('Hard Commit matches the 14.24 source',()=>{
 const row=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_HardCommit');
 expect(row.effects).toEqual(AUGMENT_BATCH5_S8C['hard-commit'].source.values);expect(row.tier).toBe(3);
 expect(row.name_zh_cn).toBe(AUGMENT_BATCH5_S8C['hard-commit'].name);
 expect(row.description_zh_cn).toBe(AUGMENT_BATCH5_S8C['hard-commit'].description);
});
it('only 2-1 can offer Hard Commit',()=>{
 for(const node of ['2-1','3-2','4-2']) {
  expect(augmentOfferAllowed('hard-commit',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='2-1');
  expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes('hard-commit')).toBe(node==='2-1');
 }
});
function choose(){
 const s=reachRound('2-1',false,firstNodeSeed('hard-commit',101)),c=s.pendingChoice!;
 expect(c.offers).toContain('hard-commit');return resolveM5Choices(accepted(selectChoice(s,c.choiceId,c.generation,'hard-commit')));
}
function trip(s:MatchState){const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(serializeMatch(restoreMatch(text))).toBe(text);return text;}
function checkGifts(s:MatchState){
 const gifts=hardCommitRewardPlan(s),emblem=gifts[0],trait=EMBLEM_ITEMS[emblem.definitionId].emblemTrait;
 expect(Object.keys(EMBLEM_ITEMS)).toHaveLength(22);
 for(const gift of gifts.slice(1)){
  // derive the stage from the authoritative round catalog below, independently of reward receipts
  const target=gift.acquiredRound===4?2:gift.acquiredRound===11?3:gift.acquiredRound===18?4:5;
  const costs=[...Array.from({length:target},(_,i)=>target-i),...Array.from({length:5-target},(_,i)=>target+i+1)];
  const expected=costs.find(cost=>SHOP_CATALOG_BY_COST[cost as 1|2|3|4|5].some(id=>UNIT_DEFINITIONS[id].traits.includes(trait!)));
  expect(UNIT_DEFINITIONS[gift.definitionId].traits).toContain(trait);expect(UNIT_DEFINITIONS[gift.definitionId].cost).toBe(expected);expect(gift.starLevel??1).toBe(1);
 }
 for(const gift of gifts)expect(s.seatMechanics!.receipts.filter(r=>r.receiptId===gift.receiptId)).toHaveLength(1);
}
it('real selection and round commands grant the emblem, immediate champion, and next stage champion exactly once',()=>{
 let s=choose();expect(hardCommitRewardPlan(s)).toHaveLength(2);checkGifts(s);trip(s);
 while(s.roundDefinitionId!=='3-1'){
  s=resolveM5Choices(s);if(s.phase==='preparation')s=accepted(startMatchCombat(emptyBoard(s)));
  s=resolveM5Choices(accepted(nextRound(s,s.round)));
 }
 expect(hardCommitRewardPlan(s)).toHaveLength(3);checkGifts(s);trip(s);
});
it('object, JSON and serialized restore reject altered emblem and champion receipts',()=>{
 const s=choose(),text=trip(s),gifts=hardCommitRewardPlan(s);
 for(const mutate of [
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId===gifts[0].receiptId).definitionId='blue-buff';},
  (x:any)=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.receiptId!==gifts[0].receiptId);},
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId===gifts[1].receiptId).definitionId='viktor';},
  (x:any)=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.receiptId!==gifts[1].receiptId);},
 ]){
  const x=JSON.parse(text);mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();
 }
});
it('each later stage draws from the same trait, prefers lower fallback and caps stage cost at five',()=>{
 const original=choose(),projected={...original,round:32};
 const gifts=hardCommitRewardPlan(projected),trait=EMBLEM_ITEMS[gifts[0].definitionId].emblemTrait!;
 expect(gifts.map(g=>g.acquiredRound)).toEqual([4,4,11,18,25,32]);
 for(const gift of gifts.slice(1)){
  const target=({4:2,11:3,18:4,25:5,32:5} as Record<number,number>)[gift.acquiredRound];
  const costs=[...Array.from({length:target},(_,i)=>target-i),...Array.from({length:5-target},(_,i)=>target+i+1)];
  const cost=costs.find(c=>SHOP_CATALOG_BY_COST[c as 1|2|3|4|5].some(id=>UNIT_DEFINITIONS[id].traits.includes(trait)));
  expect(UNIT_DEFINITIONS[gift.definitionId].traits).toContain(trait);expect(UNIT_DEFINITIONS[gift.definitionId].cost).toBe(cost);
 }
 expect(hardCommitRewardPlan({...projected,gold:0})).toEqual(gifts);
});

it('the literal S13 roster and independent reward ledger agree at all stage boundaries',()=>{
 const state={...choose(),round:32},expected=rewardPlan(state,{CATALOG,COST,ROUNDS,xp,entryXp,benchXp,pools:rewardPools.pools}).gifts;
 const actual=hardCommitRewardPlan(state).map(g=>({...g,source:'augment-pool-batch1',starLevel:g.starLevel??1}));
 expect(actual).toEqual(expected);
});
