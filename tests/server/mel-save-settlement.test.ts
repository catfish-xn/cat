import { expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleInput } from '../../src/server/room/types';
import { runUntil } from './helpers';
import { disposeAfterEach, melRoom, registerMelSave } from './mel-save-settlement-helpers';

disposeAfterEach();
// stream=true runs in mel-save-settlement-stream.test.ts.
registerMelSave(false);

// Seed 42, same frozen inputs and live pool basis: scheduling itself publishes
// different historical revisions, so compare both resolvers on this exact entry.
it.each([false, true])('seed 42: streaming Mel rescue is byte-identical to full-round settlement (beforeTerminal=%s)', seedBeforeTerminal => {
  const { room, clock } = melRoom(12, null, 2, true, seedBeforeTerminal);
  const inputs = (room as unknown as { frozenInputs: readonly BattleInput[] }).frozenInputs;
  const resolver = new TwoSidedBattleResolver();
  const full = inputs.map(input => resolver.resolveBattle(input, room.state.pool));
  const expected = room.planSettlement(full), streamed = room.planSettlement(room.state.battles);
  expect(expected.ok).toBe(true); expect(streamed.ok).toBe(true);
  if (!expected.ok || !streamed.ok) throw Error('settlement refused');
  expect(streamed.settlement.seats.some(seat => seat.events.some(e => e.type === 'playerSaved'))).toBe(true);
  expect(JSON.stringify(streamed)).toBe(JSON.stringify(expected));
  runUntil(room, clock, state => state.settlements.includes('test-room:round-4'), 20_000);
  expect(room.state.fault).toBeNull();
  expect(JSON.stringify(room.state.seats.map(seat => seat.match)))
    .toBe(JSON.stringify(expected.settlement.seats.map(seat => seat.match)));
  expect(JSON.stringify(room.state.pool)).toBe(JSON.stringify(expected.settlement.pool));
}, 60_000);
