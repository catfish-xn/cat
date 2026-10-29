import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_H3 } from '../src/simulation/content/augment-pool-batch5-h3';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { buyUnit, createMatch, deployMatchUnit, nextRound, rerollAugment, selectChoice, sellUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
import { readAugmentGrowth } from '../src/simulation/augment-history';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { accepted, fieldBench, reachRound, resolveM5Choices } from './match-helpers';
import { augmentCandidates, drawAugmentCard, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { openingEncounterId } from '../src/simulation/opening-encounter';

let afterGrowthStarted: import('../src/simulation/match').MatchState;
it.skipIf(!existsSync(RESEARCH_FILE))('No Scout source values match the 14.24 archive',()=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_NoScoutNoPivot');
 expect(AUGMENT_BATCH5_H3['no-scout-no-pivot'].source.values).toEqual(source.effects);
});
it('No Scout appears only at the first gold augment node',()=>{
 expect(AUGMENT_TIERS['no-scout-no-pivot']).toBe('gold');
 for(const node of ['2-1','3-2','4-2']) {expect(augmentOfferAllowed('no-scout-no-pivot',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='2-1');expect(augmentPool('gold',[],[],`round:${node}:augment`,[]).includes('no-scout-no-pivot')).toBe(node==='2-1');}
});
it('real solo commands lock fighters after PvP, grant growth and authenticate all restore paths',()=>{
 let found: {seed:number; rerolls:number}|undefined;
 for(let seed=0;seed<=100&&!found;seed++){
  const m=createMatch(seed),tier=resolveAugmentTier(m,'round:2-1:augment'),filter={node:'2-1',fieldedTraits:[],blocked:[]};
  const initial=generateChoices(augmentCandidates(tier,[],[],openingEncounterId(m),filter),m.choiceRngState);
  let offers=initial.offers,removed=[...offers],rng=initial.choiceRngState;
  if(offers.includes('no-scout-no-pivot')){found={seed,rerolls:0};break;}
  for(let slot=0;slot<3;slot++){const d=drawAugmentCard(augmentCandidates(tier,[],[...removed,...offers],openingEncounterId(m),filter),rng);rng=d.choiceRngState;offers=[...offers];offers[slot]=d.definitionId;removed.push(d.definitionId);if(d.definitionId==='no-scout-no-pivot'){found={seed,rerolls:slot+1};break;}}
 }
 expect(found).toBeDefined();
 let s=reachRound('2-1',false,found!.seed);
 for(let slot=0;slot<found!.rerolls;slot++){const c=s.pendingChoice!;s=accepted(rerollAugment(s,c.choiceId,c.generation,slot));}
 const choice=s.pendingChoice!;
 expect(choice.offers).toContain('no-scout-no-pivot');
 s=resolveM5Choices(accepted(selectChoice(s,choice.choiceId,choice.generation,'no-scout-no-pivot')));
 s=fieldBench(s); const unit=s.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
 expect(unit).toBeDefined();
 s=accepted(startMatchCombat(s)); while(s.phase==='combat') s=stepMatch(s).state;
 expect(readAugmentGrowth(s,unit.id)).toMatchObject({healthFlat:20,attackDamageBps:150,abilityPowerCenti:150});
 const text=serializeMatch(s);expect(restoreMatch(s)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(restoreMatch(text)).toEqual(s);
 const bad=JSON.parse(text);bad.augmentHistory.facts.find((f:any)=>f.kind==='growth').deltas[0].healthFlat++;
 expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();expect(()=>serializeMatch(bad)).toThrow();
 s=resolveM5Choices(s);s=resolveM5Choices(accepted(nextRound(s,s.round)));
 const sale=sellUnit(s,unit.id);expect(sale.ok).toBe(false);if(!sale.ok)expect(sale.reason).toBe('unit-not-sellable');
 const occupied=new Set(s.preparation.units.flatMap(u=>u.location.kind==='bench'?[u.location.slot]:[]));
 const bench=Array.from({length:s.preparation.benchSize},(_,i)=>i).find(i=>!occupied.has(i))!;expect(bench).toBeDefined();
 const failed=deployMatchUnit(s,unit.id,{kind:'bench',slot:bench});expect(failed.ok).toBe(false);if(!failed.ok)expect(failed.reason).toBe('unit-not-sellable');expect(failed.state).toBe(s);
 const shopSlot=s.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId!==unit.definitionId&&UNIT_DEFINITIONS[o.definitionId].cost<=s.gold);expect(shopSlot).toBeGreaterThanOrEqual(0);
 const beforeBuy=s;s=accepted(buyUnit(s,shopSlot,s.shop.generation));const newcomer=s.preparation.units.find(u=>!beforeBuy.preparation.units.some(old=>old.id===u.id))!;expect(newcomer).toBeDefined();
 const locked=s.preparation.units.find(u=>u.id===unit.id)!;if(locked.location.kind!=='board')throw new Error('locked unit left board');
 const swap=deployMatchUnit(s,newcomer.id,{kind:'board',cell:locked.location.cell});expect(swap.ok).toBe(false);if(!swap.ok)expect(swap.reason).toBe('unit-not-sellable');expect(swap.state).toBe(s);
 const started=accepted(startMatchCombat(s));afterGrowthStarted=started;
 expect(started.combatInputBasis?.inputs.augmentHistoryGrowth).toContainEqual({unitId:unit.id,healthFlat:20,healthBps:0,attackDamageBps:150,abilityPowerCenti:150});
 const fighter=started.combat?.units.find(u=>u.id===unit.id);expect(fighter?.maxHp).toBeGreaterThan(20);
 const effects=fighter!.sources!.filter(x=>x.source.sourceDefinitionId==='no-scout-no-pivot'&&x.source.sourceInstanceId.endsWith(':growth')).map(x=>x.effect);
 expect(effects).toContainEqual({kind:'statFlat',stat:'maxHp',amount:20});
 expect(effects).toContainEqual({kind:'statPercentBps',stat:'attackDamage',bps:150});
 expect(effects).toContainEqual({kind:'mechanic',mechanic:'fractionalFlat',values:{armorCenti:0,magicResistCenti:0,abilityPowerCenti:150}});
 expect(restoreMatch(serializeMatch(started))).toEqual(started);
});

it('the next full combat and terminal save retain the earned growth',()=>{
 let s=afterGrowthStarted;expect(s.phase).toBe('combat');while(s.phase==='combat')s=stepMatch(s).state;
 expect(s.combat?.status).toBe('finished');expect(restoreMatch(serializeMatch(s))).toEqual(s);
});
