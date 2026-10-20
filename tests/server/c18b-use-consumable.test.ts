/**
 * C18-B server side of SR-C18-03 (contract §18.3/§18.8): the wire validator for `useConsumable`, the room gate in the
 * four operating phases, the dispatch to the rules' shared transaction (atomic refusal, real success on the latest live
 * seat) and the `consumable-used` receipt's event whitelist.
 */
import { describe, expect, it } from 'vitest';
import { NET_PROTOCOL_VERSION, parseClientMessage } from '../../src/server/net/messages';
import { applySeatCommand, ROOM_COMMAND_GATE } from '../../src/server/room/room';
import type { RoomPhase } from '../../src/server/room/types';
import { makeRoom, runUntil, runUntilClaiming } from './helpers';
import { consumableReceiptEvents } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import type { GameClient, WireCommand } from '../../src/rendering/online/protocol';
import type { CombatReplay } from '../../src/server-entry';

const command = (body: unknown) => JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 9, type: 'command', roomId: 'r', round: 1, seatRevision: 0, command: body });
const use = (target: unknown, extra: Record<string, unknown> = {}) => command({ type: 'useConsumable', consumableId: 'tool-1', target, ...extra });

describe('C18-B useConsumable wire validation (§18.3 onlyKeys per layer)', () => {
  it('accepts an item target and a unit target and rebuilds them field by field', () => {
    expect(parseClientMessage(use({ kind: 'item', itemId: 'item-3' }))).toMatchObject({ ok: true, message: { command: { type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'item', itemId: 'item-3' } } } });
    expect(parseClientMessage(use({ kind: 'unit', unitId: 'unit-1' }))).toMatchObject({ ok: true, message: { command: { type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'unit', unitId: 'unit-1' } } } });
  });
  it('refuses extra fields at either layer, mixed targets, empty or missing ids and unknown kinds', () => {
    const refused = [
      use({ kind: 'item', itemId: 'item-3' }, { definitionId: 'magnetic-remover' }),
      use({ kind: 'item', itemId: 'item-3' }, { seatId: 's2' }),
      use({ kind: 'item', itemId: 'item-3', unitId: 'unit-1' }),
      use({ kind: 'unit', unitId: 'unit-1', slot: 0 }),
      use({ kind: 'unit', itemId: 'item-3' }),
      use({ kind: 'item', itemId: '' }),
      use({ kind: 'unit' }),
      use({ kind: 'board', cell: { col: 1, row: 1 } }),
      use('unit-1'),
      use(null),
      command({ type: 'useConsumable', consumableId: '', target: { kind: 'unit', unitId: 'unit-1' } }),
      command({ type: 'useConsumable', target: { kind: 'unit', unitId: 'unit-1' } }),
      command({ type: 'useConsumable', consumableId: 3, target: { kind: 'unit', unitId: 'unit-1' } }),
      command({ type: 'useConsumable', consumableId: 'tool-1' }),
      command({ type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'unit', unitId: 'unit-1' }, result: 'bow' }),
    ];
    for (const raw of refused) expect(parseClientMessage(raw), raw).toMatchObject({ ok: false, code: 'invalid-message', commandId: 9 });
  });
});

describe('C18-B useConsumable room gate and dispatch', () => {
  it('passes the gate in preparation, choice, battle, awaiting-settlement and settlement only', () => {
    const open: RoomPhase[] = ['preparation', 'choice', 'battle', 'awaiting-settlement', 'settlement'];
    for (const phase of Object.keys(ROOM_COMMAND_GATE) as RoomPhase[]) expect(ROOM_COMMAND_GATE[phase].has('useConsumable'), phase).toBe(open.includes(phase));
  });
  it('dispatch: a tool the seat does not hold is refused unknown-consumable with the input pool and state references', () => {
    const { room } = makeRoom();
    room.start();
    const seat = room.state.seats[0]!, pool = room.state.pool;
    const outcome = applySeatCommand(pool, seat.match, { type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'unit', unitId: 'unit-1' } });
    expect(outcome).toMatchObject({ ok: false, reason: 'unknown-consumable' });
    expect(outcome.pool).toBe(pool);
    expect(outcome.state).toBe(seat.match);
  });
  it('through the room, in preparation and in a battle: refused, nothing published (same room state, same seatRevision)', () => {
    const { room, clock } = makeRoom();
    room.start();
    for (const phase of ['preparation', 'battle'] as const) {
      runUntil(room, clock, state => state.phase === phase);
      const before = room.state, revision = before.seats[0]!.seatRevision;
      for (const target of [{ kind: 'unit', unitId: 'unit-1' }, { kind: 'item', itemId: 'item-1' }] as const)
        expect(room.handle('s0', { type: 'useConsumable', consumableId: 'tool-1', target }), phase).toMatchObject({ ok: false, reason: 'unknown-consumable' });
      expect(room.state).toBe(before);
      expect(room.state.seats[0]!.seatRevision).toBe(revision);
    }
  });
  it('outside the gate the room answers wrong-phase before the rules are asked', () => {
    const { room } = makeRoom();
    expect(room.state.phase).toBe('waiting');
    const before = room.state;
    expect(room.handle('s0', { type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'unit', unitId: 'unit-1' } })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(room.state).toBe(before);
  });
});

