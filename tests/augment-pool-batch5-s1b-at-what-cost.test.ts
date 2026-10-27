import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_S1B } from '../src/simulation/content/augment-pool-batch5-s1b';
import { atWhatCostGrant } from '../src/simulation/augment-pool-batch5-s1b';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { grantXp } from '../src/simulation/progression';
import { createMatch, nextRound, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { accepted, fieldBench, resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';

it.skipIf(!existsSync(RESEARCH_FILE))('At What Cost source values',()=>{
 const row=AUGMENT_BATCH5_S1B['at-what-cost'];const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((x:any)=>x.apiName===row.apiName);
 expect(row.source.values).toEqual(source.effects);expect(row.tier).toBe(['silver','gold','prismatic'][source.tier-1]);
});
it('offers only at 2-1 and keeps levels at and above six',()=>{
 for(const node of ['2-1','3-2','4-2']){const f={node,fieldedTraits:[],blocked:[]};expect(augmentOfferAllowed('at-what-cost',[],f)).toBe(node==='2-1');expect(augmentCandidates('prismatic',[],[],null,f).includes('at-what-cost')).toBe(node==='2-1');}
 for(const [level,xp] of [[3,1],[6,0],[7,3],[10,0]]){const result=grantXp(level,xp,atWhatCostGrant(level,xp));const expected=level<6?grantXp(6,0,4):grantXp(level,xp,4);expect([result.level,result.xp]).toEqual([expected.level,expected.xp]);}
});
let state:MatchState;
for(const stop of ['1-2','1-3','2-1'])it(`public route to ${stop}`,()=>{
 state ??= createMatch(firstNodeSeed('at-what-cost',101));
 while(state.roundDefinitionId!==stop){state=resolveM5Choices(state);if(state.phase==='preparation'){state=accepted(startMatchCombat(fieldBench(state)));while(state.phase==='combat')state=stepMatch(state).state;}state=resolveM5Choices(state);state=accepted(nextRound(state,state.round));}
});
it('real selection reaches level six plus four XP and authenticates the acquisition',()=>{
 const choice=state.pendingChoice!,before=state;state=accepted(selectChoice(state,choice.choiceId,choice.generation,'at-what-cost'));
 expect([state.level,state.xp]).toEqual([6,4]);expect(state.gold).toBe(before.gold);
 const text=serializeMatch(state);expect(restoreMatch(text)).toEqual(state);expect(restoreMatch(JSON.parse(text))).toEqual(state);expect(restoreMatch(structuredClone(state))).toEqual(state);
 for(const mutate of [(x:any)=>{x.xp++;},(x:any)=>{x.shopHistory.initial.xp++;},(x:any)=>{delete x.shopHistory;},(x:any)=>{x.scheduleReceipts.find((r:any)=>r.definitionId==='at-what-cost').gold=1;}]){
  const x=JSON.parse(text);mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();
 }
});
for(const stop of ['2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2','3-3','3-4','3-5','3-6','3-7','4-1','4-2'])it(`public route to ${stop}`,()=>{
 while(state.roundDefinitionId!==stop){state=resolveM5Choices(state);if(state.phase==='preparation'){state=accepted(startMatchCombat(fieldBench(state)));while(state.phase==='combat')state=stepMatch(state).state;}state=resolveM5Choices(state);state=accepted(nextRound(state,state.round));}
 if(stop==='3-2'||stop==='4-2'){
  expect(state.pendingChoice?.kind).not.toBe('augment');expect(state.augmentOffers).toHaveLength(1);expect(state.augments).toHaveLength(1);
  const text=serializeMatch(state);expect(restoreMatch(text)).toEqual(state);
  const forged=JSON.parse(text);forged.augmentOffers.push({...forged.augmentOffers[0],choiceId:`round:${stop}:augment`});
  expect(()=>restoreMatch(forged)).toThrow();expect(()=>restoreMatch(JSON.stringify(forged))).toThrow();expect(()=>serializeMatch(forged)).toThrow();
 }
});
