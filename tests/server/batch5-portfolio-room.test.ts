import { roomOfferFor } from './augment-offer-helpers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { restoreSharedOrbSnapshot } from '../../src/server-entry';
import type { SeatCommand } from '../../src/server/room/types';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { seatPushEvents } from '../../src/server/room/projection';
import { makeRoom, runUntil } from './helpers';
import { activeTraits, goldPlan } from '../fixtures/m5/h4-rewards-oracle.cjs';
import { validateRewards } from '../fixtures/m5/augment-rewards-oracle.cjs';
import { CATALOG, COST, ROUNDS, xp, entryXp, benchXp } from '../fixtures/m5/oracle.g2.cjs';

const SOURCE='augment-pool-batch5-h4';
const env={CATALOG,COST,ROUNDS,xp,entryXp,benchXp};
describe.each([
  // v26 D5 (7953c99a) pool: seed 78's s2 no longer gets Diversified Portfolio at 2-1; seed 31 is the first room seed from 0
  // offering it (to s0, a human seat, after one public slot reroll). Was {seed:78,seatId:'s2'}.
  {id:'diversified-portfolio',seed:31,seatId:'s0',acquire:4,build:9,initial:1},
  // v26 D5 (7953c99a) pool: seed 6's s3 no longer gets it at 3-2; seed 1 is the first room seed from 0 offering it (s0, unrerolled).
  {id:'diversified-portfolio-plus',seed:1,seatId:'s0',acquire:12,build:12,initial:4},
])('$id through a real eight-seat room',({id,seed,seatId,acquire,build,initial})=>{
  const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed});
  const seat=()=>room.state.seats.find(s=>s.seatId===seatId)!;
  const command=(value:SeatCommand)=>{
    const s=seat(),result=s.controller==='bot'?room.handleBot(seatId,s.controlEpoch,value):room.handle(seatId,value);
    expect(result).toMatchObject({ok:true});
  };
  beforeAll(()=>room.start());afterAll(()=>room.dispose());
  // Real combat per natural round, within the existing test timeout.
  for(let round=1;round<=build;round++)it(`plays round ${round} through public commands`,()=>{
    // Supply has no preparation notification in this room configuration.
    if(ROUNDS[round-1].kind!=='supply')runUntil(room,clock,s=>s.round===round&&s.phase==='preparation');
    expect(room.state.fault).toBeNull();
    if(round===acquire){
      roomOfferFor(room,seatId,id);const before=seat().match,c=before.pendingChoice!;expect(c.offers).toContain(id);
      command({type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:id});
      expect(seat().match.gold).toBe(before.gold+initial);
      expect(seat().match.seatMechanics!.receipts.filter(r=>r.source===SOURCE)).toEqual([]);
    }
    if(round===build){
      // Buy a literal three-trait composition: Automata, Conqueror and Watcher.
      // No injected board, funds, augment offers, outcome or receipt.
      const targets=['amumu','nocturne','darius','draven'];
      for(const u of seat().match.preparation.units.filter(u=>u.team==='player'))command({type:'sell',unitId:u.id});
      for(let rolls=0;!targets.every(id=>seat().match.preparation.units.some(u=>u.team==='player'&&u.definitionId===id));rolls++){
        expect(rolls).toBeLessThan(35);
        for(let slot=0;slot<5;slot++){
          const s=seat().match,offer=s.shop.slots[slot];
          if(offer.status==='available'&&targets.includes(offer.definitionId)&&!s.preparation.units.some(u=>u.team==='player'&&u.definitionId===offer.definitionId))
            command({type:'buy',slot,generation:s.shop.generation});
        }
        if(!targets.every(id=>seat().match.preparation.units.some(u=>u.team==='player'&&u.definitionId===id)))command({type:'reroll'});
      }
      for(const [col,u]of seat().match.preparation.units.filter(u=>u.team==='player').entries())
        command({type:'deploy',unitId:u.id,target:{kind:'board',cell:{col,row:4}}});
      expect(activeTraits({units:seat().match.preparation.units,items:seat().match.items},seat().match.augments)).toEqual(['automata','conqueror','watcher']);
    }
    runUntil(room,clock,s=>s.round===round&&s.phase==='settlement');
  });
  it('pays one gold at entry after frozen income and authenticates object/JSON restores',()=>{
    const before=seat().match;
    runUntil(room,clock,s=>s.round===build+1&&s.phase==='preparation');
    const after=seat().match,events=seatPushEvents(seat());
    const result=before.roundResults.at(-1)!;
    expect(after.gold).toBe(before.gold+result.income-result.incomeBreakdown.win+1);
    const expected={receiptId:JSON.stringify([SOURCE,`round:${ROUNDS[acquire-1].roundId}:augment`,build+1]),
      source:SOURCE,kind:'gold',amount:1,round:build+1,roundId:ROUNDS[build].roundId};
    expect(after.seatMechanics!.receipts.filter(r=>r.source===SOURCE)).toEqual([expected]);
    expect(goldPlan(after)).toEqual([{receiptId:expected.receiptId,source:SOURCE,kind:'gold',amount:1,round:build+1}]);
    expect(()=>validateRewards(before,after,{type:'continue'},events,env)).not.toThrow();
    const authority=room.augmentHistoryAuthority(seatId);
    for(const input of [after,JSON.stringify(after)]){
      const restored=restoreSharedOrbSnapshot(room.state.pool,input,authority);
      expect(restored).toEqual(after);
      expect(()=>validateRewards(restored,restored,{type:'reconnect'},[],env)).not.toThrow();
    }
    for(const connected of [false,true,false,true]){
      room.setConnected(seatId,connected);expect(seat().match).toBe(after);
    }
    for(const edit of [
      (s:any)=>{s.seatMechanics.receipts.find((r:any)=>r.source===SOURCE).amount++;s.gold++;},
      (s:any)=>{s.seatMechanics.receipts=s.seatMechanics.receipts.filter((r:any)=>r.source!==SOURCE);s.gold--;},
      (s:any)=>{s.augmentHistory.facts.find((f:any)=>f.kind==='round-entry'&&f.round===s.round).roster.units=[];},
    ]){
      const bad=structuredClone(after);edit(bad);
      for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreSharedOrbSnapshot(room.state.pool,input,authority)).toThrow();
      expect(()=>validateRewards(before,bad,{type:'continue'},events,env)).toThrow(/independent H4/);
    }
  });
});
