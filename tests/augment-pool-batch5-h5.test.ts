import { existsSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
import { captureAugmentHistoryAuthority } from '../src/simulation/augment-history';
import { canonicalContent } from '../src/simulation/content';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { tableScrapsPick } from '../src/simulation/augment-pool-batch5-h5';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { must, supplySeats } from './p7-carousel-helper';
import type { MatchState } from '../src/simulation/match-types';
import { SEATS, TIMINGS, runUntil } from './server/helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { ManualClock } from '../src/server/room/clock';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import * as choices from '../src/simulation/choices';

let fixture: ReturnType<typeof supplySeats>;
beforeAll(() => { fixture = supplySeats(8); });
it('offers Table Scraps only at 2-1 with shared carousel', () => {
  for (const node of ['2-1', '3-2', '4-2']) {
    const allowed = node === '2-1';
    expect(augmentOfferAllowed('table-scraps', [], {node,fieldedTraits:[],blocked:[],sharedCarousel:true})).toBe(allowed);
    expect(augmentCandidates('silver',[],[],null,{node,fieldedTraits:[],blocked:[],sharedCarousel:true}).includes('table-scraps')).toBe(allowed);
    expect(augmentOfferAllowed('table-scraps', [], {node,fieldedTraits:[],blocked:[],sharedCarousel:false})).toBe(false);
    expect(augmentCandidates('silver',[],[],null,{node,fieldedTraits:[],blocked:[],sharedCarousel:false})).not.toContain('table-scraps');
  }
});
describe('scripted-offer fixture self-check for carousel transactions and restore', () => {
  const clock = new ManualClock();
  const room = new Room(SEATS, {...ROOM_TIMING_DEFAULTS,...TIMINGS,roomId:'h5-table',seed:62,clock,resolver:new TwoSidedBattleResolver(),carousel:CAROUSEL_RULES_BINDING});
  let restoreOffers: (() => void) | undefined;
  beforeAll(() => { restoreOffers = installB1Offers(['table-scraps']); });
  beforeAll(() => { room.start(); runUntil(room,clock,s=>s.roundId==='2-1' && s.phase==='preparation'); });
  beforeAll(() => {
    for (const seatId of ['s1','s6']) {
      const seat=room.state.seats.find(s=>s.seatId===seatId)!, choice=seat.match.pendingChoice!;
      // Scripted three-card draw: fixture self-check, not evidence of a natural RNG offer.
      expect(choice.offers).toContain('table-scraps');
      expect(room.handle(seatId,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'table-scraps'})).toMatchObject({ok:true});
      const selected=room.state.seats.find(s=>s.seatId===seatId)!.match;
      expect(selected.gold).toBe(seat.match.gold+1);
      expect(selected.augments.some(a=>a.definitionId==='table-scraps')).toBe(true);
    }
    // Only these two seats own Table Scraps; answer the other scripted offers through real commands.
    for (const seat of room.state.seats.filter(s => !['s1','s6'].includes(s.seatId))) {
      const choice = seat.match.pendingChoice!;
      expect(room.handle(seat.seatId,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:choice.offers.find(id=>id!=='table-scraps')!})).toMatchObject({ok:true});
    }
  });
  beforeAll(() => { runUntil(room,clock,s=>s.phase==='carousel' && s.roundId==='2-4'); });
  afterAll(() => { try { room.dispose(); } finally { restoreOffers?.(); } });
  it('shares remaining slots without replacement in fixed seat order through carousel transactions', () => {
    // Detached transaction results stay local; never publish them back into either room.
    const states = room.state.seats.map(s=>s.match);
    let carousel = room.state.carousel!.state;
    carousel = must(advanceCarousel(carousel, carousel.deadlineMs)).state;
    for (let i = 0; i < 8; i++) {
      if (carousel.receipts.some(r=>r.seatId===`s${i}`)) continue;
      const slot=carousel.slots.find(s=>s.pickedBy===null)!.slot;
      const picked = must(pickCarouselForSeat(carousel.pool, carousel, states[i], `s${i}`, slot));
      carousel = picked.carousel; states[i] = picked.state;
    }
    expect(carousel.status).toBe('closed');
    expect(carousel.slots.filter(slot => slot.pickedBy === null)).toHaveLength(1);
    const first = must(completeCarouselForSeat(carousel, states[1], 's1'));
    expect(first.events.slice(0,2).map(event=>event.type)).toEqual(['carousel-picked','carouselGranted']);
    expect(first.events.slice(0,2).map(event=>event.eventSeq)).toEqual([states[1].nextMatchEventSeq,states[1].nextMatchEventSeq+1]);
    carousel = first.state; states[1] = first.match;
    const second = must(completeCarouselForSeat(carousel, states[6], 's6'));
    carousel = second.state; states[6] = second.match;
    expect(states[1].carousel!.receipts.filter(r => r.carouselId === carousel.id)).toHaveLength(2);
    expect(states[6].carousel!.receipts.filter(r => r.carouselId === carousel.id)).toHaveLength(1);
    expect(carousel.slots.filter(slot => slot.pickedBy === null)).toHaveLength(0);
    expect(states[1].augmentHistory!.facts.filter(f => f.kind === 'carousel' && f.source === 'augment')).toHaveLength(1);
    assertSharedPoolConservation(carousel.pool, states);
    const authority = captureAugmentHistoryAuthority(states[1]);
    for (const encode of [(s:MatchState):unknown => s, (s:MatchState):unknown => JSON.stringify(s), (s:MatchState):unknown => canonicalContent(s)]) {
      expect(restoreCarouselSeat(carousel, encode(states[1]), authority)).toEqual(states[1]);
      for (const edit of [
        (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='carousel'&&f.source==='augment').ordinal++;},
        (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='carousel'&&f.source==='augment').choiceId='forged';},
        (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='carousel'&&f.source==='manual').eligibilityChoiceIds=[];},
        (s:any)=>{s.carousel.receipts.at(-1).slot=0;},
        (s:any)=>{delete s.augmentHistory;},
      ]) {
        const tampered = structuredClone(states[1]); edit(tampered);
        expect(() => restoreCarouselSeat(carousel, encode(tampered), authority)).toThrow();
      }
      expect(() => restoreCarouselSeat(carousel, encode(states[1]))).toThrow('missing independent server authority');
    }
    const repeat = must(completeCarouselForSeat(carousel, states[1], 's1'));
    expect(repeat.match).toBe(states[1]);
    expect(repeat.events).toEqual([]);
  });
});

