import { acquire } from './augment-pool-batch5-h7-helpers';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { AUGMENT_BATCH5_H7 } from '../src/simulation/content/augment-pool-batch5-h7';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { batch5H7GoldPlan, drainBatch5H7Gold, BATCH5_H7_SOURCE } from '../src/simulation/augment-pool-batch5-h7';
import { appendAugmentFact, requireAugmentFacts } from '../src/simulation/augment-history';
import { accepted, fieldBench, finish } from './match-helpers';
import { makeRoom, runUntil, answerOpenChoices } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { shopOfferCost } from '../src/simulation/shop-augments';
import { openingEncounterId } from '../src/simulation/opening-encounter';
import { nextSharedRound, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
const entries=['object','JSON','serialized'] as const;
function restore(s: MatchState, entry: typeof entries[number]) {
  return restoreMatch(entry==='object'?s:entry==='JSON'?JSON.stringify(s):serializeMatch(s));
}
function receipts(s:MatchState) {return (s.seatMechanics?.receipts??[]).filter(r=>r.source===BATCH5_H7_SOURCE);}
const {h7Gold}=createRequire(import.meta.url)('./fixtures/m5/augment-h7-oracle.cjs');
function checkIndependentGold(s:MatchState) {
  expect(receipts(s).map(({receiptId,source,kind,round,...rest})=>({receiptId,source,kind,round,amount:'amount' in rest?rest.amount:undefined})))
    .toEqual(h7Gold(s));
}

it.skipIf(!existsSync(RESEARCH_FILE))('matches exact 14.24 research numbers, tier, identity and descriptions',()=>{
  const research=JSON.parse(readFileSync(RESEARCH_FILE,'utf8'));
  for(const row of Object.values(AUGMENT_BATCH5_H7)) {
    const source=research.find((r:any)=>r.apiName===row.apiName);
    expect(row.source.values).toEqual(source.effects);expect(source.tier).toBe(1);expect(row.description).toBe(source.description_zh_cn);
  }
});

describe('B5-42 Good for Something',()=>{
  let setup:ReturnType<typeof makeRoom>,seatId:string,s:MatchState,before:MatchState;
    beforeAll(()=>{
      for(let seed=0;seed<=100;seed++) {
        const candidate=makeRoom(new TwoSidedBattleResolver(),{seed});
        const possible=!['scuttle-puddle','crab-rave'].includes(openingEncounterId(candidate.room.state.seats[0].match)??'') && candidate.room.state.seats.some(({match:s})=>generateChoices(augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),s.choiceRngState).offers.includes('good-for-something'));
        if(possible){setup=candidate;setup.room.start();return;}
        candidate.room.dispose();
      }
      throw Error('No room seed in 0..100');
    });
    for(const round of [2,3,4])beforeAll(()=>{runUntil(setup.room,setup.clock,s=>s.round===round&&s.phase==='preparation');});
    beforeAll(()=>{
      const {room}=setup,seat=room.state.seats.find(s=>s.match.pendingChoice?.offers.includes('good-for-something'))!;
      expect(seat).toBeDefined();seatId=seat.seatId;const c=seat.match.pendingChoice!;
      expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'good-for-something'}).ok).toBe(true);
      before=room.state.seats.find(s=>s.seatId===seatId)!.match;
    });
    for (const round of [4,5,6]) beforeAll(()=>{
      const {room,clock}=setup;
      if (s && receipts(s).length) return;
      runUntil(room,clock,s=>s.round===round&&s.phase==='preparation');
      const others=room.state.seats.filter(seat=>seat.seatId!==seatId);
      answerOpenChoices(room,others.map(seat=>seat.seatId));
      // Normal purchases make the opponents stronger than the holder's opening hero.
      for (const seat of others) for(let slot=0;slot<5;slot++) {
        const current=room.state.seats.find(s=>s.seatId===seat.seatId)!.match;
        const offer=current.shop.slots[slot];
        if(offer.status==='available' && current.gold>=shopOfferCost(offer) && current.preparation.units.filter(u=>u.location.kind==='bench').length<current.preparation.benchSize)
          expect(room.handle(seat.seatId,{type:'buy',slot,generation:current.shop.generation})).toMatchObject({ok:true});
      }
      runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');s=room.state.seats.find(s=>s.seatId===seatId)!.match;
    });
    afterAll(()=>setup?.room.dispose());
  it('offers only at 2-1',()=>{
    for(const node of ['2-1','3-2','4-2']) expect(augmentCandidates('silver',[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('good-for-something')).toBe(node==='2-1');
  });
  describe('executed public commands and authenticated saves',()=>{
    beforeAll(()=>{
      expect(requireAugmentFacts(s,'deaths',s.round).flatMap(f=>f.deaths).filter(d=>d.ownerSeatId===seatId).length).toBeGreaterThan(0);
    });
    const restoreOnline=(state:MatchState,entry:typeof entries[number])=>{
      const input=entry==='object'?state:entry==='JSON'?JSON.stringify(state):Buffer.from(JSON.stringify(state),'utf8').toString('utf8');
      return restoreSharedOrbSnapshot(setup.room.state.pool,input,setup.room.augmentHistoryAuthority(seatId));
    };
    it('pays deaths once, preserves the previous immutable snapshot and no-op identity',()=>{
      expect(batch5H7GoldPlan(s)).toHaveLength(receipts(s).length);
      expect(receipts(s).length).toBeGreaterThan(0);
      checkIndependentGold(s);
      expect(drainBatch5H7Gold(s).state).toBe(s);
      expect(stepMatch(s).state).toBe(s);
      expect(before.augmentHistory!.facts.some(f=>f.kind==='deaths')).toBe(false);
    });
    for(const entry of entries) {
      it(`${entry} round trips and continues identically`,()=>{
        const copy=restoreOnline(s,entry);expect(copy).toEqual(s);
        const all=setup.room.state.seats.map(seat=>seat.match);
        const continued=nextSharedRound(setup.room.state.pool,all.map(m=>m===s?copy:m),s.round);
        expect(continued.ok).toBe(true);
        expect(continued).toEqual(nextSharedRound(setup.room.state.pool,all,s.round));
      });
      for(const attack of ['missing','death','equipment','receipt','gold','proof']) it(`${entry} rejects ${attack} tampering`,()=>{
        const bad:any=structuredClone(s);
        if(attack==='missing')delete bad.augmentHistory;
        if(attack==='death')bad.augmentHistory.facts.find((f:any)=>f.kind==='deaths'&&f.deaths.length).deaths[0].ordinaryHero=false;
        if(attack==='equipment')bad.augmentHistory.facts.find((f:any)=>f.kind==='deaths'&&f.deaths.length).deaths[0].equipment.push({definitionId:'belt',slot:0,temporary:true});
        if(attack==='receipt')bad.seatMechanics.receipts.find((r:any)=>r.source===BATCH5_H7_SOURCE).amount++;
        if(attack==='gold')bad.gold++;
        if(attack==='proof')bad.augmentHistory.proof.kind='solo';
        expect(()=>restoreOnline(bad,entry)).toThrow();
        expect(()=>restore(bad,entry)).toThrow();
      });
    }
  });
  it('uses death-time ownership, temporary equipment and chest grants; repeated resurrection deaths are distinct',()=>{
    const s=before;
    const base={combatId:'combat-fixture',tick:1,unitId:'unit-1',definitionId:'irelia',team:'player' as const,ownerSeatId:seatId,originalUnitId:'unit-1',ordinaryHero:true,equipment:[],combatItemGrants:[]};
    const deaths=Array.from({length:40},(_,eventSeq)=>({...base,eventSeq}));
    const sample=(rows:typeof deaths)=>appendAugmentFact(s,{kind:'deaths',battleId:base.combatId,completeThroughTick:1,deaths:rows});
    const expected=batch5H7GoldPlan(sample(deaths));expect(expected.length).toBeGreaterThan(1);expect(expected.length).toBeLessThan(deaths.length);
    expect(batch5H7GoldPlan(sample([...deaths,...deaths]))).toEqual(expected);
    expect(batch5H7GoldPlan(sample(deaths.map(d=>({...d,ordinaryHero:false}))))).toEqual([]);
    expect(batch5H7GoldPlan(sample(deaths.map(d=>({...d,ownerSeatId:'other'}))))).toEqual([]);
    for(const temporary of [false,true]) expect(batch5H7GoldPlan(sample(deaths.map(d=>({...d,equipment:[{definitionId:'belt',slot:0,temporary}]})) as typeof deaths))).toEqual([]);
    expect(batch5H7GoldPlan(sample(deaths.map(d=>({...d,combatItemGrants:[{definitionId:'belt'}]})) as any))).toEqual([]);
  });
  describe('real online room',()=>{
    it('publishes executed death facts and domain grant receipts',()=>{
      expect(requireAugmentFacts(s,'deaths',4).flatMap(f=>f.deaths).length).toBeGreaterThan(0);
      expect(receipts(s)).toHaveLength(batch5H7GoldPlan(s).length);
      // The offline serializer deliberately refuses server checkpoints; online persistence uses JSON + independent authority.
      expect(()=>serializeMatch(s)).toThrow('multiplayer-state');
    });
    for(const entry of ['object','JSON'] as const)it(`${entry} online round trip and tamper rejection`,()=>{
      const {room}=setup,authority=room.augmentHistoryAuthority(seatId);
      const input=(s:MatchState)=>entry==='object'?s:JSON.stringify(s);
      expect(restoreSharedOrbSnapshot(room.state.pool,input(s),authority)).toEqual(s);
      for(const attack of ['death','gold','missing']){
        const bad:any=structuredClone(s);
        if(attack==='death')bad.augmentHistory.facts.find((f:any)=>f.kind==='deaths').completeThroughTick++;
        if(attack==='gold')bad.gold++;
        if(attack==='missing')delete bad.augmentHistory;
        expect(()=>restoreSharedOrbSnapshot(room.state.pool,input(bad),authority)).toThrow();
      }
    });
  });
  describe('subsequent online PvE',()=>{
    for(const round of [5,6,8,9,10])beforeAll(()=>{
      if(setup.room.state.round<round)runUntil(setup.room,setup.clock,s=>s.round===round&&s.phase==='preparation');
    });
    beforeAll(()=>{
      const {room}=setup;
      for(const unit of room.state.seats.find(s=>s.seatId===seatId)!.match.preparation.units.filter(u=>u.team==='player'))
        expect(room.handle(seatId,{type:'sell',unitId:unit.id})).toMatchObject({ok:true});
      let match=room.state.seats.find(s=>s.seatId===seatId)!.match;
      for(let rolls=0;rolls<10&&!match.shop.slots.some(o=>o.status==='available'&&o.definitionId==='powder');rolls++){
        expect(room.handle(seatId,{type:'reroll'})).toMatchObject({ok:true});
        match=room.state.seats.find(s=>s.seatId===seatId)!.match;
      }
      const slot=match.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId==='powder');
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(room.handle(seatId,{type:'buy',slot,generation:match.shop.generation})).toMatchObject({ok:true});
      const hero=room.state.seats.find(s=>s.seatId===seatId)!.match.preparation.units.find(u=>u.team==='player')!;
      expect(room.handle(seatId,{type:'deploy',unitId:hero.id,target:{kind:'board',cell:{col:3,row:4}}})).toMatchObject({ok:true});
    });
    beforeAll(()=>{runUntil(setup.room,setup.clock,s=>s.round===10&&s.phase==='settlement');});
    it('keeps actual player ownership and exactly-once death grants through the PvE stream and restore',()=>{
      const {room}=setup,match=room.state.seats.find(s=>s.seatId===seatId)!.match;
      const deaths=requireAugmentFacts(match,'deaths',10).flatMap(f=>f.deaths);
      expect(deaths.filter(d=>d.ownerSeatId===seatId).length,JSON.stringify({seatId,round:match.roundDefinitionId,result:match.roundResults.at(-1)?.result,
        units:match.preparation.units.map(u=>({id:u.id,definitionId:u.definitionId,location:u.location})),deaths})).toBeGreaterThan(0);
      expect(deaths.every(d=>d.ownerSeatId===(d.team==='player'?seatId:null))).toBe(true);
      checkIndependentGold(match);expect(drainBatch5H7Gold(match).state).toBe(match);
      expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(match),room.augmentHistoryAuthority(seatId))).toEqual(match);
    });
  });
});

