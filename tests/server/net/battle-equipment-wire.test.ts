import { applyCombatReplayTick } from '../../../src/simulation/combat-replay-view';
import { afterEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import { expectOk, flush, hasKey, messagesOfType, seatTwo, startServer, type NetHarness } from './helpers';
let harness: NetHarness | null = null;
afterEach(async () => { await harness?.close(); harness = null; });
describe('battle equipment authenticated wire', () => {
  it('queued receipt, dedupe, watch and reconnect share the installed public frame', async () => {
    harness = await startServer({ combatStreaming: true, sliceTicks: 1 }, new TwoSidedBattleResolver());
    const [a, b] = await seatTwo(harness), room = harness.server.room!;
    const seam = room as unknown as { current: typeof room.state };
    seam.current = { ...seam.current, seats: seam.current.seats.map(s => s.seatId !== a.seatId ? s : { ...s, match: { ...s.match,
      items: [...s.match.items, { id: 'item-800', definitionId: 'sword', location: { kind: 'inventory' } }], nextItemSerial: 801 } }) };
    harness.clock.advance(1000); await flush();
    const seat = () => room.state.seats.find(s => s.seatId === a.seatId)!;
    const unitId = seat().match.preparation.units.find(u => u.location.kind === 'board')!.id;
    expectOk(await b.send({ type: 'watch', roomId: room.state.roomId, seatId: a.seatId! }));
    // Stop after one of the eight streams has advanced: the single-writer gate holds the command.
    harness.clock.fireNext(); expect(room.streamingBoundaryPending).toBe(true);
    const payload = { type: 'command' as const, roomId: room.state.roomId, round: room.state.round, seatRevision: seat().seatRevision,
      command: { type: 'equip' as const, itemId: 'item-800', unitId, slot: 0 } };
    let answered = false;
    const response = a.send(payload, 100).then(r => { answered = true; return r; });
    await flush(); expect(answered).toBe(false);
    while (room.streamingBoundaryPending) harness.clock.fireNext();
    const first = await response; expectOk(first);
    const once = seat().match, revision = seat().seatRevision;
    expect(once.combat!.pendingEquipment).toHaveLength(1);
    const duplicate = await a.send(payload, 100); expect(duplicate).toEqual(first);
    expect(seat().match).toBe(once); expect(seat().seatRevision).toBe(revision);
    harness.clock.advance(50); await flush();
    expect(seat().match.combat!.equipmentReceipts).toHaveLength(1);
    expect(seat().match.combat!.equipmentReceipts![0].input.effectiveTick).toBe(2);
    const player = messagesOfType(a.inbox, 'combat-chunk').flatMap(m => m.chunks).flatMap(c => c.ticks).find(t => t.tick === 2)!;
    const watched = messagesOfType(b.inbox, 'combat-chunk').flatMap(m => m.chunks).filter(c => c.watch).flatMap(c => c.ticks).find(t => t.tick === 2)!;
    expect(watched).toEqual(player);
    expect(player.events.some(e => e.type === 'unitUpdated' && e.changes.equipment?.some(i => i.definitionId === 'sword'))).toBe(true);
    const token = a.token!; a.close(); await a.closed;
    const resumed = await harness.connect(); expectOk(await resumed.resume(token)); await flush();
    const open = messagesOfType(resumed.inbox, 'combat-open').at(-1)!;
    const restoredView = messagesOfType(resumed.inbox, 'combat-chunk').flatMap(m => m.chunks).flatMap(c => c.ticks)
      .reduce(applyCombatReplayTick, applyCombatReplayTick(open.initial, open.frame));
    expect(restoredView.units.some(u => u.equipment?.some(i => i.definitionId === 'sword'))).toBe(true);
    expect(await resumed.send(payload, 100)).toEqual(first);
    expect(seat().match.combat!.equipmentReceipts).toHaveLength(1);
    for (const value of [player, watched, open]) for (const key of ['inputLog','equipmentReceipts','pendingEquipment','rngState','resourceSequence','before','after']) expect(hasKey(value, key), key).toBe(false);
  }, 60000);
});
