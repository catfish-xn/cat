import { getUnitSellPrice } from '../src/simulation/unit-stats';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { describe,it,expect } from 'vitest';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_BATCH4_B4XP } from '../src/simulation/content/augment-pool-batch4-b4xp';
import { generateChoices } from '../src/simulation/choices';
import { createMatch,createCarouselMatch,deployMatchUnit,nextRound,rerollAugment,selectChoice,stepMatch,startMatchCombat } from '../src/simulation/match';
import { augmentTier,augmentPool,augmentDraw,validateAugmentReroll,openingEncounter } from './fixtures/m5/oracle.g2.cjs';
import { serializeMatch,restoreMatch } from '../src/simulation/serialization';
import { accepted,reachRound,resolveM5Choices,emptyBoard,freeze } from './match-helpers';
import { createSharedPool, initializeSharedSeat, refreshSharedShops, nextSharedRound, runSharedMatchCommand, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { captureAugmentHistoryAuthority } from '../src/simulation/augment-history';
import { canonicalContent } from '../src/simulation/content';
import { must } from './p7-carousel-helper';

/** Preserve this file's original 0..1000 real-RNG search (including the endpoint).
 * No cards need withB1Offers fallback in the current catalog, including the two
 * shared-carousel-only cards searched with their actual shared candidate pool. */
function firstOfferSeed(id:string,sharedCarousel=false):number {
  for(let seed=0;seed<=1000;seed++){
    // An unbenchable Trainer Golem blocks the solo route's empty-board helper.
    if(openingEncounter(seed)==='trainer-golems')continue;
    const draw=augmentDraw((seed^0x9e3779b9)>>>0,augmentTier(seed,'round:2-1:augment'),[],[],'round:2-1:augment',[],sharedCarousel);
    if(draw.offers.includes(id))return seed;
  }
  throw new Error(`No real 2-1 offer for ${id} in seeds 0..1000`);
}

/** Shared-carousel cards use real draws, the multiplayer transaction and restore boundary. */
function verifySharedCarouselAcquisition(id:string) {
  const seed=firstOfferSeed(id,true);
  let pool=createSharedPool('g2-shared-choice',seed,{seatCount:1});
  const initial=must(initializeSharedSeat(pool,createCarouselMatch(seed),'s0',0));pool=initial.pool;
  const first=must(refreshSharedShops(pool,[initial.state],1));pool=first.pool;let s=first.states[0];
  while(s.roundDefinitionId!=='2-1'){
   while(s.phase!=='settlement'){
    const c=s.pendingChoice;
    const command=c?{type:'timeoutChoice' as const,round:s.round,choiceId:c.choiceId,generation:c.generation}
     :{type:s.phase==='combat'?'step' as const:'startCombat' as const};
    const r=must(runSharedMatchCommand(pool,s,command));pool=r.pool;s=r.state;
   }
   const next=must(nextSharedRound(pool,[s],s.round));pool=next.pool;s=next.states[0];
  }
  const c=s.pendingChoice!;expect(c.offers).toContain(id);
  const invalid=runSharedMatchCommand(pool,s,{type:'choose',choiceId:c.choiceId,generation:c.generation+1,definitionId:id});
  expect(invalid).toEqual({ok:false,pool,state:s,reason:'stale-choice'});expect(invalid.state).toBe(s);
  const picked=must(runSharedMatchCommand(pool,s,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:id}));
  const after=picked.state,authority=captureAugmentHistoryAuthority(after);
  const gold=AUGMENT_DEFINITIONS[id].effects.reduce((sum,e)=>sum+(e.kind==='mechanic'&&e.mechanic==='acquisitionGold'?e.values.amount:0),0);
  expect(after.gold-s.gold).toBe(gold);expect(after.choiceRngState).toBe(s.choiceRngState);
  expect(after.scheduleReceipts.filter(r=>r.eventId===c.eventId)).toHaveLength(1);
  for(const input of [after,JSON.stringify(after),canonicalContent(after)])expect(restoreSharedOrbSnapshot(picked.pool,input,authority)).toEqual(after);
  const duplicate=runSharedMatchCommand(picked.pool,after,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:id});
  expect(duplicate.ok).toBe(false);expect(duplicate.state).toBe(after);expect('events' in duplicate).toBe(false);
  const forged=structuredClone(after),receipt=forged.scheduleReceipts.find(r=>r.eventId===c.eventId)!;
  Object.assign(receipt,{gold:receipt.gold+1});
  expect(()=>restoreSharedOrbSnapshot(picked.pool,forged,authority)).toThrow();
  // Online PvP is server-authoritative; a seat cannot start a local combat.
  const blocked=startMatchCombat(after);expect(blocked.ok).toBe(false);expect(blocked.state).toBe(after);
}

