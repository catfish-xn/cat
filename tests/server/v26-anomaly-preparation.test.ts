import { expect, it } from 'vitest';
import { prepareMatchLoot } from '../../src/simulation/loot-runtime';
import { freezeOrbLayoutThroughRound } from '../../src/simulation/orb-layout';
import { getMultiplayerRoundByOrdinal } from '../../src/simulation/multiplayer-round';
import type { RoomState } from '../../src/server/room/types';
import { PER_ROUND_PREPARATION, type Room } from '../../src/server/room/room';
import { makeRoom } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toPlayerView } from '../../src/server/room/projection';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { ManualClock } from '../../src/server/room/clock';
import { LOCAL_ROOM_DEFAULTS, LocalRoomClient } from '../../src/rendering/online/local-room-client';

function enterAnomaly(emptySeat = false, gold = 20) {
  const result = makeRoom(new TwoSidedBattleResolver(), {preparationMs: PER_ROUND_PREPARATION});
  const {room} = result;
  room.start();
  return {...result,phases:stageAnomaly(room,emptySeat,gold)};
}

function stageAnomaly(room: Room, emptySeat = false, gold = 20) {
  if (emptySeat) {
    const s1 = room.state.seats[1];
    expect(room.handle('s1', {type:'sell',unitId:s1.match.preparation.units.find(u=>u.team==='player')!.id})).toMatchObject({ok:true});
  }
  // Isolated shared-seat fixture, not a natural-route/save fixture. Exercise actual round entry,
  // commands, public deadline and freeze rather than calling afterChoiceWindow directly.
  const seam = room as unknown as {current:RoomState;clearTimer():void;enterRound():void};
  seam.clearTimer();
  const round = getMultiplayerRoundByOrdinal(23);
  const frozen = freezeOrbLayoutThroughRound(room.state.pool.orbLayout, 23);
  if (!frozen.ok) throw new Error(frozen.reason);
  seam.current = {...room.state,pool:{...room.state.pool,naturalRound:23,orbLayout:frozen.layout},
    seats:room.state.seats.map(seat=>({...seat,match:{...seat.match,round:23,roundDefinitionId:'4-6',gold,
      phase:emptySeat&&seat.seatId==='s1'?'preparation':'choice',
      m8:{...seat.match.m8,round,loot:prepareMatchLoot(seat.match.seed,23,seat.match.m8.loot,frozen.layout)},
      pendingChoice:emptySeat&&seat.seatId==='s1'?null:{kind:'anomaly',step:'target',choiceId:'round:4-6:anomaly',
        eventId:'round:4-6:anomaly',generation:0,offers:[],targetId:null,rerollCount:0,returnPhase:'preparation'},
    }}))} as RoomState;
  const phases:string[]=[];
  room.subscribe(s=>{if(s.roundId==='4-6'&&phases.at(-1)!==s.phase)phases.push(s.phase);});
  seam.enterRound();
  return phases;
}

