import {existsSync,readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {AUGMENT_BATCH5_H9} from '../src/simulation/content/augment-pool-batch5-h9';
import {augmentOfferAllowed} from '../src/simulation/augment-offers';
import {augmentPool} from './fixtures/m5/oracle.g2.cjs';
import {RESEARCH_FILE} from './augment-pool-source-expectations';
import {CABAL_HEROES,CABAL_ATTACK_BPS,cabalEffects,cabalGiftPlan,cabalGrowthPlan,readCabalGrowth,settleCabalGrowth,sampleCabalTakedowns} from '../src/simulation/augment-pool-batch5-h9-cabal';
import {createMatch,type MatchState} from '../src/simulation/match';
import {recordAugmentAcquisition} from '../src/simulation/augment-history';
import {preflightAugmentHistory} from '../src/simulation/augment-history-restore';

it.skipIf(!existsSync(RESEARCH_FILE))('retains all Cabal 14.24 source numbers and descriptions',()=>{
 const row=AUGMENT_BATCH5_H9['forbidden-magic'];
 const r=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===row.apiName);
 expect(row.source.values).toEqual(r.effects);expect(row.name).toBe(r.name_zh_cn);expect(row.description).toBe(r.description_zh_cn);
 expect(row.source.description_en_us).toBe(r.description_en_us);expect(r.tier).toBe(2);expect(CABAL_ATTACK_BPS).toBe(150);
});
it('offers only at 3-2 with a Black Rose board member in production and the independent oracle',()=>{
 for(const node of ['2-1','3-2','4-2'])for(const traits of [[],['black-rose'],['visionary']]){
  const expected=node==='3-2'&&traits.includes('black-rose');
  expect(augmentOfferAllowed('forbidden-magic',[],{node,fieldedTraits:traits,blocked:[]})).toBe(expected);
  expect(augmentPool('gold',[],[],`round:${node}:augment`,traits).includes('forbidden-magic')).toBe(expected);
 }
});
it('draws three heroes with replacement from the full five-hero catalog on a private deterministic stream',()=>{
 expect(CABAL_HEROES).toEqual(['cassiopeia','elise','leblanc','morgana','vladimir']);
 const base=createMatch(42),a={definitionId:'forbidden-magic',choiceId:'round:3-2:augment',acquiredRound:12};
 let duplicates=0;
 for(let seed=0;seed<=100;seed++){
  const s={...base,seed,augments:[a]};const gifts=cabalGiftPlan(s);
  let hash=0x811c9dc5;const key=JSON.stringify(['augment-pool-batch1','solo',a.choiceId,a.definitionId,0]);
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619)>>>0;
  let rng=(seed^hash)>>>0;const expected=[];for(let i=0;i<3;i++){rng=(Math.imul(1664525,rng)+1013904223)>>>0;expected.push(CABAL_HEROES[Math.floor(rng*5/4294967296)]);}
  expect(gifts.map(g=>g.definitionId)).toEqual(expected);expect(new Set(gifts.map(g=>g.receiptId)).size).toBe(3);
  if(new Set(expected).size<3)duplicates++;
  expect(cabalGiftPlan(s)).toEqual(gifts);expect(s.rngState).toBe(base.rngState);
 }
 expect(duplicates).toBeGreaterThan(0);
});
it('counts each eligible participant once per enemy across revivals, carries the remainder, and applies only next round',()=>{
 const base=createMatch(42),a={definitionId:'forbidden-magic',choiceId:'cabal',acquiredRound:1};
 let s=recordAugmentAcquisition(base,{...base,augments:[a]});
 const actors=[{unitId:'m',definitionId:'morgana',team:'player',eligible:true},{unitId:'s',definitionId:'g23-sion',team:'player',eligible:true},{unitId:'x',definitionId:'vex',team:'player',eligible:false}];
 const facts=[1,2].map((round,i)=>({kind:'deaths',sequence:i+1,seatId:'solo',round,roundId:round===1?'1-2':'1-3',resourcePrefix:s.resourceProvenance.entries.length,battleId:`battle-${round}`,completeThroughTick:1,
  deaths:[0,1].map(eventSeq=>({combatId:`battle-${round}`,eventSeq,tick:1,unitId:'victim',originalUnitId:'victim',definitionId:'darius',team:'enemy',ownerSeatId:null,ordinaryHero:true,equipment:[],combatItemGrants:[],takedowns:actors}))}));
 s={...s,round:2,roundDefinitionId:'1-3',roundResults:[1,2].map(round=>({round,result:'playerWin',roundKind:'pve',combatTicks:1})),augmentHistory:{...s.augmentHistory!,facts:[...s.augmentHistory!.facts,...facts]}} as unknown as MatchState;
 const plan=cabalGrowthPlan(s);expect(plan).toHaveLength(1);expect(plan[0]).toMatchObject({round:2,stacks:1,healthFlat:10,attackDamageBps:150});
 const paid=settleCabalGrowth(s);expect(settleCabalGrowth(paid)).toBe(paid);expect(readCabalGrowth(paid)).toEqual({healthFlat:0,attackDamageBps:0});
 expect(readCabalGrowth({...paid,round:3})).toEqual({healthFlat:10,attackDamageBps:150});
 expect(()=>preflightAugmentHistory(paid)).not.toThrow();
 const missing:any=structuredClone(paid);delete missing.augmentHistory.facts.find((f:any)=>f.kind==='deaths').deaths[0].takedowns;
 expect(()=>preflightAugmentHistory(missing)).toThrow('death takedowns');
});
it('the combat sampler excludes allies and proxies while including formal members and Sion',()=>{
 const ordinary=(id:string,definitionId:string,team='player')=>({id,definitionId,team,mechanics:[{source:{definitionId:'forbidden-magic'},values:{enabled:1}}]});
 const units=[ordinary('m','morgana'),ordinary('s','g23-sion'),{...ordinary('clone','morgana'),itemSummon:{}},ordinary('v','vex','enemy')];
 expect(sampleCabalTakedowns(units as any,'v',['m','m','s','clone','v'])).toEqual([
  {unitId:'clone',definitionId:'morgana',team:'player',eligible:false},
  {unitId:'m',definitionId:'morgana',team:'player',eligible:true},
  {unitId:'s',definitionId:'g23-sion',team:'player',eligible:true},
 ]);
 const traits=[{team:'player',traitId:'black-rose',tier:0,memberUnitIds:['emblem'],memberDefinitionIds:[]}];
 expect(cabalEffects({id:'emblem',definitionId:'vex',team:'player'} as any,traits as any,{healthFlat:0,attackDamageBps:0})[0]).toMatchObject({values:{enabled:1}});
 expect(cabalEffects({id:'sion',definitionId:'g23-sion',team:'player'} as any,[],{healthFlat:10,attackDamageBps:150})).toContainEqual({kind:'statFlat',stat:'maxHp',amount:10});
});