describe('C18-B useConsumable success through the room (§18.6)', () => {
  it('a remover on a board unit wearing an item: applied on the live seat, items back with their ids, tool gone, pool shop untouched', () => {
    // v17 orbs are a random stage combination (room layout seed) with per-seat boxes (seat seed). The independent oracle
    // (tests/fixtures/orb-combo-oracle.cjs lootPlan(seat seed, ordinal, room seed)) puts a gray orb's remover on s3's
    // 1-2 carriers with room seed 3, so that room really drops one; the seat claims it after its source died.
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 3 });
    room.start();
    // Find the seat holding the remover with an inventory item too.
    const holder = () => room.state.seats.find(seat => seat.alive && seat.match.consumables.some(tool => tool.definitionId === 'magnetic-remover')
      && seat.match.items.some(item => item.location.kind === 'inventory'));
    // v15: the items (and the remover) arrive as orbs each seat claims in preparation.
    runUntilClaiming(room, clock, state => state.phase === 'preparation' && holder() !== undefined, 4_000);
    const seat = holder()!, seatId = seat.seatId;
    expect(seatId).toBe('s3');
    const unit = seat.match.preparation.units.find(entry => entry.team === 'player' && entry.location.kind === 'board')!;
    const item = seat.match.items.find(entry => entry.location.kind === 'inventory')!;
    const equipped = room.handle(seatId, { type: 'equip', itemId: item.id, unitId: unit.id, slot: 0 });
    expect(equipped).toMatchObject({ ok: true });
    const live = () => room.state.seats.find(entry => entry.seatId === seatId)!;
    const worn = live().match.items.filter(entry => entry.location.kind === 'unit' && entry.location.unitId === unit.id).map(entry => entry.id);
    const tool = live().match.consumables.find(entry => entry.definitionId === 'magnetic-remover')!, tools = live().match.consumables.length;
    const shopsBefore = room.state.pool.shops, availableBefore = room.state.pool.available, revision = live().seatRevision;
    const used = room.handle(seatId, { type: 'useConsumable', consumableId: tool.consumableId, target: { kind: 'unit', unitId: unit.id } });
    expect(used).toMatchObject({ ok: true });
    if (!used.ok) return;
    const after = live().match;
    expect(worn.length).toBeGreaterThan(0);
    for (const id of worn) expect(after.items.find(entry => entry.id === id)?.location).toEqual({ kind: 'inventory' });
    expect(after.consumables).toHaveLength(tools - 1);
    expect(after.consumables.some(entry => entry.consumableId === tool.consumableId)).toBe(false);
    expect(live().seatRevision).toBe(revision + 1);
    expect(room.state.pool.shops).toEqual(shopsBefore); expect(room.state.pool.available).toEqual(availableBefore);
    // The receipt's events: only the whitelisted operation events, in the rules' order, no provenance or RNG.
    const receipt = consumableReceiptEvents(used.events);
    expect(receipt.map(event => event.type)).toEqual(['itemsRemoved', 'consumableUsed']);
    expect(receipt[0]).toMatchObject({ type: 'itemsRemoved', unitId: unit.id, itemIds: worn });
    expect(receipt[1]).toMatchObject({ type: 'consumableUsed', consumableId: tool.consumableId, target: { kind: 'unit', unitId: unit.id }, effect: 'remove-all', outputItemId: null });
    for (const event of receipt) expect(Object.keys(event).filter(key => /rng|provenance|source/i.test(key))).toEqual([]);
    // A new commandId with the used tool: unknown-consumable, nothing published.
    const before = room.state;
    expect(room.handle(seatId, { type: 'useConsumable', consumableId: tool.consumableId, target: { kind: 'unit', unitId: unit.id } })).toMatchObject({ ok: false, reason: 'unknown-consumable' });
    expect(room.state).toBe(before);
  }, 120_000);
});

describe('C18-B client send path', () => {
  it('RemoteSession.useConsumable sends exactly the §18.3 command, also while my battle plays, and changes nothing locally', () => {
    const sent: WireCommand[] = [];
    const client: GameClient = { transport: 'websocket', listen: () => () => {}, joinQueue: () => {}, leaveQueue: () => {}, startMatch: () => {},
      send: command => { sent.push(command); return { ok: 'pending', commandId: sent.length }; }, reset: () => {}, dispose: () => {} };
    const session = new RemoteSession(client, undefined, () => 0), before = session.state;
    expect(session.useConsumable('tool-1', { kind: 'unit', unitId: 'unit-1' })).toMatchObject({ ok: false });
    expect(session.takeNotice()).toEqual({ kind: 'pending', commandId: 1 });
    // A battle on the board: operations stay open (§15.2), the tool command among them (BATTLE_COMMANDS).
    const view = { combatId: 'c', tick: 0, maxTicks: 1200, status: 'running', result: null, board: before.preparation.board, units: [] };
    session.receiveReplay({ initial: view, terminal: { ...view, tick: 1, status: 'finished' }, ticks: [{ tick: 1, events: [] }] } as unknown as CombatReplay);
    expect(session.inBattle).toBe(true);
    session.useConsumable('tool-1', { kind: 'item', itemId: 'item-2' });
    expect(sent).toEqual([
      { type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'unit', unitId: 'unit-1' } },
      { type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'item', itemId: 'item-2' } },
    ]);
    expect(session.state.items).toBe(before.items);
  });
});
