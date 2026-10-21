/** #376 watch acceptance, migrated to the single NET6 chunk protocol. No socket or second simulation is needed. */
import { expect, it } from 'vitest';
import { NET_PROTOCOL_VERSION, parseClientMessage } from '../../../src/server/net/messages';
import type { BattleInput } from '../../../src/server/room/types';
import { Room, ROOM_TIMING_DEFAULTS } from '../../../src/server/room/room';
import { ManualClock } from '../../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import { mirrorReplayTick, mirrorViewState } from '../../../src/server/room/projection';
import { SEATS, TIMINGS, runUntil } from '../helpers';
import { RemoteSession } from '../../../src/rendering/online/remote-session';
import type { GameClient } from '../../../src/rendering/online/protocol';
import type { CombatReplay } from '../../../src/server-entry';

const stub: GameClient = { transport: 'local-room', listen: () => () => {}, joinQueue() {}, leaveQueue() {}, startMatch() {},
  send: () => ({ ok: 'pending', commandId: 1 }), reset() {}, dispose() {} };
it('watch start and stop use a receipted request with strict room and seat shapes', () => {
  const envelope = { type: 'watch', protocolVersion: NET_PROTOCOL_VERSION, commandId: 7, roomId: 'r' };
  for (const seatId of ['other', null]) expect(parseClientMessage(JSON.stringify({ ...envelope, seatId })))
    .toEqual({ ok: true, message: { ...envelope, seatId } });
  for (const invalid of [{}, { seatId: 1 }, { seatId: '' }, { seatId: 'other', roomId: '' }, { seatId: 'other', extra: true }]) {
    expect(parseClientMessage(JSON.stringify({ ...envelope, ...invalid })).ok).toBe(false);
  }
});

it('watching side B projects the recorded stream and keeps my own playback and history independent, including next round', () => {
  const clock = new ManualClock(), room = new Room(SEATS.map(s => ({ ...s, kind: 'human' })), {
    ...ROOM_TIMING_DEFAULTS, ...TIMINGS, roomId: 'watch-stream', seed: 42, clock, resolver: new TwoSidedBattleResolver(), combatStreaming: true,
  });
  room.start();
  try {
    runUntil(room, clock, s => s.round === 5 && s.phase === 'battle', 20_000);
    const input = (room as unknown as { frozenInputs: readonly BattleInput[] }).frozenInputs.find(input => input.seats.length === 2)!;
    const pairing = { seatA: input.seats[0]!.seatId, seatB: input.seats[1]!.seatId };
    const a = room.combatStreamFor(pairing.seatA)!, b = room.combatStreamFor(pairing.seatB)!;
    expect(b.initial).toEqual(mirrorViewState(a.initial, a.initial.board.rows));
    expect(room.combatStreamFor(pairing.seatB)).toBe(b);
    const otherSeat = room.state.seats.find(s => s.seatId !== pairing.seatA && s.seatId !== pairing.seatB)!;
    const own = room.combatStreamFor(otherSeat.seatId)!;
    const asReplay = (view: typeof a): CombatReplay => ({ initial: view.initial, ticks: [...view.ticks], terminal: view.terminal ?? view.initial,
      stream: { revision: view.revision, fromTick: view.initial.tick, ended: view.terminal !== null } });
    const session = new RemoteSession(stub, otherSeat.match, () => 0);
    session.receiveReplay(asReplay(own)); session.watchReplay(pairing.seatB, asReplay(b));
    clock.advance(550);
    const currentA = room.combatStreamFor(pairing.seatA)!, currentB = room.combatStreamFor(pairing.seatB)!;
    expect(currentB.ticks).toEqual(currentA.ticks.map(frame => mirrorReplayTick(frame, a.initial.board.rows)));
    session.reviseReplay(asReplay(room.combatStreamFor(otherSeat.seatId)!)); session.watchReplay(pairing.seatB, asReplay(currentB));
    session.advanceDisplay(550);
    const ownTick = session.liveBattle!.view.tick;
    expect(session.combatView!.tick).toBeGreaterThan(0);
    expect(session.lastBattle!.replay.initial.combatId).toBe(own.battleId);
    session.stopWatching(); expect(session.combatView!.tick).toBe(ownTick);
    session.watchReplay(pairing.seatB, asReplay(currentB));
    const history = session.battleHistory;
    runUntil(room, clock, s => s.round === 6 && s.phase === 'battle', 20_000);
    const next = room.combatStreamFor(pairing.seatB)!;
    expect(next.battleId).not.toBe(b.battleId);
    session.watchReplay(pairing.seatB, asReplay(next));
    expect(session.combatView!.combatId).toBe(next.initial.combatId);
    expect(session.battleHistory).toBe(history); // another seat never becomes my last/finished battle
  } finally { room.dispose(); }
}, 60_000);
