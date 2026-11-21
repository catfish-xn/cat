import { expect, it } from 'vitest';
import { LocalRoomClient } from '../../src/rendering/online/local-room-client';
import { ManualClock } from '../../src/server/room/clock';
import { makeRoom, runUntil } from './helpers';

it('the network room commits stage-one base zero plus two surviving monsters exactly once', () => {
  const {room,clock} = makeRoom();
  try {
    room.start();
    const player = room.state.seats[0].match.preparation.units.find(u=>u.team==='player')!;
    expect(room.handle('s0',{type:'sell',unitId:player.id}).ok).toBe(true);
    runUntil(room,clock,s=>s.phase==='settlement' && s.seats[0].match.roundResults.length===1);
    const seat = room.state.seats[0];
    expect(seat.match.roundResults[0]).toMatchObject({roundId:'1-2',result:'enemyWin',baseDamage:0,
      survivingEnemyCount:2,playerDamage:2,hpBefore:100,hpAfter:98,hpLost:2});
    expect(seat.hp).toBe(98);
    expect(room.state.fault).toBeNull();
  } finally { room.dispose(); }
});

it('the local room uses the same PvE settlement through its public client commands', () => {
  const clock = new ManualClock();
  const client = new LocalRoomClient({seed:42,clock,preparationMs:1000,choiceMs:500,settlementMs:200,
    myName:'PvE',faultAtRound:null,pvpMode:'two-sided',carousel:false});
  try {
    client.joinQueue('PvE'); client.startMatch();
    const room = client.currentRoom!;
    const mine = room.state.seats.find(s=>s.kind==='human')!;
    const player = mine.match.preparation.units.find(u=>u.team==='player')!;
    expect(client.send({type:'sell',unitId:player.id}).ok).toBe(true);
    runUntil(room,clock,s=>s.phase==='settlement' && s.seats.find(seat=>seat.seatId===mine.seatId)!.match.roundResults.length===1);
    const seat = room.state.seats.find(s=>s.seatId===mine.seatId)!;
    expect(seat.match.roundResults[0]).toMatchObject({baseDamage:0,survivingEnemyCount:2,playerDamage:2,hpAfter:98});
    expect(seat.hp).toBe(98);
    expect(room.state.fault).toBeNull();
  } finally { client.dispose(); }
});
