import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { B5_13_CONTENT } from '../src/simulation/content/augment-pool-batch5-s3a';
import { planAugmentGifts } from '../src/simulation/augment-gift-plan';
import { COMPONENT_POOL } from '../src/simulation/component-pool';
import { RESEARCH_FILE } from './augment-pool-source-expectations';

it.skipIf(!existsSync(RESEARCH_FILE))('B5-13 retains its 14.24 source identity and values', () => {
  const source = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((row: {apiName:string}) => row.apiName === B5_13_CONTENT.apiName);
  expect(source.name_zh_cn).toBe(B5_13_CONTENT.name);
  expect(source.effects).toEqual(B5_13_CONTENT.source.values);
  expect(source.tier).toBe(1);
  expect(source.description_zh_cn).toContain('4个选项');
});

it('B5-13 acquisition specifies one deterministic ordinary component', () => {
  const state = {seed: 17};
  const augment = {definitionId:'component-buffet',choiceId:'round:2-1:augment',acquiredRound:4};
  const gifts = planAugmentGifts(state, augment, B5_13_CONTENT.gifts);
  expect(gifts).toHaveLength(1);
  expect(gifts[0].kind).toBe('item');
  expect(COMPONENT_POOL.map(item => item.definitionId)).toContain(gifts[0].definitionId);
  expect(planAugmentGifts(state, augment, B5_13_CONTENT.gifts)).toEqual(gifts);
});

import { AUGMENT_BATCH5_S3A } from '../src/simulation/content/augment-pool-batch5-s3a';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
it.skipIf(!existsSync(RESEARCH_FILE)).each(Object.keys(AUGMENT_BATCH5_S3A))('%s retains exact archive values',id=>{
 const row=AUGMENT_BATCH5_S3A[id],source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===row.apiName);
 expect(row.name).toBe(source.name_zh_cn);expect(row.source.values).toEqual(source.effects);expect(source.tier).toBe(1);
});
it('Fine Vintage is eligible only at 2-1',()=>{
 expect(augmentOfferAllowed('fine-vintage',[],{node:'2-1',fieldedTraits:[],blocked:[]})).toBe(true);
 for(const node of ['3-2','4-2'])expect(augmentOfferAllowed('fine-vintage',[],{node,fieldedTraits:[],blocked:[]})).toBe(false);
});
