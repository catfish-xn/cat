import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_S11A } from '../src/simulation/content/augment-pool-batch5-s11a';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { moonlightSelection } from '../src/simulation/augment-pool-batch5-s11a';
import { selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { familyCombatBase } from '../src/simulation/family-reunion';
import { accepted, fieldBench, resolveM5Choices } from './match-helpers';
import { fieldedLegCases, fieldedRoute, offerFor } from './augment-stage-helpers';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';

it.skipIf(!existsSync(RESEARCH_FILE))('Moonlight preserves the 14.24 archive numbers',()=>{
 const raw=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((x:any)=>x.apiName==='TFT_Augment_Moonlight');
 expect(AUGMENT_BATCH5_S11A.moonlight.source.values).toEqual(raw.effects);
});
it('Moonlight is offered at 4-2 only',()=>{
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('moonlight',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='4-2');
  expect(augmentPool('gold',[],[],`round:${node}:augment`,[]).includes('moonlight')).toBe(node==='4-2');
 }
});
it('Moonlight samples only fielded eligible one-cost champions, without promoting an already three-star unit',()=>{
 const u=(id:string,starLevel:1|2|3,location:any,definitionId='amumu')=>({id,definitionId,team:'player' as const,starLevel,location});
 const units=[u('a',1,{kind:'board',cell:{col:0,row:4}}),u('b',3,{kind:'board',cell:{col:1,row:4}}),u('c',1,{kind:'bench',slot:0}),u('d',1,{kind:'board',cell:{col:2,row:4}},'vander')];
 const a=[{definitionId:'moonlight',choiceId:'test',acquiredRound:1}];
 expect([...moonlightSelection(units,a,1,42,new Map()).keys()]).toEqual(['a']);
 expect(moonlightSelection(units.slice(1),a,1,42,new Map()).size).toBe(0);
});
let combat:MatchState, promotedId:string;
// Reuse the same public route in bounded legs; keep the existing hook timeout unchanged.
for(const [seed,leg] of fieldedLegCases('moonlight'))beforeAll(()=>{fieldedRoute(seed,leg);});
beforeAll(()=>{
 let s=offerFor('moonlight'), c=s.pendingChoice!;expect(c.offers).toContain('moonlight');
 s=resolveM5Choices(accepted(selectChoice(s,c.choiceId,c.generation,'moonlight')));s=fieldBench(s);
 const originals=s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&u.starLevel<3);
 expect(originals.length).toBeGreaterThan(0);
 combat=accepted(startMatchCombat(s));expect(combat.phase).toBe('combat');
 const promoted=combat.combat!.units.filter(u=>u.sources?.some(x=>x.source.sourceDefinitionId==='moonlight'&&x.source.sourceInstanceId.endsWith(':bonus')));
 expect(promoted).toHaveLength(1);
 const unit=promoted[0],original=originals.find(u=>u.id===unit.id)!;promotedId=unit.id;
 expect(unit.effectiveStarLevel).toBe(3);expect(unit.starLevel).toBe(original.starLevel);
 expect(unit.maxHpBasis?.base).toBe(familyCombatBase(original,3).base.health);
 expect(unit.sources?.filter(x=>x.source.sourceDefinitionId==='moonlight'&&x.source.sourceInstanceId.endsWith(':bonus')).map(x=>x.effect)).toEqual([{kind:'statPercentBps',stat:'attackDamage',bps:2500},{kind:'statFlat',stat:'abilityPower',amount:25}]);
});
for(const [name,next] of [['opening',false],['after one tick',true]] as const){
 it(`${name}: restores from JSON, object and serialized entries`,()=>{
  const s=next?stepMatch(combat).state:combat,json=serializeMatch(s);
  expect(restoreMatch(json)).toEqual(s);expect(restoreMatch(JSON.parse(json))).toEqual(s);expect(restoreMatch(s)).toEqual(s);
 });
 it(`${name}: rejects forged combat rank at all three entries`,()=>{
  const s=next?stepMatch(combat).state:combat,forged=JSON.parse(serializeMatch(s));
  forged.combat.units.find((x:any)=>x.id===promotedId).effectiveStarLevel=2;
  expect(()=>restoreMatch(forged)).toThrow();expect(()=>restoreMatch(JSON.stringify(forged))).toThrow();expect(()=>serializeMatch(forged)).toThrow();
 });
}
