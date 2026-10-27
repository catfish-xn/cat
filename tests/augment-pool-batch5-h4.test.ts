import { augmentCandidates } from '../src/simulation/augment-offers';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { nextRound, selectChoice, startMatchCombat } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { AUGMENT_BATCH5_H4 } from '../src/simulation/content/augment-pool-batch5-h4';
import { offeredAt, firstNodeSeed } from './augment-stage-helpers';
import { accepted, emptyBoard, reachRound, resolveM5Choices } from './match-helpers';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
const id='diversified-portfolio';
it.skipIf(!existsSync(RESEARCH_FILE))('B5-32 source numbers',()=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((x:any)=>x.apiName===AUGMENT_BATCH5_H4[id].apiName);
 expect(source.effects).toEqual(AUGMENT_BATCH5_H4[id].values);
});
it('B5-32 offer nodes, public selection and next natural round, restore and tamper rejection',()=>{
 expect(['2-1','3-2','4-2'].filter(n=>offeredAt(id,n as '2-1'|'3-2'|'4-2'))).toEqual(['2-1']);
 let s=reachRound('2-1',false,firstNodeSeed(id,101)),c=s.pendingChoice!;
 const gold=s.gold;s=accepted(selectChoice(s,c.choiceId,c.generation,id));expect(s.gold).toBe(gold+1);
 s=resolveM5Choices(s);s=accepted(startMatchCombat(emptyBoard(s)));s=resolveM5Choices(s);s=accepted(nextRound(s,s.round));
 expect(s.augmentHistory!.facts.filter(f=>f.kind==='round-entry'&&f.round===s.round)).toHaveLength(1);
 for(const format of ['object','json','serialized'] as const){
  const input=(v:typeof s)=>format==='object'?v:format==='json'?JSON.stringify(v):serializeMatch(v);
  expect(restoreMatch(input(s))).toEqual(s);
  for(const edit of [(v:any)=>{v.augmentHistory.facts.find((f:any)=>f.kind==='round-entry').roster.units=[];},(v:any)=>{delete v.augmentHistory;},(v:any)=>{v.gold++;}]){
   const bad=structuredClone(s);edit(bad);expect(()=>restoreMatch(input(bad))).toThrow();
  }
 }
});

it('portfolio variants and Built Different are mutually exclusive',()=>{
 for(const [owned,rejected] of [['diversified-portfolio','diversified-portfolio-plus'],['diversified-portfolio-plus','diversified-portfolio'],['built-different','diversified-portfolio'],['built-different','diversified-portfolio-plus']] as const){
  expect(augmentCandidates('silver',[{definitionId:owned,choiceId:'test',acquiredRound:1}])).not.toContain(rejected);
 }
});