it.each(['room','local-room'] as const)('%s refuses all anomaly-pending sales atomically, accepts moves and permits selling after confirmation', transport => {
  const clock = new ManualClock();
  const client = transport === 'local-room' ? new LocalRoomClient({...LOCAL_ROOM_DEFAULTS,clock,carousel:false}) : null;
  if (client) { client.joinQueue('异变测试'); client.startMatch(); }
  const room = client?.currentRoom ?? makeRoom(new TwoSidedBattleResolver(),{clock,preparationMs:PER_ROUND_PREPARATION}).room;
  if (!client) room.start();
  try {
    stageAnomaly(room);
    const seatId=room.state.seats[0].seatId, match=()=>room.state.seats[0].match;
    const send=(command:Parameters<Room['handle']>[1])=>client ? client.send(command) : room.handle(seatId,command);
    const deadline=room.state.deadlineAt!;
    const slot=match().shop.slots.findIndex(s=>s.status==='available');
    expect(send({type:'buy',slot,generation:match().shop.generation})).toMatchObject({ok:true});
    const [target,other]=match().preparation.units.filter(u=>u.team==='player');
    expect(other).toBeDefined();
    expect(send({type:'deploy',unitId:target.id,target:{kind:'board',cell:{col:0,row:4}}})).toMatchObject({ok:true});
    const refuseAll=()=>{
      const before=room.state, snapshot=structuredClone(before);
      for(const unit of match().preparation.units.filter(u=>u.team==='player')) {
        const result=send({type:'sell',unitId:unit.id});
        expect(result).toMatchObject({ok:false,reason:'wrong-phase'});
        if(transport==='room')expect(result.state).toBe(before.seats[0].match);
        expect(room.state).toBe(before);
        expect(room.state).toEqual(snapshot); // Includes pool holdings/revisions, fees, RNG, event sequences and deadline.
      }
    };
    refuseAll();
    let c=match().pendingChoice!;
    expect(send({type:'anomalyTarget',choiceId:c.choiceId,generation:c.generation,unitId:target.id})).toMatchObject({ok:true});
    refuseAll();
    c=match().pendingChoice!;
    expect(send({type:'anomalyReroll',choiceId:c.choiceId,generation:c.generation})).toMatchObject({ok:true});
    refuseAll();
    expect(send({type:'deploy',unitId:target.id,target:{kind:'bench',slot:8}})).toMatchObject({ok:true});
    expect(send({type:'deploy',unitId:other.id,target:{kind:'board',cell:{col:1,row:4}}})).toMatchObject({ok:true});
    expect(send({type:'deploy',unitId:other.id,target:{kind:'board',cell:{col:2,row:4}}})).toMatchObject({ok:true});
    refuseAll();
    expect(send({type:'deploy',unitId:target.id,target:{kind:'board',cell:{col:2,row:4}}})).toMatchObject({ok:true});
    // Swap at the one-unit cap, keeping the target fielded and the other unit on the bench.
    // Keep the post-confirmation sale independent of D14's special departure/return lifecycle.
    for(let i=0;i<10&&['into-the-unknown','ultimate-hero'].includes(match().pendingChoice!.offers[0]);i++) {
      c=match().pendingChoice!;
      expect(send({type:'anomalyReroll',choiceId:c.choiceId,generation:c.generation})).toMatchObject({ok:true});
    }
    c=match().pendingChoice!;
    expect(['into-the-unknown','ultimate-hero']).not.toContain(c.offers[0]);
    expect(send({type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:c.offers[0]})).toMatchObject({ok:true});
    expect(match().pendingChoice).toBeNull();
    expect(match().anomalyBinding?.unitId).toBe(target.id);
    expect(room.state.deadlineAt).toBe(deadline);
    for(const id of [target.id,other.id]) {
      expect(send({type:'sell',unitId:id})).toMatchObject({ok:true});
      expect(match().preparation.units.some(u=>u.id===id)).toBe(false);
    }
    expect(room.state.deadlineAt).toBe(deadline);
    expect(room.state.fault).toBeNull();
  } finally { if(client)client.dispose();else room.dispose(); }
});

it.each([false,true])('4-6 entry has one 75s deadline through early confirmation and freeze (all answer=%s)', allAnswer => {
  const {room,clock,phases}=enterAnomaly();
  try {
    const deadline=room.state.deadlineAt!;
    expect(deadline-clock.now()).toBe(75000);
    expect(phases).not.toContain('choice');
    clock.advance(10000);
    for(const seat of room.state.seats.filter(s=>s.alive&&(allAnswer||s.seatId!=='s1'))) {
      const c=seat.match.pendingChoice!, unit=seat.match.preparation.units.find(u=>u.team==='player')!;
      expect(room.handle(seat.seatId,{type:'anomalyTarget',choiceId:c.choiceId,generation:c.generation,unitId:unit.id})).toMatchObject({ok:true});
      const offer=room.state.seats.find(s=>s.seatId===seat.seatId)!.match.pendingChoice!;
      expect(room.handle(seat.seatId,{type:'choose',choiceId:offer.choiceId,generation:offer.generation,definitionId:offer.offers[0]})).toMatchObject({ok:true});
      expect(room.state.deadlineAt).toBe(deadline);
    }
    const s0=room.state.seats[0], authority=room.augmentHistoryAuthority(s0.seatId);
    expect(restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(s0.match),authority)).toEqual(s0.match);
    expect(()=>restoreSharedOrbSnapshot(room.state.pool,s0.match)).toThrow('independent server authority');
    const forged=structuredClone(s0.match);
    Object.assign(forged.anomalyOfferHistory!.facts.find(f=>f.kind==='anomaly-offer')!,{definitionId:'mage-armor'});
    if(JSON.stringify(forged)!==JSON.stringify(s0.match))expect(()=>restoreSharedOrbSnapshot(room.state.pool,forged,authority)).toThrow('server facts/state mismatch');
    expect(toPlayerView(room.state,'s1',clock.now()).phase).toMatchObject({kind:'preparation',endsAt:deadline});
    clock.advance(64999);
    expect(room.state.phase).toBe('preparation');
    expect(room.state.seats.find(s=>s.seatId==='s1')!.match.pendingChoice?.kind).toBe(allAnswer?undefined:'anomaly');
    expect(clock.fireNext()).toBe(true); // Freeze only: the fixture has no earlier settlements to resolve a battle against.
    expect(clock.now()).toBe(deadline);
    expect(room.state.phase).toBe('frozen');
    expect(room.state.seats.find(s=>s.seatId==='s1')!.match.anomalyBinding).not.toBeNull();
    expect(room.state.fault).toBeNull();
  } finally {room.dispose();}
});

