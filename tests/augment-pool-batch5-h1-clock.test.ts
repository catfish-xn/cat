import { describe, expect, it } from 'vitest';
import { shopGlitchRefreshes } from '../src/simulation/augment-pool-batch5-h1';
import { createMatch, type MatchState } from '../src/simulation/match';

const base = createMatch(0);
const fixture = { ...base, round: 10, augments: [{ definitionId: 'shop-glitch', choiceId: 'a', acquiredRound: 4 }],
  augmentHistory: { version: 'augment-history-v1', seatId: 'solo', proof: { kind: 'server' }, facts: [
    { kind: 'acquire', round: 4, choiceId: 'a', preparationElapsedMs: 10000 },
  ] } } as unknown as MatchState;
describe('Shop Glitch clock schedule', () => {
  it('crosses exactly the twelve PvE preparation boundaries through 30 seconds', () => {
    expect(shopGlitchRefreshes(fixture, 0, 2499)).toBe(0);
    expect(shopGlitchRefreshes(fixture, 2499, 2500)).toBe(1);
    expect(shopGlitchRefreshes(fixture, 2500, 30000)).toBe(11);
    expect(shopGlitchRefreshes(fixture, 30000, 60000)).toBe(0);
  });
  it('skips locked boundaries and excludes PvP and supply rounds', () => {
    expect(shopGlitchRefreshes({ ...fixture, shop: { ...fixture.shop, locked: true } }, 0, 5000)).toBe(0);
    expect(shopGlitchRefreshes(fixture, 5000, 7500)).toBe(1);
    expect(shopGlitchRefreshes({ ...fixture, round: 5 }, 0, 30000)).toBe(0);
    expect(shopGlitchRefreshes({ ...fixture, round: 7 }, 0, 30000)).toBe(0);
  });
  it('refuses to infer a missing acquisition fact', () => {
    expect(() => shopGlitchRefreshes({ ...fixture, augmentHistory: { ...fixture.augmentHistory!, facts: [] } }, 0, 2500)).toThrow('missing acquire');
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_H1 } from '../src/simulation/content/augment-pool-batch5-h1';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { advanceAugmentPreparationTime } from '../src/simulation/augment-history';
import { rerollAugment, selectChoice, setShopLock, startMatchCombat, stepMatch, nextRound } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, reachRound, resolveM5Choices } from './match-helpers';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { augmentPool, shopGlitchSolo } from './fixtures/m5/oracle.g2.cjs';

it('enables Shop Glitch with the shared room clock transaction',()=>{
  expect(AUGMENT_BATCH5_H1['shop-glitch'].enabled).toBe(true);
  expect(AUGMENT_DEFINITIONS['shop-glitch']).toBeDefined();
});
it.skipIf(!existsSync(RESEARCH_FILE))('retains the exact Shop Glitch source values',()=>{
  const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_ShopGlitch');
  expect(AUGMENT_BATCH5_H1['shop-glitch'].source.values).toEqual(source.effects);
  expect(source.tier).toBe(2);
});

describe('Shop Glitch public commands and restore',()=>{
it.skipIf(!existsSync(RESEARCH_FILE))('registers the 14.24 source and both allowed offer nodes', () => {
  const row = AUGMENT_BATCH5_H1['shop-glitch'];
  const source = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((r: any) => r.apiName === row.apiName);
  expect(row.source.values).toEqual(source.effects);
  expect(source.tier).toBe(2);
  for (const node of ['2-1', '3-2', '4-2']) {
    const allowed = node !== '4-2';
    expect(augmentOfferAllowed('shop-glitch', [], { node, fieldedTraits: [], blocked: [] })).toBe(allowed);
    expect(augmentCandidates('gold', [], [], null, { node, fieldedTraits: [], blocked: [] }).includes('shop-glitch')).toBe(allowed);
    expect(augmentPool('gold', [], [], `round:${node}:augment`)).toEqual(augmentCandidates('gold', [], [], null, { node, fieldedTraits: [], blocked: [] }).sort());
  }
});
let route: MatchState;
it('selects Shop Glitch through the real choice command', () => {
  // v25 batch-5 pool drift: seed 21 (also 42/51) naturally offers shop-glitch at 2-1 with up to three slot rerolls.
  const seed = 21;
  let s = reachRound('2-1', false, seed);
  for (let i = 0; i < 3 && !s.pendingChoice!.offers.includes('shop-glitch'); i++) {
    const c = s.pendingChoice!; s = accepted(rerollAugment(s, c.choiceId, c.generation, i));
  }
  const c = s.pendingChoice!; expect(c.offers).toContain('shop-glitch');
  route=resolveM5Choices(accepted(selectChoice(s,c.choiceId,c.generation,'shop-glitch')));
  expect(route.augmentHistory).toBeDefined();
});
for (const target of ['2-2','2-3','2-4','2-5','2-6','2-7']) it(`reaches ${target} with ordinary commands`, () => {
  let s=route;
  while(s.roundDefinitionId!==target){
    s=resolveM5Choices(s);
    if(s.phase==='preparation') {s=accepted(startMatchCombat(emptyBoard(s)));while(s.phase==='combat')s=stepMatch(s).state;}
    s=resolveM5Choices(s);s=accepted(nextRound(s,s.round));
  }
  route=s;
});
it('refreshes for free on elapsed boundaries, skips locked times and authenticates restores', () => {
  let s=route, generation=s.shop.generation, gold=s.gold;
  s=advanceAugmentPreparationTime(s,2499);expect(s.shop.generation).toBe(generation);
  const first=shopGlitchSolo(s,2499,2500);
  s=advanceAugmentPreparationTime(s,2500);expect(s.shop.generation).toBe(++generation);expect(s.gold).toBe(gold);
  expect(s.shop).toEqual(first.shop);expect(s.rngState).toBe(first.rngState);
  s=accepted(setShopLock(s,true,s.shop.generation));s=advanceAugmentPreparationTime(s,5000);expect(s.shop.generation).toBe(generation);
  s=accepted(setShopLock(s,false,s.shop.generation));const next=shopGlitchSolo(s,5000,7500);
  s=advanceAugmentPreparationTime(s,7500);expect(s.shop.generation).toBe(++generation);
  expect(s.shop).toEqual(next.shop);expect(s.rngState).toBe(next.rngState);
  const serialized=serializeMatch(s);
  expect(restoreMatch(s)).toEqual(s);expect(restoreMatch(JSON.stringify(s))).toEqual(s);expect(restoreMatch(serialized)).toEqual(s);
  for (const mutate of [(x:any)=>{x.augmentHistory.facts.findLast((f:any)=>f.kind==='preparation-time').elapsedMs++;},
    (x:any)=>{x.shop.generation++;},(x:any)=>{x.augmentHistory.proof.commands.pop();}]) {
    const x=structuredClone(s);mutate(x);
    expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();
  }
});

});
