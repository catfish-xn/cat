/**
 * G2-4b online wiring of the movable preparation summon (contract §26): the `moveItemSummon` wire command, the room gate,
 * the dispatch to the rules' `moveItemSummon`, the `itemSummons` field of my private state push, and the client sessions
 * (offline MatchSession and RemoteSession) that read and send it. The rules themselves are covered by g2-4b-voidspawn.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { NET_PROTOCOL_VERSION, parseClientMessage } from '../../src/server/net/messages';
import { applySeatCommand, ROOM_COMMAND_GATE } from '../../src/server/room/room';
import { toSeatPrivateView } from '../../src/server/room/projection';
import type { RoomPhase } from '../../src/server/room/types';
import { makeRoom } from './helpers';
import { createMatch, deployMatchUnit, equipItem, readItemSummons } from '../../src/server-entry';
import type { MatchState } from '../../src/server-entry';
import { grantMechanicItem } from '../../src/simulation/seat-mechanics';
import { MatchSession } from '../../src/rendering/match-session';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import type { GameClient, WireCommand } from '../../src/rendering/online/protocol';

const PORTAL = 'TFT5_Item_ZzRotPortalRadiant';
const command = (body: unknown) => JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 9, type: 'command', roomId: 'r', round: 1, seatRevision: 0, command: body });
const move = (extra: Record<string, unknown> = {}) => command({ type: 'moveItemSummon', itemInstanceId: 'item-3', cell: { col: 0, row: 7 }, ...extra });

/** A state whose first player unit on the board holds a 兹若特传送门 (granted through the rules' own item grant). */
function withPortal(base: MatchState): MatchState {
  let state = base;
  const owner = state.preparation.units.find(unit => unit.team === 'player')!;
  if (owner.location.kind !== 'board') {
    const deployed = deployMatchUnit(state, owner.id, { kind: 'board', cell: { col: 3, row: 5 } });
    if (!deployed.ok) throw Error(deployed.reason);
    state = deployed.state;
  }
  const grant = grantMechanicItem(state, { receiptId: 'portal', source: 'test', definitionId: PORTAL });
  if (!grant.ok) throw Error(grant.reason);
  const equipped = equipItem(grant.state, grant.state.items.at(-1)!.id, owner.id, 0);
  if (!equipped.ok) throw Error(equipped.reason);
  return equipped.state;
}

describe('G2-4b moveItemSummon wire validation', () => {
  it('accepts an item instance id and a cell and rebuilds them field by field', () => {
    expect(parseClientMessage(move())).toMatchObject({ ok: true, message: { command: { type: 'moveItemSummon', itemInstanceId: 'item-3', cell: { col: 0, row: 7 } } } });
  });
  it('refuses extra fields at either layer, a missing or empty id, a location instead of a cell and non-integer coordinates', () => {
    const refused = [
      move({ unitId: 'unit-1' }),
      move({ cell: { col: 0, row: 7, kind: 'board' } }),
      move({ cell: { kind: 'board', cell: { col: 0, row: 7 } } }),
      move({ cell: { col: 0.5, row: 7 } }),
      move({ cell: { col: 0 } }),
      move({ cell: null }),
      move({ itemInstanceId: '' }),
      command({ type: 'moveItemSummon', cell: { col: 0, row: 7 } }),
    ];
    for (const raw of refused) expect(parseClientMessage(raw), raw).toMatchObject({ ok: false, code: 'invalid-message', commandId: 9 });
  });
});

