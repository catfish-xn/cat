import { expect, it } from 'vitest';
import { createMatch, equipItem, type MatchState } from '../src/simulation/match';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, startTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';

// These synthetic armies isolate battle-time equipment; each card's acquisition is tested through real offers separately.
it.each(['cloning-facility', 'hall-of-mirrors'])('%s preserves opening copies when their formal owners receive equipment on either online side', id => {
  const base = createMatch(42), round = getCatalogRoundById('2-1');
  const state: MatchState = { ...base, round: round.ordinal, roundDefinitionId: round.roundId, m8: { ...base.m8, round },
    augments: [{ definitionId: id, choiceId: 'round:2-1:augment', acquiredRound: 4 }],
    preparation: { ...base.preparation, units: [{ id: 'unit-1', definitionId: 'tristana', team: 'player', starLevel: 2,
      location: { kind: 'board', cell: { col: 3, row: id === 'cloning-facility' ? 6 : 4 } } }] },
    items: [{ id: 'item-1', definitionId: id === 'cloning-facility' ? 'blue-buff' : 'warmog', location: { kind: 'inventory' } }], nextItemSerial: 2 };
  for (const seatId of ['A', 'B']) {
    const input = compileBattle(snapshotForBattle(state, 'A'), snapshotForBattle(state, 'B'), 42);
    const command = { kind: 'equipment' as const, seq: 1, effectiveTick: 1, seatId, itemId: 'item-1', unitId: 'unit-1', slot: 0 };
    const task = startTwoSidedBattle(input, { beforeTick: tick => tick === 1 ? [command] : [] });
    const equipped = equipItem(state, 'item-1', 'unit-1', 0);
    expect(equipped.ok).toBe(true); if (!equipped.ok) throw new Error(equipped.reason);
    task.queueEquipment(command, equipped.state);
    const result = task.advance(1201)!; expect(result).not.toBeNull(); expect(result.inputLog).toHaveLength(1);
    const team = seatId === 'A' ? 'player' : 'enemy';
    const opening = result.initial.units.find(u => u.team === team && (u.itemSummon?.kind === 'cloning-facility' || u.r3Mirror))!;
    const copy = result.terminal.units.find(u => u.id === opening.id)!;
    expect(copy.maxMana).toBe(opening.maxMana); expect(copy.maxHp).toBe(opening.maxHp);
    expect(copy.sources).toEqual(opening.sources);
    if (id === 'hall-of-mirrors') expect(copy.equipment).toEqual([]);
    expect(proposeSettlement(JSON.parse(JSON.stringify(result)))).toEqual(proposeSettlement(result));
  }
});
