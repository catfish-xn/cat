import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket as ServerSocket } from 'ws';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import { toCombatReplayFor } from '../../../src/server/room/projection';
import { expectOk, flush, hasKey, messagesOfType, seatTwo, startServer, type NetHarness } from './helpers';

let harness: NetHarness | null = null;
afterEach(async () => { await harness?.close(); harness = null; });

describe('NET6 combat stream', () => {
  it('opens before resolution, streams contiguous frames, resumes a cursor and reuses the same source for watch', async () => {
    harness = await startServer({ combatStreaming: true }, new TwoSidedBattleResolver());
    const [a, b] = await seatTwo(harness), room = harness.server.room!;
    harness.clock.advance(1_000); await flush();
    const open = messagesOfType(a.inbox, 'combat-open').at(-1)!;
    expect(open.frame.tick).toBe(0); expect(room.state.battles).toHaveLength(0);
    expect(messagesOfType(a.inbox, 'replay')).toHaveLength(0);
    harness.clock.advance(250); await flush();
    const chunks = messagesOfType(a.inbox, 'combat-chunk');
    let next = 1;
    for (const chunk of chunks.flatMap(packet => packet.chunks)) { expect(chunk.fromTick).toBe(next); expect(chunk.ticks.map(f => f.tick)).toEqual(Array.from({ length: chunk.ticks.length }, (_, i) => next + i)); next = chunk.throughTick + 1; }
    expect(next).toBeGreaterThan(1);
    const token = a.token!; a.close(); await a.closed;
    harness.clock.advance(150); await flush();
    const resumed = await harness.connect();
    expectOk(await resumed.send({ type: 'resume', token, combat: { battleId: open.battleId, revision: open.revision, nextTick: next, seatId: a.seatId! } }));
    await flush();
    expect(messagesOfType(resumed.inbox, 'combat-open')).toHaveLength(0);
    const resumedChunk = messagesOfType(resumed.inbox, 'combat-chunk')[0]!.chunks[0]!;
    expect(resumedChunk.fromTick).toBe(next);
    expectOk(await b.send({ type: 'watch', roomId: room.state.roomId, seatId: a.seatId! }));
    await flush();
    const watched = messagesOfType(b.inbox, 'combat-open').at(-1)!;
    expect(watched.battleId).toBe(open.battleId); expect(watched.unitIds).toEqual([]);
    harness.clock.advance(50); await flush();
    const viewerChunk = messagesOfType(b.inbox, 'combat-chunk').at(-1)!.chunks.find(chunk => chunk.watch)!;
    const playerChunk = messagesOfType(resumed.inbox, 'combat-chunk').at(-1)!.chunks[0]!;
    expect(viewerChunk.ticks).toEqual(playerChunk.ticks);
    expect(viewerChunk).toMatchObject({ watch: true, seatId: a.seatId });
    for (let i = 0; !room.state.battles.length && i < 1_300; i++) harness.clock.advance(50);
    await flush();
    const end = messagesOfType(resumed.inbox, 'combat-end').at(-1)!;
    expect(end.terminal).toEqual(toCombatReplayFor(room.state, a.seatId!)!.replay.terminal);
    expect(room.state.settlements).toHaveLength(0);
    const snapshot = await harness.connect();
    expectOk(await snapshot.resume(token)); await flush();
    const keyframe = messagesOfType(snapshot.inbox, 'combat-open').at(-1)!;
    expect(keyframe.initial.tick).toBe(end.throughTick);
    harness.clock.advance(800); await flush();
    expect(room.state.settlements).toHaveLength(1); expect(room.state.fault).toBeNull();
    for (const message of [...chunks, resumedChunk, viewerChunk, end, watched]) for (const key of ['rngState', 'bankSamples', 'liveGold', 'proposals', 'mapping']) expect(hasKey(message, key)).toBe(false);
  }, 60_000);

  it('a backpressured socket is terminated while the room and other seats continue', async () => {
    harness = await startServer({ combatStreaming: true }, new TwoSidedBattleResolver());
    const [a, b] = await seatTwo(harness);
    let slow: ServerSocket | null = null;
    vi.spyOn(ServerSocket.prototype, 'bufferedAmount', 'get').mockImplementation(function (this: ServerSocket) {
      slow ??= this;
      return this === slow ? 1_048_577 : 0;
    });
    harness.clock.advance(1_250); await flush();
    await a.closed;
    expect(slow).not.toBeNull();
    expect(messagesOfType(b.inbox, 'combat-chunk').length).toBeGreaterThan(0);
    expect(harness.server.room!.state.fault).toBeNull();
  }, 60_000);
});
