import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { AUGMENT_BATCH5_H12 } from '../src/simulation/content/augment-pool-batch5-h12';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { buyUnit, nextRound, rerollAugment, rerollShop, setShopLock, startMatchCombat, type MatchState } from '../src/simulation/match';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { drawSubscriptionSlots, enterShopAugmentRound } from '../src/simulation/augment-pool-batch5-h12-subscription';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { restoreMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, reachRound, resolveM5Choices } from './match-helpers';
import { pick, trip, reject, RESEARCH_FILE } from './augment-pool-batch5-h12-helpers';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';

it('B5-86 is prismatic and only offered at 2-1 in production and independent oracle',()=>{
 expect(AUGMENT_TIERS['subscription-service']).toBe('prismatic');
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('subscription-service',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='2-1');
  expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes('subscription-service')).toBe(node==='2-1');
 }
});
it.skipIf(!existsSync(RESEARCH_FILE))('B5-86 source is independently checked against the 14.24 archive',()=>{
 const raw=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_SubscriptionService');
 expect(AUGMENT_BATCH5_H12['subscription-service'].source.values).toEqual(raw.effects);
 expect(AUGMENT_BATCH5_H12['subscription-service'].description).toBe(raw.description_zh_cn);
});
describe('B5-86 public commands and authenticated saves',()=>{
 let before:MatchState,chosen:MatchState,stage:MatchState;
 beforeAll(()=>{
  before=restoreMatch(reachRound('2-1',false,14));const c=before.pendingChoice!;
  before=accepted(rerollAugment(before,c.choiceId,c.generation,0));chosen=pick(before,'subscription-service');stage=chosen;
 });
 it('acquisition opens four unique paid 4-costs, leaves one empty slot and pays six once',()=>{
  expect(chosen.gold).toBe(before.gold+6);
  expect(chosen.shop.generation).toBe(before.shop.generation+1);
  const ids=chosen.shop.slots.flatMap(s=>s.status==='available'?[s.definitionId]:[]);
  expect(ids).toHaveLength(4);expect(new Set(ids).size).toBe(4);expect(ids.map(id=>UNIT_DEFINITIONS[id].cost)).toEqual([4,4,4,4]);
  expect(chosen.shop.slots[4]).toEqual({status:'purchased',empty:true});
  expect(chosen.preparation.units).toEqual(before.preparation.units);
  expect(requireAugmentFacts(chosen,'acquire',chosen.round)).toHaveLength(1);
  expect(enterShopAugmentRound(chosen)).toBe(chosen);trip(chosen);
 });
 it('purchases cost four, reroll costs two and leaves the special shop; restored commands produce the same result',()=>{
  const bought=accepted(buyUnit(chosen,0,chosen.shop.generation));expect(bought.gold).toBe(chosen.gold-4);
  expect(buyUnit(restoreMatch(chosen),0,chosen.shop.generation)).toEqual(buyUnit(chosen,0,chosen.shop.generation));
  const rerolled=accepted(rerollShop(bought));expect(rerolled.gold).toBe(bought.gold-2);
  expect(rerolled.shop.slots.filter(s=>s.status==='available')).toHaveLength(5);trip(rerolled);
 });
 it.each(['missing history','acquire principal','acquire round','gold','shop','stock RNG','draw cause','missing shop evidence'])('rejects %s at object/JSON/serialized entries',kind=>reject(chosen,s=>{
  if(kind==='missing history')delete s.augmentHistory;
  if(kind==='acquire principal')s.augmentHistory.facts[0].goldBefore++;
  if(kind==='acquire round')s.augmentHistory.facts[0].round++;
  if(kind==='gold')s.gold++;
  if(kind==='shop')s.shop.slots[0].definitionId='violet';
  if(kind==='stock RNG')s.shopHistory.entries.find((e:any)=>e.kind==='draw').rngState++;
  if(kind==='draw cause')s.shopHistory.entries.find((e:any)=>e.kind==='draw').cause='natural';
  if(kind==='missing shop evidence')delete s.shopHistory;
 }));
 // Each natural checkpoint remains under the existing test timeout, without widening it.
 for(const target of ['2-2','2-3','2-4','2-5','2-6','2-7','3-1'])it(`public entry ${target} preserves the subscription cadence`,()=>{
  const old=stage;
  if(old.roundDefinitionId==='2-7')stage=accepted(setShopLock(stage,true,stage.shop.generation));
  if(stage.phase==='preparation')stage=resolveM5Choices(accepted(startMatchCombat(emptyBoard(stage))));
  stage=accepted(nextRound(stage,stage.round));stage=resolveM5Choices(stage);
  expect(stage.roundDefinitionId).toBe(target);
  const rewards=stage.seatMechanics?.receipts.filter(r=>r.receiptId.startsWith('["augment-pool-shop","subscription"'))??[];
  if(target!=='3-1')expect(rewards).toHaveLength(0);
  else {
   expect(rewards).toMatchObject([{kind:'gold',amount:6,round:stage.round}]);
   expect(stage.shop.locked).toBe(true);expect(stage.shop.generation).toBe(old.shop.generation+1);
   expect(stage.shop.slots.filter(s=>s.status==='available')).toHaveLength(4);
   expect(enterShopAugmentRound(stage)).toBe(stage);trip(stage);
   reject(stage,s=>{s.augmentHistory.facts=s.augmentHistory.facts.filter((f:any)=>f.kind!=='round-entry'||f.round!==s.round);});
   reject(stage,s=>{s.seatMechanics.receipts.find((r:any)=>r.receiptId.startsWith('["augment-pool-shop","subscription"')).amount++;});
  }
 });
 it('insufficient distinct stock leaves empty slots and consumes exactly one RNG word/reservation per drawn champion',()=>{
  for(const count of [0,1,2,3]){
   const stock=Object.fromEntries(SHOP_CATALOG_BY_COST[4].map((id,i)=>[id,i<count?5:0])),takes:string[]=[];
   const drawn=drawSubscriptionSlots(chosen,stock,id=>{takes.push(id);stock[id]--;});
   expect(takes).toHaveLength(count);expect(new Set(takes).size).toBe(count);expect(drawn.rngDraws).toBe(count);
   expect(drawn.slots.filter(s=>'empty' in s&&s.empty)).toHaveLength(5-count);
   if(count===0)expect(drawn.rngState).toBe(chosen.rngState);
  }
 });
});
