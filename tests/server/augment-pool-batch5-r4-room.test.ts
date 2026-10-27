import { afterAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming, claimAllOrbs, answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { createCarouselMatch, type MatchState } from '../../src/simulation/match';
import { nextRandom } from '../../src/simulation/rng';
import { bindSharedOpeningEncounter, createOpeningEncounter, openingEncounterId } from '../../src/simulation/opening-encounter';
import { generateChoices } from '../../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../../src/simulation/augment-offers';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation, setSharedShopLock } from '../../src/simulation/shared-pool';
import { restoreCarouselSeat } from '../../src/simulation/carousel';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { canonicalContent } from '../../src/simulation/content';
import { rewardPlan } from '../fixtures/m5/augment-rewards-oracle.cjs';
import { augmentDraw } from '../fixtures/m5/oracle.g2.cjs';

function route() {
  for (let seed=0;seed<=100;seed++) {
    let rng=seed;
    for(let index=0;index<4;index++){
      const draw=nextRandom(rng);rng=draw.state;
      const s={...createCarouselMatch(draw.word),augmentTierSeed:seed,
        openingEncounter:bindSharedOpeningEncounter(createOpeningEncounter(seed),'test-room',`s${index}`)};
      const tier=resolveAugmentTier(s,'round:2-1:augment'), filter={node:'2-1',fieldedTraits:[],blocked:[],sharedCarousel:true};
      const offers=generateChoices(augmentCandidates(tier,[],[],openingEncounterId(s),filter),s.choiceRngState).offers;
      if(offers.includes('mad-chemist')){
        expect(offers).toEqual(augmentDraw(s.choiceRngState,tier,[],[],'round:2-1:augment',[],true).offers);
        return {seed,seatId:`s${index}`};
      }
    }
  }
  throw Error('No B5-67 room offer in seeds 0..100');
}

