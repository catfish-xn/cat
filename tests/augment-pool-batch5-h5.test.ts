import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { AUGMENT_BATCH5_H5 } from '../src/simulation/content/augment-pool-batch5-h5';
import { RESEARCH_FILE } from './augment-pool-source-expectations';

it.skipIf(!existsSync(RESEARCH_FILE))('Table Scraps matches its 14.24 archived numbers and names', () => {
  const actual = AUGMENT_BATCH5_H5['table-scraps'];
  const source = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((row: {apiName: string}) => row.apiName === actual.apiName);
  expect(source).toBeDefined();
  expect(actual.source.values).toEqual(source.effects);
  expect(actual.name).toBe(source.name_zh_cn);
  expect(actual.description).toBe(source.description_zh_cn);
  expect(actual.source.description_en_us).toBe(source.description_en_us);
  expect(source.item_tags_raw).toEqual(expect.arrayContaining(['{d02ae323}', '{d12ae4b6}', '{d22ae649}']));
});

import { advanceCarousel, completeCarouselForSeat, createCarousel, pickCarouselForSeat, restoreCarouselSeat } from '../src/simulation/carousel';
import { captureAugmentHistoryAuthority, historyRoster } from '../src/simulation/augment-history';
import { canonicalContent } from '../src/simulation/content';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { tableScrapsPick } from '../src/simulation/augment-pool-batch5-h5';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { must, supplySeats } from './p7-carousel-helper';
import type { MatchState } from '../src/simulation/match-types';

let fixture: ReturnType<typeof supplySeats>;
beforeAll(() => { fixture = supplySeats(8); });
it('preserves all three 14.24 stage bans for Table Scraps', () => {
  for (const node of ['2-1', '3-2', '4-2']) {
    expect(augmentOfferAllowed('table-scraps', [], {node,fieldedTraits:[],blocked:[],sharedCarousel:true})).toBe(false);
    expect(augmentCandidates('silver',[],[],null,{node,fieldedTraits:[],blocked:[],sharedCarousel:true})).not.toContain('table-scraps');
  }
});
it('shares remaining slots without replacement in fixed seat order through carousel transactions', () => {
  // The 14.24 stage bans make this augment unavailable naturally; this fixture injects
  // ownership solely to exercise the real carousel transactions and conservation.
  const states = fixture.states.map((s, i): MatchState => i > 1 ? s : {
    ...s, augments: [...s.augments, {definitionId:'table-scraps',choiceId:`fixture-${i}`,acquiredRound:s.round-1}],
    augmentHistory: {version:'augment-history-v1',seatId:`s${i}`,facts:[{
      kind:'acquire',sequence:0,seatId:`s${i}`,round:s.round-1,roundId:getMultiplayerRoundByOrdinal(s.round-1).roundId,
      resourcePrefix:s.resourceProvenance.entries.length,choiceId:`fixture-${i}`,definitionId:'table-scraps',
      goldBefore:s.gold,hpBefore:s.playerHp,roster:historyRoster(s),previousBattle:{status:'none'},preparationElapsedMs:0,
    }],proof:{kind:'server'}},
  });
  let carousel = must(createCarousel(fixture.pool, '2-4', {algorithm:'lcg32-v1',state:9})).state;
  carousel = must(advanceCarousel(carousel, carousel.deadlineMs)).state;
  for (let i = 0; i < 8; i++) {
    const picked = must(pickCarouselForSeat(carousel.pool, carousel, states[i], `s${i}`, i));
    carousel = picked.carousel; states[i] = picked.state;
  }
  expect(carousel.status).toBe('closed');
  expect(carousel.slots.filter(slot => slot.pickedBy === null)).toHaveLength(1);
  const first = must(completeCarouselForSeat(carousel, states[0], 's0'));
  expect(first.events.slice(0,2).map(event=>event.type)).toEqual(['carousel-picked','carouselGranted']);
  expect(first.events.slice(0,2).map(event=>event.eventSeq)).toEqual([states[0].nextMatchEventSeq,states[0].nextMatchEventSeq+1]);
  carousel = first.state; states[0] = first.match;
  const second = must(completeCarouselForSeat(carousel, states[1], 's1'));
  carousel = second.state; states[1] = second.match;
  expect(states[0].carousel!.receipts.filter(r => r.carouselId === carousel.id)).toHaveLength(2);
  expect(states[1].carousel!.receipts.filter(r => r.carouselId === carousel.id)).toHaveLength(1);
  expect(carousel.slots.filter(slot => slot.pickedBy === null)).toHaveLength(0);
  expect(states[0].augmentHistory!.facts.filter(f => f.kind === 'carousel' && f.source === 'augment')).toHaveLength(1);
  assertSharedPoolConservation(carousel.pool, states);
  const authority = captureAugmentHistoryAuthority(states[0]);
  for (const encode of [(s:MatchState):unknown => s, (s:MatchState):unknown => JSON.stringify(s), (s:MatchState):unknown => canonicalContent(s)]) {
    expect(restoreCarouselSeat(carousel, encode(states[0]), authority)).toEqual(states[0]);
    for (const edit of [
      (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='carousel'&&f.source==='augment').ordinal++;},
      (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='carousel'&&f.source==='augment').choiceId='forged';},
      (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='carousel'&&f.source==='manual').eligibilityChoiceIds=[];},
      (s:any)=>{s.carousel.receipts.at(-1).slot=0;},
      (s:any)=>{delete s.augmentHistory;},
    ]) {
      const tampered = structuredClone(states[0]); edit(tampered);
      expect(() => restoreCarouselSeat(carousel, encode(tampered), authority)).toThrow();
    }
    expect(() => restoreCarouselSeat(carousel, encode(states[0]))).toThrow('missing independent server authority');
  }
  const repeat = must(completeCarouselForSeat(carousel, states[0], 's0'));
  expect(repeat.match).toBe(states[0]);
  expect(repeat.events).toEqual([]);
});

it('uses the first four subsequent carousel history boundaries even when one had no remaining slot', () => {
  const ids = ['2-4','3-4','4-4','5-4','6-4'] as const;
  const original = must(createCarousel(fixture.pool,'2-4',{algorithm:'lcg32-v1',state:31})).state;
  const base = fixture.states[0], owner = {definitionId:'table-scraps',choiceId:'fixture-history',acquiredRound:4};
  const facts = ids.map(id => ({kind:'carousel',round:getCatalogRoundById(id).ordinal,source:'manual',eligibilityChoiceIds:[owner.choiceId]}));
  for (const [index,id] of ids.entries()) {
    const round=getCatalogRoundById(id).ordinal;
    const match={...base,round,roundDefinitionId:id,augments:[...base.augments,owner],
      augmentHistory:{version:'augment-history-v1',seatId:'s0',facts:facts.slice(0,index+1),proof:{kind:'server'}}} as unknown as MatchState;
    const carousel={...original,roundId:id,status:'closed' as const};
    if(index<4) expect(tableScrapsPick(match,carousel)).toEqual(expect.objectContaining({choiceId:owner.choiceId}));
    else expect(tableScrapsPick(match,carousel)).toBeNull();
    if(index===1) {
      const exhausted={...carousel,slots:carousel.slots.map(slot=>({...slot,pickedBy:'s1'}))};
      expect(tableScrapsPick(match,exhausted)).toBeNull();
    }
    if(index===2) {
      const missing={...match,augmentHistory:{...match.augmentHistory!,facts:match.augmentHistory!.facts.filter(f=>f.round!==getCatalogRoundById('3-4').ordinal)}};
      expect(()=>tableScrapsPick(missing,carousel)).toThrow('missing carousel');
    }
  }
});
