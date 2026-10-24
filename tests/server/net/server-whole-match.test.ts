import { afterEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import type { ServerMessage } from '../../../src/server/net/messages';
import { expectOk, messagesOfType, seatTwo, startServer, type NetHarness } from './helpers';

// Split out of server.test.ts so the whole-match case runs on its own worker.
let harness: NetHarness | null = null;
afterEach(async () => { await harness?.close(); harness = null; });

describe('game server: whole match over the wire', () => {
  it('drives two clients from the queue to a full ranking with replays on the manual clock', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const [a, b] = await seatTwo(harness);
    const room = harness.server.room!;
    const phase = () => room.state.phase;
    let guard = 0;
    while (phase() !== 'ended' && guard++ < 2_000) {
      // Answer choices like a player would; everything else idles.
      for (const client of [a, b]) {
        const seat = room.state.seats.find(candidate => candidate.seatId === client.seatId)!;
        if (phase() === 'choice' && seat.alive && seat.match.phase === 'choice' && seat.match.pendingChoice?.step === 'offer') {
          const pending = seat.match.pendingChoice;
          const receipt = await client.command({ type: 'choose', choiceId: pending.choiceId, generation: pending.generation, definitionId: pending.offers[0]! }, { round: room.state.round, seatRevision: seat.seatRevision });
          expectOk(receipt);
        }
      }
      if (phase() !== 'ended' && !harness.clock.runNext()) break;
    }
    expect(phase()).toBe('ended');
    const [endedA, endedB] = await Promise.all([a, b].map(client => client.waitForView(view => view.phase.kind === 'ended', 20_000)));
    // B7: overtime runs until one seat is left, so the match ends with a full ranking.
    expect(room.state.fault).toBeNull();
    expect(endedA.ranking).toHaveLength(8); expect(endedB.ranking).toHaveLength(8); expect(new Set(endedA.ranking!.map(seat => seat.rank)).size).toBe(8);
    // B7: state stops after the round that eliminated a seat; view (and replay of a battle it fought) continue.
    for (const client of [a, b]) {
      const seat = room.state.seats.find(candidate => candidate.seatId === client.seatId)!;
      if (seat.eliminatedRound !== null) expect(messagesOfType(client.inbox, 'state').every(message => message.round <= seat.eliminatedRound!)).toBe(true);
      const replays = messagesOfType(client.inbox, 'replay');
      expect(replays.length).toBeGreaterThan(0);
      expect(new Set(replays.map(message => message.battleId)).size).toBe(replays.length);
    }
    const replaysA = messagesOfType(a.inbox, 'replay');
    expect(replaysA.every(message => message.replay.ticks.length === message.replay.terminal.tick + 1)).toBe(true);
    expect(new Set(replaysA.map(message => message.round)).size).toBe(replaysA.length); // one battle per round per seat
    expect(a.inbox.some(message => (message as { type: string }).type === 'combat')).toBe(false);
    // Evidence for the C6 PR (whole-match application bytes per message type); reported, not asserted.
    const bytes = (message: ServerMessage) => Buffer.byteLength(JSON.stringify(message));
    const byType: Record<string, number> = {};
    for (const message of a.inbox) byType[message.type] = (byType[message.type] ?? 0) + bytes(message);
    console.log(`[c6-wire] seat A whole match bytes by type ${JSON.stringify(byType)}`);
    expect(Math.max(...a.inbox.map(bytes))).toBeGreaterThan(0);
    // B6: the six fill-in bots now play (full boards, longer battles and frames), so the match takes longer on the wire.
  }, 150_000);
});
