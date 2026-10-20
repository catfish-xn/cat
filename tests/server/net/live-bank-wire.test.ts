/**
 * D11 live bank on the wire: a seat whose combat reads its live gold changes its gold during the battle; it is sent
 * `replay-tail` records while the battle plays, never the private samples, and the records it ends up with are the
 * battle the room settled.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import { toCombatReplayFor } from '../../../src/server/room/projection';
import type { Room } from '../../../src/server/room/room';
import type { RoomState } from '../../../src/server/room/types';
import type { CombatReplay } from '../../../src/server-entry';
import { expectOk, flush, hasKey, messagesOfType, seatTwo, startServer, type NetHarness } from './helpers';

let harness: NetHarness | null = null;
afterEach(async () => { await harness?.close(); harness = null; });

/** Test seam: binds avarice-incarnate to the seat's first board unit; its revision stays, so its client is not stale. */
function bindAvarice(room: Room, seatId: string): void {
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...holder.current, seats: holder.current.seats.map(seat => {
    if (seat.seatId !== seatId) return seat;
    const unit = seat.match.preparation.units.find(entry => entry.team === 'player' && entry.location.kind === 'board')!;
    return { ...seat, match: { ...seat.match, anomalyBinding: { definitionId: 'avarice-incarnate', unitId: unit.id, choiceId: 'test-avarice', boundRound: seat.match.round } } };
  }) };
}

describe('D11 live bank: replay-tail on the wire', () => {
  it('streams the changed records of a live battle to its seat and ends on the settled battle', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const [a] = await seatTwo(harness);
    const room = harness.server.room!, seatId = a.seatId!;
    let guard = 0;
    while (!(room.state.round === 5 && room.state.phase === 'preparation') && guard++ < 400) harness.clock.runNext();
    bindAvarice(room, seatId);
    while (room.state.phase === 'preparation' && guard++ < 400) harness.clock.runNext();
    expect(room.state.phase).toBe('battle');
    const replay = await a.waitFor<Extract<import('../../../src/server/net/messages').ServerMessage, { type: 'replay' }>>(message => message.type === 'replay' && message.round === 5);
    await a.waitFor(message => message.type === 'state' && message.seatRevision === room.state.seats.find(seat => seat.seatId === seatId)!.seatRevision);
    harness.clock.advance(400);
    const gold = room.state.seats.find(seat => seat.seatId === seatId)!.match.gold;
    expectOk(await a.command(gold >= 4 ? { type: 'buyXp' } : { type: 'reroll' }));
    for (guard = 0; room.state.phase === 'battle' && guard < 400; guard++) { harness.clock.advance(200); await flush(5); }
    await flush();
    expect(room.state.fault).toBeNull();
    const tails = messagesOfType(a.inbox, 'replay-tail');
    // Streamed during the battle (not only once at its end), and only public view records.
    expect(tails.length).toBeGreaterThan(1);
    for (const message of tails) for (const key of ['bankSamples', 'liveGold', 'currentItemBankGold', 'openingItemBankGold', 'proposals', 'mapping']) expect(hasKey(message, key)).toBe(false);
    let shown: CombatReplay = replay.replay;
    for (const tail of tails) shown = { initial: shown.initial, ticks: [...shown.ticks.slice(0, tail.fromTick), ...tail.ticks], terminal: tail.terminal };
    expect(JSON.parse(JSON.stringify(shown))).toEqual(JSON.parse(JSON.stringify(toCombatReplayFor(room.state, seatId)!.replay)));
  }, 180_000);
});
