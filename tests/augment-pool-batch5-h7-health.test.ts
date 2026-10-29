import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { selectChoice, startMatchCombat, nextRound, buyXp, type MatchState } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { maximumPlayerHp, acquireTitanicTitan, h7CarouselRelease } from '../src/simulation/augment-pool-batch5-h7-health';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { restoreCarouselSeat, validateCarousel } from '../src/simulation/carousel';
import { applyLevelUpHealth } from '../src/simulation/augment-xp';
import { explainedHp } from '../src/simulation/player-hp';
import { acquire, offered } from './augment-pool-batch5-h7-helpers';
import { accepted, fieldBench, finish, resolveM5Choices } from './match-helpers';
import { makeRoom, runUntil } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import type { CarouselState } from '../src/simulation/carousel-types';
const entries=['object','JSON','serialized'] as const;
const restore=(s:MatchState,e:typeof entries[number])=>restoreMatch(e==='object'?s:e==='JSON'?JSON.stringify(s):serializeMatch(s));

describe('B5-44 Titanic Titan',()=>{
  let picked:MatchState,battled:MatchState;
  beforeAll(()=>{picked=acquire('titanic-titan');});
  beforeAll(()=>{battled=finish(accepted(startMatchCombat(fieldBench(picked))));});
  it('offers at 2-1 and 3-2 only',()=>{
    for(const node of ['2-1','3-2','4-2'])expect(augmentCandidates('silver',[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('titanic-titan')).toBe(node!=='4-2');
  });
  it('real selection adds exactly 20 current/max HP once and rejects stale choice atomically',()=>{
    const open=offered('titanic-titan'),c=open.pendingChoice!,before=structuredClone(open);
    expect(picked.playerHp).toBe(open.playerHp+20);expect(picked.playerHp).toBeGreaterThan(100);
    expect(maximumPlayerHp(picked.augments)).toBe(120);expect(maximumPlayerHp(open.augments)).toBe(100);
    expect(requireAugmentFacts(picked,'player-health',picked.round)).toEqual([expect.objectContaining({hpBefore:open.playerHp,hpAfter:open.playerHp+20,maxHpBefore:100,maxHpAfter:120})]);
    expect(explainedHp(open,picked)).toBe(picked.playerHp);
    expect(acquireTitanicTitan(picked,picked.augments.at(-1)!)).toBe(picked);
    const invalid=selectChoice(open,c.choiceId,c.generation+1,'titanic-titan');expect(invalid.ok).toBe(false);expect(invalid.state).toBe(open);expect(open).toEqual(before);
    expect(selectChoice(picked,c.choiceId,c.generation,'titanic-titan').ok).toBe(false);
  });
  it('settles and enters the next round at >100 HP with the cap retained; buying XP stays a real command',()=>{
    expect(battled.roundResults.at(-1)!.hpBefore).toBe(picked.playerHp);
    const next=accepted(nextRound(resolveM5Choices(battled),battled.round));
    expect(maximumPlayerHp(next.augments)).toBe(120);expect(next.playerHp).toBe(battled.playerHp);
    expect(accepted(buyXp(next)).playerHp).toBe(next.playerHp);
  });
  it('existing Upward Mobility heals to the new cap, without reviving a dead player',()=>{
    const augment={definitionId:'upward-mobility',choiceId:'round:3-2:augment',acquiredRound:12};
    const s={...picked,playerHp:119,level:6,augments:[...picked.augments,augment]} as MatchState;
    expect(applyLevelUpHealth({level:5},s).playerHp).toBe(120);
    expect(applyLevelUpHealth({level:5},{...s,playerHp:0}).playerHp).toBe(0);
    expect(applyLevelUpHealth({level:5},{...s,playerHp:99,augments:[augment]}).playerHp).toBe(100);
  });
  for(const entry of entries) {
    it(`${entry} round trips selection`,()=>{expect(restore(picked,entry)).toEqual(picked);});
    it(`${entry} round trips combat and subsequent entry`,()=>{
      expect(restore(battled,entry)).toEqual(battled);
      const next=accepted(nextRound(resolveM5Choices(battled),battled.round));expect(restore(next,entry)).toEqual(next);
    });
    for(const attack of ['missing','hp','cap','gain','owner','receipt','remove','duplicate'])it(`${entry} rejects ${attack}`,()=>{
      const bad:any=structuredClone(picked),f=bad.augmentHistory.facts.find((f:any)=>f.kind==='player-health');
      if(attack==='missing')delete bad.augmentHistory;
      if(attack==='hp')bad.playerHp++;
      if(attack==='cap')f.maxHpAfter++;
      if(attack==='gain')f.hpAfter++;
      if(attack==='owner')f.choiceId='round:3-2:augment';
      if(attack==='receipt')f.receiptId+='forged';
      if(attack==='remove')bad.augmentHistory.facts=bad.augmentHistory.facts.filter((f:any)=>f.kind!=='player-health');
      if(attack==='duplicate')bad.augmentHistory.facts.push({...f,sequence:bad.augmentHistory.facts.length});
      expect(()=>restore(bad,entry)).toThrow();
    });
  }
  it('moves only the holder one existing batch earlier, clamps the first batch, and sorts automatic release order by time',()=>{
    const rows=Array.from({length:8},(_,i)=>({seatId:`s${i}`,seatIndex:i,hp:10+i}));
    for(let holder=0;holder<8;holder++){
      const participants=rows.map((p,i)=>({...p,...(i===holder?{titanicTitanChoiceId:'round:2-1:augment'}:{})}));
      const release=h7CarouselRelease(participants,6000,6000);
      for(let i=0;i<8;i++)expect(release.releaseAtMs[`s${i}`]).toBe(6000+Math.max(0,Math.floor(i/2)-(i===holder?1:0))*6000);
      expect(release.releaseOrder.map(id=>release.releaseAtMs[id])).toEqual([...Object.values(release.releaseAtMs)].sort((a,b)=>a-b));
    }
  });
});

describe('B5-44 real online selection, battle and early carousel pick',()=>{
  let setup:ReturnType<typeof makeRoom>,seatId:string,carousel:CarouselState,saved:MatchState;
  beforeAll(()=>{
    for(let seed=0;seed<=100;seed++){
      const candidate=makeRoom(new TwoSidedBattleResolver(),{seed,carousel:CAROUSEL_RULES_BINDING});
      const possible=candidate.room.state.seats.filter(s=>s.kind==='human').some(({match:s})=>generateChoices(augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[],sharedCarousel:!!s.carousel}),s.choiceRngState).offers.includes('titanic-titan'));
      if(possible){setup=candidate;setup.room.start();return;}candidate.room.dispose();
    }
    throw Error('No human room seed in 0..100');
  });
  for(const round of [2,3,4])beforeAll(()=>{runUntil(setup.room,setup.clock,s=>s.round===round&&s.phase==='preparation');});
  beforeAll(()=>{
    const {room}=setup,seat=room.state.seats.find(s=>s.kind==='human'&&s.match.pendingChoice?.offers.includes('titanic-titan'))!;
    expect(seat).toBeDefined();seatId=seat.seatId;const c=seat.match.pendingChoice!;
    expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'titanic-titan'}).ok).toBe(true);
    const after=room.state.seats.find(s=>s.seatId===seatId)!;expect(after.hp).toBe(seat.hp+20);expect(after.match.playerHp).toBe(after.hp);
    expect(after.hp).toBeGreaterThan(100);
  });
  for(const round of [5,6])beforeAll(()=>{runUntil(setup.room,setup.clock,s=>s.round===round&&s.phase==='preparation');});
  beforeAll(()=>{runUntil(setup.room,setup.clock,s=>s.roundId==='2-4'&&s.phase==='carousel');});
  beforeAll(()=>{
    const {room,clock}=setup,c=room.state.carousel!.state,ordered=[...c.participants].sort((a,b)=>a.hp-b.hp||a.seatIndex-b.seatIndex);
    const index=ordered.findIndex(p=>p.seatId===seatId),early=c.releaseAtMs[seatId];
    expect(index).toBeGreaterThanOrEqual(2);expect(early).toBe(6000+(Math.floor(index/2)-1)*6000);
    clock.advance(early-1);
    let current=room.state.carousel!.state,slot=current.slots.find(s=>s.pickedBy===null)!.slot;
    const seatsBefore=room.state.seats,poolBefore=room.state.pool;
    // The first request publishes elapsed logical time; the refused pick must not change any seat or resource.
    expect(room.handle(seatId,{type:'carousel-pick',carouselId:current.id,revision:current.revision,slot})).toMatchObject({ok:false,reason:'seat-locked'});
    expect(room.state.seats).toBe(seatsBefore);expect(room.state.pool).toBe(poolBefore);
    current=room.state.carousel!.state;
    const before=room.state;
    expect(room.handle(seatId,{type:'carousel-pick',carouselId:current.id,revision:current.revision,slot})).toMatchObject({ok:false,reason:'seat-locked'});
    expect(room.state).toBe(before);
    clock.advance(1);current=room.state.carousel!.state;slot=current.slots.find(s=>s.pickedBy===null)!.slot;
    expect(room.handle(seatId,{type:'carousel-pick',carouselId:current.id,revision:current.revision,slot}).ok).toBe(true);
    carousel=room.state.carousel!.state;saved=room.state.seats.find(s=>s.seatId===seatId)!.match;
  });
  afterAll(()=>setup?.room.dispose());
  it('records the actual early release and owning choice in the authenticated carousel fact',()=>{
    const fact=requireAugmentFacts(saved,'carousel',saved.round)[0];
    expect(fact.releaseAtMs).toBe(carousel.releaseAtMs[seatId]);expect(fact.eligibilityChoiceIds).toContain('round:2-1:augment');
    expect(fact.receipt).toEqual(saved.carousel!.receipts.at(-1));expect(setup.room.state.fault).toBeNull();
    expect(()=>serializeMatch(saved)).toThrow('multiplayer-state');
  });
  for(const entry of ['object','JSON'] as const)it(`${entry} restores both online entries and rejects health/eligibility/release edits`,()=>{
    const {room}=setup,authority=room.augmentHistoryAuthority(seatId),input=(s:MatchState)=>entry==='object'?s:JSON.stringify(s);
    for(const restore of [(v:unknown)=>restoreCarouselSeat(carousel,v,authority),(v:unknown)=>restoreSharedOrbSnapshot(room.state.pool,v,authority)]){
      expect(restore(input(saved))).toEqual(saved);
      for(const attack of ['hp','cap','eligibility','release','missing']){
        const bad:any=structuredClone(saved);
        if(attack==='hp')bad.playerHp++;
        if(attack==='cap')bad.augmentHistory.facts.find((f:any)=>f.kind==='player-health').maxHpAfter++;
        if(attack==='eligibility')bad.augmentHistory.facts.find((f:any)=>f.kind==='carousel').eligibilityChoiceIds=[];
        if(attack==='release')bad.augmentHistory.facts.find((f:any)=>f.kind==='carousel').releaseAtMs--;
        if(attack==='missing')delete bad.augmentHistory;
        expect(()=>restore(input(bad))).toThrow();
      }
    }
  });
  it('rejects a forged carousel schedule or lost participant eligibility',()=>{
    const bad:any=structuredClone(carousel);bad.releaseAtMs[seatId]--;
    expect(()=>validateCarousel(bad)).toThrow('invalid-carousel');
    const missing:any=structuredClone(carousel);delete missing.participants.find((p:any)=>p.seatId===seatId).titanicTitanChoiceId;
    expect(()=>validateCarousel(missing)).toThrow('invalid-carousel');
  });
});
