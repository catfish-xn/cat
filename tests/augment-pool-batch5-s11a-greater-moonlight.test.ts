import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_S11A } from '../src/simulation/content/augment-pool-batch5-s11a';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { moonlightSelection } from '../src/simulation/augment-pool-batch5-s11a';
import { selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { familyCombatBase } from '../src/simulation/family-reunion';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { accepted, fieldBench, resolveM5Choices } from './match-helpers';
import { FIELDED_LEGS, fieldedRoute } from './augment-stage-helpers';
import { rerollAugment } from '../src/simulation/match';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';

it.skipIf(!existsSync(RESEARCH_FILE))('Greater Moonlight preserves the 14.24 archive numbers',()=>{
 const raw=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((x:any)=>x.apiName==='TFT_Augment_GreaterMoonlight');
 expect(AUGMENT_BATCH5_S11A['greater-moonlight'].source.values).toEqual(raw.effects);
});
it('Greater Moonlight is offered at 4-2 only',()=>{
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('greater-moonlight',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='4-2');
  expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes('greater-moonlight')).toBe(node==='4-2');
 }
});
it('Greater Moonlight samples only fielded eligible one-cost champions and excludes already four-star units',()=>{
 const u=(id:string,starLevel:1|2|3,location:any,definitionId='amumu')=>({id,definitionId,team:'player' as const,starLevel,location});
 const units=[u('a',1,{kind:'board',cell:{col:0,row:4}}),u('b',3,{kind:'board',cell:{col:1,row:4}}),u('c',1,{kind:'bench',slot:0}),u('d',1,{kind:'board',cell:{col:2,row:4}},'vander')];
 const a=[{definitionId:'greater-moonlight',choiceId:'test',acquiredRound:1}];
 expect([...moonlightSelection(units,a,1,42,new Map([['b',4]])).keys()]).toEqual(['a']);
 expect(moonlightSelection(units.slice(1),a,1,42,new Map([['b',4]])).size).toBe(0);
 expect([...moonlightSelection([units[1]],a,1,42,new Map()).values()][0].star).toBe(4);
 const both=[...a,{definitionId:'moonlight',choiceId:'other',acquiredRound:1}];
 const chosen=moonlightSelection(units.slice(0,2),both,1,42,new Map());
 expect([...chosen.values()].find(x=>x.definitionId==='greater-moonlight')?.star).toBe(4);
 expect(augmentOfferAllowed('greater-moonlight',[both[1]])).toBe(false);
 expect(augmentOfferAllowed('moonlight',[both[0]])).toBe(false);
});
let combat:MatchState, promotedId:string;
// v25 catalog: fielded 4-2 seed 6 (replacing STAGE_SEEDS 16) with the same public slot rerolls.
// v26 rules (D5 pool 7953c99a, 14.24 neutrals): seed 28 (was 6); seed 6's fielded route now loses at 4-1 (gameOver).
// The route is played in FIELDED_LEGS cases (as in the H8 suite) so each leg stays inside the default case timeout.
const SEED=28;
it.each(FIELDED_LEGS)('reaches %s with real commands',leg=>{expect(fieldedRoute(SEED,leg).roundDefinitionId).toBe(leg);});
it('selects the real 4-2 Greater Moonlight offer and promotes exactly one fielded unit',()=>{
 let s=fieldedRoute(SEED,'4-2');
 for(let slot=0;slot<3&&!s.pendingChoice!.offers.includes('greater-moonlight');slot++){const c=s.pendingChoice!;s=accepted(rerollAugment(s,c.choiceId,c.generation,slot));}
 const c=s.pendingChoice!;expect(c.offers).toContain('greater-moonlight');
 s=resolveM5Choices(accepted(selectChoice(s,c.choiceId,c.generation,'greater-moonlight')));s=fieldBench(s);
 const originals=s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&u.starLevel<=3);
 expect(originals.length).toBeGreaterThan(0);
 combat=accepted(startMatchCombat(s));expect(combat.phase).toBe('combat');
 const promoted=combat.combat!.units.filter(u=>u.sources?.some(x=>x.source.sourceDefinitionId==='greater-moonlight'&&x.source.sourceInstanceId.endsWith(':bonus')));
 expect(promoted).toHaveLength(1);
 const unit=promoted[0],original=originals.find(u=>u.id===unit.id)!;promotedId=unit.id;
 expect(unit.effectiveStarLevel).toBe(4);expect(unit.starLevel).toBe(original.starLevel);
 expect(unit.maxHpBasis?.base).toBe(familyCombatBase(original,4).base.health);
 expect(unit.sources?.filter(x=>x.source.sourceDefinitionId==='greater-moonlight'&&x.source.sourceInstanceId.endsWith(':bonus')).map(x=>x.effect)).toEqual([{kind:'statPercentBps',stat:'attackDamage',bps:500},{kind:'statFlat',stat:'abilityPower',amount:5}]);
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

it('four-star Singed uses the existing 14.24b fourth-rank damage reduction',()=>{
 const input=combat.combatInputBasis!.inputs, unit=input.preparation.units.find(u=>u.id===promotedId)!;
 const target={...unit,definitionId:'singed',starLevel:1 as const};
 const compiled=buildStrategySnapshot({...input,preparation:{...input.preparation,units:[target]},items:[],temporaryEquipment:[],
  augments:input.augments.filter(a=>a.definitionId==='greater-moonlight'),anomalyBinding:null,persistentGrowth:[],d14Combat:undefined});
 const ability=compiled.units.find(u=>u.unitId===target.id)!.ability;
 expect(ability.kind).toBe('s13');if(ability.kind!=='s13')throw Error('Expected S13 ability');
 expect(ability.variables.DR).toBe(6000);
});
it('equipment recompilation retains the opening promotion and its augment source',()=>{
 const input=combat.combatInputBasis!.inputs,opening=combat.combat!.strategy!;
 const before=opening.units.find(u=>u.unitId===promotedId)!;
 const after=buildStrategySnapshot({...input,items:input.items.filter(i=>i.location.kind!=='unit'||i.location.unitId!==promotedId)},undefined,undefined,opening).units.find(u=>u.unitId===promotedId)!;
 expect(after.effectiveStarLevel).toBe(before.effectiveStarLevel);
 expect(after.sources.filter(s=>s.source.sourceDefinitionId==='greater-moonlight')).toEqual(before.sources.filter(s=>s.source.sourceDefinitionId==='greater-moonlight'));
});