describe('G2-4b moveItemSummon room gate, dispatch and state push', () => {
  it('passes the gate only while seats prepare (preparation and the choice window)', () => {
    for (const phase of Object.keys(ROOM_COMMAND_GATE) as RoomPhase[]) {
      expect(ROOM_COMMAND_GATE[phase].has('moveItemSummon'), phase).toBe(phase === 'preparation' || phase === 'choice');
    }
  });
  it('dispatches to the rules: success persists the cell and the push shows it; refusals keep the input references', () => {
    const { room } = makeRoom();
    room.start();
    const seat = room.state.seats[0]!, pool = room.state.pool;
    const state = withPortal(seat.match), [origin] = readItemSummons(state);
    expect(origin?.kind).toBe('voidspawn');
    const before = toSeatPrivateView(state).itemSummons;
    expect(before).toEqual([{ kind: 'voidspawn', ownerId: origin!.ownerId, itemInstanceId: origin!.itemInstanceId,
      unit: { id: origin!.unit.id, definitionId: 'g24-voidspawn', team: 'player', starLevel: origin!.unit.starLevel, location: origin!.unit.location } }]);

    const moved = applySeatCommand(pool, state, { type: 'moveItemSummon', itemInstanceId: origin!.itemInstanceId, cell: { col: 0, row: 7 } });
    if (!moved.ok) throw Error(moved.reason);
    expect(moved.pool).toBe(pool);
    expect(moved.events).toEqual([{ type: 'seatMechanicChanged', key: 'g24ItemPositions' }]);
    expect(moved.state.items).toEqual(state.items);
    expect(moved.state.preparation).toEqual(state.preparation);
    expect(toSeatPrivateView(moved.state).itemSummons[0]!.unit.location).toEqual({ kind: 'board', cell: { col: 0, row: 7 } });

    for (const [cmd, reason] of [
      [{ type: 'moveItemSummon', itemInstanceId: origin!.itemInstanceId, cell: { col: 0, row: 0 } }, 'outside-deployment-zone'],
      [{ type: 'moveItemSummon', itemInstanceId: 'item-999', cell: { col: 0, row: 7 } }, 'unknown-unit'],
    ] as const) {
      const outcome = applySeatCommand(pool, state, cmd);
      expect(outcome).toMatchObject({ ok: false, reason });
      expect(outcome.pool).toBe(pool);
      expect(outcome.state).toBe(state);
    }
  });
  it('sends no summons outside preparation and none for a seat without the item', () => {
    const plain = createMatch(42);
    expect(toSeatPrivateView(plain).itemSummons).toEqual([]);
    const portal = withPortal(createMatch(42));
    expect(toSeatPrivateView({ ...portal, phase: 'settlement' } as MatchState).itemSummons).toEqual([]);
  });
});

describe('G2-4b client sessions', () => {
  it('offline: MatchSession reads the rules placement and commits a move through the rules', () => {
    const session = new MatchSession(withPortal(createMatch(42)));
    const [summon] = session.itemSummons;
    expect(summon?.kind).toBe('voidspawn');
    expect(session.moveItemSummon(summon!.itemInstanceId, { col: 0, row: 0 })).toMatchObject({ ok: false, reason: 'outside-deployment-zone' });
    expect(session.moveItemSummon(summon!.itemInstanceId, { col: 0, row: 7 }).ok).toBe(true);
    expect(session.itemSummons[0]!.unit.location).toEqual({ kind: 'board', cell: { col: 0, row: 7 } });
  });
  it('online: RemoteSession shows the pushed summons and sends only the item instance id and the cell', () => {
    const sent: WireCommand[] = [];
    const display = toDisplayMatch(toSeatPrivateView(withPortal(createMatch(42))));
    const client = { send: (wire: WireCommand) => { sent.push(wire); return { ok: 'pending' as const, commandId: 1 }; } } as unknown as GameClient;
    const session = new RemoteSession(client, display);
    const [summon] = session.itemSummons;
    expect(summon).toEqual(display.itemSummons![0]);
    session.moveItemSummon(summon!.itemInstanceId, { col: 0, row: 7 });
    expect(sent).toEqual([{ type: 'moveItemSummon', itemInstanceId: summon!.itemInstanceId, cell: { col: 0, row: 7 } }]);
    // Pending: nothing moves locally before the server's receipt and state push.
    expect(session.itemSummons[0]!.unit.location).toEqual(summon!.unit.location);
  });
});
