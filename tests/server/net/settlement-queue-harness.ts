import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { afterAll, expect, it, vi } from 'vitest';
import { createGameServer } from '../../../src/server/net/server';
import { NET_PROTOCOL_VERSION, type ServerMessage } from '../../../src/server/net/messages';
import { ManualClock } from '../../../src/server/room/clock';
import type { RoomState, SeatCommand } from '../../../src/server/room/types';
import { TIMINGS } from '../helpers';

// Shared by settlement-queue*.test.ts. Each test file installs its own vi.mock of 'ws' and
// 'node:http' (mocks are per file) and passes the captured connection listener in.
export class Socket extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  readonly messages: ServerMessage[] = [];
  send(text: string) { this.messages.push(JSON.parse(text) as ServerMessage); }
  close() { this.readyState = 3; this.emit('close'); }
  ping() {}
  receive(message: object) { this.emit('message', Buffer.from(JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, ...message })), false); }
}

/** One whole eight-bot match with continuous authenticated human traffic; returns its evidence hashes. */
async function* busyMatchSteps(connect: (socket: EventEmitter) => void, combatStreaming: boolean, minFrozen: number) {
  const clock = new ManualClock();
  const server = await createGameServer({ port: 0, host: '127.0.0.1', clock, seed: 42, roomId: 'busy-match',
    timings: TIMINGS, sliceTicks: 50, sliceMs: 20, spotCheckEveryRounds: 1_000_000, combatStreaming,
    limits: { maxMessagesPerWindow: 1_000_000 }, logger: () => {} });
  const socket = new Socket(); connect(socket);
  socket.receive({ type: 'join', name: 'human', commandId: 1 });
  socket.receive({ type: 'start', commandId: 2 });
  const room = server.room!;
  // Eight seats total: let BotDriver also drive the connected human's seat for this stress fixture.
  // Its kind/session remain human, so setConnected changes real state and all traffic uses real auth/dedupe.
  const holder = room as unknown as { current: RoomState };
  holder.current = { ...room.state, seats: room.state.seats.map((seat, index) => index === 0 ? { ...seat, controller: 'bot' } : seat) };
  room.setConnected(room.state.seats[0]!.seatId, false); // Publish once so BotDriver observes the eighth controller.
  expect(room.state.seats.every(seat => seat.controller === 'bot')).toBe(true);
  // Vitest clears mock.calls between cases; keep the original whole-route transcript separately.
  const botCalls: Parameters<typeof room.handleBot>[] = [];
  const handleBot = room.handleBot.bind(room);
  const botSteps = vi.spyOn(room, 'handleBot').mockImplementation((...args) => {
    botCalls.push(args); return handleBot(...args);
  });
  const checkpoints: RoomState[] = [];
  let committed = 0, dirtiedRound = -1, arrivals = 0, commandId = 3, frozenArrivals = 0;
  const sent = createHash('sha256'), receipts = createHash('sha256');
  const successful = new Set<string>();
  const commandTypes = new Map<number, string>();
  room.subscribe(state => {
    if (state.settlements.length > committed) { committed = state.settlements.length; checkpoints.push(state); }
  });
  try {
    for (; room.state.phase !== 'ended' && arrivals < 100_000; arrivals++) {
      const state = room.state, seat = state.seats[0]!;
      // Every PvE round exercises a stale staged plan, including the late, expensive rounds.
      if (state.phase === 'battle' && state.roundKind === 'pve' && dirtiedRound !== state.round) {
        dirtiedRound = state.round;
        const living = state.seats.find(candidate => candidate.alive)!;
        room.handleBot(living.seatId, living.controlEpoch, { type: 'shopLock', locked: !living.match.shop.locked, generation: living.match.shop.generation });
      }
      const slot = Math.max(0, seat.match.shop.slots.findIndex(offer => offer.status === 'available'));
      const unit = seat.match.preparation.units.find(candidate => candidate.team === 'player' && candidate.location.kind === 'bench');
      const commands: SeatCommand[] = [
        { type: 'buy', slot, generation: seat.match.shop.generation },
        { type: 'sell', unitId: unit?.id ?? 'missing-unit' },
        { type: 'reroll' },
        { type: 'shopLock', locked: !seat.match.shop.locked, generation: seat.match.shop.generation },
      ];
      const command = commands[arrivals % commands.length]!;
      const message = { type: 'command', commandId: commandId++, roomId: state.roomId, round: state.round,
        seatRevision: room.state.seats[0]!.seatRevision, command };
      commandTypes.set(message.commandId, command.type);
      const walk = { type: 'walk', commandId: commandId++, roomId: state.roomId, scene: 'board', to: { x: arrivals % 3, y: 1 } };
      const connected = arrivals % 2 === 0;
      sent.update(JSON.stringify({ message, walk, connected }));
      socket.receive(message);
      socket.receive(walk);
      room.setConnected(seat.seatId, connected);
      if ((room as unknown as { settlementFrozen: boolean }).settlementFrozen) frozenArrivals++;
      expect(clock.fireNext()).toBe(true);
      for (const result of socket.messages) if (result.type === 'receipt' && result.commandId >= 3) {
        receipts.update(JSON.stringify(result));
        if (result.ok) successful.add(commandTypes.get(result.commandId)!);
        commandTypes.delete(result.commandId);
      }
      socket.messages.length = 0; // Keep full-match transport observations bounded, without trimming domain ledgers.
      yield room.state.round;
    }
    expect(room.state.phase).toBe('ended');
    expect(room.state.fault).toBeNull();
    expect(room.state.ranking?.map(entry => entry.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(room.state.round).toBeGreaterThanOrEqual(31);
    expect(new Set(botCalls.map(([id]) => id)).size).toBe(8);
    expect(frozenArrivals).toBeGreaterThanOrEqual(minFrozen);
    expect(successful).toEqual(new Set(['buy', 'sell', 'reroll', 'shopLock']));
    expect(commandTypes.size).toBe(0); // Every admitted command receives a final receipt, including the terminal round.
    expect(room.retained.resolving).toBe(false);
    const ledger = createHash('sha256');
    // Hash whole RoomStates, including every battle event, pool/RNG, receipt, revision and deadline; omit nothing.
    for (const checkpoint of checkpoints) {
      ledger.update(JSON.stringify(checkpoint) + '\n');
      yield room.state.round;
    }
    const result = { terminal: createHash('sha256').update(JSON.stringify(room.state)).digest('hex'),
      ledger: ledger.digest('hex'), commands: sent.digest('hex'), receipts: receipts.digest('hex'),
      bots: createHash('sha256').update(JSON.stringify(botCalls)).digest('hex'), arrivals, round: room.state.round, frozenArrivals };
    console.info('settlement full-match evidence', JSON.stringify(result));
    return result;
  } finally { botSteps.mockRestore(); await server.close(); }
}

/** Two complete independent runs, continued per round with all original terminal evidence checks. */
export function registerBusyMatch(connect: (socket: EventEmitter) => void, streaming: boolean, minFrozen: number) {
  const runs = [busyMatchSteps(connect, streaming, minFrozen), busyMatchSteps(connect, streaming, minFrozen)];
  const cursors: Awaited<ReturnType<typeof runs[number]['next']>>[] = [];
  async function through(index: number, round: number, callbacks = streaming ? 16 : 2) {
    const run = runs[index]!;
    let cursor = cursors[index] ?? await run.next();
    for (let fired = 0; !cursor.done && cursor.value <= round && fired < callbacks; fired++) cursor = await run.next();
    cursors[index] = cursor;
    return cursor;
  }
  afterAll(async () => { for (const run of runs) await run.return(undefined as never); });
  // The route normally ends in stage 7; later cases also support overtime without replaying earlier rounds.
  for (let index = 0; index < runs.length; index++) for (let round = 1; round <= 60; round++) for (let part = 1; part <= (streaming ? 32 : 64); part++) {
    it(`streaming=${streaming}: run ${index + 1} toward round ${round}, part ${part}`, async () => { await through(index, round); });
  }
  it(`finishes deterministically with eight bot controllers and continuous authenticated human traffic (streaming=${streaming})`, async () => {
    const first = await through(0, Infinity, Infinity), second = await through(1, Infinity, Infinity);
    expect(first.done).toBe(true); expect(second.done).toBe(true);
    expect(first.value).toEqual(second.value);
  });
}
