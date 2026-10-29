import { existsSync, readFileSync } from 'node:fs';
import { H12_MAX_CAP_SEED } from './augment-stage-helpers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { AUGMENT_BATCH5_H12 } from '../src/simulation/content/augment-pool-batch5-h12';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { createMatch, buyXp, sellUnit, nextRound, startMatchCombat, stepMatch, selectChoice, rerollAugment, type MatchState, getDeploymentCap } from '../src/simulation/match';
import { augmentLevelCap } from '../src/simulation/augment-pool-batch5-h12-progression';
import { grantXp } from '../src/simulation/progression';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, fieldBench, resolveM5Choices, emptyBoard } from './match-helpers';
import { RESEARCH_FILE, trip, reject } from './augment-pool-batch5-h12-helpers';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';

it('B5-84 only offers at 4-2, filters level 8+ and excludes Level Up in both directions',()=>{
 expect(AUGMENT_TIERS['max-cap']).toBe('prismatic');
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('max-cap',[],{node,fieldedTraits:[],blocked:[],level:7})).toBe(node==='4-2');
  expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes('max-cap')).toBe(node==='4-2');
 }
 for(const level of [8,9,10])expect(augmentCandidates('prismatic',[],[],null,{node:'4-2',fieldedTraits:[],blocked:[],level})).not.toContain('max-cap');
 for(const [id,other] of [['max-cap','level-up'],['level-up','max-cap']])expect(augmentOfferAllowed(id,[{definitionId:other,choiceId:'owned',acquiredRound:4}])).toBe(false);
});
it.skipIf(!existsSync(RESEARCH_FILE))('B5-84 preserves the 60 gold / 1 shield source and literal cap 7',()=>{
 const raw=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_MaxCap');
 expect(AUGMENT_BATCH5_H12['max-cap'].source.values).toEqual(raw.effects);
 expect(AUGMENT_BATCH5_H12['max-cap'].description).toBe(raw.description_zh_cn);
 expect(raw.description_en_us).toContain('max level is 7');
});
it('B5-84 progression truncates overflow once and rejects already non-normalized cap XP',()=>{
 expect(grantXp(6,35,100,7)).toEqual({level:7,xp:0,xpRequested:100,xpApplied:1,levelsGained:1});
 expect(grantXp(7,0,100,7)).toMatchObject({level:7,xp:0,xpApplied:0,xpRequested:100});
 expect(()=>grantXp(7,1,0,7)).toThrow();
});
function smallEmptyBoard(state:MatchState):MatchState {
 for(let i=0;state.preparation.units.filter(u=>u.team==='player').length>9&&i<32;i++)state=accepted(sellUnit(state,state.preparation.units.find(u=>u.team==='player'&&!u.definitionId.startsWith('TFT_Armory'))!.id));
 return emptyBoard(state);
}
describe('B5-84 real solo trajectory',()=>{
 let prior:MatchState,state:MatchState,open:MatchState,chosen:MatchState,capped:MatchState;
 let restoreOffers:()=>void;
 beforeAll(()=>{restoreOffers=installB1Offers(['max-cap']);});
 afterAll(()=>restoreOffers());
 // The target is injected only into its real eligible 4-2 pool; offer containment below is fixture self-checking, not an RNG claim.
 beforeAll(()=>{state=createMatch(H12_MAX_CAP_SEED);});
 // Bounded route, split at natural checkpoints; do not raise any timeout.
 for(const target of ['2-1','2-4','3-1','3-2','3-5','4-1','4-2'])beforeAll(()=>{
  while(state.roundDefinitionId!==target){
   state=resolveM5Choices(state,['worth-the-wait-ii','clockwork-accelerator']);
   if(state.phase==='preparation'){state=accepted(startMatchCombat(fieldBench(state)));while(state.phase==='combat')state=stepMatch(state).state;}
   state=resolveM5Choices(state);state=accepted(nextRound(state,state.round));
  }
  // A legal existing checkpoint bounds subsequent command replay, without editing state or resources.
  if(target==='4-1'){state=restoreMatch(serializeMatch(state));prior=state;}
 });
 beforeAll(()=>{
  open=state;
  for(let slot=0;slot<3&&!open.pendingChoice!.offers.includes('max-cap');slot++){const c=open.pendingChoice!;open=accepted(rerollAugment(open,c.choiceId,c.generation,slot));}
  const c=open.pendingChoice!;expect(c.offers,JSON.stringify({owned:open.augments,history:open.augmentOffers,removed:open.removedAugmentIds})).toContain('max-cap');chosen=accepted(selectChoice(open,c.choiceId,c.generation,'max-cap'));
 });
 it('pays 60 gold, grants the correct shield (+1 population), authenticates offer levels and cannot repeat',()=>{
  expect(chosen.gold-open.gold).toBe(60);expect(chosen.items.filter(i=>i.definitionId==='TFT_Item_TacticiansScepter')).toHaveLength(1);
  expect(getDeploymentCap(chosen)).toBe(getDeploymentCap(open)+1);expect(augmentLevelCap(chosen.augments)).toBe(7);
  expect(requireAugmentFacts(chosen,'offer-level',chosen.round)[0].level).toBe(open.level);
  const c=open.pendingChoice!,again=selectChoice(chosen,c.choiceId,c.generation,'max-cap');expect(again.ok).toBe(false);expect(again.state).toBe(chosen);trip(chosen);
 });
 it('public XP purchases stop at 7 with zero remainder; failed purchases preserve state and RNG',()=>{
  capped=chosen;for(let n=0;n<80&&capped.level<7;n++)capped=accepted(buyXp(capped));
  expect(capped.level).toBe(7);expect(capped.xp).toBe(0);
  const failed=buyXp(capped);expect(failed).toMatchObject({ok:false,reason:'max-level'});expect(failed.state).toBe(capped);trip(capped);
 });
 it('natural and settlement XP remain capped through the next round and restore',()=>{
  let next=resolveM5Choices(accepted(startMatchCombat(smallEmptyBoard(capped))));
  expect(next.level).toBe(7);expect(next.xp).toBe(0);expect(next.roundResults.at(-1)?.xpAwarded).toBe(0);
  next=accepted(nextRound(next,next.round));expect(next.level).toBe(7);expect(next.xp).toBe(0);trip(next);
 });
 it('a public level-8 route never offers Max Cap, records every reroll level and restores without owning it',()=>{
  let high=prior;for(let i=0;i<80&&high.level<8;i++)high=accepted(buyXp(high));
  expect(high.level).toBe(8);high=resolveM5Choices(accepted(startMatchCombat(smallEmptyBoard(high))));high=accepted(nextRound(high,high.round));
  expect(high.pendingChoice!.offers).not.toContain('max-cap');
  for(let slot=0;slot<3;slot++){const c=high.pendingChoice!;high=accepted(rerollAugment(high,c.choiceId,c.generation,slot));expect(high.pendingChoice!.offers).not.toContain('max-cap');}
  expect(requireAugmentFacts(high,'offer-level',high.round).map(f=>f.level)).toEqual([8,8,8,8]);trip(high);
  reject(high,s=>{delete s.augmentHistory;});reject(high,s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='offer-level').level=7;});
 });
 it.each(['gold','shield','level','xp','offer level','missing offer level','history version','missing history'])('rejects %s tampering in object/JSON/serialized restore',kind=>reject(chosen,s=>{
  if(kind==='gold')s.gold++;
  if(kind==='shield')s.items=s.items.filter((i:any)=>i.definitionId!=='TFT_Item_TacticiansScepter');
  if(kind==='level')s.level=8;
  if(kind==='xp')s.xp++;
  if(kind==='offer level')s.augmentHistory.facts.find((f:any)=>f.kind==='offer-level').level=8;
  if(kind==='missing offer level')s.augmentHistory.facts=s.augmentHistory.facts.filter((f:any)=>f.kind!=='offer-level');
  if(kind==='missing history')delete s.augmentHistory;
  if(kind==='history version')s.augmentHistory.version='augment-history-v0';
 }));
});
