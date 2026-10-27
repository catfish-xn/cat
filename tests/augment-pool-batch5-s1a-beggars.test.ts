import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_S1A } from '../src/simulation/content/augment-pool-batch5-s1a';
import { augmentOfferAllowed, augmentOptionViews } from '../src/simulation/augment-offers';
import { nextRound, rerollAugment, selectChoice, startMatchCombat } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, reachRound, resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { validateAugmentReroll } from './fixtures/m5/oracle.g2.cjs';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
const id='beggars-can-be-choosers';
it.skipIf(!existsSync(RESEARCH_FILE))('B5-01 transcribes the 14.24 source',()=>{
 const row=AUGMENT_BATCH5_S1A[id], source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((x:any)=>x.apiName===row.apiName);
 expect(row.source.values).toEqual(source.effects);expect(row.description).toBe(source.description_zh_cn);expect(row.name).toBe(source.name_zh_cn);
});
it('B5-01 nodes and public rerolls: three shared extras after acquisition, base slot first, restore rejects tampering',()=>{
 for(const node of ['2-1','3-2','4-2'])expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='2-1');
 const seed=firstNodeSeed(id,101),open=reachRound('2-1',false,seed),first=open.pendingChoice!;
 expect(first.offers).toContain(id);expect(first.rerollsRemaining).toBe(3);
 let state=accepted(selectChoice(open,first.choiceId,first.generation,id));expect(state.gold-open.gold).toBe(7);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 while(state.roundDefinitionId!=='3-2'){
  state=resolveM5Choices(state);if(state.phase==='preparation')state=accepted(startMatchCombat(emptyBoard(state)));
  state=resolveM5Choices(state);state=accepted(nextRound(state,state.round));
 }
 expect(state.pendingChoice!.rerollsRemaining).toBe(6);
 for(const [index,slot] of [0,0,0,0,1,2].entries()){
  const c=state.pendingChoice!;expect(augmentOptionViews(state)[slot].rerollAvailable).toBe(true);
  const command={type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot};const result=rerollAugment(state,c.choiceId,c.generation,slot);
  validateAugmentReroll(state,result,command);state=accepted(result);expect(state.pendingChoice!.rerollsRemaining).toBe(5-index);
  const saved=serializeMatch(state);expect(restoreMatch(saved)).toEqual(state);expect(restoreMatch(JSON.parse(saved))).toEqual(state);expect(restoreMatch(state)).toEqual(state);
 }
 const c=state.pendingChoice!;expect(augmentOptionViews(state).every(v=>!v.rerollAvailable)).toBe(true);
 const failed=rerollAugment(state,c.choiceId,c.generation,0);expect(failed.ok).toBe(false);expect(failed.state).toBe(state);
 for(const mutate of [(x:any)=>x.augmentOffers[1].rerolledIndices[1]=3,(x:any)=>x.pendingChoice.rerollsRemaining++, (x:any)=>x.augmentOffers[1].rerollCount--, (x:any)=>x.scheduleReceipts.find((r:any)=>r.definitionId===id).gold++]){
  const forged=JSON.parse(serializeMatch(state));mutate(forged);
  expect(()=>restoreMatch(forged)).toThrow();expect(()=>restoreMatch(JSON.stringify(forged))).toThrow();expect(()=>serializeMatch(forged)).toThrow();
 }
});
