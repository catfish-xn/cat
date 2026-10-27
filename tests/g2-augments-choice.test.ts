import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { describe,it,expect } from 'vitest';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_BATCH4_B4XP } from '../src/simulation/content/augment-pool-batch4-b4xp';
import { generateChoices } from '../src/simulation/choices';
import { createMatch,deployMatchUnit,nextRound,rerollAugment,selectChoice,stepMatch,startMatchCombat } from '../src/simulation/match';
import { augmentTier,augmentPool,augmentDraw,validateAugmentReroll,openingEncounter } from './fixtures/m5/oracle.g2.cjs';
import { serializeMatch,restoreMatch } from '../src/simulation/serialization';
import { accepted,reachRound,resolveM5Choices,emptyBoard,freeze } from './match-helpers';

describe('W4, P1 and S13 P2 public choice and acquisition receipt',()=>{
 it.each([0,1,42,123456789,4294967295])('seed %i consumes exactly three independently calculated LCG words',seed=>{
  const ids=(['silver','gold','prismatic'] as const).flatMap(tier=>augmentPool(tier,[],[],null,[],true)).sort(),pool=[...ids];
  expect(Object.keys(AUGMENT_DEFINITIONS).sort()).toEqual(ids);let rng=BigInt(seed);
  for(let i=0;i<3;i++){rng=(rng*1664525n+1013904223n)%4294967296n;const j=i+Number(rng)% (pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}
  expect(ids).toHaveLength(283); // Integrated catalog, including shared-carousel augments and Shop Glitch.
  expect(generateChoices(ids,seed)).toEqual({offers:pool.slice(0,3),choiceRngState:Number(rng)});
 });
 // Only cards offered at 2-1 (14.24 stage tags, augment-stage-bans.ts) can be selected there.
// B4XP bench-XP cards (P-B4XP) make every later PvP settlement a historical claim, so their saves restore only with the
 // completed battles; tests/augment-pool-batch4-b4xp.test.ts covers their public selection and replayed restore.
it.each(Object.keys(AUGMENT_DEFINITIONS).filter(id=>!Object.hasOwn(AUGMENT_BATCH4_B4XP,id)).filter(id=>!((AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string,readonly string[]>>)[AUGMENT_POOL_API_NAMES[id]]??[]).includes('2-1')))('%s can be publicly selected and strictly restored from a fixed seed',id=>{
  if(id==='young-and-wild-and-free'){
    expect(augmentPool('silver',[])).not.toContain(id);
    expect(augmentPool('silver',[],[],null,[],true)).toContain(id);
    return;
  }
  // Search the independent first-node offer oracle, then play only the chosen
  // public route. The expanded pool puts Portable Forge at seed 236; replaying
  // three opening combats for every candidate needlessly hits CI time limits.
  let selectedSeed=-1;
  // v23: skip Trainer Golem openings; the unbenchable golem blocks this route's empty-board helper.
  for(let seed=0;seed<1000;seed++){if(openingEncounter(seed)==='trainer-golems')continue;const draw=augmentDraw((seed^0x9e3779b9)>>>0,augmentTier(seed,'round:2-1:augment'),[],[],'round:2-1:augment');if(draw.offers.includes(id)){selectedSeed=seed;break;}}
  expect(selectedSeed).toBeGreaterThanOrEqual(0);const state=reachRound('2-1',false,selectedSeed),choice=state.pendingChoice!;
  expect(choice.offers).toContain(id);
  const invalid=selectChoice(state,choice.choiceId,choice.generation+1,id);expect(invalid.ok).toBe(false);expect(invalid.state).toBe(state);expect("events" in invalid).toBe(false);
  const gold=AUGMENT_DEFINITIONS[id].effects.reduce((sum,e)=>sum+(e.kind==='mechanic'&&e.mechanic==='acquisitionGold'?e.values.amount:0),0);
  const result=selectChoice(state,choice.choiceId,choice.generation,id),after=accepted(result);
  expect(after.gold-state.gold).toBe(gold);expect(after.choiceRngState).toBe(state.choiceRngState);
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
