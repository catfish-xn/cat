import { deferredRoundIncome } from '../src/simulation/deferred-income';
import { deriveTraits } from '../src/simulation/trait-snapshot';
import { TRAIT_DEFINITIONS } from '../src/simulation/content/traits';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { nextRound, selectChoice, startMatchCombat, stepMatch, buyUnit, buyXp, deployMatchUnit, getDeploymentCap, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { AUGMENT_BATCH5_H4 } from '../src/simulation/content/augment-pool-batch5-h4';
import { offeredAt } from './augment-stage-helpers';
import { accepted, emptyBoard, reachRound, resolveM5Choices } from './match-helpers';
const id='diversified-portfolio-plus';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(RESEARCH_FILE))('B5-33 source numbers',()=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((x:any)=>x.apiName===AUGMENT_BATCH5_H4[id].apiName);
 expect(source.effects).toEqual(AUGMENT_BATCH5_H4[id].values);
});
it('B5-33 offer, public selection, next natural round and authenticated restore',()=>{
 expect(['2-1','3-2','4-2'].filter(n=>offeredAt(id,n as '2-1'|'3-2'|'4-2'))).toEqual(['3-2']);
 let s=reachRound('3-2',false,17),c=s.pendingChoice!;expect(c.offers).toContain(id);
 const gold=s.gold;s=accepted(selectChoice(s,c.choiceId,c.generation,id));expect(s.gold).toBe(gold+4);
 s=resolveM5Choices(s);s=accepted(startMatchCombat(emptyBoard(s)));s=resolveM5Choices(s);s=accepted(nextRound(s,s.round));
 expect(s.augmentHistory!.facts.filter(f=>f.kind==='round-entry'&&f.round===s.round)).toHaveLength(1);
 for(const format of ['object','json','serialized'] as const){
  const input=(v:typeof s)=>format==='object'?v:format==='json'?JSON.stringify(v):serializeMatch(v);
  expect(restoreMatch(input(s))).toEqual(s);
  for(const edit of [(v:any)=>{v.augmentHistory.facts.find((f:any)=>f.kind==='round-entry').roster.items.push({id:'forged'});},(v:any)=>{delete v.augmentHistory;},(v:any)=>{v.gold++;}]){
   const bad=structuredClone(s);edit(bad);expect(()=>restoreMatch(input(bad))).toThrow();
  }
 }
});
let rewarded:MatchState;
it('B5-33 pays its first recurring gold from an actual three-trait board',()=>{
 let s=reachRound('3-2',false,17),c=s.pendingChoice!;
 s=accepted(selectChoice(s,c.choiceId,c.generation,id));s=resolveM5Choices(s);
 for(const slot of s.shop.slots){if(slot.status!=='available'||s.gold<2||s.preparation.units.some(u=>u.team==='player'&&u.definitionId===slot.definitionId))continue;
  const r=buyUnit(s,s.shop.slots.indexOf(slot),s.shop.generation);if(r.ok)s=r.state;}
 while(s.gold>=4&&getDeploymentCap(s)<5){const r=buyXp(s);if(!r.ok)break;s=r.state;}
 for(const u of s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench')){
  if(s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length>=getDeploymentCap(s))break;
  for(let col=0;col<7;col++){if(s.preparation.units.some(v=>v.team==='player'&&v.location.kind==='board'&&v.location.cell.col===col&&v.location.cell.row===4))continue;
   const r=deployMatchUnit(s,u.id,{kind:'board',cell:{col,row:4}});if(r.ok){s=r.state;break;}}
 }
 const active=deriveTraits(s.preparation,'player',TRAIT_DEFINITIONS,undefined,s.items).filter(t=>t.tier>0&&!(TRAIT_DEFINITIONS[t.traitId].tiers.length===1&&TRAIT_DEFINITIONS[t.traitId].tiers[0].threshold===1)).map(t=>t.traitId);
 expect(active).toEqual(['conqueror','sentinel','visionary']);
 s=accepted(startMatchCombat(s));while(s.phase==='combat')s=stepMatch(s).state;s=resolveM5Choices(s);
 const before=s,r=nextRound(s,s.round);s=accepted(r);
 expect(s.gold).toBe(before.gold+deferredRoundIncome(before.roundResults.at(-1)!)+1);
 expect(s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5-h4')).toMatchObject([{round:s.round,kind:'gold',amount:1}]);
 expect(r.ok&&r.events.some(e=>e.type==='mechanicGranted'&&e.receipt.source==='augment-pool-batch5-h4')).toBe(true);
 rewarded=s;
});

let serializedReward:string;
it('B5-33 serializes the real recurring reward',()=>{serializedReward=serializeMatch(rewarded);expect(typeof serializedReward).toBe('string');});
for(const format of ['object','json','serialized'] as const){
 const input=(v:MatchState)=>format==='object'?v:format==='serialized'&&v===rewarded?serializedReward:JSON.stringify(v);
 it(`B5-33 ${format} restores the real recurring reward`,()=>expect(restoreMatch(input(rewarded))).toEqual(rewarded));
 it(`B5-33 ${format} rejects a forged recurring reward`,()=>{
  const bad:any=structuredClone(rewarded);bad.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-h4').amount++;
  expect(()=>restoreMatch(input(bad))).toThrow();
 });
}