describe('B5-67 real online room commands and authenticated saves',()=>{
  const found=route(), {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed:found.seed,carousel:CAROUSEL_RULES_BINDING}), seatId=found.seatId;
  const seat=()=>room.state.seats.find(s=>s.seatId===seatId)!;
  afterAll(()=>room.dispose());
  let acquired: MatchState;
  it('starts the real eight-seat room',()=>{room.start();expect(room.state.seats).toHaveLength(8);});
  for(const roundId of ['1-3','1-4','2-1'])it(`reaches ${roundId}`,()=>{
    expect(runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation').roundId).toBe(roundId);
  });
  it('chooses the offered card, grants exactly the independent Singed reward, claims and deploys it',()=>{
    const choice=seat().match.pendingChoice!;expect(choice.offers).toContain('mad-chemist');
    const available=room.state.pool.available.singed;
    expect(room.handle(seatId,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'mad-chemist'})).toMatchObject({ok:true});
    acquired=seat().match;
    // Deliberately erase the output receipts. The oracle must still derive the same grant.
    const expected=rewardPlan({...acquired,seatMechanics:undefined},{}).gifts;
    expect(expected).toHaveLength(1);expect(expected[0]).toMatchObject({kind:'unit',definitionId:'singed',starLevel:1,acquiredRound:4});
    const actual=acquired.seatMechanics!.receipts.find(r=>r.receiptId===expected[0].receiptId)!;
    expect(actual).toMatchObject({source:expected[0].source,kind:'unit',definitionId:'singed',starLevel:1});
    claimAllOrbs(room,[seatId]);
    expect(room.state.pool.available.singed).toBe(available-1);
    const singed=seat().match.preparation.units.find(u=>u.definitionId==='singed'&&u.team==='player')!;
    expect(singed).toBeDefined();
    expect(room.handle(seatId,{type:'deploy',unitId:singed.id,target:{kind:'board',cell:{col:3,row:4}}})).toMatchObject({ok:true});
    assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
    const before=canonicalContent(room.state);
    expect(room.handle(seatId,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'mad-chemist'}).ok).toBe(false);
    expect(canonicalContent(room.state)).toBe(before);
    expect(seat().match.seatMechanics!.receipts.filter(r=>r.receiptId===expected[0].receiptId)).toHaveLength(1);
  });
  it('round-trips object and canonical JSON without history placeholders; rejects owner/reward/roster and authority tampering',()=>{
    const match=seat().match, authority=room.augmentHistoryAuthority(seatId), text=canonicalContent(match);
    expect(match.augmentHistory).toBeUndefined();
    expect(restoreSharedOrbSnapshot(room.state.pool,match,authority)).toEqual(match);
    expect(canonicalContent(restoreSharedOrbSnapshot(room.state.pool,text,authority))).toBe(text);
    expect(setSharedShopLock(room.state.pool,restoreSharedOrbSnapshot(room.state.pool,text,authority),!match.shop.locked,match.shop.generation))
      .toEqual(setSharedShopLock(room.state.pool,match,!match.shop.locked,match.shop.generation));
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,text)).toThrow('missing independent server authority');
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,text,JSON.parse(JSON.stringify(authority)))).toThrow('missing independent server authority');
    const mutations: ((s:any)=>void)[]=[
      s=>{s.augments.find((a:any)=>a.definitionId==='mad-chemist').acquiredRound++;},
      s=>{s.augments=[];},
      s=>{s.seatMechanics.receipts.find((r:any)=>r.receiptId.includes('mad-chemist')).definitionId='lux';},
      s=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>!r.receiptId.includes('mad-chemist'));},
      s=>{s.preparation.units.find((u:any)=>u.definitionId==='singed').starLevel=3;},
      s=>{s.gold++;},
      s=>{s.augmentHistory={version:'augment-history-v1',seatId,facts:[],proof:{kind:'server'}};},
    ];
    for(const mutate of mutations){const bad=JSON.parse(text);mutate(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,bad,authority)).toThrow();expect(()=>restoreSharedOrbSnapshot(room.state.pool,canonicalContent(bad),authority)).toThrow();}
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,match,room.augmentHistoryAuthority(seatId=== 's0'?'s1':'s0'))).toThrow();
  });
  it('executes the actual PvP battle, with poison packets and no strengthened Singed attacks on either side',()=>{
    answerOpenChoices(room);
    runUntilClaiming(room,clock,s=>s.roundId==='2-1'&&s.phase==='settlement');
    const battle=room.state.battles.find(b=>b.kind==='two-sided'&&b.participants.includes(seatId));
    expect(battle?.kind).toBe('two-sided');if(battle?.kind!=='two-sided')throw Error('missing real PvP battle');
    const chemist=battle.battle.initial.units.find(u=>u.mechanics?.some(m=>m.mechanic==='madChemist'))!;
    expect(chemist).toBeDefined();
    expect(battle.battle.events.some(e=>e.type==='attack'&&e.attackerId===chemist.id)).toBe(false);
    const poison=battle.battle.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId===chemist.id&&e.outcome.context.delivery==='ability-periodic');
    expect(poison.length).toBeGreaterThan(0);
    expect(battle.battle.terminal.units.find(u=>u.id===chemist.id)!.madChemist).toBeDefined();
    expect(seat().match.roundResults.at(-1)?.roundKind).toBe('pvp');
    const match=seat().match, authority=room.augmentHistoryAuthority(seatId);
    expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(match),authority)).toEqual(match);
    // A genuinely earlier server checkpoint cannot authorize the later save.
    const bad=structuredClone(match) as any;bad.roundResults.at(-1).combatTicks++;
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,bad,authority)).toThrow();
    expect(acquired.augments.filter(a=>a.definitionId==='mad-chemist')).toHaveLength(1);
  });
  for(const roundId of ['2-2','2-3'])it(`continues through ${roundId} with the production carousel binding`,()=>{
    expect(runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation').roundId).toBe(roundId);
  });
  it('round-trips the real carousel seat and rejects poison-owner and reward changes through its restore entry too',()=>{
    runUntilClaiming(room,clock,s=>s.roundId==='2-4'&&s.phase==='carousel'&&s.carousel?.state.status==='closed');
    const carousel=room.state.carousel!.state, match=seat().match, authority=room.augmentHistoryAuthority(seatId);
    expect(match.carousel?.receipts.some(r=>r.seatId===seatId)).toBe(true);
    for(const input of [match,JSON.stringify(match),canonicalContent(match)])expect(restoreCarouselSeat(carousel,input,authority)).toEqual(match);
    expect(()=>restoreCarouselSeat(carousel,match)).toThrow('missing independent server authority');
    for(const mutation of [(s:any)=>{s.augments=[];},(s:any)=>{s.seatMechanics.receipts.find((r:any)=>r.receiptId.includes('mad-chemist')).definitionId='lux';}]){
      const bad=structuredClone(match);mutation(bad);
      expect(()=>restoreCarouselSeat(carousel,bad,authority)).toThrow();expect(()=>restoreCarouselSeat(carousel,JSON.stringify(bad),authority)).toThrow();
    }
  });
});