it.each([false,true])('empty seat shares the original deadline and may recruit late (recruit=%s)', recruit => {
  const {room,clock}=enterAnomaly(true);
  try {
    const deadline=room.state.deadlineAt!;
    expect(room.state.seats[1].match.pendingChoice).toBeNull();
    clock.advance(74000);
    if(recruit) {
      const s1=room.state.seats[1].match,slot=s1.shop.slots.findIndex(s=>s.status==='available');
      expect(room.handle('s1',{type:'buy',slot,generation:s1.shop.generation})).toMatchObject({ok:true});
      expect(room.state.seats[1].match.pendingChoice?.kind).toBe('anomaly');
      expect(room.state.deadlineAt).toBe(deadline);
    }
    expect(clock.fireNext()).toBe(true);
    expect(clock.now()).toBe(deadline);
    expect(room.state.phase).toBe('frozen');
    expect(room.state.seats[1].match.anomalyBinding!==null).toBe(recruit);
    expect(room.state.seats[1].match.pendingChoice).toBeNull();
    if(!recruit)expect(room.state.seats[1].match.multiplayer?.forfeitedChoices).toContain('round:4-6:anomaly');
    expect(room.state.fault).toBeNull();
  } finally {room.dispose();}
});


it('deadline deploys the locked benched D14 target before automatic selection, preserving the paid offer', () => {
  const {room,clock}=enterAnomaly(false,500);
  try {
    let s=room.state.seats[0].match;
    const unit=s.preparation.units.find(u=>u.team==='player')!;
    expect(room.handle('s0',{type:'deploy',unitId:unit.id,target:{kind:'board',cell:{col:0,row:4}}})).toMatchObject({ok:true});
    let c=s.pendingChoice!;
    expect(room.handle('s0',{type:'anomalyTarget',choiceId:c.choiceId,generation:c.generation,unitId:unit.id})).toMatchObject({ok:true});
    for(let i=0;i<450;i++) {
      c=room.state.seats[0].match.pendingChoice!;
      if(c.offers[0]==='into-the-unknown')break;
      expect(room.handle('s0',{type:'anomalyReroll',choiceId:c.choiceId,generation:c.generation})).toMatchObject({ok:true});
    }
    s=room.state.seats[0].match;c=s.pendingChoice!;
    expect(c.offers).toEqual(['into-the-unknown']);
    expect(room.handle('s0',{type:'deploy',unitId:unit.id,target:{kind:'bench',slot:0}})).toMatchObject({ok:true});
    const deadline=room.state.deadlineAt!,gold=s.gold,rng=s.choiceRngState,history=s.anomalyOfferHistory;
    expect(clock.fireNext()).toBe(true);
    expect(clock.now()).toBe(deadline);
    const resolved=room.state.seats[0].match;
    expect(resolved.anomalyBinding).toMatchObject({unitId:unit.id,definitionId:'into-the-unknown'});
    expect(resolved.gold).toBe(gold);
    expect(resolved.choiceRngState).toBe(rng);
    expect(resolved.anomalyOfferHistory).toEqual(history);
    expect(resolved.multiplayer!.forfeitedChoices).not.toContain(c.choiceId);
    expect(room.state.fault).toBeNull();
  } finally {room.dispose();}
});
