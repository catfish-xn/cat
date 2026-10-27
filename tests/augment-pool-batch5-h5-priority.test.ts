import { roomOfferFor } from './server/augment-offer-helpers';
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AUGMENT_BATCH5_H5 } from '../src/simulation/content/augment-pool-batch5-h5';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { canonicalContent } from '../src/simulation/content';
import { restoreCarouselSeat } from '../src/simulation/carousel';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { SEATS, TIMINGS, runUntil } from './server/helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../src/server/room/room';
import { ManualClock } from '../src/server/room/clock';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import type { MatchState } from '../src/simulation/match-types';

it.skipIf(!existsSync(RESEARCH_FILE))('Young and Wild and Free matches 14.24 values and source text', () => {
  const actual=AUGMENT_BATCH5_H5['young-and-wild-and-free'];
  const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((row:{apiName:string})=>row.apiName===actual.apiName);
  expect(source).toBeDefined();expect(actual.source.values).toEqual(source.effects);
  expect(actual.name).toBe(source.name_zh_cn);expect(actual.description).toBe(source.description_zh_cn);
  expect(actual.source.description_en_us).toBe(source.description_en_us);
});
it('offers priority only at its allowed shared-carousel nodes',()=>{
  for(const node of ['2-1','3-2','4-2']){
    expect(augmentOfferAllowed('young-and-wild-and-free',[],{node,fieldedTraits:[],blocked:[],sharedCarousel:true})).toBe(node!=='4-2');
    expect(augmentOfferAllowed('young-and-wild-and-free',[],{node,fieldedTraits:[],blocked:[],sharedCarousel:false})).toBe(false);
    expect(augmentCandidates('silver',[],[],null,{node,fieldedTraits:[],blocked:[],sharedCarousel:true}).includes('young-and-wild-and-free')).toBe(node!=='4-2');
    expect(augmentCandidates('silver',[],[],null,{node,fieldedTraits:[],blocked:[],sharedCarousel:false})).not.toContain('young-and-wild-and-free');
  }
});
const clock=new ManualClock();
const room=new Room(SEATS,{
  ...ROOM_TIMING_DEFAULTS,...TIMINGS,roomId:'h5-priority',seed:94,clock,resolver:new TwoSidedBattleResolver(),carousel:CAROUSEL_RULES_BINDING,
});
let selected:MatchState;
beforeAll(()=>{room.start();runUntil(room,clock,s=>s.round===4&&s.phase==='preparation');});
beforeAll(()=>{
  const seat=roomOfferFor(room,'s2','young-and-wild-and-free'),choice=seat.match.pendingChoice!;
  expect(choice.offers).toContain('young-and-wild-and-free');
  const before=seat.match.gold;
  expect(room.handle('s2',{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'young-and-wild-and-free'})).toMatchObject({ok:true});
  selected=room.state.seats.find(s=>s.seatId==='s2')!.match;
  expect(selected.gold).toBe(before+2);
  expect(requireAugmentFacts(selected,'acquire',selected.round).some(f=>f.definitionId==='young-and-wild-and-free')).toBe(true);
});
beforeAll(()=>{runUntil(room,clock,s=>s.phase==='carousel'&&s.roundId==='2-4');});
afterAll(()=>room.dispose());
it('releases the holder at carousel start while other seats remain locked, with atomic shared picks',()=>{
  const carousel=room.state.carousel!.state;
  expect(carousel.elapsedMs).toBe(0);expect(carousel.releaseAtMs.s2).toBe(0);expect(carousel.releaseAtMs.s0).toBeGreaterThan(0);
  const slot=carousel.slots.find(s=>s.pickedBy===null)!.slot;
  expect(room.handle('s0',{type:'carousel-pick',carouselId:carousel.id,revision:carousel.revision,slot})).toMatchObject({ok:false,reason:'seat-locked'});
  expect(room.handle('s2',{type:'carousel-pick',carouselId:carousel.id,revision:carousel.revision,slot})).toMatchObject({ok:true});
  const after=room.state.carousel!.state,holder=room.state.seats.find(s=>s.seatId==='s2')!.match;
  expect(after.slots[slot].pickedBy).toBe('s2');
  expect(requireAugmentFacts(holder,'carousel',holder.round)[0].releaseAtMs).toBe(0);
  expect(room.handle('s2',{type:'carousel-pick',carouselId:after.id,revision:after.revision,slot})).toMatchObject({ok:false,reason:'already-picked'});
  clock.advance(after.releaseAtMs.s0 - after.elapsedMs);
  const released=room.state.carousel!.state;
  expect(room.handle('s0',{type:'carousel-pick',carouselId:released.id,revision:released.revision,slot})).toMatchObject({ok:false,reason:'slot-taken'});
});
it('authenticates acquisition and carousel facts on object, JSON and canonical serialized restore entries',()=>{
  const carousel=room.state.carousel!.state,match=room.state.seats.find(s=>s.seatId==='s2')!.match,authority=room.augmentHistoryAuthority('s2');
  for(const encode of [(s:MatchState):unknown=>s,(s:MatchState):unknown=>JSON.stringify(s),(s:MatchState):unknown=>canonicalContent(s)]){
    expect(restoreCarouselSeat(carousel,encode(match),authority)).toEqual(match);
    expect(restoreSharedOrbSnapshot(carousel.pool,encode(match),authority)).toEqual(match);
    for(const mutate of [
      (s:any)=>{delete s.augmentHistory;},
      (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='acquire').goldBefore++;},
      (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='carousel').releaseAtMs++;},
    ]){
      const bad=structuredClone(match);mutate(bad);
      expect(()=>restoreCarouselSeat(carousel,encode(bad),authority)).toThrow();
      expect(()=>restoreSharedOrbSnapshot(carousel.pool,encode(bad),authority)).toThrow();
    }
  }
});