describe('W4, P1 and S13 P2 public choice and acquisition receipt',()=>{
 it.each([0,1,42,123456789,4294967295])('seed %i consumes exactly three independently calculated LCG words',seed=>{
  const ids=(['silver','gold','prismatic'] as const).flatMap(tier=>augmentPool(tier,[],[],null,[],true)).sort(),pool=[...ids];
  expect(Object.keys(AUGMENT_DEFINITIONS).sort()).toEqual(ids);let rng=BigInt(seed);
  for(let i=0;i<3;i++){rng=(rng*1664525n+1013904223n)%4294967296n;const j=i+Number(rng)% (pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}
  expect(ids).toHaveLength(306); // Full batch-5 catalog, including both shared-carousel-only cards.
  const ordinary=(['silver','gold','prismatic'] as const).flatMap(tier=>augmentPool(tier,[])).sort();
  expect(ordinary).toHaveLength(304);
  expect(ids.filter(id=>!ordinary.includes(id))).toEqual(['table-scraps','young-and-wild-and-free']);
  expect(generateChoices(ids,seed)).toEqual({offers:pool.slice(0,3),choiceRngState:Number(rng)});
 });
 // Only cards offered at 2-1 (14.24 stage tags, augment-stage-bans.ts) can be selected there.
// B4XP bench-XP cards (P-B4XP) make every later PvP settlement a historical claim, so their saves restore only with the
 // completed battles; tests/augment-pool-batch4-b4xp.test.ts covers their public selection and replayed restore.
it.each(Object.keys(AUGMENT_DEFINITIONS).filter(id=>!Object.hasOwn(AUGMENT_BATCH4_B4XP,id)).filter(id=>!((AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string,readonly string[]>>)[AUGMENT_POOL_API_NAMES[id]]??[]).includes('2-1')))('%s can be publicly selected and strictly restored from a fixed seed',id=>{
  if(id==='young-and-wild-and-free'||id==='table-scraps'){
    expect(augmentPool('silver',[])).not.toContain(id);
    expect(augmentPool('silver',[],[],null,[],true)).toContain(id);
    verifySharedCarouselAcquisition(id);
    return;
  }
  const selectedSeed=firstOfferSeed(id);
  expect(selectedSeed).toBeGreaterThanOrEqual(0);expect(selectedSeed).toBeLessThanOrEqual(1000);
  const state=reachRound('2-1',false,selectedSeed),choice=state.pendingChoice!;
  expect(choice.offers).toContain(id);
  const invalid=selectChoice(state,choice.choiceId,choice.generation+1,id);expect(invalid.ok).toBe(false);expect(invalid.state).toBe(state);expect("events" in invalid).toBe(false);
  const gold=AUGMENT_DEFINITIONS[id].effects.reduce((sum,e)=>sum+(e.kind==='mechanic'&&e.mechanic==='acquisitionGold'?e.values.amount:0),0);
  const result=selectChoice(state,choice.choiceId,choice.generation,id),after=accepted(result);
  const saleGold=id==='head-start'?state.preparation.units.filter(u=>u.team==='player').reduce((sum,u)=>sum+getUnitSellPrice(u),0):0;
  expect(after.gold-state.gold).toBe(gold+saleGold);expect(after.choiceRngState).toBe(state.choiceRngState);
  expect(after.scheduleReceipts.filter(r=>r.eventId===choice.eventId)).toHaveLength(1);
  expect(restoreMatch(serializeMatch(after))).toEqual(after);
  const duplicate=selectChoice(after,choice.choiceId,choice.generation,id);expect(duplicate.ok).toBe(false);expect(duplicate.state).toBe(after);expect("events" in duplicate).toBe(false);
  const forged=JSON.parse(serializeMatch(after));forged.scheduleReceipts.find((r:{eventId:string})=>r.eventId===choice.eventId).gold++;
  expect(()=>restoreMatch(forged)).toThrow();
  if(after.pendingChoice){const blocked=startMatchCombat(after);expect(blocked.ok).toBe(false);expect(blocked.state).toBe(after);}
  let preparation=resolveM5Choices(after);
  // Blood Brothers and Pilfer authenticate settled combat facts. Keep acquisition checks in a live battle.
  if(id==='blood-brothers'||id==='pilfer'){const hero=preparation.preparation.units.find(u=>u.team==='player')!;preparation=accepted(deployMatchUnit(preparation,hero.id,{kind:'board',cell:{col:3,row:4}}));}
  const started=accepted(startMatchCombat(preparation));if(id==='blood-brothers'||id==='pilfer')expect(started.phase).toBe('combat');expect(restoreMatch(serializeMatch(started))).toEqual(started);
  let live=started;for(let i=0;i<3&&live.phase==='combat';i++)live=stepMatch(live).state;
  expect(restoreMatch(serializeMatch(live))).toEqual(live);
 });
});

describe('independent augment card-reroll oracle',()=>{
 it.each([0,1,42,123456789,4294967295])('strictly checks tier, three words, free reroll and failures for seed %i',seed=>{
  const state=freeze(reachRound('2-1',false,seed)),c=state.pendingChoice!,tier=augmentTier(seed,c.choiceId);
  const draw=augmentDraw((seed^0x9e3779b9)>>>0,tier,[],[],'round:2-1:augment');
  expect(c).toMatchObject({offers:draw.offers,augmentTier:tier,rerollCount:0,generation:0,rerollsRemaining:3,rerolledSlots:[false,false,false]});
  expect(state.choiceRngState).toBe(draw.rng);
  const command={type:'rerollAugment',choiceId:c.choiceId,generation:0,optionIndex:1},result=rerollAugment(state,c.choiceId,0,1);
  validateAugmentReroll(state,result,command);
  const after=accepted(result);
  for(const [before,cmd] of [
   [createMatch(seed),command],
   [state,{...command,choiceId:'wrong'}],
   [after,command],
   [after,{...command,generation:1}],
  ] as const)validateAugmentReroll(freeze(before),rerollAugment(before,cmd.choiceId,cmd.generation,cmd.optionIndex),cmd);
  // Explicit shortage boundary, as in the domain tests; no ordinary acquisition claim.
  const short={...state,augments:augmentPool(tier,[],c.offers).map((definitionId:string)=>({definitionId,choiceId:'prior',acquiredRound:1}))};
  validateAugmentReroll(freeze(short),rerollAugment(short,c.choiceId,0,1),command);
  // A matching implementation bug must still fail the independent expected state/event.
  expect(()=>validateAugmentReroll(state,{...result,state:{...after,gold:after.gold+1}},command)).toThrow();
  expect(()=>validateAugmentReroll(state,{...result,state:{...after,choiceRngState:state.choiceRngState}},command)).toThrow();
  expect(()=>validateAugmentReroll(state,{...result,state:{...after,pendingChoice:{...after.pendingChoice,offers:c.offers}}},command)).toThrow();
 });
 it('independently checks owned exclusion and the next node reset after exhausting an earlier node',()=>{
  let state=reachRound('2-1',false),c=state.pendingChoice!;
  state=accepted(rerollAugment(state,c.choiceId,c.generation,2));
  const rng=state.choiceRngState;
  while(state.roundDefinitionId!=='3-2'){
   state=resolveM5Choices(state);
   if(state.phase==='preparation')state=accepted(startMatchCombat(emptyBoard(state)));
   state=resolveM5Choices(state);
   state=accepted(nextRound(state,state.round));
  }
  c=state.pendingChoice!;
  const tier=augmentTier(state.seed,c.choiceId),draw=augmentDraw(rng,tier,state.augments,state.removedAugmentIds.slice(0,-3),c.choiceId,state.augmentOffers.at(-1)!.fieldedTraits); // v22: the opened three join the seen ledger
  expect(c).toMatchObject({offers:draw.offers,augmentTier:tier,generation:0,rerollCount:0,rerollsRemaining:3,rerolledSlots:[false,false,false]});
  expect(state.choiceRngState).toBe(draw.rng);
  expect(state.augmentOffers.map(r=>r.rerollCount)).toEqual([1,0]);
  expect(c.offers.some(id=>state.augments.some(a=>a.definitionId===id))).toBe(false);
  validateAugmentReroll(freeze(state),rerollAugment(state,c.choiceId,0,0),{type:'rerollAugment',choiceId:c.choiceId,generation:0,optionIndex:0});
 });
 it('refuses unknown nodes instead of deriving another independent tier sample',()=>{
  expect(()=>augmentTier(42,'round:\ud83d\ude00:augment')).toThrow('Unknown augment tier node');
 });
});
