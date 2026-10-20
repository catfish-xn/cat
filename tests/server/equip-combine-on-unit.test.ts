/**
 * 2026-10-20 user point 1: crafting stays possible on a hero, not only on the item bench. Online, dropping a component on a
 * unit that already holds one sends the plain `equip` command; the room passes it to the rules' `equipItem`, which combines
 * the two components in place (the dropped slot does not matter). The room adds nothing of its own.
 */
import { describe, expect, it } from 'vitest';
import { applySeatCommand, ROOM_COMMAND_GATE } from '../../src/server/room/room';
import type { MatchState } from '../../src/simulation/match-types';
import { makeRoom } from './helpers';

describe('equip combines two components on a unit through the room', () => {
  it('is open in preparation and the battle phases', () => {
    for (const phase of ['preparation', 'choice', 'battle'] as const) expect(ROOM_COMMAND_GATE[phase].has('equip'), phase).toBe(true);
  });
  it('a component dropped on a unit holding a component becomes the completed item on that unit', () => {
    const { room } = makeRoom();
    room.start();
    const base = room.state.seats[0]!.match;
    const unit = base.preparation.units.find(candidate => candidate.team === 'player')!;
    const match = { ...base, nextItemSerial: 900, items: [...base.items,
      { id: 'item-801', definitionId: 'bow', location: { kind: 'inventory' } },
      { id: 'item-802', definitionId: 'rod', location: { kind: 'inventory' } },
    ] } as unknown as MatchState;
    const first = applySeatCommand(room.state.pool, match, { type: 'equip', itemId: 'item-801', unitId: unit.id, slot: 0 });
    expect(first.ok).toBe(true);
    // Any target slot: the rules move the second component onto the worn one.
    const second = applySeatCommand(first.pool, first.state, { type: 'equip', itemId: 'item-802', unitId: unit.id, slot: 2 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.events.some(event => event.type === 'itemCombined' && event.definitionId === 'rageblade')).toBe(true);
    const held = second.state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unit.id);
    expect(held.map(item => item.definitionId)).toEqual(['rageblade']);
    expect(second.state.items.some(item => item.id === 'item-801' || item.id === 'item-802')).toBe(false);
  });
});
