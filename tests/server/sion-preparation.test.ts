import { describe, expect, it } from 'vitest';
import { parseClientMessage, NET_PROTOCOL_VERSION } from '../../src/server/net/messages';
import { toPublicBoard, toSeatPrivateView } from '../../src/server/room/projection';
import { applySeatCommand, type Room } from '../../src/server/room/room';
import type { RoomState } from '../../src/server/room/types';
import { draftPool, reconcileHoldings, rewardPolicy } from '../../src/simulation/shared-pool-ledger';
import { assertSharedPoolConservation } from '../../src/simulation/shared-pool';
import { readItemSummons } from '../../src/simulation/match';
import { MatchSession } from '../../src/rendering/match-session';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import { LocalRoomClient } from '../../src/rendering/online/local-room-client';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import type { GameClient, WireCommand } from '../../src/rendering/online/protocol';
import { ManualClock } from '../../src/server/room/clock';
import { makeRoom } from './helpers';
import { sionPreparation } from '../fixtures/sion-preparation';

/** Set up real rule grants and their pool reservations; conservation assertions stay enabled. */
function fieldSion(room: Room) {
  const before = room.state, seat = before.seats[0], pool = draftPool(before.pool);
  const match = sionPreparation(seat.match, rewardPolicy(pool, seat.match, []));
  reconcileHoldings(pool, seat.match, match, []);
  const current = { ...before, pool, seats: before.seats.map(s => s === seat ? { ...seat, match } : s) };
  assertSharedPoolConservation(pool, current.seats.map(s => s.match));
  (room as unknown as { current: RoomState }).current = current;
  return { match, seatId: seat.seatId, summon: readItemSummons(match).find(s => s.kind === 'sion')! };
}
const command = { type: 'moveItemSummon', itemInstanceId: 'g23-sion', cell: { col: 6, row: 7 } } as const;

describe('Sion preparation: server, local room and remote sessions', () => {
  it('parses the seat-local key, moves through the real room, publishes privately and publicly, and keeps pool conservation', () => {
    const raw = JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 1, type: 'command', roomId: 'test-room', round: 1, seatRevision: 0, command });
    expect(parseClientMessage(raw)).toMatchObject({ ok: true, message: { command } });
    const { room } = makeRoom();
    try {
      room.start(); const { match, seatId, summon } = fieldSion(room), pool = room.state.pool;
      expect(toSeatPrivateView(match).itemSummons).toContainEqual(summon);
      const augmentWindow = { ...match, phase: 'choice' as const, combat: null,
        pendingChoice: { kind: 'augment' as const, choiceId: 'round:2-1:augment', generation: 0, offers: [], eventId: 'prep-window', returnPhase: 'preparation' as const, step: 'offer' as const, targetId: null, rerollCount: 0, rerolledSlots: [], augmentTier: 'silver' as const, rerollsRemaining: 0 } };
      expect(toSeatPrivateView(augmentWindow).itemSummons).toContainEqual(summon);
      expect(room.handle(seatId, command)).toMatchObject({ ok: true });
      const after = room.state.seats.find(s => s.seatId === seatId)!.match;
      expect(room.state.pool).toBe(pool);
      expect(after.preparation).toBe(match.preparation);
      expect(toSeatPrivateView(after).itemSummons.find(s => s.kind === 'sion')!.unit.location).toEqual({ kind: 'board', cell: command.cell });
      const publicSion = toPublicBoard(after).units.filter(u => u.definitionId === 'g23-sion');
      expect(publicSion).toEqual([{ definitionId: 'g23-sion', starLevel: 1, cell: command.cell, items: [], summon: true }]);
      expect(JSON.stringify(publicSion)).not.toContain(summon.ownerId);
      expect(() => assertSharedPoolConservation(pool, room.state.seats.map(s => s.match))).not.toThrow();
      const frozen = { ...after, multiplayer: { ...after.multiplayer!, combatRosterLocked: true as const } };
      const refused = applySeatCommand(pool, frozen, command);
      expect(refused).toMatchObject({ ok: false, reason: 'wrong-phase' });
      expect(refused.state).toBe(frozen); expect(refused.pool).toBe(pool);
    } finally { room.dispose(); }
  });

  it('single player commits through MatchSession; RemoteSession waits for the authoritative push and never moves speculatively', () => {
    const state = sionPreparation(), local = new MatchSession(state);
    const sent: WireCommand[] = [];
    const client = { send: (wire: WireCommand) => { sent.push(wire); return { ok: 'pending' as const, commandId: 1 }; } } as unknown as GameClient;
    const remote = new RemoteSession(client, toDisplayMatch(toSeatPrivateView(state)));
    try {
      const before = remote.itemSummons;
      expect(local.itemSummons.find(s => s.kind === 'sion')).toBeDefined();
      expect(local.moveItemSummon('g23-sion', command.cell).ok).toBe(true);
      expect(local.itemSummons.find(s => s.kind === 'sion')!.unit.location).toEqual({ kind: 'board', cell: command.cell });
      remote.moveItemSummon('g23-sion', command.cell);
      expect(sent).toEqual([command]); expect(remote.itemSummons).toBe(before);
    } finally { local.dispose(); remote.dispose(); }
  });

  it('LocalRoomClient uses the same room command and returns the pushed Sion cell to RemoteSession', async () => {
    const client = new LocalRoomClient({ clock: new ManualClock(), seed: 42, preparationMs: 1000, choiceMs: 500, settlementMs: 200,
      myName: '赛恩测试', faultAtRound: null, pvpMode: 'two-sided', carousel: false });
    try {
      client.joinQueue('赛恩测试'); client.startMatch();
      const { match } = fieldSion(client.currentRoom!);
      const remote = new RemoteSession(client, toDisplayMatch(toSeatPrivateView(match)));
      try {
        const result = remote.moveItemSummon('g23-sion', command.cell);
        expect(result).toMatchObject({ ok: true });
        expect(client.currentRoom!.state.fault).toBeNull();
        const current = client.currentRoom!.state;
        expect(current.seats[0].match.seatMechanics!.seat.g24ItemPositions).toEqual({ 'g23-sion': command.cell });
        expect(remote.itemSummons.find(s => s.kind === 'sion')!.unit.location).toEqual({ kind: 'board', cell: command.cell });
        expect(() => assertSharedPoolConservation(current.pool, current.seats.map(s => s.match))).not.toThrow();
      } finally { remote.dispose(); }
    } finally { client.dispose(); }
  });
});

