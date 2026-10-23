import { expect, it } from 'vitest';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  toCombatReplay, applyCombatReplayTick, type MatchState } from '../src/server-entry';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { CombatStream } from '../src/server/room/combat-stream';
import { mirrorCombatReplay, toCombatReplayFor } from '../src/server/room/projection';
import type { BattleInput, RoomState } from '../src/server/room/types';
import type { ServerMessage } from '../src/server/net/messages';
import { deployMatchUnit, equipItem, sellUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';

function preparation(definitionId = 'ambessa'): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  return { ...base, level: 9, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round },
    items: ['blue-buff', 'warmog', 'bramble-vest'].map((definitionId, slot) => ({ id: `item-${slot + 1}`, definitionId, location: { kind: 'unit', unitId: 'unit-1', slot: slot as 0 | 1 | 2 } })),
    preparation: { ...base.preparation, units: [
      { id: 'unit-1', definitionId, team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 3, row: 6 } } },
    ] } };
}

it('strict Match save restore authenticates a real Ambessa dash and resumes the next tick exactly', () => {
  const base = createMatch(42), sold = sellUnit(base, base.preparation.units.find(u => u.team === 'player')!.id);
  if (!sold.ok) throw Error(sold.reason);
  const recruit = grantMechanicUnit(sold.state, { receiptId: 'ambessa-save-unit', source: 'test', definitionId: 'ambessa' });
  if (!recruit.ok) throw Error(recruit.reason);
  const holder = recruit.state.preparation.units.find(u => u.definitionId === 'ambessa')!;
  const deployed = deployMatchUnit(recruit.state, holder.id, { kind: 'board', cell: { col: 3, row: 4 } });
  if (!deployed.ok) throw Error(deployed.reason);
  let prepared = deployed.state;
  for (const [slot, definitionId] of ['blue-buff', 'protectors-vow'].entries()) {
    const grant = grantMechanicItem(prepared, { receiptId: `ambessa-save-${slot}`, source: 'test', definitionId });
    if (!grant.ok) throw Error(grant.reason);
    const equipped = equipItem(grant.state, grant.state.items.at(-1)!.id, holder.id, slot as 0 | 1);
    if (!equipped.ok) throw Error(equipped.reason);
    prepared = equipped.state;
  }
  const start = startMatchCombat(prepared); if (!start.ok) throw Error(start.reason);
  let state = start.state, checked = false;
  while (state.phase === 'combat') {
    const next = stepMatch(state); state = next.state;
    if (next.events.some(e => e.type === 'movement' && e.reason)) {
      const restored = restoreMatch(serializeMatch(state));
      expect(restored).toEqual(state);
      expect(stepMatch(restored)).toEqual(stepMatch(state));
      checked = true; break;
    }
  }
  expect(checked).toBe(true);
});

it('real PvP: synchronous/sliced results and server stream/replay projection keep both dash reasons on both seats', () => {
  const state = preparation(), opponent = preparation('morgana'), envelope: BattleInput = { battleId: 'ambessa-stream', roomId: 'test', round: state.round,
    roundId: '2-1', roundKind: 'pvp', roomRevision: 1, battleSeed: 42, maxSteps: 1201,
    seats: [{ seatId: 'A', state }, { seatId: 'B', state: opponent }], mirrorOf: null };
  const input = compileBattle(snapshotForBattle(state, 'A'), snapshotForBattle(opponent, 'B'), 42, { battleId: envelope.battleId });
  const full = resolveTwoSidedBattle(input, 1201), replay = toCombatReplay(full);
  for (const budget of [1, 7]) {
    const task = startTwoSidedBattle(input); let sliced = null;
    while (!sliced) sliced = task.advance(budget);
    expect(sliced).toEqual(full);
  }
  const stream = new CombatStream(envelope);
  expect(stream.frames).toHaveLength(1);
  while (!stream.done) stream.advancePvp();
  expect(stream.result!.battle).toEqual(full);
  const published = { battles: [stream.result!] } as unknown as RoomState;
  for (const seatId of ['A', 'B']) {
    const view = stream.view(seatId)!, expected = seatId === 'A' ? replay : mirrorCombatReplay(replay);
    expect({ initial: view.initial, ticks: view.ticks, terminal: view.terminal }).toEqual(expected);
    expect(toCombatReplayFor(published, seatId)!.replay).toEqual(expected);
    // Exact NET6 payload serialization, no socket or external network required.
    const message: ServerMessage = { type: 'combat-chunk', chunks: [{ roomId: envelope.roomId, round: state.round,
      battleId: view.battleId, revision: view.revision, seatId, watch: false,
      fromTick: 1, throughTick: stream.tick, ticks: view.ticks.slice(1) }] };
    const wire = JSON.parse(JSON.stringify(message)) as typeof message;
    const events = wire.chunks.flatMap(chunk => chunk.ticks.flatMap(frame => frame.events));
    const dashed = events.filter(e => e.type === 'movement' && e.reason);
    expect(new Set(dashed.map(e => e.type === 'movement' && e.reason))).toEqual(new Set(['ambessa-chain', 'ambessa-fist-retreat']));
    const original = full.events.filter(e => e.type === 'movement' && e.reason);
    expect(dashed).toHaveLength(original.length);
    for (const event of dashed) {
      if (event.type !== 'movement') throw Error('dash');
      const source = original.find(e => e.eventSeq === event.eventSeq)!;
      if (source.type !== 'movement') throw Error('ledger');
      const flip = (cell: { col: number; row: number }) => ({ col: cell.col, row: 7 - cell.row });
      expect(event).toEqual({ type: 'movement', tick: source.tick, eventSeq: source.eventSeq, unitId: source.unitId,
        from: seatId === 'B' ? flip(source.from) : source.from, to: seatId === 'B' ? flip(source.to) : source.to, reason: source.reason });
    }
    let played = view.initial;
    for (const frame of wire.chunks[0].ticks) played = applyCombatReplayTick(played, frame);
    expect(played).toEqual(view.terminal);
  }
});
