import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_H3 } from '../src/simulation/content/augment-pool-batch5-h3';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentCandidates, augmentOfferAllowed, drawAugmentCard, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { openingEncounterId } from '../src/simulation/opening-encounter';
import { buyUnit, createMatch, equipItem, nextRound, rerollAugment, selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import { readAugmentGrowth, requireAugmentFacts } from '../src/simulation/augment-history';
import { hexDistance } from '../src/simulation/board';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { accepted, fieldBench, reachRound, resolveM5Choices } from './match-helpers';

it.skipIf(!existsSync(RESEARCH_FILE))('Cooking Pot source values match the 14.24 archive',()=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_CookingPot');
 expect(AUGMENT_BATCH5_H3['cooking-pot'].source.values).toEqual(source.effects);
});
it('Cooking Pot is a gold offer at 2-1 only',()=>{
 expect(AUGMENT_TIERS['cooking-pot']).toBe('gold');
 for(const node of ['2-1','3-2','4-2']){expect(augmentOfferAllowed('cooking-pot',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='2-1');expect(augmentPool('gold',[],[],`round:${node}:augment`,[]).includes('cooking-pot')).toBe(node==='2-1');}
});
it('real commands grant one pan and 50 permanent HP at the next entry, with authenticated restores',()=>{
 let found:{seed:number;rerolls:number}|undefined;
 for(let seed=0;seed<=100&&!found;seed++){
  const m=createMatch(seed),tier=resolveAugmentTier(m,'round:2-1:augment'),filter={node:'2-1',fieldedTraits:[],blocked:[]};
  const initial=generateChoices(augmentCandidates(tier,[],[],openingEncounterId(m),filter),m.choiceRngState);
  let offers=initial.offers,removed=[...offers],rng=initial.choiceRngState;
  if(offers.includes('cooking-pot')){found={seed,rerolls:0};break;}
  for(let slot=0;slot<3;slot++){const d=drawAugmentCard(augmentCandidates(tier,[],[...removed,...offers],openingEncounterId(m),filter),rng);rng=d.choiceRngState;offers=[...offers];offers[slot]=d.definitionId;removed.push(d.definitionId);if(d.definitionId==='cooking-pot'){found={seed,rerolls:slot+1};break;}}
 }
 expect(found).toBeDefined();let s=reachRound('2-1',false,found!.seed);
 for(let slot=0;slot<found!.rerolls;slot++){const c=s.pendingChoice!;s=accepted(rerollAugment(s,c.choiceId,c.generation,slot));}
 const c=s.pendingChoice!;expect(c.offers).toContain('cooking-pot');
 s=resolveM5Choices(accepted(selectChoice(s,c.choiceId,c.generation,'cooking-pot')));
 const pan=s.items.find(i=>i.definitionId==='frying-pan'&&i.location.kind==='inventory')!;expect(pan).toBeDefined();
 const slot=s.shop.slots.findIndex(o=>o.status==='available'&&s.gold>=1);expect(slot).toBeGreaterThanOrEqual(0);
 s=accepted(buyUnit(s,slot,s.shop.generation));s=fieldBench(s);
 const units=s.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');expect(units.length).toBeGreaterThanOrEqual(2);
 const holder=units[0];s=accepted(equipItem(s,pan.id,holder.id,0));
 s=accepted(startMatchCombat(s));while(s.phase==='combat')s=stepMatch(s).state;
 s=resolveM5Choices(s);s=resolveM5Choices(accepted(nextRound(s,s.round)));
 const entry=requireAugmentFacts(s,'round-entry',s.round)[0],source=entry.roster.units.find(u=>u.id===holder.id)!;
 if(source.location.kind!=='board')throw new Error('holder left board');
 const cell=source.location.cell;
 const target=entry.roster.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&u.id!==holder.id).sort((a,b)=>{
  if(a.location.kind!=='board'||b.location.kind!=='board')return 0;
  return hexDistance(cell,a.location.cell)-hexDistance(cell,b.location.cell)||(a.id<b.id?-1:a.id>b.id?1:0);
 })[0];
 expect(readAugmentGrowth(s,target.id)).toMatchObject({healthFlat:50,healthBps:0,attackDamageBps:0,abilityPowerCenti:0});
 const text=serializeMatch(s);for(const input of [s,JSON.parse(text),text])expect(restoreMatch(input)).toEqual(s);
 for(const mutate of [(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='growth').deltas[0].healthFlat++;},(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='round-entry').roster.items=[];}]){
  const bad=JSON.parse(text);mutate(bad);expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();expect(()=>serializeMatch(bad)).toThrow();
 }
});

it('Cooking Pot resolves tied distances by ID, counts each holder once, and ignores bench and derived items',async()=>{
 const {planCookingPotGrowth}=await import('../src/simulation/augment-pool-batch5-h3');
 const board=(id:string,col:number)=>({id,definitionId:'amumu',team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col,row:4}}});
 const units=[board('holder',3),board('a',2),board('b',4),{...board('bench',0),location:{kind:'bench' as const,slot:0}}];
 const item=(id:string,definitionId:string,unitId:string,slot:number)=>({id,definitionId,location:{kind:'unit' as const,unitId,slot}});
 const items=[item('i1','frying-pan','holder',0),item('i2','spatula','holder',1),item('i3','spatula','a',0),item('i4','TFT_Item_TacticiansRing','b',0),item('i5','spatula','bench',0)];
 expect(planCookingPotGrowth({units,items})).toEqual([
  {unitId:'a',healthFlat:50,healthBps:0,attackDamageBps:0,abilityPowerCenti:0},
  {unitId:'holder',healthFlat:50,healthBps:0,attackDamageBps:0,abilityPowerCenti:0},
 ]);
 const twoHolders=[board('one',2),board('center',3),board('two',4)];
 expect(planCookingPotGrowth({units:twoHolders,items:[item('i6','spatula','one',0),item('i7','frying-pan','two',0)]})).toEqual([{unitId:'center',healthFlat:100,healthBps:0,attackDamageBps:0,abilityPowerCenti:0}]);
 expect(planCookingPotGrowth({units:[units[0]],items})).toEqual([]);
 expect(planCookingPotGrowth({units:[],items:[]})).toEqual([]);
});
