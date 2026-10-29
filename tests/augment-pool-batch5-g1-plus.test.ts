import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_G1 } from '../src/simulation/content/augment-pool-batch5-g1';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { createMatch } from '../src/simulation/match';
import { luckyGlovesRewardPlan } from '../src/simulation/augment-pool-batch5-g1';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import { existsSync, readFileSync } from 'node:fs';

it('B5-54 immediately grants three gloves, has no delayed reward, and uses the same selection policy',()=>{
  const row=AUGMENT_BATCH5_G1['lucky-gloves-plus'];
  expect(row.source.values).toEqual({NumGloves:3});
  expect(row.gifts).toEqual([{kind:'item',definitionId:'gloves',count:3}]);
  for(const round of [12,13,17,38]){
    const state={...createMatch(1),round,augments:[{definitionId:'lucky-gloves-plus',choiceId:'choice',acquiredRound:12}]};
    expect(luckyGlovesRewardPlan(state)).toEqual([]);
    const gifts=rewardPlan(state,{}).gifts;
    expect(gifts).toHaveLength(3);expect(gifts.every(g=>g.definitionId==='gloves'&&g.acquiredRound===12)).toBe(true);
  }
});
it('B5-54 preserves the 2-1 ban and is offered only at 3-2 and 4-2; both variants exclude each other',()=>{
  for(const node of ['2-1','3-2','4-2']){
    const filter={node,fieldedTraits:[],blocked:[]};
    const pool=augmentCandidates('prismatic',[],[],null,filter);
    expect([...pool].sort()).toEqual(augmentPool('prismatic',[],[],`round:${node}:augment`,[]));
    expect(pool.includes('lucky-gloves-plus')).toBe(node!=='2-1');
    expect(augmentOfferAllowed('lucky-gloves-plus',[],filter)).toBe(node!=='2-1');
  }
  expect(augmentCandidates('prismatic',[{definitionId:'lucky-gloves',choiceId:'first',acquiredRound:4}],[],null,{node:'3-2',fieldedTraits:[],blocked:[]})).not.toContain('lucky-gloves-plus');
  expect(augmentOfferAllowed('lucky-gloves',[{definitionId:'lucky-gloves-plus',choiceId:'fixture',acquiredRound:1}],{node:'2-1',fieldedTraits:[],blocked:[]})).toBe(false);
});
const archive='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(archive))('both card descriptions and source effects match independent 14.24 rows when the local research is present',()=>{
  // CI still verifies the literal quantities above; this archive lives outside the repository.
  const source:any[]=JSON.parse(readFileSync(archive,'utf8'));
  for(const row of Object.values(AUGMENT_BATCH5_G1)){
    const raw=source.find(s=>s.apiName===row.apiName);expect(raw).toBeDefined();
    expect(row.source.values).toEqual(raw.effects);expect(row.description).toBe(raw.description_zh_cn);
    expect(row.name).toBe(raw.name_zh_cn);expect(row.source.description_en_us).toBe(raw.description_en_us);
  }
});
