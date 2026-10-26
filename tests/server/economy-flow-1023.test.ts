import { expect, it } from 'vitest';
import { PER_ROUND_PREPARATION, Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState } from '../../src/server/room/types';
import { getMultiplayerRoundByOrdinal } from '../../src/simulation/multiplayer-round';
import { SEATS, makeRoom } from './helpers';

function setRound(room: Room, round: number): void {
  const seam=room as unknown as {current:RoomState;clearTimer():void;afterChoiceWindow():void};
  seam.clearTimer();const definition=getMultiplayerRoundByOrdinal(round);
  seam.current={...room.state,round,roundId:definition.roundId,roundKind:definition.kind,seats:room.state.seats.map(seat=>({...seat,
    match:{...seat.match,round,roundDefinitionId:definition.roundId,m8:{...seat.match.m8,round:definition}}}))};
  seam.afterChoiceWindow();
}

it('production preparation deadlines select 6/15/20/30/75 seconds after choices, including all later PvE', () => {
  const clock=new ManualClock();
  const room=new Room(SEATS.map(s=>({...s,kind:'human'})),{...ROOM_TIMING_DEFAULTS,roomId:'econ-clock',seed:42,clock,resolver:new TwoSidedBattleResolver()});
  const seam=room as unknown as {current:RoomState;clearTimer():void;afterChoiceWindow():void};
  try {
    room.start();
    expect(room.state.deadlineAt!-clock.now()).toBe(6000);
    // Isolate the room's after-choice adapter from combat/loot: supply each authoritative round identity,
    // then let the real phase scheduler arm its deadline. No historical epoch fixture is required.
    for(const [round,ms] of [[1,6000],[2,15000],[3,20000],[4,30000],[10,20000],[17,20000],[23,75000],[24,20000],[31,20000],[38,20000],[39,30000]]) {
      seam.clearTimer();const definition=getMultiplayerRoundByOrdinal(round);
      seam.current={...room.state,round,roundId:definition.roundId,roundKind:definition.kind,seats:room.state.seats.map(seat=>({...seat,
        match:{...seat.match,round,roundDefinitionId:definition.roundId,m8:{...seat.match.m8,round:definition}}}))};
      seam.afterChoiceWindow();
      expect(room.state.deadlineAt!-clock.now()).toBe(ms);
      clock.advance(ms-1);expect(room.state.phase).toBe('preparation');
    }
  } finally { room.dispose(); }
});

it('explicit accelerated preparation override still applies to all rounds', () => {
  const {room,clock}=makeRoom();
  try { room.start();expect(room.state.deadlineAt!-clock.now()).toBe(1000); }
  finally { room.dispose(); }
});

it('the per-round table is an explicit option: the defaults select it, an explicit 30 s fixes every round to 30 s', () => {
  expect(ROOM_TIMING_DEFAULTS.preparationMs).toBe(PER_ROUND_PREPARATION);
  const clock=new ManualClock();
  const room=new Room(SEATS.map(s=>({...s,kind:'human'})),{...ROOM_TIMING_DEFAULTS,preparationMs:30_000,roomId:'econ-fixed',seed:42,clock,resolver:new TwoSidedBattleResolver()});
  try {
    room.start();
    expect(room.state.deadlineAt!-clock.now()).toBe(30_000);
    // 1-2 (6 s), 1-4 (20 s), a PvE round (20 s) and the anomaly round (75 s) all take the explicit value.
    for(const round of [1,3,10,23]) { setRound(room,round); expect(room.state.deadlineAt!-clock.now(),`round ${round}`).toBe(30_000); }
  } finally { room.dispose(); }
});
