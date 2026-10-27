import { afterAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntil, runUntilClaiming, claimAllOrbs, answerOpenChoices } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { createMatch } from '../../src/simulation/match';
import { bindSharedOpeningEncounter, createOpeningEncounter, openingEncounterId } from '../../src/simulation/opening-encounter';
import { nextRandom } from '../../src/simulation/rng';
import { generateChoices } from '../../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../../src/simulation/augment-offers';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { requireAugmentFacts } from '../../src/simulation/augment-history';
import { drainLootExplosionRewards, lootExplosionRewardPlan, validateLootExplosionRewards } from '../../src/simulation/augment-pool-batch5-g7';
import { lootExplosionPlan, validateLootExplosionReceipts } from '../fixtures/m5/augment-rewards-oracle.cjs';
import type { MatchState } from '../../src/simulation/match-types';

const ID='loot-explosion',SOURCE='augment-pool-batch5-g7';
let found:{seed:number;seatId:string}|undefined;
// Cheap offer-only discovery, bounded by the user's 0..100 limit; the actual route below verifies it.
for(let seed=0;seed<=100&&!found;seed++){
  let rng=seed;
  for(let index=0;index<4;index++){
    const draw=nextRandom(rng);rng=draw.state;
    const s={...createMatch(draw.word,{mode:'shared-deferred'}),augmentTierSeed:seed,openingEncounter:bindSharedOpeningEncounter(createOpeningEncounter(seed),'test-room',`s${index}`)};
    const candidates=augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],openingEncounterId(s),{node:'2-1',fieldedTraits:[],blocked:[]});
    if(generateChoices(candidates,s.choiceRngState).offers.includes(ID)){found={seed,seatId:`s${index}`};break;}
  }
}
if(!found)throw new Error('No Loot Explosion room offer in seeds 0..100');
const {seed,seatId}=found;
const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed});
const own=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
let terminal:MatchState;
afterAll(()=>room.dispose());

