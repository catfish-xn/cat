import { expect, it } from 'vitest';
import { applyCombatReplayTick, createCombatReplayRecorder, toCombatViewState } from '../src/simulation/combat-replay-view';
import { stepCombat } from '../src/simulation/combat';
import { createMatch, startMatchCombat } from '../src/simulation/match';
import { mirrorReplayTick, mirrorViewState, toCombatReplayFor, startReplaySpotCheck } from '../src/server/room/projection';
import { freeze } from './combat-helpers';
import type { CombatState, CombatUnit } from '../src/simulation/combat-types';

function fixture(): CombatState {
  const base = createMatch(42);
  const result = startMatchCombat({ ...base, preparation: { ...base.preparation,
    units: [{ id: 'holder', definitionId: 'steb', team: 'player', starLevel: 1,
      location: { kind: 'board', cell: { col: 3, row: 6 } } }, ...base.preparation.units.filter(u => u.team === 'enemy')] },
    items: ['first', 'second'].map((id, slot) => ({ id, definitionId: 'titans-resolve',
      location: { kind: 'unit' as const, unitId: 'holder', slot } })) });
  if (!result.ok || !result.state.combat) throw Error(result.ok ? 'missing-combat' : result.reason);
  return { ...result.state.combat, units: [...result.state.combat.units].sort((a, b) => Number(b.team === 'player') - Number(a.team === 'player')).map((unit, i) => ({ ...unit,
    cell: { col: 3, row: i === 0 ? 4 : 3 }, hp: 100000, maxHp: 100000, attackDamage: 1 })) };
}
it('projects independent item counters and declared caps without mutating authoritative state', () => {
  let stepped = fixture();
  for (let i = 0; i < 25 && !stepped.units.find(u => u.id === 'holder')!.triggerLedger; i++) stepped = stepCombat(stepped).state;
  const holder = stepped.units.find(u => u.id === 'holder')!;
  const runtimes = holder.triggerLedger!.runtimes.map(r => ({ ...r, counters: 'stacks' in r.counters
    ? { ...r.counters, stacks: r.source.instanceId === 'first' ? 25 : 7 } : r.counters }));
  const state = freeze({ ...stepped, units: stepped.units.map(u => u.id === holder.id ? { ...holder, triggerLedger: { ...holder.triggerLedger!, runtimes } } : u) });
  const before = JSON.stringify(state), view = toCombatViewState(state);
  expect(view.units.find(u => u.id === 'holder')!.itemStacks).toEqual([
    { instanceId: 'first', definitionId: 'titans-resolve', stacks: 25, maxStacks: 25 },
    { instanceId: 'second', definitionId: 'titans-resolve', stacks: 7, maxStacks: 25 },
  ]);
  expect(JSON.stringify(state)).toBe(before);
  expect(toCombatViewState({ ...state, units: [{ ...holder, itemPrograms: [] }] }).units[0].itemStacks).toEqual([]);
  expect(JSON.stringify(view)).not.toMatch(/triggerLedger|counters|itemPrograms/);
});
it('live replay diffs, keyframes, JSON transport and mirrored seats preserve counters at each tick', () => {
  let state = fixture();
  const recorder = createCombatReplayRecorder(state, []);
  let view = recorder.initial, mirrored = mirrorViewState(view, state.board.rows);
  expect(view.units[0].itemStacks!.map(row => row.stacks)).toEqual([0, 0]);
  for (let i = 0; i < 25; i++) {
    const next = stepCombat(state), frame = JSON.parse(JSON.stringify(recorder.record(state, next)));
    view = applyCombatReplayTick(view, frame);
    mirrored = applyCombatReplayTick(mirrored, mirrorReplayTick(frame, state.board.rows));
    expect(view).toEqual(toCombatViewState(next.state));
    expect(mirrored).toEqual(mirrorViewState(view, state.board.rows));
    state = next.state;
  }
  expect(view.units.find(u => u.id === 'holder')!.itemStacks!.every(row => row.stacks > 0)).toBe(true);
});
it('wanted marks use the existing list, survive the owner dying and clear on target death or list removal', () => {
  const initial = fixture();
  const g22 = { initialized: true, rebelTriggered: false, wanted: [initial.units[1].id], wantedDeaths: 0,
    mordeUntilTick: 0, reaveUntilTick: 0, reaveBps: 0, exposureFromTick: 0, exposureUntilTick: 0, exposureBps: 0 };
  const owner: CombatUnit = { ...initial.units[0], alive: false, hp: 0, g22 };
  const state = { ...initial, units: [owner, initial.units[1]] };
  expect(toCombatViewState(state).units.map(u => u.enforcerWanted)).toEqual([false, true]);
  expect(toCombatViewState({ ...state, units: [owner, { ...initial.units[1], alive: false, hp: 0 }] }).units[1].enforcerWanted).toBe(false);
  const recorder = createCombatReplayRecorder(state, []);
  const next = { ...state, tick: 1, units: [{ ...owner, g22: { ...g22, wanted: [] } }, initial.units[1]] };
  const frame = recorder.record(state, { state: next, events: [] });
  expect(applyCombatReplayTick(recorder.initial, frame).units[1].enforcerWanted).toBe(false);
});
it('an empty display field clears old badges and legacy frames without new optional fields still apply', () => {
  const view = toCombatViewState(fixture());
  const units = view.units.map(({ itemStacks: _stacks, enforcerWanted: _wanted, ...unit }) => unit);
  const legacy = { ...view, units };
  const update = { tick: 1, events: [{ type: 'unitUpdated' as const, unitId: 'holder', changes: { hp: 90 } }] };
  expect(applyCombatReplayTick(legacy, update).units[0].itemStacks).toBeUndefined();
  expect(applyCombatReplayTick(view, { tick: 1, events: [{ type: 'unitUpdated', unitId: 'holder', changes: { itemStacks: [] } }] }).units[0].itemStacks).toEqual([]);
});