describe('B5-43 Lunch Money',()=>{
  it('offers at 2-1 and 3-2, never 4-2',()=>{
    for(const node of ['2-1','3-2','4-2']) expect(augmentCandidates('silver',[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('lunch-money')).toBe(node!=='4-2');
  });
  describe('solo commands and unknown opposing HP',()=>{
    let s:MatchState;
    beforeAll(()=>{s=finish(accepted(startMatchCombat(fieldBench(acquire('lunch-money')))));});
    it('records unknown enemy HP without inventing online damage or rewards',()=>{
      expect(requireAugmentFacts(s,'player-damage',s.round)[0]).toMatchObject({opponentSeatId:null,actualDamage:null});
      expect(batch5H7GoldPlan(s)).toEqual([]);expect(receipts(s)).toEqual([]);
    });
    for(const entry of entries) {
      it(`${entry} round trips acquisition and settlement`,()=>{expect(restore(s,entry)).toEqual(s);});
      for(const attack of ['missing','damage','gold','remove','duplicate']) it(`${entry} rejects ${attack}`,()=>{
        const bad:any=structuredClone(s);
        if(attack==='missing')delete bad.augmentHistory;
        if(attack==='damage')bad.augmentHistory.facts.find((f:any)=>f.kind==='player-damage').actualDamage=8;
        if(attack==='gold')bad.gold+=2;
        if(attack==='remove')bad.augmentHistory.facts=bad.augmentHistory.facts.filter((f:any)=>f.kind!=='player-damage');
        if(attack==='duplicate')bad.augmentHistory.facts.push({...bad.augmentHistory.facts.find((f:any)=>f.kind==='player-damage'),sequence:bad.augmentHistory.facts.length});
        expect(()=>restore(bad,entry)).toThrow();
      });
    }
  });
  it('planner excludes mirrors and overkill, retains remainder and can cross multiple thresholds',()=>{
    let s=finish(accepted(startMatchCombat(fieldBench(acquire('lunch-money')))));
    const add=(battleId:string,damage:number,mirror=false)=>{s=appendAugmentFact(s,{kind:'player-damage',battleId,opponentSeatId:'enemy',mirror,hpBefore:damage,hpAfterDamage:0,actualDamage:damage});};
    add('first',7);expect(batch5H7GoldPlan(s)).toEqual([]);
    add('mirror',20,true);expect(batch5H7GoldPlan(s)).toEqual([]);
    // Even a lethal combat with a huge damage proposal contributes only these 3 remaining HP.
    add('lethal',3);expect(batch5H7GoldPlan(s).map(r=>r.amount)).toEqual([2]);
    add('large',22);expect(batch5H7GoldPlan(s).map(r=>r.amount)).toEqual([2,6]);
    add('large',22);expect(batch5H7GoldPlan(s).map(r=>r.amount)).toEqual([2,6]);
    expect(()=>restoreMatch(s)).toThrow(); // An appended vector is not a legitimate public-command history.
  });
  describe('online actual damage and carry between wins',()=>{
    let setup:ReturnType<typeof makeRoom>,seatId:string;
    const snapshots:MatchState[]=[];
    beforeAll(()=>{
      for(let seed=0;seed<=100;seed++) {
        const candidate=makeRoom(new TwoSidedBattleResolver(),{seed});
        const possible=candidate.room.state.seats.some(({match:s})=>generateChoices(augmentCandidates(resolveAugmentTier(s,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),s.choiceRngState).offers.includes('lunch-money'));
        if(possible){setup=candidate;setup.room.start();return;}candidate.room.dispose();
      }
      throw Error('No room seed in 0..100');
    });
    for(const round of [2,3,4])beforeAll(()=>{runUntil(setup.room,setup.clock,s=>s.round===round&&s.phase==='preparation');});
    beforeAll(()=>{
      const {room}=setup,seat=room.state.seats.find(s=>s.match.pendingChoice?.offers.includes('lunch-money'))!;
      expect(seat).toBeDefined();seatId=seat.seatId;const c=seat.match.pendingChoice!;
      expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'lunch-money'}).ok).toBe(true);
    });
    for(const round of [4,5,6]) {
      beforeAll(()=>{
        const {room,clock}=setup;if(round!==4)runUntil(room,clock,s=>s.round===round&&s.phase==='preparation');
        // Legal sell commands leave every opponent with no army; the chosen seat wins genuine two-sided battles.
        for(const seat of room.state.seats.filter(s=>s.seatId!==seatId)) {
          while(room.state.seats.find(s=>s.seatId===seat.seatId)!.match.pendingChoice) {
            const c=room.state.seats.find(s=>s.seatId===seat.seatId)!.match.pendingChoice!;
            expect(room.handle(seat.seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]}).ok).toBe(true);
          }
          for(const unit of room.state.seats.find(s=>s.seatId===seat.seatId)!.match.preparation.units.filter(u=>u.team==='player'))
            expect(room.handle(seat.seatId,{type:'sell',unitId:unit.id}).ok).toBe(true);
        }
        runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');
        snapshots.push(room.state.seats.find(s=>s.seatId===seatId)!.match);
      });
    }
    afterAll(()=>setup?.room.dispose());
    it('pays exactly floor(cumulative actual HP loss / 8) * 2, including carried remainder',()=>{
      let total=0;
      for(const s of snapshots) {
        const f=requireAugmentFacts(s,'player-damage',s.round)[0];
        expect(f.mirror).toBe(false);expect(f.actualDamage).toBe(f.hpBefore!-f.hpAfterDamage!);
        expect(f.actualDamage).toBeGreaterThan(0);total+=f.actualDamage!;
        expect(receipts(s).reduce((n,r)=>n+(r.kind==='gold'?r.amount:0),0)).toBe(Math.floor(total/8)*2);
        checkIndependentGold(s);
        expect(drainBatch5H7Gold(s).state).toBe(s);
      }
      expect(total).toBeGreaterThanOrEqual(8);expect(total%8).toBeGreaterThan(0);
      expect(receipts(snapshots.at(-1)!).length).toBeGreaterThan(0);
    });
    for(const entry of ['object','JSON'] as const)it(`${entry} authenticates online damage/reward and rejects altered facts or receipts`,()=>{
      const {room}=setup,s=snapshots.at(-1)!,authority=room.augmentHistoryAuthority(seatId);
      const input=(s:MatchState)=>entry==='object'?s:JSON.stringify(s);
      expect(restoreSharedOrbSnapshot(room.state.pool,input(s),authority)).toEqual(s);
      for(const attack of ['damage','mirror','hp','reward','gold']) {
        const bad:any=structuredClone(s),f=bad.augmentHistory.facts.find((f:any)=>f.kind==='player-damage');
        if(attack==='damage')f.actualDamage++;
        if(attack==='mirror')f.mirror=true;
        if(attack==='hp')f.hpAfterDamage++;
        if(attack==='reward')bad.seatMechanics.receipts.find((r:any)=>r.source===BATCH5_H7_SOURCE).amount++;
        if(attack==='gold')bad.gold+=2;
        expect(()=>restoreSharedOrbSnapshot(room.state.pool,input(bad),authority)).toThrow();
      }
    });
  });
});
