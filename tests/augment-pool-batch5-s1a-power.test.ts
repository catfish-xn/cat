import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_S1A } from '../src/simulation/content/augment-pool-batch5-s1a';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed, deriveAugmentTier, resolveAugmentTier, augmentCandidates, drawAugmentCard } from '../src/simulation/augment-offers';
import { promoteNextAugmentTier } from '../src/simulation/augment-pool-batch5-s1a';
import { createMatch, nextRound, rerollAugment, selectChoice, startMatchCombat } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, reachRound, resolveM5Choices } from './match-helpers';
import { generateChoices } from '../src/simulation/choices';
import { validateAugmentReroll } from './fixtures/m5/oracle.g2.cjs';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
const id='power-up';
it.skipIf(!existsSync(RESEARCH_FILE))('B5-02 transcribes the 14.24 source',()=>{
 const row=AUGMENT_BATCH5_S1A[id], source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((x:any)=>x.apiName===row.apiName);
 expect(row.source.values).toEqual(source.effects);expect(row.description).toBe(source.description_zh_cn);expect(row.name).toBe(source.name_zh_cn);
});
it('B5-02 promotes silver to gold, gold to prismatic, caps prismatic, and consumes on next choice',()=>{
 const power={definitionId:id,choiceId:'round:2-1:augment',acquiredRound:4};
 for(const [tier,expected] of [['silver','gold'],['gold','prismatic'],['prismatic','prismatic']] as const)
  expect(promoteNextAugmentTier(tier,[power],'round:3-2:augment')).toBe(expected);
 expect(promoteNextAugmentTier('silver',[power],'round:2-1:augment')).toBe('silver');
 expect(promoteNextAugmentTier('silver',[power,{definitionId:'x',choiceId:'round:3-2:augment',acquiredRound:10}],'round:4-2:augment')).toBe('silver');
 expect(promoteNextAugmentTier('silver',[power],'round:4-2:augment')).toBe('gold');
});
it('B5-02 nodes, actual next offer and reroll tier, authenticated restore and consumption',()=>{
 for(const node of ['2-1','3-2','4-2'])expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(node!=='4-2');
 let found: {seed:number; rolls:number}|undefined;
 for(let seed=0;seed<=100&&!found;seed++){
  const root=createMatch(seed),tier=resolveAugmentTier(root,'round:2-1:augment'),filter={node:'2-1',fieldedTraits:[],blocked:[]};
  const first=generateChoices(augmentCandidates(tier,[],[],null,filter),root.choiceRngState), offers=[...first.offers],removed=[...offers];let rng=first.choiceRngState;
  if(offers.includes(id)){found={seed,rolls:0};break;}
  for(let slot=0;slot<3;slot++){const draw=drawAugmentCard(augmentCandidates(tier,[],[...removed,...offers],null,filter),rng);rng=draw.choiceRngState;offers[slot]=draw.definitionId;removed.push(draw.definitionId);if(draw.definitionId===id){found={seed,rolls:slot+1};break;}}
 }
 expect(found).toBeDefined();const {seed,rolls}=found!;let open=reachRound('2-1',false,seed);
 for(let slot=0;slot<rolls;slot++){const c=open.pendingChoice!;open=accepted(rerollAugment(open,c.choiceId,c.generation,slot));}
 const c=open.pendingChoice!;expect(c.offers).toContain(id);let state=accepted(selectChoice(open,c.choiceId,c.generation,id));
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 while(state.roundDefinitionId!=='3-2'){
  state=resolveM5Choices(state);if(state.phase==='preparation')state=accepted(startMatchCombat(emptyBoard(state)));
  state=resolveM5Choices(state);state=accepted(nextRound(state,state.round));
 }
 const base=deriveAugmentTier(seed,'round:3-2:augment'),tier=resolveAugmentTier(state,'round:3-2:augment');
 expect(tier).toBe(base==='silver'?'gold':'prismatic');expect(state.pendingChoice!.augmentTier).toBe(tier);
 expect(state.pendingChoice!.offers.every(x=>AUGMENT_TIERS[x]===tier)).toBe(true);
 const pending=state.pendingChoice!,command={type:'rerollAugment',choiceId:pending.choiceId,generation:pending.generation,optionIndex:0},result=rerollAugment(state,pending.choiceId,pending.generation,0);
 validateAugmentReroll(state,result,command);state=accepted(result);
 expect(state.pendingChoice!.offers.every(x=>AUGMENT_TIERS[x]===tier)).toBe(true);
 const saved=serializeMatch(state);expect(restoreMatch(saved)).toEqual(state);expect(restoreMatch(JSON.parse(saved))).toEqual(state);expect(restoreMatch(state)).toEqual(state);
 for(const mutate of [(x:any)=>x.augmentOffers[1].tier=base,(x:any)=>x.pendingChoice.augmentTier=base,(x:any)=>x.augments[0].definitionId='placebo']){
  const forged=JSON.parse(saved);mutate(forged);expect(()=>restoreMatch(forged)).toThrow();expect(()=>restoreMatch(JSON.stringify(forged))).toThrow();expect(()=>serializeMatch(forged)).toThrow();
 }
 const next=state.pendingChoice!;state=accepted(selectChoice(state,next.choiceId,next.generation,next.offers[0]));
 expect(resolveAugmentTier(state,'round:4-2:augment')).toBe(deriveAugmentTier(seed,'round:4-2:augment'));
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
});