describe('live room with natural offers and public commands', () => {
  // Found within the permitted 0..100 range on v25: seed 62 offers s7 naturally;
  // s0 gets Table Scraps after rerolling slots 0, 1. The old seed 124 / s1+s6
  // initial-offer assumption drifted: the eligible 2-1 silver pool grew from 31
  // (a3353895, where this test originated) to 45. generateChoices sorts that pool
  // before drawing, so the same RNG words now choose different cards.
  // v26 D5 (7953c99a) pool: seed 62 no longer offers s7 naturally (only s0/s1 after rerolls). Seed 31 is the first seed
  // from 0 with the same shape: s6 (a bot seat, like s7 before) is offered Table Scraps naturally and s0 gets it after
  // rerolling slots 0, 1. The second holder below is therefore s6 (was s7).
  // This room never runs inside installB1Offers and never adopts the transaction fixture's states.
  const clock = new ManualClock();
  const room = new Room(SEATS, {...ROOM_TIMING_DEFAULTS,...TIMINGS,roomId:'h5-table',seed:31,clock,resolver:new TwoSidedBattleResolver(),carousel:CAROUSEL_RULES_BINDING});
  beforeAll(() => {
    expect(vi.isMockFunction(choices.generateChoices)).toBe(false);
    room.start(); runUntil(room,clock,s=>s.roundId==='2-1' && s.phase==='preparation');
  });
  beforeAll(() => {
    const initial = room.state.seats.find(s=>s.seatId==='s6')!.match.pendingChoice!;
    expect(initial.offers).toContain('table-scraps');
    for (const optionIndex of [0,1]) {
      const choice = room.state.seats.find(s=>s.seatId==='s0')!.match.pendingChoice!;
      expect(room.handle('s0',{type:'rerollAugment',choiceId:choice.choiceId,generation:choice.generation,optionIndex})).toMatchObject({ok:true});
    }
    for (const seatId of ['s0','s6']) {
      const seat=room.state.seats.find(s=>s.seatId===seatId)!, choice=seat.match.pendingChoice!;
      expect(choice.offers).toContain('table-scraps');
      expect(room.handle(seatId,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'table-scraps'})).toMatchObject({ok:true});
      const selected=room.state.seats.find(s=>s.seatId===seatId)!.match;
      expect(selected.gold).toBe(seat.match.gold+1);
      expect(selected.augments.some(a=>a.definitionId==='table-scraps')).toBe(true);
    }
  });
  beforeAll(() => { runUntil(room,clock,s=>s.phase==='carousel' && s.roundId==='2-4'); });
  afterAll(() => room.dispose());
  it('grants the extra slot in the live room after normal picks', () => {
    runUntil(room,clock,s=>s.roundId==='2-5' && s.phase==='preparation');
    expect(room.state.fault).toBeNull();
    const holder=room.state.seats.find(s=>s.seatId==='s0')!.match;
    expect(holder.carousel!.receipts.filter(r=>r.carouselId.includes('2-4'))).toHaveLength(2);
    expect(holder.augmentHistory!.facts.filter(f=>f.kind==='carousel'&&f.source==='augment')).toHaveLength(1);
    const second=room.state.seats.find(s=>s.seatId==='s6')!.match;
    expect(second.carousel!.receipts.filter(r=>r.carouselId.includes('2-4'))).toHaveLength(1);
    expect(second.augmentHistory!.facts.filter(f=>f.kind==='carousel'&&f.source==='augment')).toHaveLength(0);
    assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
  });
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
