import { expect, it } from 'vitest';
import { AUGMENT_BATCH1, AUGMENT_BATCH1_BLOCKED } from '../src/simulation/content/augment-pool-batch1';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { AUGMENT_DEFINITIONS, ITEM_DEFINITIONS } from '../src/simulation/content';
import { CONSUMABLE_DEFINITIONS } from '../src/simulation/content/consumables';
import { validateEffect } from '../src/simulation/validate-content';
import { cloneEffect } from '../src/simulation/effects';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { createMatch, selectChoice, openAnvil, forfeitPendingChoice, startMatchCombat, nextRound, rerollAugment, sellUnit, buyXp, buyUnit, deployMatchUnit, stepMatch, useConsumable } from '../src/simulation/match';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { batch1GiftPlan, drainBatch1Gifts, validateBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { augmentAnvilOffers } from '../src/simulation/augment-gift-plan';
import { isAnvil } from '../src/simulation/content/anvils';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { grantXp } from '../src/simulation/progression';
import { previewRoundEconomy } from '../src/simulation/economy-preview';
import { readAugmentIncome } from '../src/simulation/augment-income';
import { accepted, emptyBoard, reachRound, resolveM5Choices, finish } from './match-helpers';
import { fieldedLegCases, fieldedRoute, offerFor, offeredAt, STAGE_SEEDS } from './augment-stage-helpers';
import type { MatchState } from '../src/simulation/match-types';
import { room, accept, conserved } from './tp-helpers';
import { runSharedMatchCommand } from '../src/simulation/shared-pool';

function batch1Seed(id:string):number {
 for(let seed=0;seed<5000;seed++){
  const s=createMatch(seed);
  if(generateChoices(augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),s.choiceRngState).offers.includes(id))return seed;
 }
 throw new Error(`No first-node seed for ${id}`);
}
function acquire(id:string) {
 // 14.24 stage tags: a card not offered at 2-1 is taken at its first offering round instead.
 const before=offeredAt(id,'2-1')?reachRound('2-1',false,batch1Seed(id)):offerFor(id),c=before.pendingChoice!;
 return {before,state:accepted(selectChoice(before,c.choiceId,c.generation,id))};
}
it('covers 69 classified entries, admits 67 fully implemented entries and leaves two out of the pool',()=>{
 expect(Object.keys(AUGMENT_BATCH1)).toHaveLength(67);expect(Object.keys(AUGMENT_BATCH1_BLOCKED)).toHaveLength(0);
 expect(Object.values(AUGMENT_BATCH1).filter(x=>x.apiName.endsWith('Crest'))).toHaveLength(22);
 expect(Object.values(AUGMENT_BATCH1).filter(x=>x.apiName.endsWith('Crown'))).toHaveLength(22);
 for(const api of Object.keys(AUGMENT_BATCH1_BLOCKED))expect(Object.values(AUGMENT_POOL_API_NAMES)).not.toContain(api);
});
it.each(Object.keys(AUGMENT_BATCH1))('%s validates executable grants and receipt authority',id=>{
 for(const effect of AUGMENT_DEFINITIONS[id].effects){expect(()=>validateEffect(effect)).not.toThrow();expect(cloneEffect(effect)).toEqual(effect);}
 const base=createMatch(42),s={...base,augments:[{definitionId:id,choiceId:'test',acquiredRound:1}]};
 const gifts=batch1GiftPlan(s);
 for(const gift of gifts)expect(gift.kind==='item'?ITEM_DEFINITIONS:gift.kind==='unit'?UNIT_DEFINITIONS:CONSUMABLE_DEFINITIONS).toHaveProperty(gift.definitionId);
 const after=drainBatch1Gifts(s);expect(drainBatch1Gifts(after)).toBe(after);expect(()=>validateBatch1Gifts(after)).not.toThrow();
 expect(after.rngState).toBe(s.rngState);expect(after.choiceRngState).toBe(s.choiceRngState);expect(after.rewardRngState).toBe(s.rewardRngState);
 if(gifts.length){const forged=structuredClone(after) as any;forged.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch1').definitionId='untrusted';expect(()=>validateBatch1Gifts(forged)).toThrow();}
});
it.each(Object.keys(AUGMENT_BATCH1).filter(id=>id.endsWith('-crest')||id.endsWith('-crown')))('%s uses existing trait tailoring, same-trait mutual exclusion and Built Different exclusion',id=>{
 const api=AUGMENT_POOL_API_NAMES[id],trait=ITEM_DEFINITIONS[AUGMENT_BATCH1[id].gifts[0].kind==='item'?(AUGMENT_BATCH1[id].gifts[0] as {definitionId:string}).definitionId:''].emblemTrait!;
 expect(api).toMatch(/Crest$|Crown$/);
 const matching={node:'3-2',fieldedTraits:[trait],blocked:[]},empty={...matching,fieldedTraits:[]};
 expect(augmentOfferAllowed(id,[],empty)).toBe(false);expect(augmentOfferAllowed(id,[],matching)).toBe(true);
 expect(augmentOfferAllowed(id,[{definitionId:'built-different',choiceId:'old',acquiredRound:1}],matching)).toBe(false);
 const other=id.replace(/-crest$|-crown$/,id.endsWith('-crest')?'-crown':'-crest');
 expect(augmentOfferAllowed(id,[{definitionId:other,choiceId:'old',acquiredRound:1}],matching)).toBe(false);
 expect(augmentOfferAllowed(id,[],{...matching,node:'2-1',fieldedTraits:[]})).toBe(!id.startsWith('black-rose-'));
});
it('source rewards keep the exceptional crest/crown counts and item identities',()=>{
 const gift=(id:string)=>batch1GiftPlan({...createMatch(42),augments:[{definitionId:id,choiceId:'test',acquiredRound:1}]});
 expect(gift('black-rose-crest').map(g=>g.kind)).toEqual(['item']);
 expect(gift('enforcer-crest').map(g=>g.kind)).toEqual(['item']);
 expect(gift('black-rose-crown').map(g=>g.definitionId)).toEqual(['TFT13_Item_CabalEmblemItem','shojin']);
 expect(gift('family-crown').map(g=>g.definitionId)).toEqual(['TFT13_Item_FamilyEmblemItem','redemption','vander','violet']);
 expect(gift('scrap-crown').map(g=>g.kind)).toEqual(['item','unit','item','item']);
 expect(gift('duo-queue').slice(2).map(g=>g.definitionId)[0]).toBe(gift('duo-queue')[3].definitionId);
 expect(gift('two-trick').map(g=>[UNIT_DEFINITIONS[g.definitionId].cost,g.starLevel])).toEqual([[2,2],[1,2],[1,2]]);
 expect(gift('build-a-bud').map(g=>[UNIT_DEFINITIONS[g.definitionId].cost,g.starLevel])).toEqual([[1,3]]);
 expect(gift('one-buff-two-buff').map(g=>g.definitionId)).toEqual(['red-buff','blue-buff','TFT_Consumable_NeekosHelp']);
});
it('full bench escrows all fourteen one-cost gifts and selling retries a stable plan',()=>{
 const base=createMatch(42),s:MatchState={...base,phase:'preparation',pendingChoice:null,combat:null,augments:[{definitionId:'missed-connections',choiceId:'test',acquiredRound:1}],nextUnitSerial:100,
  preparation:{...base.preparation,units:[...base.preparation.units.map(u=>({...u,starLevel:3 as const})),...Array.from({length:9},(_,i)=>({id:`b${i}`,definitionId:'lux',team:'player' as const,starLevel:3 as const,location:{kind:'bench' as const,slot:i}}))]}};
 expect(batch1GiftPlan(s)).toHaveLength(14);expect(drainBatch1Gifts(s)).toBe(s);
 const after=accepted(sellUnit(s,'b0')),r=after.seatMechanics!.receipts.find(r=>r.source==='augment-pool-batch1')!;
 expect(r).toMatchObject({kind:'unit',receiptId:batch1GiftPlan(s)[0].receiptId,definitionId:'amumu'});
 expect(drainBatch1Gifts(after)).toBe(after);
});
// Final Polish's first public offer is a fielded 4-2 route (STAGE_SEEDS); it is played in cached legs, one case each, so the
// acquisition case below stays inside the default timeout (offerFor resumes the same cached route).
it.each(fieldedLegCases('final-polish'))('Final Polish fielded 4-2 route (seed %s): the leg to %s settles every fight',(seed,leg)=>{
 expect(STAGE_SEEDS['final-polish']).toMatchObject({node:'4-2',fielded:true});expect(fieldedRoute(seed,leg).roundDefinitionId).toBe(leg);
});
let polishState:MatchState,polishAnvils:MatchState['preparation']['units'];
it('Final Polish grants exactly two bench anvils with the source birth order',()=>{
 let before=fieldedRoute(STAGE_SEEDS['final-polish'].seed,'4-1');
 while(before.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').length>before.preparation.benchSize-2){
  const unit=before.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&!isAnvil(u.definitionId))!;
  before=accepted(sellUnit(before,unit.id));
 }
 before=resolveM5Choices(finish(accepted(startMatchCombat(before))));
 before=accepted(nextRound(before,before.round));
 const rerolls=STAGE_SEEDS['final-polish'].rerolls;
 for(const slot of typeof rerolls==='number'?Array.from({length:rerolls},(_,i)=>i):rerolls??[]){const c=before.pendingChoice!;before=accepted(rerollAugment(before,c.choiceId,c.generation,slot));}
 expect(before.pendingChoice!.offers).toContain('final-polish');
 const choice=before.pendingChoice!,state=accepted(selectChoice(before,choice.choiceId,choice.generation,'final-polish')),anvils=state.preparation.units.filter(u=>isAnvil(u.definitionId)&&!before.preparation.units.some(old=>old.id===u.id));
 // Source gift birth order is support then completed; preparation is sorted by textual unit ID.
 // Derive the expected order from the before-state serial, including unit-9/unit-10 crossings.
 const expectedAnvils=[{id:`unit-${before.nextUnitSerial}`,definitionId:'TFT_ArmoryKeySupport'},
  {id:`unit-${before.nextUnitSerial+1}`,definitionId:'TFT_ArmoryKeyCompleted'}].sort((a,b)=>a.id<b.id?-1:1);
 expect(anvils.map(u=>u.definitionId)).toEqual(expectedAnvils.map(u=>u.definitionId));
 expect(anvils.map(u=>u.id)).toEqual(expectedAnvils.map(u=>u.id));
 polishState=state;polishAnvils=anvils;
});
for(const reverse of [false,true]){
 let s:MatchState;
 for(const index of [0,1])it(`Final Polish ${reverse?'reverse':'source'} opening ${index+1} restores and times out to its authenticated first option`,()=>{
   if(index===0)s=polishState;
   const unit=polishAnvils[reverse?1-index:index];
   const birth=s.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.unitId===unit.id)!;
   s=accepted(openAnvil(s,unit.id));const c=s.pendingChoice!;
   expect(c.offers).toEqual(augmentAnvilOffers(s.seed,birth.receiptId,unit.definitionId as 'TFT_ArmoryKeySupport'));
   expect(c.payload).toMatchObject({timeoutMs:30000});expect(restoreMatch(serializeMatch(s))).toEqual(s);
   const timeout=forfeitPendingChoice(s,s.round,c.choiceId,c.generation);if(!timeout.ok)throw new Error(timeout.reason);s=timeout.state;
   expect(s.items.at(-1)?.definitionId).toBe(c.offers[0]);expect(restoreMatch(serializeMatch(s))).toEqual(s);
   expect(openAnvil(s,unit.id)).toEqual({ok:false,state:s,reason:'unknown-unit'});
 });
}
it('Silver Spoon grants exactly ten XP, composes with purchased XP, restores across settlement, and respects level ten',()=>{
 const {before,state}=acquire('silver-spoon'),expected=grantXp(before.level,before.xp,10);
 expect([state.level,state.xp]).toEqual([expected.level,expected.xp]);expect(restoreMatch(serializeMatch(state))).toEqual(state);
 let s=accepted(buyXp(state));expect(restoreMatch(serializeMatch(s))).toEqual(s);
 s=resolveM5Choices(accepted(startMatchCombat(emptyBoard(s))));expect(restoreMatch(serializeMatch(s))).toEqual(s);
 s=accepted(nextRound(s,s.round));expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const capped={...before,level:10,xp:0},c=capped.pendingChoice!;
 const cap=accepted(selectChoice(capped,c.choiceId,c.generation,'silver-spoon'));expect([cap.level,cap.xp]).toEqual([10,0]);
});
it.each([['raining-gold',8],['raining-gold-plus',18]] as const)('%s pays immediate source gold and one deferred gold each round, with preview/restore agreement',(id,gold)=>{
 const {before,state}=acquire(id);expect(state.gold-before.gold).toBe(gold);expect(readAugmentIncome(state.augments).roundGold).toBe(1);
 expect(previewRoundEconomy(state)?.ifWin.base).toBe(6);
 let s=resolveM5Choices(accepted(startMatchCombat(emptyBoard(state))));
 expect(s.roundResults.at(-1)?.incomeBreakdown.base).toBe(6);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const held=s.gold,income=s.roundResults.at(-1)!.income-s.roundResults.at(-1)!.incomeBreakdown.win;
 s=accepted(nextRound(s,s.round));expect(s.gold).toBe(held+income);expect(restoreMatch(serializeMatch(s))).toEqual(s);
});
it('online two-star gifts enqueue reward orbs then claim through the conserved shared pool',()=>{
 const initial=room(undefined,2,42),seat=initial.states[0];
 const seeded={...seat,phase:'preparation' as const,pendingChoice:null,combat:null,augments:[{definitionId:'two-trick',choiceId:'test',acquiredRound:1}]};
 let s=drainBatch1Gifts(seeded);
 const receipts=s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch1');
 expect(receipts).toHaveLength(3);expect(receipts.every(r=>r.kind==='unit'&&r.resolution==='orb'&&r.starLevel===2)).toBe(true);
 expect(drainBatch1Gifts(s)).toBe(s);
 // Actual grant orbs use the same ledger path as the existing P2 gifts; no heroes are allocated before claim.
 expect(s.preparation.units).toEqual(seat.preparation.units);
 expect(s.m8.loot.rewardOrbs).toHaveLength(3);
 let pool=initial.pool;
 for(const orb of s.m8.loot.rewardOrbs??[]){
  const result=runSharedMatchCommand(pool,s,{type:'claimOrb',round:s.round,orbId:orb.orbId});
  const acceptedResult=accept(result);pool=acceptedResult.pool;s=acceptedResult.state;
 }
 expect(s.preparation.units.length-seat.preparation.units.length).toBe(3);
 conserved(pool,[s,initial.states[1]]);
});
it.each(['black-rose-crest','black-rose-crown'])('%s can be publicly selected at 3-2 and restores its board snapshot',id=>{
 let found:MatchState|undefined;
 // Pinned first successful searches; keep the pure second-node predicate and the real Morgana purchase checks.
 const traits=UNIT_DEFINITIONS.morgana.traits;
 const seed=id==='black-rose-crest'?42:599;
 {
  const initial=createMatch(seed),first=generateChoices(augmentCandidates(resolveAugmentTier(initial,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),initial.choiceRngState);
  const chosen=first.offers.find(x=>x!=='placebo'&&x!=='glass-cannon-i')!;
  const candidates=augmentCandidates(resolveAugmentTier(initial,'round:3-2:augment'),[{definitionId:chosen,choiceId:'round:2-1:augment',acquiredRound:4}],first.offers,null,{node:'3-2',fieldedTraits:traits,blocked:[]});
  expect(generateChoices(candidates,first.choiceRngState).offers).toContain(id);
  let s=reachRound('3-1',true,seed),hero=s.preparation.units.find(u=>u.team==='player'&&u.definitionId==='morgana');
  if(!hero){
   const slot=s.shop.slots.findIndex(x=>x.status==='available'&&x.definitionId==='morgana');
   expect(slot).toBeGreaterThanOrEqual(0);
   s=accepted(buyUnit(s,slot,s.shop.generation));hero=s.preparation.units.find(u=>u.team==='player'&&u.definitionId==='morgana');
  }
  expect(hero).toBeDefined();
  if(!hero)throw Error('pinned seed must buy Morgana');
  s=accepted(deployMatchUnit(s,hero.id,{kind:'board',cell:{col:0,row:7}}));
  s=accepted(startMatchCombat(s));while(s.phase==='combat')s=stepMatch(s).state;
  s=accepted(nextRound(resolveM5Choices(s),s.round));
  if(s.pendingChoice?.offers.includes(id))found=s;
 }
 expect(found).toBeDefined();const before=found!,c=before.pendingChoice!;
 const after=accepted(selectChoice(before,c.choiceId,c.generation,id));
 expect(after.augments.at(-1)?.definitionId).toBe(id);expect(restoreMatch(serializeMatch(after))).toEqual(after);
 const forged=structuredClone(after) as any;forged.augmentOffers.at(-1).fieldedTraits=[];
 expect(()=>restoreMatch(forged)).toThrow();
});

it('granted lesser duplicators can be consumed once and restore with their acquisition authority',()=>{
 let {state:s}=acquire('heroic-grab-bag');
 const tools=s.consumables.filter(c=>c.definitionId==='TFT_Consumable_ChampionDuplicator_III');expect(tools).toHaveLength(2);
 s=accepted(useConsumable(s,tools[0].consumableId,{kind:'unit',unitId:'unit-1'}));
 expect(s.consumables.filter(c=>c.definitionId==='TFT_Consumable_ChampionDuplicator_III')).toHaveLength(1);
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const before=s;const duplicate=useConsumable(s,tools[0].consumableId,{kind:'unit',unitId:'unit-1'});
 expect(duplicate.ok).toBe(false);expect(duplicate.state).toBe(before);
 const forged=structuredClone(s) as any;forged.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch1').definitionId='TFT_Consumable_NeekosHelp';
 expect(()=>restoreMatch(forged)).toThrow();
});