describe('B5-69 real online room',()=>{
  it('starts the room',()=>{room.start();});
  for(const roundId of ['1-3','1-4','2-1'])it(`reaches ${roundId}`,()=>{
    expect(runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation').roundId).toBe(roundId);
  });
  it('selects the offered card and claims both champion gifts through room commands',()=>{
    const c=own().pendingChoice!;expect(c.offers).toContain(ID);
    expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:ID})).toMatchObject({ok:true});
    const gifts=own().seatMechanics!.receipts.filter(r=>r.receiptId.includes(ID));
    expect(gifts).toMatchObject([{kind:'unit',definitionId:'camille',resolution:'orb'},{kind:'unit',definitionId:'powder',resolution:'orb'}]);
    claimAllOrbs(room,[seatId]);
    expect(own().preparation.units.some(u=>u.definitionId==='camille')).toBe(true);
    expect(own().preparation.units.some(u=>u.definitionId==='powder')).toBe(true);
    answerOpenChoices(room);
    // Use the actual public sell/deploy commands to make last-hit attribution unambiguous.
    for(const s of room.state.seats) {
      const keep=s.seatId===seatId?new Set(['camille','powder']):new Set([s.match.preparation.units.find(u=>u.team==='player')!.definitionId]);
      for(const u of [...s.match.preparation.units].filter(u=>u.team==='player'&&!keep.has(u.definitionId)))
        expect(room.handle(s.seatId,{type:'sell',unitId:u.id})).toMatchObject({ok:true});
    }
    const units=own().preparation.units.filter(u=>u.team==='player');
    for(const [i,u]of units.entries())expect(room.handle(seatId,{type:'deploy',unitId:u.id,target:{kind:'board',cell:{col:i%7,row:4+Math.floor(i/7)}}})).toMatchObject({ok:true});
    expect(own().seatMechanics?.receipts.filter(r=>r.source===SOURCE)).toHaveLength(0);
  });
  it('freezes a real battle and awards nothing during combat',()=>{
    runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='battle');
    expect(own().seatMechanics?.receipts.filter(r=>r.source===SOURCE)).toHaveLength(0);
  });
  it('settles the first real Ambusher last hits',()=>{
    runUntil(room,clock,s=>s.roundId==='2-1'&&s.phase==='settlement');terminal=own();
    expect(room.state.fault).toBeNull();
    const deaths=requireAugmentFacts(terminal,'deaths',terminal.round).flatMap(f=>f.deaths);
    const kills=deaths.filter(d=>d.lootExplosion?.killerSeatId===seatId);
    expect(kills.length).toBeGreaterThan(0);
    for(const d of kills){expect(d.ordinaryHero).toBe(true);expect(d.ownerSeatId).not.toBe(seatId);expect(d.lootExplosion!.critChanceBps).toBeGreaterThanOrEqual(2500);}
  });
  for(const roundId of ['2-2','2-3']){
    it(`enters ${roundId} through the room`,()=>{runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation');});
    it(`settles ${roundId} through the room`,()=>{runUntil(room,clock,s=>s.roundId===roundId&&s.phase==='settlement');terminal=own();});
  }
  it('awards real last hits once and matches independently drawn loot',()=>{
    const expected=lootExplosionPlan(terminal),actual=terminal.seatMechanics!.receipts.filter(r=>r.source===SOURCE);
    expect(actual.length).toBeGreaterThan(0);
    expect(actual.map(r=>r.receiptId).sort()).toEqual([...expected.gold,...expected.gifts].map(r=>r.receiptId).sort());
    for(const r of actual){
      const g=expected.gold.find(g=>g.receiptId===r.receiptId),i=expected.gifts.find(g=>g.receiptId===r.receiptId);
      if(g)expect(r).toMatchObject({kind:'gold',amount:g.amount,round:g.round});
      else expect(r).toMatchObject({kind:'item',definitionId:i!.definitionId,round:i!.acquiredRound});
      if(r.round===terminal.round)expect(room.state.seats.find(s=>s.seatId===seatId)!.serverEvents?.events.filter(e=>e.type==='mechanicGranted'&&e.receipt.receiptId===r.receiptId)).toHaveLength(1);
    }
    expect(drainLootExplosionRewards(terminal)).toBe(terminal);
    expect(()=>validateLootExplosionRewards(terminal)).not.toThrow();
    expect(lootExplosionRewardPlan(terminal)).toHaveLength(actual.length);
    expect(()=>validateLootExplosionReceipts(terminal)).not.toThrow();
    for(const edit of [(s:any)=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.source!==SOURCE);},(s:any)=>{const r=s.seatMechanics.receipts.find((r:any)=>r.source===SOURCE);if(r.kind==='gold')r.amount++;else r.definitionId='spatula';},(s:any)=>{s.seatMechanics.receipts.push({...s.seatMechanics.receipts.find((r:any)=>r.source===SOURCE),receiptId:'invented'});}]){
      const bad=structuredClone(terminal);edit(bad);expect(()=>validateLootExplosionReceipts(bad)).toThrow(/independent Loot Explosion/);
    }
  });
  it.each(['object','json','serialized'] as const)('round-trips %s online state and rejects omitted authority and joint tampering',form=>{
    const authority=room.augmentHistoryAuthority(seatId);
    const encode=(s:MatchState)=>form==='object'?s:form==='json'?JSON.stringify(s):canonicalContent(s);
    expect(restoreSharedOrbSnapshot(room.state.pool,encode(terminal),authority)).toEqual(terminal);
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,encode(terminal))).toThrow(/independent server authority/);
    const edits:((s:any)=>void)[]=[
      s=>{delete s.augmentHistory;},
      s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='deaths').deaths.find((d:any)=>d.lootExplosion?.killerSeatId===seatId).ordinaryHero=false;},
      s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='deaths').deaths.find((d:any)=>d.lootExplosion?.killerSeatId===seatId).lootExplosion.critChanceBps++;},
      s=>{s.augmentHistory.facts.find((f:any)=>f.kind==='deaths').deaths.find((d:any)=>d.lootExplosion?.killerSeatId===seatId).lootExplosion.killerSeatId='invented';},
      s=>{s.augmentHistory.facts=s.augmentHistory.facts.filter((f:any)=>f.kind!=='deaths');},
      s=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.source!==SOURCE);},
      s=>{const r=s.seatMechanics.receipts.find((r:any)=>r.source===SOURCE);if(r.kind==='gold'){r.amount++;s.gold++;}else r.definitionId='spatula';},
      s=>{s.augments=s.augments.filter((a:any)=>a.definitionId!==ID);},
    ];
    for(const [i,edit] of edits.entries()){const bad=structuredClone(terminal);edit(bad);expect(()=>restoreSharedOrbSnapshot(room.state.pool,encode(bad),authority),`tamper ${i}`).toThrow();}
    const forged=Object.freeze(JSON.parse(JSON.stringify(authority)));
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,encode(terminal),forged)).toThrow();
  });
  it('continues into 2-4 without reissuing the previous combat rewards',()=>{
    const ids=terminal.seatMechanics!.receipts.filter(r=>r.source===SOURCE).map(r=>r.receiptId);
    runUntilClaiming(room,clock,s=>s.roundId==='2-4');
    expect(own().seatMechanics!.receipts.filter(r=>r.source===SOURCE).map(r=>r.receiptId)).toEqual(ids);
    const restored=restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(own()),room.augmentHistoryAuthority(seatId));
    expect(drainLootExplosionRewards(restored)).toBe(restored);
  });
  for(const roundId of ['2-5','2-6','2-7']){
    it(`continues to ${roundId} after the shared carousel`,()=>{runUntilClaiming(room,clock,s=>s.roundId===roundId&&s.phase==='preparation');});
    it(`completes ${roundId} with the same authoritative reward ledger`,()=>{
      runUntil(room,clock,s=>s.roundId===roundId&&s.phase==='settlement');
      expect(()=>validateLootExplosionReceipts(own())).not.toThrow();
    });
  }
  it('records actual PvE deaths, excludes neutral monsters, and round-trips the resulting online save',()=>{
    const s=own(),rows=requireAugmentFacts(s,'deaths',s.round);
    expect(rows.at(-1)?.completeThroughTick).toBe(s.roundResults.at(-1)?.combatTicks);
    expect(rows.flatMap(f=>f.deaths).filter(d=>d.team==='enemy').length).toBeGreaterThan(0);
    expect(rows.flatMap(f=>f.deaths).filter(d=>d.team==='enemy').every(d=>!d.ordinaryHero&&!d.lootExplosion)).toBe(true);
    expect(s.seatMechanics!.receipts.filter(r=>r.source===SOURCE&&r.round===s.round)).toHaveLength(0);
    expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(s),room.augmentHistoryAuthority(seatId))).toEqual(s);
  });
});