import { statusIcons } from '../src/presentation/status-icons';
import type { RoomState } from '../src/server/room/types';
import { CombatStream } from '../src/server/room/combat-stream';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { combatItemStackBadges } from '../src/presentation/battle-equipment';
it('online PvP streams deliver Titan slots and wanted marks to both seats and reconnect keyframes', () => {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  const state = { ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round }, level: 3, nextUnitSerial: 3, nextItemSerial: 3,
    preparation: { ...base.preparation, units: ['steb', 'maddie'].map((definitionId, i) => ({ id: `unit-${i + 1}`, definitionId,
      team: 'player' as const, starLevel: 1 as const, location: { kind: 'board' as const, cell: { col: 3 + i, row: 4 } } })) },
    items: [2, 0].map(slot => ({ id: `item-${slot === 2 ? 2 : 1}`, definitionId: 'titans-resolve', location: { kind: 'unit' as const, unitId: 'unit-1', slot } })) };
  const stream = new CombatStream({ battleId: 'display-online', roomId: 'test', round: state.round, roundId: state.roundDefinitionId,
    roundKind: 'pvp', roomRevision: 1, battleSeed: 42, maxSteps: 1201,
    seats: [{ seatId: 'A', state }, { seatId: 'B', state }], mirrorOf: null });
  for (let i = 0; i < 20; i++) stream.advancePvp();
  for (const seatId of ['A', 'B']) {
    const replay = JSON.parse(JSON.stringify(stream.view(seatId)!));
    const holder = replay.initial.units.find((u: CombatUnit) => u.definitionId === 'steb' && u.team === 'player');
    expect(holder.itemStacks.map((r: { slot: number }) => r.slot).sort()).toEqual([0, 2]);
    const tick1 = applyCombatReplayTick(replay.initial, replay.ticks.find((f: { tick: number }) => f.tick === 1));
    expect(tick1.units.some(u => u.enforcerWanted)).toBe(true);
    expect(statusIcons(null, tick1.units.find(u => u.enforcerWanted)!)).toContainEqual({ kind: 'enforcer-wanted', harmful: true, badge: '缉' });
    const frame = replay.ticks.find((f: { keyframe?: unknown }) => f.keyframe);
    expect(frame.keyframe.tick).toBe(20);
    const restored = applyCombatReplayTick(replay.initial, frame);
    const stacks = restored.units.find(u => u.id === holder.id)!.itemStacks!;
    expect(stacks.every(r => r.stacks > 0 && r.maxStacks === 25)).toBe(true);
    expect(stacks.map(r => r.slot).sort()).toEqual([0, 2]);
    const badges = combatItemStackBadges(['titans-resolve', 'titans-resolve'], [
      { ...stacks[0], slot: 2, stacks: 3 }, { ...stacks[1], slot: 0, stacks: 17 }]);
    expect(badges.map(b => b!.stacks)).toEqual([17, 3]);
  }
  while (!stream.done) stream.advancePvp();
  const complete = toCombatReplayFor({ battles: [stream.result!] } as unknown as RoomState, 'B')!;
  expect(complete.replay.terminal).toEqual(stream.view('B')!.terminal);
  const audit = startReplaySpotCheck([stream.result!], 0, true)!;
  expect(audit.advance(1201)?.[0].firstDifference).toBeNull();
});
