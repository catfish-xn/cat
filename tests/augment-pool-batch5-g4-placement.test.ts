import { expect, it } from 'vitest';
import { createMatch, type MatchState } from '../src/simulation/match';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, startTwoSidedCombatWithEvents, startTwoSidedBattle } from '../src/simulation/two-sided-battle';
import { stepCombat } from '../src/simulation/combat';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { occupiesCell } from '../src/simulation/anomalies/availability';
import { voidFixture } from './augment-pool-batch5-g4-helpers';
import { castB5Voidcaller, spawnB5Voidlings, type B5VoidcallerCounter, type B5VoidlingBirth } from '../src/simulation/augment-pool-batch5-g4';

// Legal battle assets, separate from Match acquisition/history fixtures.
function side(seatId: string, definitions: readonly string[], cells: readonly (readonly [number, number])[], equipment: readonly (readonly string[])[], augment = false) {
  const base = createMatch(0), round = getMultiplayerRoundByOrdinal(19);
  const units: MatchState['preparation']['units'] = definitions.map((definitionId, i) => ({
    id: `unit-${i + 1}`, definitionId, starLevel: 1, team: 'player', location: { kind: 'board', cell: { col: cells[i][0], row: cells[i][1] } },
  }));
  let serial = 1;
  const state: MatchState = { ...base, round: round.ordinal, roundDefinitionId: round.roundId, level: 8, phase: 'preparation', combat: null, pendingChoice: null,
    items: equipment.flatMap((items, i) => items.map((definitionId, slot) => ({
      id: `item-${serial++}`, definitionId, location: { kind: 'unit' as const, unitId: units[i].id, slot },
    }))), nextUnitSerial: units.length + 1, nextItemSerial: serial, preparation: { ...base.preparation, units }, m8: { ...base.m8, round },
    augments: augment ? [{ definitionId: 'voidcaller', choiceId: 'fixture', acquiredRound: 4 }] : [],
  };
  return snapshotForBattle(state, seatId);
}

it('B5-72 two-sided casts publish safely after Smeech jumps into the preselected birth cell', () => {
  const a = side('A', ['rell', 'nunu', 'vex', 'smeech'], [[1, 4], [4, 4], [3, 4], [2, 5]], [
    ['blue-buff', 'protectors-vow'], ['blue-buff', 'protectors-vow', 'tear'], ['blue-buff', 'protectors-vow'], ['protectors-vow', 'protectors-vow'],
  ], true);
  const b = side('B', ['amumu', 'maddie', 'kogmaw', 'irelia'], [[1, 4], [3, 5], [2, 5], [4, 4]], [['warmog'], [], ['warmog'], ['warmog']]);
  const input = compileBattle(a, b, 17), initial = startTwoSidedCombatWithEvents(input).state;
  expect(initial.units.filter(u => u.team === 'player').map(u => u.maxMana)).toEqual([90, 125, 60, 80]);
  expect(initial.units.filter(u => u.team === 'player').map(u => u.mana)).toEqual([90, 125, 60, 80]);
  const next = stepCombat(initial);
  const casters = next.events.flatMap(e => e.type === 'cast' && 'receipt' in e && e.receipt.source.ownerId.startsWith('["t2","A"') ? [e.receipt.actualManaSpent] : []);
  expect(casters).toEqual([90, 125, 60, 80]);
  const smeech = next.state.units.find(u => u.definitionId === 'smeech')!;
  expect(smeech.cell).toEqual({ col: 2, row: 3 });
  const birth = next.events.find(e => e.type === 'unitSpawned' && e.definitionId === 'b5-voidling');
  expect(birth).toMatchObject({ tick: 1, team: 'player', cell: { col: 3, row: 3 } });
  expect(next.state.voidcaller).toEqual([{ team: 'player', remainder: 0, summoned: 1 }]);
  const occupied = next.state.units.filter(u => occupiesCell(u, next.state.tick)).map(u => `${u.cell.col},${u.cell.row}`);
  expect(new Set(occupied).size).toBe(occupied.length);
  const newborn = next.state.units.find(u => u.definitionId === 'b5-voidling')!;
  expect(newborn.startingCell).toEqual(newborn.cell);
  expect(next.events.some(e => e.type === 'attack' && e.attackerId === newborn.id || e.type === 'movement' && e.unitId === newborn.id)).toBe(false);
  const task = startTwoSidedBattle(input);
  expect(task.advance(1)).toBeNull();
  const result = task.advance(1200);
  expect(result?.terminal.status).toBe('finished');
  expect(result?.events.filter(e => e.type === 'unitSpawned' && e.definitionId === 'b5-voidling' && e.tick === 1)).toEqual([birth]);
});

it('B5-72 a board filled after planning skips birth without spending a summon slot, and the next birth reuses its ordinal', () => {
  const { ctx, initial, rell } = voidFixture(), counters: B5VoidcallerCounter[] = [], births: B5VoidlingBirth[] = [];
  castB5Voidcaller(ctx, rell, 300, counters, births);
  expect(births).toHaveLength(1);
  ctx.units = Array.from({ length: 56 }, (_, i) => ({ ...rell, id: `block-${i}`, cell: { col: i % 7, row: Math.floor(i / 7) } }));
  spawnB5Voidlings(ctx, initial.state, births, counters);
  expect(counters).toEqual([{ team: 'player', remainder: 25, summoned: 0 }]);
  expect(ctx.units).toHaveLength(56); expect(ctx.events).toEqual([]);
  ctx.units.pop(); births.length = 0;
  castB5Voidcaller(ctx, rell, 250, counters, births);
  spawnB5Voidlings(ctx, initial.state, births, counters);
  expect(counters).toEqual([{ team: 'player', remainder: 0, summoned: 1 }]);
  expect(ctx.units.filter(u => u.definitionId === 'b5-voidling')).toMatchObject([{ id: JSON.stringify(['b5-voidling', 'player', rell.mechanics!.find(m => m.mechanic === 'voidcaller')!.source.instanceId, 1]), cell: { col: 6, row: 7 } }]);
  expect(ctx.events.filter(e => e.type === 'unitSpawned')).toHaveLength(1);
});
