import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { describe,it,expect } from 'vitest';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { generateChoices } from '../src/simulation/choices';
import { createMatch,nextRound,rerollAugment,selectChoice,stepMatch,startMatchCombat } from '../src/simulation/match';
import { augmentTier,augmentPool,augmentDraw,validateAugmentReroll } from './fixtures/m5/oracle.g2.cjs';
import { serializeMatch,restoreMatch } from '../src/simulation/serialization';
import { accepted,reachRound,resolveM5Choices,emptyBoard,freeze } from './match-helpers';

describe('W4, P1 and S13 P2 public choice and acquisition receipt',()=>{
 it.each([0,1,42,123456789,4294967295])('seed %i consumes exactly three independently calculated LCG words',seed=>{
  const ids=(['silver','gold','prismatic'] as const).flatMap(tier=>augmentPool(tier,[])).sort(),pool=[...ids];
  expect(Object.keys(AUGMENT_DEFINITIONS).sort()).toEqual(ids);let rng=BigInt(seed);
  for(let i=0;i<3;i++){rng=(rng*1664525n+1013904223n)%4294967296n;const j=i+Number(rng)% (pool.length-i);[pool[i],pool[j]]=[pool[j],pool[i]];}
  expect(ids).toHaveLength(206);expect(generateChoices(ids,seed)).toEqual({offers:pool.slice(0,3),choiceRngState:Number(rng)});
 });
 // Only cards offered at 2-1 (14.24 stage tags, augment-stage-bans.ts) can be selected there.
it.each(Object.keys(AUGMENT_DEFINITIONS).filter(id=>!((AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string,readonly string[]>>)[AUGMENT_POOL_API_NAMES[id]]??[]).includes('2-1')))('%s can be publicly selected and strictly restored from a fixed seed',id=>{
  // Search the independent first-node offer oracle, then play only the chosen
  // public route. The expanded pool puts Portable Forge at seed 236; replaying
  // three opening combats for every candidate needlessly hits CI time limits.
  // v23 batch 3: skip seeds whose opening (e.g. the trainer golem, which cannot be benched) the empty-board helper cannot route.
  let selectedSeed=-1,found:ReturnType<typeof reachRound>|undefined;
  for(let seed=0;seed<1000;seed++){const draw=augmentDraw((seed^0x9e3779b9)>>>0,augmentTier(seed,'round:2-1:augment'),[],[],'round:2-1:augment');if(!draw.offers.includes(id))continue;try{found=reachRound('2-1',false,seed);}catch{continue;}selectedSeed=seed;break;}
  expect(selectedSeed).toBeGreaterThanOrEqual(0);const state=found!,choice=state.pendingChoice!;
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
  const started=accepted(startMatchCombat(resolveM5Choices(after)));expect(restoreMatch(serializeMatch(started))).toEqual(started);
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
